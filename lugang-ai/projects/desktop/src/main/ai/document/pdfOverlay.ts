// 鲁港通 - PDF 原样副本叠加：按文本层标签定位，在标签旁写入内容，只生成副本、原文件不动
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from '../fileNaming';
import { embedCjkFont } from '../form/pdfFill';
import { assertCopyPathDistinct, type EditedDocumentCopy } from './editTypes';

const PDF_MARGIN = 36;
const LABEL_GAP = 6;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 14;
const LINE_HEIGHT_RATIO = 1.25;
const MAX_OUTLINE_LABEL_LENGTH = 40;

export type PdfOverlayErrorCode = 'pdf_no_text_layer' | 'pdf_font_missing' | 'pdf_overlay_failed';

export class PdfOverlayError extends Error {
  readonly code: PdfOverlayErrorCode;

  constructor(code: PdfOverlayErrorCode, message: string) {
    super(message);
    this.name = 'PdfOverlayError';
    this.code = code;
  }
}

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfPageText = {
  page: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

export type PdfOverlayEntry = {
  page?: number;
  label: string;
  value: string;
};

/** 页面坐标比例：原点在左上角，取值范围 0..1，网页端按渲染尺寸直接换算 */
export type PdfOverlayRect = { x: number; y: number; width: number; height: number };

export type PdfOverlayPlacement = {
  entryIndex: number;
  page: number;
  label: string;
  value: string;
  status: 'placed' | 'missing';
  note?: string;
  labelRect?: PdfOverlayRect;
  valueRect?: PdfOverlayRect;
  x?: number;
  y?: number;
  fontSize?: number;
  lines?: string[];
};

export type PdfOverlayPlan = {
  pages: Array<{ page: number; width: number; height: number }>;
  placements: PdfOverlayPlacement[];
};

const resolvePdfjsAssets = (): string | null => {
  const candidates = [
    join(__dirname, 'pdfjs'),
    join(__dirname, '../../../../node_modules/pdfjs-dist'),
    join(__dirname, '../../../node_modules/pdfjs-dist')
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'legacy/build/pdf.worker.mjs'))) return dir;
  }
  return null;
};

let workerConfigured = false;

const configurePdfjs = (): string | null => {
  const assets = resolvePdfjsAssets();
  if (assets && !workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(assets, 'legacy/build/pdf.worker.mjs')
    ).href;
    workerConfigured = true;
  }
  return assets;
};

export const extractPdfTextPages = async (bytes: Uint8Array): Promise<PdfPageText[]> => {
  const assets = configurePdfjs();
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    document = await pdfjs.getDocument({
      // 鲁港通 - pdfjs 会接管传入的缓冲区，复制一份避免调用方数据被分离
      data: bytes.slice(),
      isEvalSupported: false,
      disableFontFace: true,
      useWorkerFetch: false,
      cMapPacked: true,
      ...(assets
        ? {
            cMapUrl: pathToFileURL(join(assets, 'cmaps') + '/').href,
            standardFontDataUrl: pathToFileURL(join(assets, 'standard_fonts') + '/').href
          }
        : {})
    }).promise;
  } catch {
    throw new PdfOverlayError(
      'pdf_overlay_failed',
      '这个 PDF 没有读取成功，可能已加密或文件损坏；请确认能正常打开后再试。'
    );
  }

  const pages: PdfPageText[] = [];
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const raw of content.items) {
        const item = raw as {
          str?: unknown;
          transform?: unknown;
          width?: unknown;
          height?: unknown;
        };
        const text = typeof item.str === 'string' ? item.str : '';
        const transform = item.transform;
        if (!text.trim() || !Array.isArray(transform) || transform.length < 6) continue;
        const x = Number(transform[4]);
        const y = Number(transform[5]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const width = Number(item.width);
        const height = Number(item.height);
        items.push({
          text,
          x,
          y,
          width: Number.isFinite(width) && width > 0 ? width : 0,
          height: Number.isFinite(height) && height > 0 ? height : 0
        });
      }
      pages.push({ page: index, width: viewport.width, height: viewport.height, items });
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }
  return pages;
};

export const extractPdfOutline = async (
  bytes: Uint8Array
): Promise<{ pages: number; labels: string[] }> => {
  const pages = await extractPdfTextPages(bytes);
  const labeled: string[] = [];
  const seen = new Set<string>();
  const push = (text: string, target: string[]) => {
    const key = text.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    target.push(key);
  };

  for (const page of pages) {
    for (const item of page.items) {
      const text = item.text.trim();
      if (!text || text.length > MAX_OUTLINE_LABEL_LENGTH) continue;
      if (/[：:]$/.test(text)) push(text, labeled);
    }
  }
  // 鲁港通 - 没有明显「标签：」的表格改用页面上较短的文字，模型才能知道能填哪些位置
  if (labeled.length < 3) {
    for (const page of pages) {
      for (const item of page.items) {
        const text = item.text.trim();
        if (!text || text.length > 20) continue;
        push(text, labeled);
      }
    }
  }
  return { pages: pages.length, labels: labeled.slice(0, 150) };
};

const normalizeLabel = (text: string): string =>
  text.replace(/[\s\u3000]+/g, '').replace(/[：:]+$/, '');

const normalizeNeedle = (text: string): string => normalizeLabel(text.trim());

const charWidth = (char: string, size: number): number => {
  const code = char.codePointAt(0) ?? 0;
  if (char === ' ') return size * 0.32;
  if (code <= 0x7e) return size * 0.56;
  return size;
};

const estimateWidth = (text: string, size: number): number =>
  [...text].reduce((total, char) => total + charWidth(char, size), 0);

const layoutLines = (text: string, maxWidth: number, size: number): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const char of [...text]) {
    if (char === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const next = current + char;
    if (current && estimateWidth(next, size) > maxWidth) {
      lines.push(current);
      current = char;
      continue;
    }
    current = next;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

const toFractionRect = (
  page: PdfPageText,
  x: number,
  top: number,
  width: number,
  height: number
): PdfOverlayRect => {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const left = clamp(x / page.width);
  const right = clamp((x + Math.max(width, 1)) / page.width);
  const upper = clamp(1 - top / page.height);
  const lower = clamp(1 - (top - Math.max(height, 1)) / page.height);
  return {
    x: left,
    y: upper,
    width: Math.max(right - left, 0.001),
    height: Math.max(lower - upper, 0.001)
  };
};

const findAnchor = (
  pages: PdfPageText[],
  label: string,
  pageHint: number | undefined,
  used: Set<string>
): { page: PdfPageText; item: PdfTextItem } | null => {
  const needle = normalizeNeedle(label);
  if (!needle) return null;
  const ordered = pageHint
    ? [
        ...pages.filter((page) => page.page === pageHint),
        ...pages.filter((page) => page.page !== pageHint)
      ]
    : pages;

  const pick = (test: (text: string) => boolean) => {
    for (const page of ordered) {
      for (const item of page.items) {
        const key = `${page.page}:${item.x}:${item.y}`;
        if (used.has(key)) continue;
        if (test(normalizeLabel(item.text))) return { page, item, key };
      }
    }
    return null;
  };

  const matched =
    pick((text) => text === needle) ??
    pick((text) => text.endsWith(needle)) ??
    (needle.length >= 2 ? pick((text) => text.includes(needle)) : null);
  if (!matched) return null;
  used.add(matched.key);
  return { page: matched.page, item: matched.item };
};

const planPlacement = (
  page: PdfPageText,
  item: PdfTextItem,
  entry: PdfOverlayEntry,
  entryIndex: number
): PdfOverlayPlacement => {
  const labelTop = item.y + item.height * 0.9;
  const labelRect = toFractionRect(page, item.x, labelTop, item.width, item.height * 1.2);

  const initialSize = Math.min(
    MAX_FONT_SIZE,
    Math.max(9, Math.round(item.height > 0 ? item.height : 12))
  );
  const rightX = item.x + item.width + LABEL_GAP;
  // 鲁港通 - 标签贴着右边界时内容改写在标签下方，避免字被页面裁掉
  const below = page.width - PDF_MARGIN - rightX < 60;
  const startX = below ? item.x : rightX;
  const available = Math.max(48, page.width - PDF_MARGIN - startX);
  const startBaseline = below ? item.y - Math.max(initialSize, item.height) * 1.6 : item.y;

  let fontSize = initialSize;
  let lines = layoutLines(entry.value, available, fontSize);
  const fits = () =>
    startBaseline - (lines.length - 1) * fontSize * LINE_HEIGHT_RATIO - fontSize * 0.3 >=
    PDF_MARGIN;
  while (!fits() && fontSize > MIN_FONT_SIZE) {
    fontSize -= 1;
    lines = layoutLines(entry.value, available, fontSize);
  }

  let note: string | undefined;
  if (!fits()) {
    const allowed = Math.max(
      1,
      Math.floor(
        (startBaseline - PDF_MARGIN + fontSize * 0.3) / (fontSize * LINE_HEIGHT_RATIO)
      ) + 1
    );
    if (allowed < lines.length) {
      lines = lines.slice(0, allowed);
      note = '内容较长，页面放不下全部文字，请缩短后再试';
    }
  }

  const widest = Math.max(...lines.map((line) => estimateWidth(line, fontSize)), 1);
  const lastBaseline = startBaseline - (lines.length - 1) * fontSize * LINE_HEIGHT_RATIO;
  const valueTop = startBaseline + fontSize * 0.9;
  const valueRect = toFractionRect(
    page,
    startX,
    valueTop,
    widest,
    valueTop - (lastBaseline - fontSize * 0.3)
  );

  return {
    entryIndex,
    page: page.page,
    label: entry.label,
    value: entry.value,
    status: 'placed',
    ...(note ? { note } : {}),
    labelRect,
    valueRect,
    x: startX,
    y: startBaseline,
    fontSize,
    lines
  };
};

export const planPdfOverlay = (
  pages: PdfPageText[],
  entries: PdfOverlayEntry[]
): PdfOverlayPlan => {
  const used = new Set<string>();
  const placements = entries.map((entry, entryIndex) => {
    const anchor = findAnchor(pages, entry.label, entry.page, used);
    if (!anchor) {
      return {
        entryIndex,
        page: entry.page ?? 1,
        label: entry.label,
        value: entry.value,
        status: 'missing' as const,
        note: '这份 PDF 里找不到这个标签'
      };
    }
    return planPlacement(anchor.page, anchor.item, entry, entryIndex);
  });

  return {
    pages: pages.map((page) => ({ page: page.page, width: page.width, height: page.height })),
    placements
  };
};

export const writePdfOverlayCopy = async (options: {
  pdfBytes: Uint8Array;
  fileName: string;
  sourcePath: string;
  placements: PdfOverlayPlacement[];
  outputDir: string;
  now?: Date;
}): Promise<EditedDocumentCopy> => {
  const drawable = options.placements.filter(
    (placement) => placement.status === 'placed' && placement.lines?.length
  );

  let document: PDFDocument;
  try {
    document = await PDFDocument.load(options.pdfBytes.slice());
  } catch {
    throw new PdfOverlayError(
      'pdf_overlay_failed',
      '这个 PDF 有加密保护或格式不受支持，无法生成叠加副本；请先解除加密后再试。'
    );
  }

  const font = await embedCjkFont(document);
  document.registerFontkit(fontkit);

  for (const placement of drawable) {
    const page = document.getPage(placement.page - 1);
    if (!page) continue;
    const size = placement.fontSize ?? 12;
    placement.lines?.forEach((line, index) => {
      page.drawText(line, {
        x: placement.x ?? PDF_MARGIN,
        y: (placement.y ?? PDF_MARGIN) - index * size * LINE_HEIGHT_RATIO,
        size,
        font,
        color: rgb(0, 0, 0)
      });
    });
  }

  const folder = join(options.outputDir, GENERATED_FILE_FOLDER);
  const base = basename(options.fileName, extname(options.fileName));
  await mkdir(folder, { recursive: true });
  const name = resolveGeneratedFileName({
    fileName: `${base}-已填写`,
    format: 'pdf',
    exists: (fileName) => existsSync(join(folder, fileName)),
    now: options.now
  });
  const path = join(folder, name);
  assertCopyPathDistinct(options.sourcePath, path);
  await writeFile(path, await document.save());

  return {
    name,
    format: 'pdf',
    folder: GENERATED_FILE_FOLDER,
    path,
    applied: drawable.length,
    skipped: [],
    warnings: []
  };
};
