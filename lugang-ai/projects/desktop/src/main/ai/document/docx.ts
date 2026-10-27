// 鲁港通 - Word 文档提纲：正文段落按顺序编号，表格单独编号，供服务端指定改动位置
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { DocumentParseError, type RawDocumentOutline } from './types';

const ELEMENT_NODE = 1;
const MAX_PARAGRAPHS = 300;
const MAX_PARAGRAPH_PREVIEW = 120;
const MAX_TABLES = 20;
const MAX_TABLE_HEADER_CELLS = 8;
const MAX_CELL_PREVIEW = 60;

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

const readParagraphText = (paragraph: Element): string => {
  let text = '';
  const walk = (node: Node): void => {
    for (const child of elementChildren(node)) {
      const name = localName(child).toLowerCase();
      if (name === 't') text += child.textContent ?? '';
      else if (name === 'tab') text += '\t';
      else if (name === 'br' || name === 'cr') text += '\n';
      else walk(child);
    }
  };
  walk(paragraph);
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

const previewText = (text: string, maxLength: number): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, maxLength);

const readTableRow = (row: Element): string[] =>
  elementChildren(row)
    .filter((child) => localName(child) === 'tc')
    .map((cell) =>
      previewText(
        elementChildren(cell)
          .filter((child) => localName(child) === 'p')
          .map(readParagraphText)
          .join(' '),
        MAX_CELL_PREVIEW
      )
    );

export const parseDocxDocument = async (filePath: string): Promise<RawDocumentOutline> => {
  let xml: string;
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) throw new Error('missing document.xml');
    xml = zip.readAsText(entry, 'utf8');
  } catch {
    throw new DocumentParseError(
      'document_parse_failed',
      '无法读取这个 Word 文件，可能已损坏或不是 .docx 格式；请用 Word 另存为 .docx 后再试。'
    );
  }

  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const root = document.documentElement as Element | undefined;
  const body = root ? elementChildren(root).find((child) => localName(child) === 'body') : undefined;
  if (!body) {
    throw new DocumentParseError(
      'document_parse_failed',
      '这个 Word 文件缺少正文，无法读取段落结构。'
    );
  }

  const paragraphs: RawDocumentOutline['paragraphs'] = [];
  const tables: NonNullable<RawDocumentOutline['tables']> = [];
  let paragraphIndex = 0;
  let tableIndex = 0;

  for (const child of elementChildren(body)) {
    const name = localName(child);
    if (name === 'p') {
      const text = previewText(readParagraphText(child), MAX_PARAGRAPH_PREVIEW);
      if (paragraphs.length < MAX_PARAGRAPHS) {
        const style = readParagraphStyle(child);
        paragraphs.push({ index: paragraphIndex, text, ...(style ? { style } : {}) });
      }
      paragraphIndex += 1;
      continue;
    }
    if (name === 'tbl') {
      if (tables.length < MAX_TABLES) {
        const rows = elementChildren(child).filter((item) => localName(item) === 'tr');
        const rowTexts = rows.map(readTableRow);
        tables.push({
          index: tableIndex,
          rows: rows.length,
          cells: rowTexts.reduce((max, row) => Math.max(max, row.length), 0),
          header: (rowTexts[0] ?? []).slice(0, MAX_TABLE_HEADER_CELLS)
        });
      }
      tableIndex += 1;
    }
  }

  const warnings: string[] = [];
  if (/<w:(?:ins|del)[\s>]/.test(xml)) {
    warnings.push('文档含修订记录，副本会按当前显示内容生成，修订痕迹可能不保留。');
  }
  const comments = zip.getEntry('word/comments.xml');
  if (comments && comments.getData().length > 0) {
    warnings.push('文档含批注，编辑副本时批注可能不会同步更新。');
  }
  const settings = zip.getEntry('word/settings.xml');
  if (settings && settings.getData().toString('utf8').includes('documentProtection')) {
    warnings.push('文档设置了编辑保护，副本仍会按原结构生成，请完成后检查。');
  }

  return {
    format: 'docx',
    paragraphs,
    ...(tables.length > 0 ? { tables } : {}),
    ...(paragraphIndex > paragraphs.length ? { paragraphsTruncated: true } : {}),
    ...(warnings.length > 0 ? { warnings } : {})
  };
};