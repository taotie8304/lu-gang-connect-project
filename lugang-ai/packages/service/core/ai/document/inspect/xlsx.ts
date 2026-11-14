// 鲁港通 - Excel 提纲：列出工作表、表头与带地址的示例单元格，供模型按地址改值
import ExcelJS from 'exceljs';
import { hasZipMagic, loadDocumentArchive } from '../limits';
import { DocumentReadError, type DocumentOutline } from '../types';
import { columnLetters } from '../xlsxRefs';

const MAX_SHEETS = 12;
const MAX_SHEET_COLUMNS = 12;
const MAX_SAMPLE_ROWS = 8;
const MAX_CELL_PREVIEW = 60;
const HEADER_SCAN_ROWS = 20;
const MAX_DATA_SCAN_ROWS = 200;

const INVALID_XLSX_MESSAGE =
  '无法读取这个文件，它不是有效的 Excel（.xlsx）工作簿；请确认文件没有损坏或被改过后缀名。';

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

const isFormulaValue = (value: ExcelJS.CellValue): boolean => {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  const record = value as { formula?: unknown; sharedFormula?: unknown };
  return typeof record.formula === 'string' || typeof record.sharedFormula === 'string';
};

const readRowCells = (
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number
): Array<{ col: number; text: string; formula: boolean }> => {
  const cells: Array<{ col: number; text: string; formula: boolean }> = [];
  for (let column = 1; column <= columnCount; column += 1) {
    const cell = sheet.getRow(rowNumber).getCell(column);
    // 鲁港通 - 合并区域的从属格会镜像主格的值，只保留主格，避免一行标题被算成多列
    if (cell.master !== cell) continue;
    const text = readCellText(cell);
    if (!text) continue;
    cells.push({ col: column, text: text.slice(0, MAX_CELL_PREVIEW), formula: isFormulaValue(cell.value) });
  }
  return cells;
};

const pickHeaderRow = (sheet: ExcelJS.Worksheet, columnCount: number, rowCount: number) => {
  const scanEnd = Math.min(rowCount, HEADER_SCAN_ROWS);
  let fallback: { row: number; cells: ReturnType<typeof readRowCells> } | undefined;
  for (let rowNumber = 1; rowNumber <= scanEnd; rowNumber += 1) {
    const cells = readRowCells(sheet, rowNumber, columnCount);
    if (cells.length >= 2) return { row: rowNumber, cells };
    if (cells.length === 1 && !fallback) fallback = { row: rowNumber, cells };
  }
  return fallback;
};

export const inspectXlsx = async (
  buffer: Buffer,
  common: { fileName: string; sizeBytes: number; warnings: string[] }
): Promise<DocumentOutline> => {
  if (!hasZipMagic(buffer)) throw new DocumentReadError(INVALID_XLSX_MESSAGE);
  const zip = await loadDocumentArchive(buffer);
  const entryNames = Object.keys(zip.files);
  // 鲁港通 - 别的 OOXML（例如 Word）也能被 ExcelJS 当作空工作簿加载，先核对核心部件
  if (!zip.file('xl/workbook.xml') || !entryNames.some((name) => name.startsWith('xl/worksheets/'))) {
    throw new DocumentReadError(INVALID_XLSX_MESSAGE);
  }
  const warnings = [...common.warnings];
  if (entryNames.some((name) => name.startsWith('xl/charts/'))) {
    warnings.push('文件含图表，修改副本仍按手术式补丁只改目标单元格，请完成后核对图表。');
  }
  if (
    entryNames.some(
      (name) => name.startsWith('xl/pivotTables/') || name.startsWith('xl/pivotCache/')
    )
  ) {
    warnings.push('文件含数据透视表，修改后请在 Excel 里刷新透视表核对结果。');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // 鲁港通 - ExcelJS 自带的 Buffer 声明与 Node 的 Buffer 类型不一致，这里只做类型收窄
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new DocumentReadError(INVALID_XLSX_MESSAGE);
  }

  const worksheets = workbook.worksheets;
  const sheets: NonNullable<DocumentOutline['sheets']> = worksheets
    .slice(0, MAX_SHEETS)
    .map((sheet) => {
      const rowCount = sheet.rowCount || 0;
      const columnCount = sheet.columnCount || 0;
      const previewColumns = Math.min(Math.max(columnCount, 1), MAX_SHEET_COLUMNS);
      const header = pickHeaderRow(sheet, previewColumns, rowCount);
      const headerRow = header?.row ?? 0;

      const samples: NonNullable<DocumentOutline['sheets']>[number]['samples'] = [];
      const dataStart = headerRow + 1;
      const dataEnd = Math.min(rowCount, dataStart + MAX_DATA_SCAN_ROWS);
      for (let rowNumber = dataStart; rowNumber <= dataEnd; rowNumber += 1) {
        if (samples.length >= MAX_SAMPLE_ROWS) break;
        const cells = readRowCells(sheet, rowNumber, previewColumns);
        if (cells.length === 0) continue;
        samples.push({
          row: rowNumber,
          cells: cells.map((cell) => ({
            ref: `${columnLetters(cell.col)}${rowNumber}`,
            text: cell.text,
            ...(cell.formula ? { formula: true } : {})
          }))
        });
      }

      return {
        name: sheet.name,
        rowCount,
        columnCount,
        headerRow,
        header: header?.cells.map((cell) => cell.text) ?? [],
        samples
      };
    });

  return {
    format: 'xlsx',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    sheets,
    sheetCount: worksheets.length,
    ...(worksheets.length > sheets.length ? { sheetsTruncated: true } : {}),
    warnings
  };
};
