// 鲁港通 - Excel 文档提纲：列出工作表、表头与样例行，并提示副本可能丢失的对象
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { DocumentParseError, type RawDocumentOutline } from './types';

const MAX_SHEETS = 12;
const MAX_SHEET_COLUMNS = 12;
const MAX_SAMPLE_ROWS = 8;
const MAX_CONTEXT_ROWS = 2;
const MAX_CELL_PREVIEW = 60;
const HEADER_SCAN_ROWS = 50;
const MAX_DATA_SCAN_ROWS = 500;
const MAX_TAIL_SCAN_ROWS = 200;

type ContentRow = {
  rowNumber: number;
  cells: string[];
  nonEmpty: number;
};

const readContentRow = (
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number
): ContentRow => {
  const cells = readRow(sheet, rowNumber, columnCount);
  return {
    rowNumber,
    cells,
    nonEmpty: cells.reduce((total, cell) => (cell === '' ? total : total + 1), 0)
  };
};

// 鲁港通 - 表格上方常有合并标题与说明行：取列数最多的内容行当表头，紧邻数据行的行优先
const pickHeaderRow = (rows: ContentRow[]): ContentRow | undefined => {
  let best: ContentRow | undefined;
  let bestScore = 0;
  rows.forEach((row, index) => {
    const nextIsContent = rows[index + 1]?.rowNumber === row.rowNumber + 1;
    const score = row.nonEmpty * 2 + (nextIsContent ? 1 : 0);
    if (!best || score > bestScore) {
      best = row;
      bestScore = score;
    }
  });
  return best;
};

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
    const cell = sheet.getRow(rowIndex).getCell(column);
    // 鲁港通 - 合并区域的从属格会镜像主格的值，只保留主格，避免一行标题被算成多列
    values.push(
      cell.master === cell ? readCellText(cell).slice(0, MAX_CELL_PREVIEW) : ''
    );
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

      const contentRows: ContentRow[] = [];
      for (let rowNumber = 1; rowNumber <= Math.min(rowCount, HEADER_SCAN_ROWS); rowNumber += 1) {
        const row = readContentRow(sheet, rowNumber, previewColumns);
        if (row.nonEmpty > 0) contentRows.push(row);
      }

      const headerRow = pickHeaderRow(contentRows);
      const headerRowNumber = headerRow?.rowNumber ?? 0;

      const contextRows: ContentRow[] = [];
      const headerIndex = headerRow ? contentRows.indexOf(headerRow) : -1;
      for (let index = headerIndex - 1; index >= 0 && contextRows.length < MAX_CONTEXT_ROWS; index -= 1) {
        contextRows.unshift(contentRows[index]);
      }

      const dataRows: ContentRow[] = [];
      const dataStart = headerRowNumber + 1;
      const dataScanEnd = Math.min(rowCount, dataStart + MAX_DATA_SCAN_ROWS);
      for (let rowNumber = dataStart; rowNumber <= dataScanEnd; rowNumber += 1) {
        if (dataRows.length >= MAX_SAMPLE_ROWS) break;
        const row = readContentRow(sheet, rowNumber, previewColumns);
        if (row.nonEmpty > 0) dataRows.push(row);
      }

      // 鲁港通 - 数据行多时保留末尾合计行，模型才能看到总计口径
      const lastIncluded = dataRows[dataRows.length - 1]?.rowNumber ?? 0;
      if (rowCount > lastIncluded) {
        for (
          let rowNumber = rowCount;
          rowNumber > lastIncluded && rowNumber > rowCount - MAX_TAIL_SCAN_ROWS;
          rowNumber -= 1
        ) {
          const row = readContentRow(sheet, rowNumber, previewColumns);
          if (row.nonEmpty === 0) continue;
          if (rowNumber > lastIncluded) {
            if (dataRows.length >= MAX_SAMPLE_ROWS) dataRows.pop();
            dataRows.push(row);
          }
          break;
        }
      }

      const sampleRows = [...contextRows, ...dataRows];
      if (sheet.getImages().length > 0) {
        warnings.add('工作表含图片，副本会尽量保留图片，请完成后核对版面。');
      }
      return {
        name: sheet.name,
        rowCount,
        columnCount,
        headerRow: headerRowNumber,
        header: headerRow?.cells ?? [],
        sampleRows: sampleRows.map((row) => row.cells),
        sampleRowNumbers: sampleRows.map((row) => row.rowNumber)
      };
    });

  return {
    format: 'xlsx',
    sheets,
    ...(worksheets.length > sheets.length ? { sheetsTruncated: true } : {}),
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};