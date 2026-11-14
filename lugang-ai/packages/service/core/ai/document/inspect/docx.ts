// 鲁港通 - Word 提纲：正文段落按顺序编号，表格单独编号，供模型指定改动位置
import { DOMParser } from '@xmldom/xmldom';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import { DocumentReadError, type DocumentOutline } from '../types';

const ELEMENT_NODE = 1;
const MAX_PARAGRAPHS = 300;
const MAX_PARAGRAPH_PREVIEW = 120;
const MAX_TABLES = 20;
const MAX_TABLE_HEADER_CELLS = 8;
const MAX_CELL_PREVIEW = 60;

const INVALID_DOCX_MESSAGE =
  '无法读取这个文件，它不是有效的 Word（.docx）文档；请确认文件没有损坏或被改过后缀名。';

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

export const inspectDocx = async (
  buffer: Buffer,
  common: { fileName: string; sizeBytes: number; warnings: string[] }
): Promise<DocumentOutline> => {
  if (!hasZipMagic(buffer)) throw new DocumentReadError(INVALID_DOCX_MESSAGE);
  const zip = await loadDocumentArchive(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new DocumentReadError(INVALID_DOCX_MESSAGE);

  const xml = await entry.async('string');
  let body: Element | undefined;
  try {
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const root = document.documentElement as Element | undefined;
    body = root
      ? elementChildren(root).find((child) => localName(child) === 'body')
      : undefined;
  } catch {
    body = undefined;
  }
  if (!body) throw new DocumentReadError(INVALID_DOCX_MESSAGE);

  const paragraphs: NonNullable<DocumentOutline['paragraphs']> = [];
  const tables: NonNullable<DocumentOutline['tables']> = [];
  let paragraphCount = 0;
  let tableCount = 0;

  for (const child of elementChildren(body)) {
    const name = localName(child);
    if (name === 'p') {
      if (paragraphs.length < MAX_PARAGRAPHS) {
        const style = readParagraphStyle(child);
        paragraphs.push({
          index: paragraphCount,
          text: previewText(readParagraphText(child), MAX_PARAGRAPH_PREVIEW),
          ...(style ? { style } : {})
        });
      }
      paragraphCount += 1;
      continue;
    }
    if (name === 'tbl') {
      if (tables.length < MAX_TABLES) {
        const rows = elementChildren(child).filter((item) => localName(item) === 'tr');
        const rowTexts = rows.map(readTableRow);
        tables.push({
          index: tableCount,
          rows: rows.length,
          cells: rowTexts.reduce((max, row) => Math.max(max, row.length), 0),
          header: (rowTexts[0] ?? []).slice(0, MAX_TABLE_HEADER_CELLS)
        });
      }
      tableCount += 1;
    }
  }

  const warnings = [...common.warnings];
  if (/<w:(?:ins|del)[\s>]/.test(xml)) {
    warnings.push('文档含修订记录，修改副本会按当前显示内容处理，修订痕迹可能不保留。');
  }
  const comments = zip.file('word/comments.xml');
  if (comments) warnings.push('文档含批注，修改副本时批注可能不会同步更新。');
  const settings = zip.file('word/settings.xml');
  if (settings) {
    const settingsXml = await settings.async('string');
    if (settingsXml.includes('documentProtection')) {
      warnings.push('文档设置了编辑保护，修改副本仍会按原结构生成，请完成后检查。');
    }
  }

  return {
    format: 'docx',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    paragraphs,
    paragraphCount,
    ...(paragraphCount > paragraphs.length ? { paragraphsTruncated: true } : {}),
    tables,
    tableCount,
    warnings
  };
};
