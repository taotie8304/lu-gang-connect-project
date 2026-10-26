// 鲁港通 - Word（.docx）空白表单解析：读取表头、表格标签与“标签：____”占位
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { cleanLabel, findLabelField, isValidLabel, kindForLabel } from './labels';
import { FormParseError, type RawFormField, type RawFormParse } from './types';

const ELEMENT_NODE = 1;
const BLANK_CELL = /^[\s_＿]*$/;
const TITLE_MAX_LENGTH = 60;

type CellParagraph = {
  index: number;
  text: string;
  hasCheckBox: boolean;
  hasContentControl: boolean;
};

type CellInfo = {
  text: string;
  paragraphs: CellParagraph[];
};

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
  const children = elementChildren(root as Node);
  for (const child of children) {
    if (localName(child) === name) return child;
    const nested = findFirst(child, name);
    if (nested) return nested;
  }
  return undefined;
};

const readParagraph = (
  paragraph: Element
): { text: string; hasCheckBox: boolean; hasContentControl: boolean } => {
  let text = '';
  let hasCheckBox = false;
  let hasContentControl = false;

  const walk = (node: Node): void => {
    for (const child of elementChildren(node)) {
      const name = localName(child).toLowerCase();
      if (name === 't') text += child.textContent ?? '';
      else if (name === 'tab') text += '\t';
      else if (name === 'br' || name === 'cr') text += '\n';
      else if (name === 'sdt') {
        hasContentControl = true;
        walk(child);
      } else if (name.includes('checkbox')) {
        hasCheckBox = true;
        walk(child);
      } else {
        walk(child);
      }
    }
  };

  walk(paragraph);
  return { text, hasCheckBox, hasContentControl };
};

const isBlankCell = (cell: CellInfo): boolean => BLANK_CELL.test(cell.text);

const readCell = (cell: Element): CellInfo => {
  const paragraphs = elementChildren(cell)
    .filter((child) => localName(child) === 'p')
    .map((paragraph, index) => ({ index, ...readParagraph(paragraph) }));
  return {
    text: paragraphs
      .map((paragraph) => paragraph.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    paragraphs
  };
};

const collectWarnings = (cell: CellInfo, warnings: Set<string>): void => {
  for (const paragraph of cell.paragraphs) {
    if (paragraph.hasCheckBox) {
      warnings.add('文档含复选框，自动填写只写入文字字段，请填写后自行勾选。');
    }
    if (paragraph.hasContentControl) {
      warnings.add('文档含内容控件，个别字段可能无法自动填写，请完成后检查。');
    }
  }
};

const isHeaderRow = (cells: CellInfo[]): boolean => {
  const filled = cells.filter((cell) => cell.text.trim().length > 0);
  return filled.length >= 2 && filled.every((cell) => isValidLabel(cleanLabel(cell.text)));
};

const parseTable = (
  table: Element,
  tableIndex: number,
  warnings: Set<string>
): RawFormField[] => {
  const rows = elementChildren(table)
    .filter((child) => localName(child) === 'tr')
    .map((row) =>
      elementChildren(row)
        .filter((child) => localName(child) === 'tc')
        .map(readCell)
    );

  const fields: RawFormField[] = [];

  rows.forEach((cells, rowIndex) => {
    cells.forEach((cell, cellIndex) => {
      collectWarnings(cell, warnings);
      for (const paragraph of cell.paragraphs) {
        const found = findLabelField(paragraph.text);
        if (!found) continue;
        fields.push({
          label: found.label,
          kind: kindForLabel(found.label),
          locator: {
            type: 'docx-cell-paragraph',
            table: tableIndex,
            row: rowIndex,
            cell: cellIndex,
            paragraph: paragraph.index,
            labelEnd: found.labelEnd
          }
        });
      }
    });

    const hasInlineField = cells.some((cell) =>
      cell.paragraphs.some((paragraph) => Boolean(findLabelField(paragraph.text)))
    );
    if (hasInlineField) return;

    for (let cellIndex = 0; cellIndex + 1 < cells.length; ) {
      const label = cleanLabel(cells[cellIndex].text);
      if (isValidLabel(label) && isBlankCell(cells[cellIndex + 1])) {
        fields.push({
          label,
          kind: kindForLabel(label),
          locator: {
            type: 'docx-table-cell',
            table: tableIndex,
            row: rowIndex,
            cell: cellIndex + 1
          }
        });
        cellIndex += 2;
      } else {
        cellIndex += 1;
      }
    }
  });

  if (rows.length >= 2 && isHeaderRow(rows[0]) && rows[1].every(isBlankCell)) {
    rows[0].forEach((cell, cellIndex) => {
      const label = cleanLabel(cell.text);
      if (!isValidLabel(label)) return;
      fields.push({
        label,
        kind: kindForLabel(label),
        locator: { type: 'docx-table-cell', table: tableIndex, row: 1, cell: cellIndex }
      });
    });
  }

  return fields;
};

export const parseDocxForm = async (filePath: string): Promise<RawFormParse> => {
  let xml: string;
  try {
    const zip = new AdmZip(filePath);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) throw new Error('missing document.xml');
    xml = zip.readAsText(entry, 'utf8');
  } catch {
    throw new FormParseError(
      'form_parse_failed',
      '无法读取这个 Word 文件，可能已损坏或不是 .docx 格式；请用 Word 另存为 .docx 后再试。'
    );
  }

  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const root = document.documentElement as Element | undefined;
  const body = root ? findFirst(root, 'body') : undefined;
  if (!body) {
    throw new FormParseError('form_parse_failed', '这个 Word 文件缺少正文，无法读取表单结构。');
  }

  const fields: RawFormField[] = [];
  const warnings = new Set<string>();
  let title: string | undefined;
  let tableIndex = 0;
  let paragraphIndex = 0;

  for (const child of elementChildren(body)) {
    const name = localName(child);

    if (name === 'p') {
      const paragraph = readParagraph(child);
      collectWarnings({ text: paragraph.text, paragraphs: [{ index: 0, ...paragraph }] }, warnings);

      const found = findLabelField(paragraph.text);
      if (found) {
        fields.push({
          label: found.label,
          kind: kindForLabel(found.label),
          locator: { type: 'docx-paragraph', paragraph: paragraphIndex, labelEnd: found.labelEnd }
        });
      }

      const text = paragraph.text.trim();
      if (
        !title &&
        paragraphIndex === 0 &&
        text.length > 0 &&
        text.length <= TITLE_MAX_LENGTH &&
        !/[:：]/.test(text) &&
        !/[_＿]{2,}/.test(text)
      ) {
        title = text;
      }

      paragraphIndex += 1;
      continue;
    }

    if (name === 'tbl') {
      fields.push(...parseTable(child, tableIndex, warnings));
      tableIndex += 1;
    }
  }

  if (fields.length === 0) {
    throw new FormParseError(
      'form_not_fillable',
      '没有在 Word 里找到可填写的空白位置；请确认表格中的空白格或“标签：____”占位没有被内容替换，或改用可填写 PDF。'
    );
  }

  return {
    format: 'docx',
    ...(title ? { title } : {}),
    fields,
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};
