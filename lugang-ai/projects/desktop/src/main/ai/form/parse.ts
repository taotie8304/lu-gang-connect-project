// 鲁港通 - 本地表单解析入口：按扩展名分派，字段编号只在本机使用
import { basename, extname } from 'node:path';
import { parseDocxForm } from './docx';
import { parsePdfForm } from './pdf';
import { parseXlsxForm } from './xlsx';
import {
  FormParseError,
  type FormFormat,
  type FormSummary,
  type ParsedForm,
  type RawFormParse
} from './types';

export const MAX_FORM_FIELDS = 200;

const FORMAT_BY_EXTENSION: Record<string, FormFormat> = {
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.pdf': 'pdf'
};

const PARSE_BY_FORMAT: Record<FormFormat, (filePath: string) => Promise<RawFormParse>> = {
  docx: parseDocxForm,
  xlsx: parseXlsxForm,
  pdf: parsePdfForm
};

export const parseFormFile = async (filePath: string): Promise<ParsedForm> => {
  const format = FORMAT_BY_EXTENSION[extname(filePath).toLowerCase()];
  if (!format) {
    throw new FormParseError(
      'unsupported_format',
      '目前只支持 Word（.docx）、Excel（.xlsx）和可填写 PDF；请先另存为这些格式后再试。'
    );
  }

  let parsed: RawFormParse;
  try {
    parsed = await PARSE_BY_FORMAT[format](filePath);
  } catch (error) {
    if (error instanceof FormParseError) throw error;
    throw new FormParseError(
      'form_parse_failed',
      '无法读取这个表单文件，可能已损坏或格式不完整；请确认文件能正常打开后再试。'
    );
  }

  const fields = parsed.fields.slice(0, MAX_FORM_FIELDS).map((field, index) => ({
    id: `f${index + 1}`,
    ...field
  }));

  return {
    format: parsed.format,
    name: basename(filePath),
    ...(parsed.title ? { title: parsed.title } : {}),
    fields,
    ...(parsed.fields.length > MAX_FORM_FIELDS ? { fieldsTruncated: true } : {}),
    ...(parsed.warnings && parsed.warnings.length > 0 ? { warnings: parsed.warnings } : {}),
    path: filePath
  };
};

export const toFormSummary = (parsed: ParsedForm): FormSummary => ({
  format: parsed.format,
  name: parsed.name,
  ...(parsed.title ? { title: parsed.title } : {}),
  fields: parsed.fields.map(({ id, label, kind, required, options, hint }) => ({
    id,
    label,
    kind,
    ...(required !== undefined ? { required } : {}),
    ...(options ? { options } : {}),
    ...(hint ? { hint } : {})
  })),
  ...(parsed.fieldsTruncated ? { fieldsTruncated: true } : {}),
  ...(parsed.warnings && parsed.warnings.length > 0 ? { warnings: parsed.warnings } : {})
});
