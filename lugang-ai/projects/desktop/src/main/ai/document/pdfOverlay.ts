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

export type PdfOutlineField = {
  page: number;
  label: string;
  section?: string;
};

export type PdfOverlayEntry = {
  page?: number;
  label: string;
  value: string;
  section?: string;
};

/** 页面坐标比例：原点在左上角，取值范围 0..1，网页端按渲染尺寸直接换算 */
export type PdfOverlayRect = { x: number; y: number; width: number; height: number };

export type PdfOverlayPlacement = {
  entryIndex: number;
  page: number;
  label: string;
  value: string;
  section?: string;
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

const normalizeLabel = (text: string): string =>
  text.replace(/[\s\u3000]+/g, '').replace(/[：:]+$/, '');

const normalizeNeedle = (text: string): string => normalizeLabel(text.trim());

type PdfVisualRow = { y: number; cells: PdfTextItem[] };
type PdfFieldCandidate = { page: number; item: PdfTextItem; label: string; section?: string };
type PdfPageStructure = {
  page: PdfPageText;
  rows: PdfVisualRow[];
  cells: PdfFieldCandidate[];
  fields: PdfFieldCandidate[];
};

const joinCellText = (left: string, right: string): string => {
  const before = left.trim();
  const after = right.trim();
  const space = /\d/.test(after) && /[^\d\s]$/.test(before) ? ' ' : '';
  return `${before}${space}${after}`;
};

const buildVisualRows = (page: PdfPageText): PdfVisualRow[] => {
  const rows: Array<{ y: number; height: number; items: PdfTextItem[] }> = [];
  const sorted = page.items
    .map((item) => ({ ...item }))
    .sort((first, second) => second.y - first.y || first.x - second.x);
  for (const item of sorted) {
    const row = rows.at(-1);
    const tolerance = Math.max(2, Math.min(row?.height ?? item.height, item.height) * 0.35);
    if (!row || Math.abs(item.y - row.y) > tolerance) {
      rows.push({ y: item.y, height: item.height, items: [item] });
      continue;
    }
    row.items.push(item);
    row.height = Math.max(row.height, item.height);
  }

  return rows.map((row) => ({
    y: row.y,
    cells: row.items
      .sort((first, second) => first.x - second.x)
      .reduce<PdfTextItem[]>((cells, item) => {
        const previous = cells.at(-1);
        if (!previous) return [item];
        const gap = item.x - (previous.x + previous.width);
        if (gap > Math.max(6, Math.min(previous.height, item.height) * 0.6)) {
          cells.push(item);
          return cells;
        }
        previous.text = joinCellText(previous.text, item.text);
        previous.y = (previous.y + item.y) / 2;
        previous.width = Math.max(previous.x + previous.width, item.x + item.width) - previous.x;
        previous.height = Math.max(previous.height, item.height);
        return cells;
      }, [])
  }));
};

const isCenteredText = (page: PdfPageText, item: PdfTextItem): boolean => {
  const center = item.x + item.width / 2;
  return item.x > page.width * 0.2 && Math.abs(center - page.width / 2) < page.width * 0.18;
};

const isSectionTitle = (page: PdfPageText, row: PdfVisualRow): boolean => {
  if (row.cells.length !== 1) return false;
  const item = row.cells[0];
  const text = item.text.trim();
  return (
    text.length <= MAX_OUTLINE_LABEL_LENGTH &&
    /\D\s*\d+\s*$/.test(text) &&
    !/[：:]$/.test(text) &&
    !isCenteredText(page, item)
  );
};

const buildPageStructure = (page: PdfPageText): PdfPageStructure => {
  const rows = buildVisualRows(page);
  const cells = rows.flatMap((row) =>
    row.cells.map((item) => ({ page: page.page, item, label: item.text.trim() }))
  );
  const fields: PdfFieldCandidate[] = [];
  let section: string | undefined;
  rows.forEach((row) => {
    if (isSectionTitle(page, row)) {
      section = row.cells[0].text.trim();
      return;
    }
    for (const item of row.cells) {
      const label = item.text.trim();
      if (
        !label ||
        label.length > MAX_OUTLINE_LABEL_LENGTH ||
        /^[\d\s.、()（）-]+$/.test(label) ||
        (row.cells.length === 1 && isCenteredText(page, item))
      ) {
        continue;
      }
      fields.push({ page: page.page, item, label, ...(section ? { section } : {}) });
    }
  });
  return { page, rows, cells, fields };
};

const buildDocumentStructure = (pages: PdfPageText[]): PdfPageStructure[] => {
  const structures = pages.map(buildPageStructure);
  const labelSections = new Map<string, Set<string>>();
  for (const structure of structures) {
    for (const field of structure.fields) {
      const label = normalizeLabel(field.label);
      const sections = labelSections.get(label) ?? new Set<string>();
      sections.add(field.section ? normalizeLabel(field.section) : '');
      labelSections.set(label, sections);
    }
  }
  for (const structure of structures) {
    for (const field of structure.fields) {
      if (field.section && (labelSections.get(normalizeLabel(field.label))?.size ?? 0) < 2) {
        delete field.section;
      }
    }
  }
  return structures;
};

export const extractPdfOutline = async (
  bytes: Uint8Array
): Promise<{ pages: number; labels: string[]; fields: PdfOutlineField[] }> => {
  const pages = await extractPdfTextPages(bytes);
  const labeled: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const key = text.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    labeled.push(key);
  };

  for (const page of pages) {
    for (const item of page.items) {
      const text = item.text.trim();
      if (!text || text.length > MAX_OUTLINE_LABEL_LENGTH) continue;
      if (/[：:]$/.test(text)) push(text);
    }
  }
  // 鲁港通 - 没有明显「标签：」的表格改用页面上较短的文字，模型才能知道能填哪些位置
  if (labeled.length < 3) {
    for (const page of pages) {
      for (const item of page.items) {
        const text = item.text.trim();
        if (!text || text.length > 20) continue;
        push(text);
      }
    }
  }
  const fields = buildDocumentStructure(pages).flatMap((structure) =>
    structure.fields.map((field) => ({
      page: field.page,
      label: field.label,
      ...(field.section ? { section: field.section } : {})
    }))
  );
  return { pages: pages.length, labels: labeled.slice(0, 150), fields: fields.slice(0, 400) };
};

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

const anchorKey = (candidate: PdfFieldCandidate): string =>
  `${candidate.page}:${candidate.item.x.toFixed(2)}:${candidate.item.y.toFixed(2)}`;

const findAnchor = (
  structures: PdfPageStructure[],
  entry: PdfOverlayEntry,
  used: Set<string>
): { page: PdfPageText; item: PdfTextItem; section?: string } | null => {
  const needle = normalizeNeedle(entry.label);
  if (!needle) return null;
  const ordered = entry.page
    ? [
        ...structures.filter((structure) => structure.page.page === entry.page),
        ...structures.filter((structure) => structure.page.page !== entry.page)
      ]
    : structures;

  const pick = (candidates: PdfFieldCandidate[]) => {
    const pickBy = (test: (text: string) => boolean) => {
      for (const candidate of candidates) {
        const key = anchorKey(candidate);
        if (used.has(key)) continue;
        if (test(normalizeLabel(candidate.label))) return { candidate, key };
      }
      return null;
    };
    return (
      pickBy((text) => text === needle) ??
      pickBy((text) => text.endsWith(needle)) ??
      (needle.length >= 2 ? pickBy((text) => text.includes(needle)) : null)
    );
  };

  const sectionNeedle = entry.section ? normalizeNeedle(entry.section) : '';
  if (sectionNeedle) {
    const scoped = ordered.flatMap((structure) =>
      structure.fields.filter(
        (field) => field.section && normalizeNeedle(field.section) === sectionNeedle
      )
    );
    const matched = pick(scoped);
    if (matched) {
      used.add(matched.key);
      const structure = ordered.find((item) => item.page.page === matched.candidate.page)!;
      return {
        page: structure.page,
        item: matched.candidate.item,
        section: entry.section?.trim()
      };
    }
  }

  const matched = pick(ordered.flatMap((structure) => structure.cells));
  if (!matched) return null;
  used.add(matched.key);
  const structure = ordered.find((item) => item.page.page === matched.candidate.page)!;
  return { page: structure.page, item: matched.candidate.item };
};

type PdfAbsoluteBox = { x: number; top: number; width: number; height: number };

const boxesOverlap = (first: PdfAbsoluteBox, second: PdfAbsoluteBox): boolean =>
  first.x < second.x + second.width + 1 &&
  first.x + first.width + 1 > second.x &&
  first.top + 1 > second.top - second.height &&
  first.top - first.height < second.top + 1;

const layoutValue = (
  page: PdfPageText,
  entry: PdfOverlayEntry,
  startX: number,
  startBaseline: number,
  initialSize: number
) => {
  const available = Math.max(48, page.width - PDF_MARGIN - startX);
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
  const box = {
    x: startX,
    top: valueTop,
    width: widest,
    height: valueTop - (lastBaseline - fontSize * 0.3)
  };
  return {
    fontSize,
    lines,
    note,
    box,
    valueRect: toFractionRect(page, box.x, box.top, box.width, box.height)
  };
};

const planPlacement = (
  page: PdfPageText,
  item: PdfTextItem,
  entry: PdfOverlayEntry,
  entryIndex: number,
  occupied: PdfAbsoluteBox[],
  section?: string
): { placement: PdfOverlayPlacement; box?: PdfAbsoluteBox } => {
  const labelTop = item.y + item.height * 0.9;
  const labelRect = toFractionRect(page, item.x, labelTop, item.width, item.height * 1.2);
  const initialSize = Math.min(
    MAX_FONT_SIZE,
    Math.max(9, Math.round(item.height > 0 ? item.height : 12))
  );
  const rightX = item.x + item.width + LABEL_GAP;
  const step = Math.max(initialSize, item.height) * 1.6;
  const candidates: Array<{ x: number; y: number }> = [];
  if (page.width - PDF_MARGIN - rightX >= 60) candidates.push({ x: rightX, y: item.y });
  for (let level = 1; level <= 16; level += 1) {
    if (page.width - PDF_MARGIN - rightX >= 60) {
      candidates.push({ x: rightX, y: item.y - step * level });
    }
    candidates.push({ x: item.x, y: item.y - step * level });
  }

  for (const candidate of candidates) {
    if (candidate.y - initialSize * 0.3 < PDF_MARGIN) continue;
    const layout = layoutValue(page, entry, candidate.x, candidate.y, initialSize);
    if (occupied.some((box) => boxesOverlap(layout.box, box))) continue;
    return {
      placement: {
        entryIndex,
        page: page.page,
        label: entry.label,
        value: entry.value,
        ...(section ? { section } : {}),
        status: 'placed',
        ...(layout.note ? { note: layout.note } : {}),
        labelRect,
        valueRect: layout.valueRect,
        x: candidate.x,
        y: candidate.y,
        fontSize: layout.fontSize,
        lines: layout.lines
      },
      box: layout.box
    };
  }

  return {
    placement: {
      entryIndex,
      page: page.page,
      label: entry.label,
      value: entry.value,
      ...(section ? { section } : {}),
      status: 'missing',
      note: '标签附近没有足够空白，未写入内容；请缩短文字或调整填写位置',
      labelRect
    }
  };
};

export const planPdfOverlay = (
  pages: PdfPageText[],
  entries: PdfOverlayEntry[]
): PdfOverlayPlan => {
  const used = new Set<string>();
  const structures = buildDocumentStructure(pages);
  const occupied = new Map<number, PdfAbsoluteBox[]>(
    pages.map((page) => [
      page.page,
      page.items.map((item) => ({
        x: item.x,
        top: item.y + item.height * 0.9,
        width: Math.max(item.width, 1),
        height: Math.max(item.height * 1.2, 1)
      }))
    ])
  );
  const placements: PdfOverlayPlacement[] = [];
  entries.forEach((entry, entryIndex) => {
    const anchor = findAnchor(structures, entry, used);
    if (!anchor) {
      placements.push({
        entryIndex,
        page: entry.page ?? 1,
        label: entry.label,
        value: entry.value,
        ...(entry.section ? { section: entry.section } : {}),
        status: 'missing',
        note: '这份 PDF 里找不到这个标签'
      });
      return;
    }
    const pageOccupied = occupied.get(anchor.page.page) ?? [];
    const planned = planPlacement(
      anchor.page,
      anchor.item,
      entry,
      entryIndex,
      pageOccupied,
      anchor.section
    );
    placements.push(planned.placement);
    if (planned.box) pageOccupied.push(planned.box);
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
