// 鲁港通 - PowerPoint 提纲：按页序给出每页标题与文字行，供模型按页码替换文字
import { DOMParser } from '@xmldom/xmldom';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import { readPptxSlideOrder } from '../pptxOrder';
import {
  DocumentReadError,
  type DocumentOutline,
  type DocumentOutlineSlide
} from '../types';

const MEDIA_PART_PATTERN = /^ppt\/media\/([^/]+)$/;
const MAX_SLIDES = 60;
const MAX_SLIDE_LINES = 12;
const MAX_LINE_CHARS = 120;
const MAX_MEDIA_FILES = 40;

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

  const slideParts = (await readPptxSlideOrder(zip)).slides;

  if (slideParts.length === 0) throw new DocumentReadError(INVALID_PPTX_MESSAGE);

  const slides: NonNullable<DocumentOutline['slides']> = [];
  for (const [order, part] of slideParts.slice(0, MAX_SLIDES).entries()) {
    const entry = zip.file(part.partPath);
    if (!entry) continue;
    const slide = inspectSlide(await entry.async('string'), order + 1);
    if (slide) slides.push(slide);
  }

  const mediaFiles = Object.keys(zip.files)
    .map((name) => MEDIA_PART_PATTERN.exec(name)?.[1])
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
  const warnings = [...common.warnings];
  if (mediaFiles.length > MAX_MEDIA_FILES) {
    warnings.push(`图片较多，只列出前 ${MAX_MEDIA_FILES} 张，其余仍可按文件名替换。`);
  }

  return {
    format: 'pptx',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    slides,
    slideCount: slideParts.length,
    images: mediaFiles.slice(0, MAX_MEDIA_FILES),
    ...(slideParts.length > slides.length ? { slidesTruncated: true } : {}),
    warnings
  };
};
