// 鲁港通 - Word 编辑：在 document.xml 上按段落/表格定位改字，保留原字体与段落样式
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { loadDocumentArchive } from '../limits';
import {
  DocumentEditError,
  type DocumentEditResult
} from '../types';

const ELEMENT_NODE = 1;
const MAX_MATCHES_PER_OP = 200;

const DOCX_UNREADABLE_MESSAGE =
  '无法读取这个 Word 文件，可能已损坏；请确认文件能正常打开后再试。';
const DOCX_EDIT_FAILED_MESSAGE =
  '修改文件没有生成成功，请重试一次；如果仍然失败，请手动修改原文件。';

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

type TextElement = { element: Element; start: number; end: number };

const collectTextElements = (paragraph: Element): { text: string; items: TextElement[] } => {
  const items: TextElement[] = [];
  let text = '';

  const walk = (node: Node): void => {
    for (const child of elementChildren(node)) {
      const name = localName(child).toLowerCase();
      if (name === 't') {
        const value = child.textContent ?? '';
        items.push({ element: child, start: text.length, end: text.length + value.length });
        text += value;
      } else if (name === 'tab') {
        text += '\t';
      } else if (name === 'br' || name === 'cr') {
        text += '\n';
      } else {
        walk(child);
      }
    }
  };

  walk(paragraph);
  return { text, items };
};

const setText = (element: Element, value: string): void => {
  const document = element.ownerDocument;
  while (element.firstChild) element.removeChild(element.firstChild);
  if (document) element.appendChild(document.createTextNode(value));
  element.setAttribute('xml:space', 'preserve');
};

const appendRun = (paragraph: Element, value: string): void => {
  const document = paragraph.ownerDocument;
  if (!document) return;
  const run = document.createElement('w:r');
  const text = document.createElement('w:t');
  text.setAttribute('xml:space', 'preserve');
  text.appendChild(document.createTextNode(value));
  run.appendChild(text);
  paragraph.appendChild(run);
};

// 鲁港通 - 只改目标范围内的字符，替换文字写进第一段文字节点，原有 run 格式因此得以保留
const replaceRange = (paragraph: Element, start: number, end: number, replacement: string): void => {
  const { items } = collectTextElements(paragraph);
  let inserted = false;
  for (const item of items) {
    if (item.end <= start || item.start >= end) continue;
    const value = item.element.textContent ?? '';
    const localStart = Math.max(0, start - item.start);
    const localEnd = Math.min(value.length, end - item.start);
    setText(
      item.element,
      value.slice(0, localStart) + (inserted ? '' : replacement) + value.slice(localEnd)
    );
    inserted = true;
  }
  if (!inserted) appendRun(paragraph, replacement);
};

const replaceInParagraph = (
  paragraph: Element,
  find: string,
  replace: string,
  limit: number
): { count: number; capped: boolean } => {
  if (limit <= 0) return { count: 0, capped: true };
  const { text } = collectTextElements(paragraph);
  const starts: number[] = [];
  let from = 0;
  while (starts.length < limit) {
    const index = text.indexOf(find, from);
    if (index < 0) break;
    starts.push(index);
    from = index + find.length;
  }
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    replaceRange(paragraph, starts[index], starts[index] + find.length, replace);
  }
  const capped = starts.length >= limit && text.indexOf(find, from) >= 0;
  return { count: starts.length, capped };
};

const writeParagraphText = (paragraph: Element, text: string): void => {
  const { items } = collectTextElements(paragraph);
  if (items.length === 0) {
    appendRun(paragraph, text);
    return;
  }
  setText(items[0].element, text);
  for (const item of items.slice(1)) setText(item.element, '');
};

const collectParagraphs = (node: Node, result: Element[]): void => {
  for (const child of elementChildren(node)) {
    if (localName(child) === 'p') {
      result.push(child);
    } else {
      collectParagraphs(child, result);
    }
  }
};

const bodyParagraphs = (body: Element): Element[] =>
  elementChildren(body).filter((child) => localName(child) === 'p');

const bodyTables = (body: Element): Element[] =>
  elementChildren(body).filter((child) => localName(child) === 'tbl');

const tableRows = (table: Element): Element[] =>
  elementChildren(table).filter((child) => localName(child) === 'tr');

const rowCells = (row: Element): Element[] =>
  elementChildren(row).filter((child) => localName(child) === 'tc');

const findChild = (element: Element, name: string): Element | undefined =>
  elementChildren(element).find((child) => localName(child) === name);

const sectionProperties = (body: Element): Element | undefined =>
  findChild(body, 'sectPr');

const runProperties = (paragraph: Element): Element | undefined => {
  for (const run of elementChildren(paragraph)) {
    if (localName(run) !== 'r') continue;
    const properties = findChild(run, 'rPr');
    if (properties) return properties;
  }
  return undefined;
};

const createParagraph = (reference: Element | undefined, text: string): Element => {
  const document = reference?.ownerDocument;
  if (!document) throw new DocumentEditError(DOCX_UNREADABLE_MESSAGE);
  const paragraph = document.createElement('w:p');
  const paragraphProperties = reference ? findChild(reference, 'pPr') : undefined;
  if (paragraphProperties) paragraph.appendChild(paragraphProperties.cloneNode(true));
  const run = document.createElement('w:r');
  const properties = reference ? runProperties(reference) : undefined;
  if (properties) run.appendChild(properties.cloneNode(true));
  const textNode = document.createElement('w:t');
  textNode.setAttribute('xml:space', 'preserve');
  textNode.appendChild(document.createTextNode(text));
  run.appendChild(textNode);
  paragraph.appendChild(run);
  return paragraph;
};

const insertAfter = (body: Element, reference: Element, paragraph: Element): void => {
  body.insertBefore(paragraph, reference.nextSibling);
};

const editTable = (
  body: Element,
  tableIndex: number,
  rowIndex: number,
  cellIndex: number,
  text: string
): boolean => {
  const table = bodyTables(body)[tableIndex];
  if (!table) return false;
  const row = tableRows(table)[rowIndex];
  if (!row) return false;
  const cell = rowCells(row)[cellIndex];
  if (!cell) return false;

  const paragraphs = elementChildren(cell).filter((child) => localName(child) === 'p');
  if (paragraphs.length === 0) return false;
  writeParagraphText(paragraphs[0], text);
  for (const paragraph of paragraphs.slice(1)) {
    for (const item of collectTextElements(paragraph).items) setText(item.element, '');
  }
  return true;
};

/** 鲁港通 - 在 document.xml 文本上执行修改项；段落编号与 read 提纲的正文直系段落一致 */
export const editDocxXml = (
  xml: string,
  operations: DocumentEditOperation[]
): { xml: string; applied: number; skipped: string[]; warnings: string[] } => {
  let document: Document;
  try {
    document = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
  } catch {
    throw new DocumentEditError(DOCX_UNREADABLE_MESSAGE);
  }
  const root = document.documentElement as Element | undefined;
  const body = root ? elementChildren(root).find((child) => localName(child) === 'body') : undefined;
  if (!body) throw new DocumentEditError(DOCX_UNREADABLE_MESSAGE);

  const paragraphs = bodyParagraphs(body);
  const skipped: string[] = [];
  const warnings = new Set<string>();
  const lastInserted = new Map<Element, Element>();
  let applied = 0;

  for (const operation of operations) {
    if (operation.op === 'replace_text') {
      if (operation.sheet) {
        skipped.push('「按工作表替换」只适用于 Excel，已跳过');
        continue;
      }
      if (operation.slide) {
        skipped.push('「按幻灯片替换」只适用于 PowerPoint，已跳过');
        continue;
      }

      const scope = operation.paragraph !== undefined ? [paragraphs[operation.paragraph]] : undefined;
      if (operation.paragraph !== undefined && !scope?.[0]) {
        skipped.push(`第 ${operation.paragraph} 段在文档里不存在，已跳过`);
        continue;
      }

      let remaining = MAX_MATCHES_PER_OP;
      let matched = 0;
      const targets: Element[] = [];
      if (scope?.[0]) targets.push(scope[0]);
      else collectParagraphs(body, targets);

      for (const paragraph of targets) {
        if (remaining <= 0) break;
        const result = replaceInParagraph(paragraph, operation.find, operation.replace, remaining);
        matched += result.count;
        remaining -= result.count;
        if (result.capped) {
          warnings.add(`替换内容出现次数较多，本次只处理了前 ${MAX_MATCHES_PER_OP} 处。`);
          break;
        }
      }

      if (matched === 0) {
        skipped.push(`没有找到「${operation.find}」，已跳过`);
      } else {
        applied += matched;
      }
      continue;
    }

    if (operation.op === 'set_paragraph') {
      const paragraph = paragraphs[operation.paragraph];
      if (!paragraph) {
        skipped.push(`第 ${operation.paragraph} 段在文档里不存在，已跳过`);
        continue;
      }
      writeParagraphText(paragraph, operation.text);
      applied += 1;
      continue;
    }

    if (operation.op === 'insert_paragraph') {
      const reference = paragraphs[operation.after];
      if (!reference) {
        skipped.push(`第 ${operation.after} 段在文档里不存在，已跳过`);
        continue;
      }
      const anchor = lastInserted.get(reference) ?? reference;
      const paragraph = createParagraph(reference, operation.text);
      insertAfter(body, anchor, paragraph);
      lastInserted.set(reference, paragraph);
      applied += 1;
      continue;
    }

    if (operation.op === 'append_paragraph') {
      const reference = paragraphs[paragraphs.length - 1];
      const paragraph = createParagraph(reference, operation.text);
      const section = sectionProperties(body);
      body.insertBefore(paragraph, section ?? null);
      applied += 1;
      continue;
    }

    if (operation.op === 'set_table_cell') {
      const done = editTable(body, operation.table, operation.row, operation.cell, operation.text);
      if (!done) {
        skipped.push(
          `第 ${operation.table} 个表格的第 ${operation.row} 行第 ${operation.cell} 格在文档里不存在，已跳过`
        );
        continue;
      }
      applied += 1;
      continue;
    }

    if (operation.op === 'set_cell' || operation.op === 'append_row') {
      skipped.push('单元格与追加行操作只适用于 Excel，已跳过');
      continue;
    }

    skipped.push('填写表单与叠加文字只适用于 PDF，已跳过');
  }

  return {
    xml: new XMLSerializer().serializeToString(document),
    applied,
    skipped,
    warnings: [...warnings]
  };
};

/** 鲁港通 - 编辑 Word：只改 word/document.xml，其余 zip 部件原样保留；未命中不产出新文件 */
export const editDocx = async ({
  buffer,
  operations
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  const zip = await loadDocumentArchive(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new DocumentEditError(DOCX_UNREADABLE_MESSAGE);

  let outcome: ReturnType<typeof editDocxXml>;
  try {
    outcome = editDocxXml(await entry.async('string'), operations);
  } catch (error) {
    if (error instanceof DocumentEditError) throw error;
    throw new DocumentEditError(DOCX_EDIT_FAILED_MESSAGE);
  }

  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对段落或文字后重试。`
    );
  }

  zip.file('word/document.xml', outcome.xml);
  let output: Buffer;
  try {
    output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  } catch {
    throw new DocumentEditError(DOCX_EDIT_FAILED_MESSAGE);
  }

  return {
    buffer: output,
    applied: outcome.applied,
    skipped: outcome.skipped,
    warnings: outcome.warnings
  };
};
