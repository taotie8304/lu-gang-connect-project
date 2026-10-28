// 鲁港通 - Word 预览模型：完整正文块 + 逐条模拟改动 + 按采用/跳过计算最终展示
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { DocumentEditOperation } from '../protocol';
import { DocumentParseError } from './types';

const ELEMENT_NODE = 1;
const MAX_PREVIEW_BLOCKS = 1200;
const MAX_PREVIEW_CHARS = 200_000;
const MAX_TABLE_ROWS = 60;
const MAX_TABLE_CELLS = 20;

const elementChildren = (node: Node): Element[] => {
  const children: Element[] = [];
  for (let index = 0; index < node.childNodes.length; index += 1) {
    const child = node.childNodes.item(index);
    if (child && child.nodeType === ELEMENT_NODE) children.push(child as Element);
  }
  return children;
};

const localName = (element: Element): string =>
  (element.localName ?? element.nodeName).replace(/^.*:/, '');

const readText = (node: Node): string => {
  let text = '';
  const walk = (current: Node): void => {
    for (const child of elementChildren(current)) {
      const name = localName(child).toLowerCase();
      if (name === 't') text += child.textContent ?? '';
      else if (name === 'tab') text += '\t';
      else if (name === 'br' || name === 'cr') text += '\n';
      else walk(child);
    }
  };
  walk(node);
  return text;
};

const readParagraphStyle = (paragraph: Element): string | undefined => {
  const properties = elementChildren(paragraph).find((child) => localName(child) === 'pPr');
  if (!properties) return undefined;
  const style = elementChildren(properties).find((child) => localName(child) === 'pStyle');
  if (!style) return undefined;
  const value = style.getAttribute('w:val') ?? style.getAttribute('val') ?? '';
  return value ? value.slice(0, 40) : undefined;
};

const readHeading = (paragraph: Element): number | undefined => {
  const style = readParagraphStyle(paragraph);
  const fromStyle = style?.match(/^heading\s*([1-6])$/i);
  if (fromStyle) return Number(fromStyle[1]);

  const properties = elementChildren(paragraph).find((child) => localName(child) === 'pPr');
  if (!properties) return undefined;
  const outline = elementChildren(properties).find((child) => localName(child) === 'outlineLvl');
  if (!outline) return undefined;
  const raw = outline.getAttribute('w:val') ?? outline.getAttribute('val');
  const level = Number(raw);
  if (!Number.isInteger(level) || level < 0 || level > 5) return undefined;
  return level + 1;
};

const readTableRows = (table: Element): string[][] =>
  elementChildren(table)
    .filter((child) => localName(child) === 'tr')
    .slice(0, MAX_TABLE_ROWS)
    .map((row) =>
      elementChildren(row)
        .filter((child) => localName(child) === 'tc')
        .slice(0, MAX_TABLE_CELLS)
        .map((cell) =>
          elementChildren(cell)
            .filter((child) => localName(child) === 'p')
            .map(readText)
            .join(' ')
        )
    );

export type PreviewParagraphBlock = {
  id: string;
  kind: 'paragraph';
  index: number;
  text: string;
  heading?: number;
};

export type PreviewTableBlock = {
  id: string;
  kind: 'table';
  index: number;
  rows: string[][];
};

export type PreviewBlock = PreviewParagraphBlock | PreviewTableBlock;

export type PreviewMark = 'pending' | 'applied';

export type PreviewTableCellMark = {
  row: number;
  cell: number;
  mark: PreviewMark;
  original: string;
};

export type PreviewParagraphView = PreviewParagraphBlock & {
  originalText?: string;
  mark?: PreviewMark;
};

export type PreviewTableView = PreviewTableBlock & {
  mark?: PreviewMark;
  cellMarks?: PreviewTableCellMark[];
};

export type PreviewBlockView = PreviewParagraphView | PreviewTableView;

export type PreviewChangeStatus = 'pending' | 'applied' | 'skipped' | 'unavailable';

export type PreviewChange = {
  index: number;
  target: string;
  section?: string;
  before: string;
  after: string;
  status: PreviewChangeStatus;
  scope: 'paragraph' | 'document' | 'table' | 'none';
  paragraph?: number;
  table?: { index: number; row: number; cell: number };
  note?: string;
};

export type DocxPreviewModel = { xml: string; blocks: PreviewBlock[] };

const readDocumentXml = async (filePath: string): Promise<string> => {
  try {
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) throw new Error('missing document.xml');
    return zip.readAsText(entry, 'utf8');
  } catch {
    throw new DocumentParseError(
      'document_parse_failed',
      '无法读取这个 Word 文件，可能已损坏或不是 .docx 格式；请用 Word 另存为 .docx 后再试。'
    );
  }
};

const findBody = (xml: string): Element => {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const root = document.documentElement as Element | undefined;
  const body = root ? elementChildren(root).find((child) => localName(child) === 'body') : undefined;
  if (!body) {
    throw new DocumentParseError(
      'document_parse_failed',
      '这个 Word 文件缺少正文，无法读取段落结构。'
    );
  }
  return body;
};

export const parseDocxBlocks = (xml: string): PreviewBlock[] => {
  const body = findBody(xml);
  const blocks: PreviewBlock[] = [];
  let paragraphIndex = 0;
  let tableIndex = 0;
  let chars = 0;

  for (const child of elementChildren(body)) {
    const name = localName(child);
    if (name !== 'p' && name !== 'tbl') continue;
    if (blocks.length >= MAX_PREVIEW_BLOCKS) {
      throw new DocumentParseError(
        'document_parse_failed',
        '这份文档内容较多，暂时无法在右栏完整预览；可以改在确认窗里逐条查看。'
      );
    }

    if (name === 'p') {
      const text = readText(child);
      chars += text.length;
      if (chars > MAX_PREVIEW_CHARS) {
        throw new DocumentParseError(
          'document_parse_failed',
          '这份文档正文较长，暂时无法在右栏完整预览；可以改在确认窗里逐条查看。'
        );
      }
      const heading = readHeading(child);
      blocks.push({
        id: `p:${paragraphIndex}`,
        kind: 'paragraph',
        index: paragraphIndex,
        text,
        ...(heading ? { heading } : {})
      });
      paragraphIndex += 1;
      continue;
    }

    const rows = readTableRows(child);
    blocks.push({ id: `t:${tableIndex}`, kind: 'table', index: tableIndex, rows });
    tableIndex += 1;
  }

  return blocks;
};

export const extractDocxPreview = async (filePath: string): Promise<DocxPreviewModel> => {
  const xml = await readDocumentXml(filePath);
  return { xml, blocks: parseDocxBlocks(xml) };
};

const paragraphText = (model: DocxPreviewModel, index: number): string | undefined =>
  model.blocks.find(
    (block): block is PreviewParagraphBlock => block.kind === 'paragraph' && block.index === index
  )?.text;

const tableRows = (model: DocxPreviewModel, index: number): string[][] | undefined =>
  model.blocks.find(
    (block): block is PreviewTableBlock => block.kind === 'table' && block.index === index
  )?.rows;

const findSection = (model: DocxPreviewModel, paragraphIndex: number): string | undefined => {
  let heading: string | undefined;
  for (const block of model.blocks) {
    if (block.kind !== 'paragraph') continue;
    if (block.index === paragraphIndex) return block.heading ? block.text : heading;
    if (block.index > paragraphIndex) break;
    if (block.heading) heading = block.text;
  }
  return heading;
};

const findSectionBeforeTable = (model: DocxPreviewModel, tableIndex: number): string | undefined => {
  let heading: string | undefined;
  for (const block of model.blocks) {
    if (block.kind === 'table' && block.index === tableIndex) return heading;
    if (block.kind === 'paragraph' && block.heading) heading = block.text;
  }
  return heading;
};

const unavailable = (index: number, note: string): PreviewChange => ({
  index,
  target: '不适用',
  before: '',
  after: '',
  status: 'unavailable',
  scope: 'none',
  note
});

const buildChange = (
  model: DocxPreviewModel,
  operation: DocumentEditOperation,
  index: number
): PreviewChange => {
  if (operation.op === 'replace_text') {
    if (operation.sheet) {
      return unavailable(index, '「按工作表替换」只适用于 Excel，Word 文档会跳过这一条。');
    }
    if (operation.paragraph !== undefined) {
      const before = paragraphText(model, operation.paragraph);
      if (before === undefined) {
        return unavailable(index, `第 ${operation.paragraph + 1} 段在文档里不存在。`);
      }
      return {
        index,
        target: `第 ${operation.paragraph + 1} 段`,
        section: findSection(model, operation.paragraph),
        before: operation.find,
        after: operation.replace,
        status: 'pending',
        scope: 'paragraph',
        paragraph: operation.paragraph
      };
    }

    const hit = model.blocks.some(
      (block) =>
        block.kind === 'paragraph' && block.text.includes(operation.find)
    );
    if (!hit) {
      return unavailable(index, `没有找到「${operation.find}」，这一条会跳过。`);
    }
    return {
      index,
      target: '全篇',
      before: operation.find,
      after: operation.replace,
      status: 'pending',
      scope: 'document'
    };
  }

  if (operation.op === 'set_paragraph') {
    const before = paragraphText(model, operation.paragraph);
    if (before === undefined) {
      return unavailable(index, `第 ${operation.paragraph + 1} 段在文档里不存在。`);
    }
    return {
      index,
      target: `第 ${operation.paragraph + 1} 段`,
      section: findSection(model, operation.paragraph),
      before,
      after: operation.text,
      status: 'pending',
      scope: 'paragraph',
      paragraph: operation.paragraph
    };
  }

  if (operation.op === 'insert_paragraph') {
    if (paragraphText(model, operation.after) === undefined) {
      return unavailable(index, `第 ${operation.after + 1} 段在文档里不存在。`);
    }
    return {
      index,
      target: `第 ${operation.after + 1} 段之后`,
      section: findSection(model, operation.after),
      before: '',
      after: operation.text,
      status: 'pending',
      scope: 'paragraph',
      paragraph: operation.after
    };
  }

  if (operation.op === 'append_paragraph') {
    const last = model.blocks.filter(
      (block): block is PreviewParagraphBlock => block.kind === 'paragraph'
    ).at(-1);
    return {
      index,
      target: '文末',
      section: last ? findSection(model, last.index) : undefined,
      before: '',
      after: operation.text,
      status: 'pending',
      scope: 'paragraph'
    };
  }

  if (operation.op === 'set_table_cell') {
    const rows = tableRows(model, operation.table);
    if (!rows) {
      return unavailable(index, `第 ${operation.table + 1} 张表在文档里不存在。`);
    }
    const before = rows[operation.row]?.[operation.cell];
    if (before === undefined) {
      return unavailable(
        index,
        `第 ${operation.table + 1} 张表的第 ${operation.row + 1} 行第 ${operation.cell + 1} 格不存在。`
      );
    }
    return {
      index,
      target: `第 ${operation.table + 1} 张表 第 ${operation.row + 1} 行第 ${operation.cell + 1} 格`,
      section: findSectionBeforeTable(model, operation.table),
      before,
      after: operation.text,
      status: 'pending',
      scope: 'table',
      table: { index: operation.table, row: operation.row, cell: operation.cell }
    };
  }

  return unavailable(index, '单元格与追加行操作只适用于 Excel，Word 文档会跳过这一条。');
};

export const buildPreviewChanges = (
  model: DocxPreviewModel,
  operations: DocumentEditOperation[]
): PreviewChange[] => operations.map((operation, index) => buildChange(model, operation, index));

const mergeMark = (current: PreviewMark | undefined, next: PreviewMark): PreviewMark =>
  current === 'pending' || next === 'pending' ? 'pending' : 'applied';

type ParagraphState = { text: string; original: string; mark?: PreviewMark };
type TableState = { rows: string[][]; cellMarks: PreviewTableCellMark[] };

export const computePreviewBlocks = (
  model: DocxPreviewModel,
  operations: DocumentEditOperation[],
  changes: PreviewChange[]
): PreviewBlockView[] => {
  const paragraphs = new Map<number, ParagraphState>();
  for (const block of model.blocks) {
    if (block.kind === 'paragraph') {
      paragraphs.set(block.index, { text: block.text, original: block.text });
    }
  }
  const tables = new Map<number, TableState>();
  for (const block of model.blocks) {
    if (block.kind === 'table') {
      tables.set(block.index, { rows: block.rows.map((row) => [...row]), cellMarks: [] });
    }
  }

  const inserts = new Map<number, Array<{ text: string; mark: PreviewMark; id: string }>>();
  const appends: Array<{ text: string; mark: PreviewMark; id: string }> = [];

  operations.forEach((operation, index) => {
    const change = changes[index];
    if (!change || (change.status !== 'pending' && change.status !== 'applied')) return;
    const mark: PreviewMark = change.status;

    if (operation.op === 'replace_text') {
      const targets =
        operation.paragraph !== undefined
          ? [operation.paragraph]
          : [...paragraphs.entries()]
              .filter(([, state]) => state.text.includes(operation.find))
              .map(([paragraphIndex]) => paragraphIndex);
      for (const target of targets) {
        const state = paragraphs.get(target);
        if (!state) continue;
        const next = state.text.split(operation.find).join(operation.replace);
        if (next === state.text) continue;
        state.text = next;
        state.mark = mergeMark(state.mark, mark);
      }
      return;
    }

    if (operation.op === 'set_paragraph') {
      const state = paragraphs.get(operation.paragraph);
      if (!state) return;
      state.text = operation.text;
      state.mark = mergeMark(state.mark, mark);
      return;
    }

    if (operation.op === 'insert_paragraph') {
      const list = inserts.get(operation.after) ?? [];
      list.push({ text: operation.text, mark, id: `ins:${index}` });
      inserts.set(operation.after, list);
      return;
    }

    if (operation.op === 'append_paragraph') {
      appends.push({ text: operation.text, mark, id: `append:${index}` });
      return;
    }

    if (operation.op === 'set_table_cell') {
      const state = tables.get(operation.table);
      const row = state?.rows[operation.row];
      if (!state || !row || row[operation.cell] === undefined) return;
      const existing = state.cellMarks.find(
        (item) => item.row === operation.row && item.cell === operation.cell
      );
      if (existing) {
        existing.mark = mergeMark(existing.mark, mark);
        existing.original = row[operation.cell];
      } else {
        state.cellMarks.push({
          row: operation.row,
          cell: operation.cell,
          mark,
          original: row[operation.cell]
        });
      }
      row[operation.cell] = operation.text;
    }
  });

  const result: PreviewBlockView[] = [];
  for (const block of model.blocks) {
    if (block.kind === 'paragraph') {
      const state = paragraphs.get(block.index);
      result.push({
        ...block,
        text: state?.text ?? block.text,
        ...(state?.mark
          ? { originalText: state.original, mark: state.mark }
          : {})
      });
      for (const inserted of inserts.get(block.index) ?? []) {
        result.push({
          id: `p:${block.index}:${inserted.id}`,
          kind: 'paragraph',
          index: block.index,
          text: inserted.text,
          originalText: '',
          mark: inserted.mark
        });
      }
      continue;
    }

    const state = tables.get(block.index);
    result.push({
      ...block,
      rows: state?.rows ?? block.rows,
      ...(state?.cellMarks.length ? { cellMarks: state.cellMarks } : {})
    });
  }

  const lastParagraph = [...paragraphs.keys()].sort((a, b) => b - a)[0];
  for (const appended of appends) {
    result.push({
      id: `p:${lastParagraph ?? 0}:${appended.id}`,
      kind: 'paragraph',
      index: (lastParagraph ?? -1) + 1,
      text: appended.text,
      originalText: '',
      mark: appended.mark
    });
  }

  return result;
};
