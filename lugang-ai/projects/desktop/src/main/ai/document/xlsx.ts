// 鲁港通 - Excel 文档提纲：列出工作表、表头与样例行，并提示副本可能丢失的对象
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { DocumentParseError, type RawDocumentOutline } from './types';

const MAX_SHEETS = 12;
const MAX_SHEET_COLUMNS = 8;
const MAX_SAMPLE_ROWS = 3;
const MAX_CELL_PREVIEW = 60;

const readCellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const record = value as {
      richText?: Array<{ text?: string }>;
      text?: unknown;
      result?: unknown;
    };
    if (Array.isArray(record.richText)) {
      return record.richText.map((item) => item.text ?? '').join('').trim();
    }
    if (typeof record.text === 'string') return record.text.trim();
    if (record.result !== undefined && record.result !== null) {
      return String(record.result).trim();
    }
  }
  return '';
};

const readRow = (sheet: ExcelJS.Worksheet, rowIndex: number, columnCount: number): string[] => {
  const values: string[] = [];
  for (let column = 1; column <= columnCount; column += 1) {
    values.push(readCellText(sheet.getRow(rowIndex).getCell(column)).slice(0, MAX_CELL_PREVIEW));
  }
  while (values.length > 0 && values[values.length - 1] === '') values.pop();
  return values;
};

const detectObjectRisks = (filePath: string): string[] => {
  let entries: AdmZip.IZipEntry[];
  try {
    entries = new AdmZip(filePath).getEntries();
  } catch {
    return [];
  }

  const names = entries.map((entry) => entry.entryName);
  const warnings: string[] = [];
  if (names.some((name) => name.startsWith('xl/charts/'))) {
    warnings.push('文件含图表，生成的副本可能丢失图表，请保留原件并核对副本。');
  }
  if (names.some((name) => name.startsWith('xl/pivotTables/') || name.startsWith('xl/pivotCache/'))) {
    warnings.push('文件含数据透视表，生成的副本可能丢失透视表，请保留原件并核对副本。');
  }
  return warnings;
};

export const parseXlsxDocument = async (filePath: string): Promise<RawDocumentOutline> => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    throw new DocumentParseError(
      'document_parse_failed',
      '无法读取这个 Excel 文件，可能已损坏或不是 .xlsx 格式；请用 Excel 另存为 .xlsx 后再试。'
    );
  }

  const worksheets = workbook.worksheets;
  const warnings = new Set(detectObjectRisks(filePath));

  const sheets: NonNullable<RawDocumentOutline['sheets']> = worksheets
    .slice(0, MAX_SHEETS)
    .map((sheet) => {
      const rowCount = sheet.rowCount || 0;
      const columnCount = sheet.columnCount || 0;
      const previewColumns = Math.min(columnCount, MAX_SHEET_COLUMNS);
      const sampleRows: string[][] = [];
      for (
        let rowIndex = 2;
        rowIndex <= Math.min(rowCount, 1 + MAX_SAMPLE_ROWS);
        rowIndex += 1
      ) {
        const row = readRow(sheet, rowIndex, previewColumns);
        if (row.length > 0) sampleRows.push(row);
      }
      if (sheet.getImages().length > 0) {
        warnings.add('工作表含图片，副本会尽量保留图片，请完成后核对版面。');
      }
      return {
        name: sheet.name,
        rowCount,
        columnCount,
        header: rowCount > 0 ? readRow(sheet, 1, previewColumns) : [],
        sampleRows
      };
    });

  return {
    format: 'xlsx',
    sheets,
    ...(worksheets.length > sheets.length ? { sheetsTruncated: true } : {}),
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};