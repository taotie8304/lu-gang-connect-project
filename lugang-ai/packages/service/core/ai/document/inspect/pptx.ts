// 鲁港通 - PowerPoint 提纲：按页序给出每页标题与文字行，供模型按页码替换文字
import { DOMParser } from '@xmldom/xmldom';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import {
  DocumentReadError,
  type DocumentOutline,
  type DocumentOutlineSlide
} from '../types';

const SLIDE_PART_PATTERN = /^ppt\/slides\/slide(\d+)\.xml$/;
const MAX_SLIDES = 60;
const MAX_SLIDE_LINES = 12;
const MAX_LINE_CHARS = 120;

const INVALID_PPTX_MESSAGE =
  '无法读取这个文件，它不是有效的 PowerPoint（.pptx）演示文稿；请确认文件没有损坏或被改过后缀名。';

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

const collectParagraphs = (node: Node, result: Element[]): void => {
  for (const child of elementChildren(node)) {
    if (localName(child) === 'p') result.push(child);
    else collectParagraphs(child, result);
  }
};

const paragraphText = (paragraph: Element): string => {
  let text = '';
  const walk = (node: Node): void => {
    for (const child of elementChildren(node)) {
      const name = localName(child);
      if (name === 't') text += child.textContent ?? '';
      else walk(child);
    }
  };
  walk(paragraph);
  return text.replace(/\s+/g, ' ').trim();
};

const inspectSlide = (xml: string, index: number): DocumentOutlineSlide | undefined => {
  try {
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const root = document.documentElement as Element | undefined;
    if (!root) return undefined;
    const paragraphs: Element[] = [];
    collectParagraphs(root, paragraphs);
    const lines = paragraphs
      .map(paragraphText)
      .filter((text) => text.length > 0)
      .map((text) => text.slice(0, MAX_LINE_CHARS));
    return {
      index,
      title: lines[0] ?? '',
      lines: lines.slice(1, MAX_SLIDE_LINES)
    };
  } catch {
    return undefined;
  }
};

export const inspectPptx = async (
  buffer: Buffer,
  common: { fileName: string; sizeBytes: number; warnings: string[] }
): Promise<DocumentOutline> => {
  if (!hasZipMagic(buffer)) throw new DocumentReadError(INVALID_PPTX_MESSAGE);
  const zip = await loadDocumentArchive(buffer);
  if (!zip.file('ppt/presentation.xml')) throw new DocumentReadError(INVALID_PPTX_MESSAGE);

  const slideParts = Object.keys(zip.files)
    .map((name) => {
      const match = SLIDE_PART_PATTERN.exec(name);
      return match ? { name, index: Number(match[1]) } : undefined;
    })
    .filter((part): part is { name: string; index: number } => part !== undefined)
    .sort((first, second) => first.index - second.index);

  if (slideParts.length === 0) throw new DocumentReadError(INVALID_PPTX_MESSAGE);

  const slides: NonNullable<DocumentOutline['slides']> = [];
  for (const [order, part] of slideParts.slice(0, MAX_SLIDES).entries()) {
    const entry = zip.file(part.name);
    if (!entry) continue;
    const slide = inspectSlide(await entry.async('string'), order + 1);
    if (slide) slides.push(slide);
  }

  return {
    format: 'pptx',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    slides,
    slideCount: slideParts.length,
    ...(slideParts.length > slides.length ? { slidesTruncated: true } : {}),
    warnings: [...common.warnings]
  };
};
