// 鲁港通 - 本机文档解析入口：按扩展名分派，提纲只含结构与摘要，不含文件路径
import { basename, extname } from 'node:path';
import { parseDocxDocument } from './docx';
import { parseXlsxDocument } from './xlsx';
import {
  DocumentParseError,
  type DocumentFormat,
  type DocumentSummary,
  type ParsedDocument,
  type RawDocumentOutline
} from './types';

const PARSERS: Record<DocumentFormat, (filePath: string) => Promise<RawDocumentOutline>> = {
  docx: parseDocxDocument,
  xlsx: parseXlsxDocument
};

const FORMAT_BY_EXTENSION: Record<string, DocumentFormat> = {
  '.docx': 'docx',
  '.xlsx': 'xlsx'
};

export const parseDocumentFile = async (filePath: string): Promise<ParsedDocument> => {
  const format = FORMAT_BY_EXTENSION[extname(filePath).toLowerCase()];
  if (!format) {
    throw new DocumentParseError(
      'unsupported_format',
      '目前只能修改 Word（.docx）与 Excel（.xlsx）文件；.doc / .xls 请先用 Office 另存为新格式后再试。'
    );
  }

  try {
    const outline = await PARSERS[format](filePath);
    return { ...outline, name: basename(filePath), path: filePath };
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(
      'document_parse_failed',
      '无法读取这个文件，可能已损坏或格式不完整；请确认文件能正常打开后再试。'
    );
  }
};

export const toDocumentSummary = (parsed: ParsedDocument): DocumentSummary => ({
  format: parsed.format,
  name: parsed.name,
  ...(parsed.paragraphs ? { paragraphs: parsed.paragraphs } : {}),
  ...(parsed.tables ? { tables: parsed.tables } : {}),
  ...(parsed.paragraphsTruncated ? { paragraphsTruncated: true } : {}),
  ...(parsed.sheets ? { sheets: parsed.sheets } : {}),
  ...(parsed.sheetsTruncated ? { sheetsTruncated: true } : {}),
  ...(parsed.warnings && parsed.warnings.length > 0 ? { warnings: parsed.warnings } : {})
});