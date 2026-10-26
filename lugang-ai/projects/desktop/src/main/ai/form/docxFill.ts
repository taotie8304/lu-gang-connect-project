// 鲁港通 - Word 表单回填：按 locator 定位段落或表格单元格，只写入副本的 document.xml
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { FormFillEntry } from './types';

const ELEMENT_NODE = 1;

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

const findFirst = (root: Element | Document, name: string): Element | undefined => {
  for (const child of elementChildren(root as Node)) {
    if (localName(child) === name) return child;
    const nested = findFirst(child, name);
    if (nested) return nested;
  }
  return undefined;
};

type TextElement = { element: Element; start: number; end: number };

const collectTextElements = (
  paragraph: Element
): { text: string; items: TextElement[] } => {
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

/** 保留 labelEnd 之前的文字（标签与冒号），把之后的占位下划线替换成填写内容 */
const writeAfterLabel = (paragraph: Element, labelEnd: number, value: string): void => {
  const { items } = collectTextElements(paragraph);
  let inserted = false;
  for (const item of items) {
    if (item.end <= labelEnd) continue;
    const original = item.element.textContent ?? '';
    const keep = Math.max(0, labelEnd - item.start);
    setText(item.element, original.slice(0, keep) + (inserted ? '' : value));
    inserted = true;
  }
  if (!inserted) appendRun(paragraph, value);
};

const firstParagraph = (cell: Element): Element | undefined =>
  elementChildren(cell).find((child) => localName(child) === 'p');

const findBody = (root: Element): Element | undefined => findFirst(root, 'body');

export const fillDocxDocument = (
  xml: string,
  entries: FormFillEntry[]
): { xml: string; filled: number; skipped: string[] } => {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const root = document.documentElement as Element | undefined;
  const body = root ? findBody(root) : undefined;
  if (!body) throw new Error('missing document body');

  const bodyChildren = elementChildren(body);
  const paragraphs = bodyChildren.filter((child) => localName(child) === 'p');
  const tables = bodyChildren.filter((child) => localName(child) === 'tbl');

  let filled = 0;
  const skipped: string[] = [];

  for (const { field, value } of entries) {
    const locator = field.locator;
    let paragraph: Element | undefined;

    if (locator.type === 'docx-paragraph') {
      paragraph = paragraphs[locator.paragraph];
      if (paragraph) {
        writeAfterLabel(paragraph, locator.labelEnd, value);
        filled += 1;
        continue;
      }
    } else if (locator.type === 'docx-table-cell' || locator.type === 'docx-cell-paragraph') {
      const rows = tables[locator.table]
        ? elementChildren(tables[locator.table]).filter((child) => localName(child) === 'tr')
        : [];
      const cells = rows[locator.row]
        ? elementChildren(rows[locator.row]).filter((child) => localName(child) === 'tc')
        : [];
      const cell = cells[locator.cell];
      if (cell) {
        if (locator.type === 'docx-table-cell') {
          const target = firstParagraph(cell);
          if (target) {
            writeAfterLabel(target, 0, value);
            filled += 1;
            continue;
          }
        } else {
          const cellParagraphs = elementChildren(cell).filter(
            (child) => localName(child) === 'p'
          );
          const target = cellParagraphs[locator.paragraph];
          if (target) {
            writeAfterLabel(target, locator.labelEnd, value);
            filled += 1;
            continue;
          }
        }
      }
    }

    skipped.push(`「${field.label}」在文档里找不到对应位置，已跳过`);
  }

  return { xml: new XMLSerializer().serializeToString(document), filled, skipped };
};
