// 鲁港通 - PDF 提纲：页数、文字层标签与可填写表单域，供模型定位填写或叠加位置
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField
} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore
import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
import {
  DocumentReadError,
  type DocumentOutline,
  type DocumentOutlinePdfField
} from '../types';

const MAX_LABELS = 60;
const MAX_LABEL_CHARS = 40;
const MAX_FIELDS = 80;
const MAX_FIELD_VALUE_CHARS = 60;

const INVALID_PDF_MESSAGE =
  '无法读取这个文件，它不是有效的 PDF 文档；请确认文件没有损坏或被改过后缀名。';
const PASSWORD_PDF_MESSAGE = '这份 PDF 受密码保护，请先解除保护后重试。';
const BROKEN_PDF_MESSAGE = '这个 PDF 没有读取成功，可能已损坏；请确认能正常打开后再试。';
const NO_TEXT_LAYER_MESSAGE =
  '这份 PDF 没有可识别的文字层（可能是扫描件），无法按文字标签定位；表单域仍可填写。';

type PdfTextItem = { text: string; x: number; width: number };

const readPageTextItems = async (data: Uint8Array): Promise<PdfTextItem[][]> => {
  let loadingTask: ReturnType<typeof pdfjs.getDocument>;
  try {
    loadingTask = pdfjs.getDocument({
      // 鲁港通 - pdfjs 会接管传入的缓冲区，复制一份避免调用方数据被分离
      data: new Uint8Array(data),
      isEvalSupported: false,
      disableFontFace: true,
      useWorkerFetch: false
    });
  } catch {
    throw new DocumentReadError(BROKEN_PDF_MESSAGE);
  }

  let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    if ((error as { name?: string })?.name === 'PasswordException') {
      throw new DocumentReadError(PASSWORD_PDF_MESSAGE);
    }
    throw new DocumentReadError(BROKEN_PDF_MESSAGE);
  }

  const pages: PdfTextItem[][] = [];
  try {
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const raw of content.items) {
        const item = raw as { str?: unknown; transform?: unknown; width?: unknown };
        const text = typeof item.str === 'string' ? item.str.trim() : '';
        const transform = item.transform;
        if (!text || !Array.isArray(transform) || transform.length < 6) continue;
        const x = Number(transform[4]);
        const width = Number(item.width);
        items.push({
          text,
          x: Number.isFinite(x) ? x : 0,
          width: Number.isFinite(width) && width > 0 ? width : 0
        });
      }
      pages.push(items);
      page.cleanup();
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }
  return pages;
};

const pickLabels = (pages: PdfTextItem[][]): string[] => {
  const labels: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const label = text.trim();
    if (!label || seen.has(label) || labels.length >= MAX_LABELS) return;
    seen.add(label);
    labels.push(label);
  };

  for (const items of pages) {
    for (const item of items) {
      if (item.text.length > MAX_LABEL_CHARS) continue;
      if (/[：:]$/.test(item.text)) push(item.text);
    }
  }
  // 鲁港通 - 没有明显「标签：」的表格改用页面上的短文字，模型才能知道能填哪些位置
  if (labels.length < 3) {
    for (const items of pages) {
      for (const item of items) {
        if (item.text.length <= 20) push(item.text);
      }
    }
  }
  return labels;
};

const readFields = (pdf: PDFDocument): DocumentOutlinePdfField[] => {
  const fields: DocumentOutlinePdfField[] = [];
  for (const field of pdf.getForm().getFields()) {
    if (fields.length >= MAX_FIELDS) break;
    const name = field.getName();
    if (field instanceof PDFTextField) {
      const value = field.getText()?.trim();
      fields.push({
        name,
        type: 'text',
        ...(value ? { value: value.slice(0, MAX_FIELD_VALUE_CHARS) } : {})
      });
      continue;
    }
    if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      const value = field.getSelected()?.[0];
      fields.push({
        name,
        type: field instanceof PDFDropdown ? 'dropdown' : 'optionlist',
        options: field.getOptions(),
        ...(value ? { value: value.slice(0, MAX_FIELD_VALUE_CHARS) } : {})
      });
      continue;
    }
    if (field instanceof PDFRadioGroup) {
      const value = field.getSelected();
      fields.push({
        name,
        type: 'radio',
        options: field.getOptions(),
        ...(value ? { value: value.slice(0, MAX_FIELD_VALUE_CHARS) } : {})
      });
      continue;
    }
    if (field instanceof PDFCheckBox) {
      fields.push({ name, type: 'checkbox', ...(field.isChecked() ? { value: '已勾选' } : {}) });
      continue;
    }
    fields.push({ name, type: 'other' });
  }
  return fields;
};

export const inspectPdf = async (
  buffer: Buffer,
  common: { fileName: string; sizeBytes: number; warnings: string[] }
): Promise<DocumentOutline> => {
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new DocumentReadError(INVALID_PDF_MESSAGE);
  }

  // 鲁港通 - pdf.js 能用空密码打开部分加密文件，必须用 pdf-lib 的加密标记先拦截
  let formPdf: PDFDocument | undefined;
  try {
    formPdf = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true });
  } catch {
    formPdf = undefined;
  }
  if (formPdf?.isEncrypted) throw new DocumentReadError(PASSWORD_PDF_MESSAGE);

  const pages = await readPageTextItems(new Uint8Array(buffer));
  const hasTextLayer = pages.some((items) => items.length > 0);
  const warnings = [...common.warnings];
  if (!hasTextLayer) warnings.push(NO_TEXT_LAYER_MESSAGE);

  let fields: DocumentOutlinePdfField[] | undefined;
  if (formPdf) {
    try {
      fields = readFields(formPdf);
    } catch {
      warnings.push(
        '这个 PDF 的表单域信息暂时读取不到（可能已加密或结构异常），填写前请确认字段名称。'
      );
    }
  }

  return {
    format: 'pdf',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    pages: pages.length,
    hasTextLayer,
    labels: hasTextLayer ? pickLabels(pages) : [],
    ...(fields ? { fields } : {}),
    ...(fields && fields.length >= MAX_FIELDS ? { fieldsTruncated: true } : {}),
    warnings
  };
};
