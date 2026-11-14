// 鲁港通 - PDF 编辑：填写 AcroForm 表单域，或按文字层标签在空白处叠加内容，只产出副本、原件不动
import {
  PDFBool,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  type PDFField,
  type PDFFont
} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { DocumentEditError, type DocumentEditResult } from '../types';
import { embedPdfEditFont } from './pdfFont';

const PDF_MARGIN = 36;
const LABEL_GAP = 6;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 14;
const LINE_HEIGHT_RATIO = 1.25;
const MAX_OUTLINE_LABEL_LENGTH = 40;

const PDF_INVALID_MESSAGE =
  '无法读取这个 PDF 文件，它不是有效的 PDF 文档；请确认文件没有损坏或被改过后缀名。';
const PDF_PASSWORD_MESSAGE = '这份 PDF 受密码保护，请先解除保护后重试。';
const PDF_BROKEN_MESSAGE = '这个 PDF 没有读取成功，可能已损坏；请确认能正常打开后再试。';
const PDF_EDIT_FAILED_MESSAGE =
  '修改文件没有生成成功，请重试一次；如果仍然失败，请手动修改原文件。';
const NO_TEXT_LAYER_MESSAGE =
  '这个 PDF 没有可识别的文字层（可能是扫描件），无法按文字标签定位；表单域仍可填写。';
const NO_FORM_FIELDS_MESSAGE = '这个 PDF 没有可填写的表单域，无法按字段填写。';
const CHECKED_PATTERN = /^(是|true|yes|1|√|✔|✓|勾选|已勾选|on)$/i;

type PdfTextItem = { text: string; x: number; y: number; width: number; height: number };
type PdfPageText = { page: number; width: number; height: number; items: PdfTextItem[] };

export type PdfOverlayEntry = { label: string; value: string };

type PdfVisualRow = { y: number; cells: PdfTextItem[] };
type PdfFieldCandidate = { page: number; item: PdfTextItem; label: string };
type PdfPageStructure = { page: PdfPageText; cells: PdfFieldCandidate[] };

const loadPdfDocument = async (buffer: Buffer): Promise<PDFDocument> => {
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new DocumentEditError(PDF_INVALID_MESSAGE);
  }

  let document: PDFDocument;
  try {
    document = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  } catch {
    throw new DocumentEditError(PDF_BROKEN_MESSAGE);
  }
  // 鲁港通 - pdf.js 能用空密码打开部分加密文件，先按加密标记拦截，避免写出损坏的副本
  if (document.isEncrypted) throw new DocumentEditError(PDF_PASSWORD_MESSAGE);
  return document;
};

const extractPdfTextPages = async (bytes: Uint8Array): Promise<PdfPageText[]> => {
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    document = await pdfjs.getDocument({
      // 鲁港通 - pdfjs 会接管传入的缓冲区，复制一份避免调用方数据被分离
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      disableFontFace: true,
      useWorkerFetch: false
    }).promise;
  } catch (error) {
    if ((error as { name?: string })?.name === 'PasswordException') {
      throw new DocumentEditError(PDF_PASSWORD_MESSAGE);
    }
    throw new DocumentEditError(PDF_BROKEN_MESSAGE);
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
      page.cleanup();
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }
  return pages;
};

const normalizeLabel = (text: string): string =>
  text.replace(/[\s\u3000]+/g, '').replace(/[：:]+$/, '');

const normalizeNeedle = (text: string): string => normalizeLabel(text.trim());

const joinCellText = (left: string, right: string): string => {
  const before = left.trim();
  const after = right.trim();
  const space = /\d/.test(after) && /[^\d\s]$/.test(before) ? ' ' : '';
  return `${before}${space}${after}`;
};

// 鲁港通 - 中文表单常把标签拆成多个文字项，先按基线聚成行、再按字距聚成单元格
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
  const cells: PdfFieldCandidate[] = [];
  for (const row of buildVisualRows(page)) {
    // 鲁港通 - 标题行不当作可填写标签，避免把内容写到页眉或章节名旁边
    if (isSectionTitle(page, row)) continue;
    for (const item of row.cells) {
      const label = item.text.trim();
      if (!label || label.length > MAX_OUTLINE_LABEL_LENGTH) continue;
      if (/^[\d\s.、()（）-]+$/.test(label)) continue;
      if (row.cells.length === 1 && isCenteredText(page, item)) continue;
      cells.push({ page: page.page, item, label });
    }
  }
  return { page, cells };
};

const buildDocumentStructure = (pages: PdfPageText[]): PdfPageStructure[] =>
  pages.map(buildPageStructure);

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
  return { fontSize, lines, note, box };
};

type PdfOverlayPlacement = {
  entryIndex: number;
  page: number;
  label: string;
  value: string;
  status: 'placed' | 'missing';
  note?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  lines?: string[];
};

const anchorKey = (candidate: PdfFieldCandidate): string =>
  `${candidate.page}:${candidate.item.x.toFixed(2)}:${candidate.item.y.toFixed(2)}`;

const findAnchor = (
  structures: PdfPageStructure[],
  entry: PdfOverlayEntry,
  used: Set<string>
): { page: PdfPageText; item: PdfTextItem } | null => {
  const needle = normalizeNeedle(entry.label);
  if (!needle) return null;

  const pickBy = (test: (text: string) => boolean) => {
    for (const structure of structures) {
      for (const candidate of structure.cells) {
        const key = anchorKey(candidate);
        if (used.has(key)) continue;
        if (test(normalizeLabel(candidate.label))) {
          return { structure, candidate, key };
        }
      }
    }
    return null;
  };

  const matched =
    pickBy((text) => text === needle) ??
    pickBy((text) => text.endsWith(needle)) ??
    (needle.length >= 2 ? pickBy((text) => text.includes(needle)) : null);
  if (!matched) return null;
  used.add(matched.key);
  return { page: matched.structure.page, item: matched.candidate.item };
};

const planPlacement = (
  page: PdfPageText,
  item: PdfTextItem,
  entry: PdfOverlayEntry,
  entryIndex: number,
  occupied: PdfAbsoluteBox[]
): { placement: PdfOverlayPlacement; box?: PdfAbsoluteBox } => {
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
        status: 'placed',
        ...(layout.note ? { note: layout.note } : {}),
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
      status: 'missing',
      note: '标签附近没有足够空白，未写入内容；请缩短文字或调整填写位置'
    }
  };
};

const planPdfOverlay = (
  pages: PdfPageText[],
  entries: PdfOverlayEntry[]
): PdfOverlayPlacement[] => {
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
        page: 1,
        label: entry.label,
        value: entry.value,
        status: 'missing',
        note: `「${entry.label}」在 PDF 里找不到这个标签，已跳过`
      });
      return;
    }
    const pageOccupied = occupied.get(anchor.page.page) ?? [];
    const planned = planPlacement(anchor.page, anchor.item, entry, entryIndex, pageOccupied);
    placements.push(planned.placement);
    if (planned.box) pageOccupied.push(planned.box);
  });
  return placements;
};

const matchOption = (options: string[], value: string): string | undefined => {
  const target = value.trim();
  if (!target) return undefined;
  const exact = options.find((option) => option === target);
  if (exact) return exact;
  const lower = target.toLowerCase();
  const insensitive = options.find((option) => option.trim().toLowerCase() === lower);
  if (insensitive) return insensitive;
  return options.find((option) => option && (target.includes(option) || option.includes(target)));
};

const isChecked = (value: string): boolean => CHECKED_PATTERN.test(value.trim());

const normalizeFieldKey = (text: string): string =>
  text.replace(/[\s\u3000]+/g, '').toLowerCase();

// 鲁港通 - 模型给的是字段名称，先精确（忽略空格大小写）匹配，再在唯一的近似名称上兜底
const findField = (fields: PDFField[], label: string): PDFField | undefined => {
  const target = normalizeFieldKey(label);
  if (!target) return undefined;
  const exact = fields.find((field) => normalizeFieldKey(field.getName()) === target);
  if (exact) return exact;
  const similar = fields.filter((field) => {
    const key = normalizeFieldKey(field.getName());
    return key.length > 0 && (key.includes(target) || target.includes(key));
  });
  return similar.length === 1 ? similar[0] : undefined;
};

const fillFormFields = async (
  document: PDFDocument,
  operations: Extract<DocumentEditOperation, { op: 'fill_field' }>[],
  context: { skipped: string[]; warnings: Set<string> }
): Promise<number> => {
  const form = document.getForm();
  const fields = form.getFields();
  let font: PDFFont | undefined;
  const ensureFont = async (): Promise<PDFFont> => {
    if (!font) font = await embedPdfEditFont(document);
    return font;
  };

  let applied = 0;
  let touched = false;
  for (const operation of operations) {
    const { label, value } = operation;
    if (fields.length === 0) {
      context.skipped.push(`「${label}」${NO_FORM_FIELDS_MESSAGE}`);
      continue;
    }
    const field = findField(fields, label);
    if (!field) {
      context.skipped.push(`「${label}」在 PDF 里找不到这个表单域，已跳过`);
      continue;
    }

    try {
      if (field instanceof PDFTextField) {
        field.setText(value);
        field.updateAppearances(await ensureFont());
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const option = matchOption(field.getOptions(), value);
        if (!option) {
          context.skipped.push(`「${label}」的可选项里没有“${value}”，已跳过`);
          continue;
        }
        field.select(option);
        field.updateAppearances(await ensureFont());
      } else if (field instanceof PDFRadioGroup) {
        const option = matchOption(field.getOptions(), value);
        if (!option) {
          context.skipped.push(`「${label}」的可选项里没有“${value}”，已跳过`);
          continue;
        }
        field.select(option);
        field.updateAppearances();
      } else if (field instanceof PDFCheckBox) {
        if (isChecked(value)) field.check();
        else field.uncheck();
      } else {
        context.skipped.push(`「${label}」不是可填写的表单域，已跳过`);
        continue;
      }
      applied += 1;
      if (!(field instanceof PDFCheckBox)) touched = true;
    } catch (error) {
      if (error instanceof DocumentEditError) throw error;
      context.skipped.push(`「${label}」填写失败，请在这个文件里手动填写该字段`);
    }
  }

  // 鲁港通 - 外观流已用中文字体生成，关掉 NeedAppearances 防止阅读器用默认字体重绘
  if (touched && applied > 0) {
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.False);
  }
  return applied;
};

const drawOverlayPlacements = async (
  document: PDFDocument,
  placements: PdfOverlayPlacement[],
  context: { skipped: string[]; warnings: Set<string> }
): Promise<number> => {
  const drawable = placements.filter(
    (placement) => placement.status === 'placed' && placement.lines?.length
  );
  for (const placement of placements) {
    if (placement.status === 'placed') continue;
    context.skipped.push(placement.note ?? `「${placement.label}」没有写入成功，已跳过`);
  }
  if (drawable.length === 0) return 0;

  const font = await embedPdfEditFont(document);
  for (const placement of drawable) {
    if (placement.note) context.warnings.add(placement.note);
    const page = document.getPage(placement.page - 1);
    if (!page) continue;
    const size = placement.fontSize ?? 12;
    placement.lines?.forEach((line, index) => {
      page.drawText(line, {
        x: placement.x ?? PDF_MARGIN,
        y: (placement.y ?? PDF_MARGIN) - index * size * LINE_HEIGHT_RATIO,
        size,
        font
      });
    });
  }
  return drawable.length;
};

const PDF_OP_SKIP_NOTES: Partial<Record<DocumentEditOperation['op'], string>> = {
  replace_text: '「替换文字」在 PDF 上暂不支持，请改用「填写表单」或「叠加文字」，已跳过',
  set_paragraph: '段落操作只适用于 Word，已跳过',
  insert_paragraph: '段落操作只适用于 Word，已跳过',
  append_paragraph: '段落操作只适用于 Word，已跳过',
  set_table_cell: '表格单元格操作只适用于 Word，已跳过',
  set_cell: '单元格操作只适用于 Excel，已跳过',
  append_row: '追加行操作只适用于 Excel，已跳过'
};

export const editPdf = async ({
  buffer,
  operations
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  const document = await loadPdfDocument(buffer);
  const skipped: string[] = [];
  const warnings = new Set<string>();
  const context = { skipped, warnings };

  const fillOperations = operations.filter(
    (operation): operation is Extract<DocumentEditOperation, { op: 'fill_field' }> =>
      operation.op === 'fill_field'
  );
  const overlayOperations = operations.filter(
    (operation): operation is Extract<DocumentEditOperation, { op: 'add_text' }> =>
      operation.op === 'add_text'
  );
  for (const operation of operations) {
    const note = PDF_OP_SKIP_NOTES[operation.op];
    if (note) skipped.push(note);
  }

  let applied = 0;
  if (fillOperations.length > 0) {
    applied += await fillFormFields(document, fillOperations, context);
  }

  if (overlayOperations.length > 0) {
    const pages = await extractPdfTextPages(new Uint8Array(buffer));
    if (!pages.some((page) => page.items.length > 0)) {
      warnings.add(NO_TEXT_LAYER_MESSAGE);
      for (const operation of overlayOperations) {
        skipped.push(`「${operation.label}」${NO_TEXT_LAYER_MESSAGE}`);
      }
    } else {
      const placements = planPdfOverlay(
        pages,
        overlayOperations.map(({ label, value }) => ({ label, value }))
      );
      applied += await drawOverlayPlacements(document, placements, context);
    }
  }

  if (applied === 0) {
    const detail = skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对字段名称或标签后重试。`
    );
  }

  let output: Uint8Array;
  try {
    output = await document.save();
  } catch {
    throw new DocumentEditError(PDF_EDIT_FAILED_MESSAGE);
  }
  return { buffer: Buffer.from(output), applied, skipped, warnings: [...warnings] };
};
