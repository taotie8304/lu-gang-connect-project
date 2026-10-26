// 鲁港通 - 本地表单回填：生成“原名-已填写”副本，原文件永不修改
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from '../fileNaming';
import { fillDocxDocument } from './docxFill';
import { fillPdfDocument } from './pdfFill';
import { fillXlsxDocument } from './xlsxFill';
import {
  FormFillError,
  type FilledFormCopy,
  type FormFillEntry,
  type FormFillValue,
  type ParsedForm
} from './types';

export type FillFormCopyOptions = {
  form: ParsedForm;
  values: FormFillValue[];
  /** 下载目录：副本统一放进其下的「鲁港通生成文件」子目录 */
  outputDir: string;
  now?: Date;
};

const resolveEntries = (
  form: ParsedForm,
  values: FormFillValue[]
): { entries: FormFillEntry[]; skipped: string[] } => {
  const fields = new Map(form.fields.map((field) => [field.id, field]));
  const accepted = new Map<string, { field: FormFillEntry['field']; value: string }>();
  const skipped: string[] = [];

  for (const item of values) {
    const field = fields.get(item.id);
    if (!field) {
      skipped.push(`无法识别字段「${item.id}」，已跳过`);
      continue;
    }
    const value = typeof item.value === 'string' ? item.value.trim() : '';
    if (!value) {
      skipped.push(`「${field.label}」的填写内容为空白，已跳过`);
      continue;
    }
    accepted.set(field.id, { field, value });
  }

  return {
    entries: [...accepted.values()],
    skipped
  };
};

const writeDocxCopy = (form: ParsedForm, targetPath: string, entries: FormFillEntry[]) => {
  const zip = new AdmZip(form.path);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new FormFillError('form_fill_failed', '这个 Word 文件缺少正文，无法生成填写副本。');
  }
  const result = fillDocxDocument(zip.readAsText(entry, 'utf8'), entries);
  zip.updateFile('word/document.xml', Buffer.from(result.xml, 'utf8'));
  zip.writeZip(targetPath);
  return result;
};

const writeXlsxCopy = async (
  form: ParsedForm,
  targetPath: string,
  entries: FormFillEntry[]
) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(form.path);
  const result = fillXlsxDocument(workbook, entries);
  await workbook.xlsx.writeFile(targetPath);
  return result;
};

const writePdfCopy = async (
  form: ParsedForm,
  targetPath: string,
  entries: FormFillEntry[]
) => {
  const bytes = new Uint8Array(await readFile(form.path));
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const result = await fillPdfDocument(document, entries);
  await writeFile(targetPath, await document.save());
  return result;
};

export const fillFormCopy = async (options: FillFormCopyOptions): Promise<FilledFormCopy> => {
  const { form } = options;
  const folder = join(options.outputDir, GENERATED_FILE_FOLDER);
  await mkdir(folder, { recursive: true });

  const baseName = basename(form.name, extname(form.name));
  const name = resolveGeneratedFileName({
    fileName: `${baseName}-已填写`,
    format: form.format,
    exists: (candidate) => existsSync(join(folder, candidate)),
    ...(options.now ? { now: options.now } : {})
  });
  const path = join(folder, name);

  const { entries, skipped } = resolveEntries(form, options.values);
  const warnings = new Set(form.warnings ?? []);

  let result: { filled: number; skipped: string[] };
  try {
    if (form.format === 'docx') {
      result = writeDocxCopy(form, path, entries);
    } else if (form.format === 'xlsx') {
      result = await writeXlsxCopy(form, path, entries);
    } else {
      result = await writePdfCopy(form, path, entries);
    }
  } catch (error) {
    if (error instanceof FormFillError) throw error;
    throw new FormFillError(
      'form_fill_failed',
      '填写副本没有生成成功，请重试一次；如果仍然失败，请手动填写原表单。'
    );
  }

  skipped.push(...result.skipped);
  return {
    name,
    format: form.format,
    folder,
    path,
    filled: result.filled,
    skipped,
    warnings: [...warnings]
  };
};
