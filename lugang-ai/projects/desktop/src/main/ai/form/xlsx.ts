// 鲁港通 - Excel（.xlsx）空白表单解析：支持“标签在左、空格在右”与“首行表头、下方空白”两种版式
import ExcelJS from 'exceljs';
import { cleanLabel, isValidLabel, kindForLabel } from './labels';
import { FormParseError, type RawFormField, type RawFormParse } from './types';

const MAX_SCAN_ROWS = 500;
const MAX_SCAN_COLUMNS = 50;

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
      formula?: unknown;
    };
    if (Array.isArray(record.richText)) {
      return record.richText.map((item) => item.text ?? '').join('').trim();
    }
    if (typeof record.text === 'string') return record.text.trim();
    if (record.result !== undefined && record.result !== null) return String(record.result).trim();
  }
  return '';
};

type SheetMatrix = {
  rows: string[][];
  cellCounts: number[];
};

const readSheet = (sheet: ExcelJS.Worksheet): SheetMatrix => {
  const rowLimit = Math.min(sheet.rowCount || 0, MAX_SCAN_ROWS);
  const columnLimit = Math.min(sheet.columnCount || 0, MAX_SCAN_COLUMNS);
  const rows: string[][] = [];
  const cellCounts: number[] = [];

  for (let rowIndex = 1; rowIndex <= rowLimit; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const cells: string[] = [];
    for (let columnIndex = 1; columnIndex <= columnLimit; columnIndex += 1) {
      cells.push(readCellText(row.getCell(columnIndex)));
    }
    rows.push(cells);
    cellCounts.push(Math.min(row.cellCount || 0, columnLimit));
  }

  return { rows, cellCounts };
};

const isBlankValue = (value: string | undefined): boolean => !value || /^[\s_＿]*$/.test(value);

const isFilled = (value: string | undefined): boolean => !isBlankValue(value);

const isBlankRow = (row: string[] | undefined): boolean =>
  !row || row.every((cell) => isBlankValue(cell));

type HeaderMatch = { row: number; columns: number[] };

const findHeaderRow = (matrix: SheetMatrix): HeaderMatch | undefined => {
  for (let rowIndex = 0; rowIndex < matrix.rows.length; rowIndex += 1) {
    const row = matrix.rows[rowIndex];
    const filledColumns = row
      .map((cell, columnIndex) => (isFilled(cell) ? columnIndex : -1))
      .filter((columnIndex) => columnIndex >= 0);
    if (filledColumns.length < 2) continue;
    if (!filledColumns.every((columnIndex) => isValidLabel(cleanLabel(row[columnIndex])))) continue;
    if (!isBlankRow(matrix.rows[rowIndex + 1])) continue;
    return { row: rowIndex, columns: filledColumns };
  }
  return undefined;
};

const parseVerticalSheet = (matrix: SheetMatrix, sheetName: string): RawFormField[] => {
  const fields: RawFormField[] = [];
  matrix.rows.forEach((row, rowIndex) => {
    if ((matrix.cellCounts[rowIndex] ?? 0) < 2) return;
    for (let columnIndex = 0; columnIndex + 1 < row.length; ) {
      const label = cleanLabel(row[columnIndex]);
      if (isValidLabel(label) && !isFilled(row[columnIndex + 1])) {
        fields.push({
          label,
          kind: kindForLabel(label),
          locator: {
            type: 'xlsx-cell',
            sheet: sheetName,
            row: rowIndex + 1,
            column: columnIndex + 2
          }
        });
        columnIndex += 2;
      } else {
        columnIndex += 1;
      }
    }
  });
  return fields;
};

const parseHeaderSheet = (
  matrix: SheetMatrix,
  header: HeaderMatch,
  sheetName: string
): RawFormField[] => {
  const headerRow = matrix.rows[header.row];
  const fields: RawFormField[] = [];
  for (const columnIndex of header.columns) {
    const label = cleanLabel(headerRow[columnIndex]);
    if (!isValidLabel(label)) continue;
    fields.push({
      label,
      kind: kindForLabel(label),
      locator: {
        type: 'xlsx-cell',
        sheet: sheetName,
        row: header.row + 2,
        column: columnIndex + 1
      }
    });
  }
  return fields;
};

export const parseXlsxForm = async (filePath: string): Promise<RawFormParse> => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    throw new FormParseError(
      'form_parse_failed',
      '无法读取这个 Excel 文件，可能已损坏或不是 .xlsx 格式；请用 Excel 另存为 .xlsx 后再试。'
    );
  }

  const fields: RawFormField[] = [];
  const warnings = new Set<string>();
  let title: string | undefined;

  const sheets = workbook.worksheets.filter((sheet) => sheet.rowCount > 0);
  if (sheets.length === 1) title = sheets[0].name;
  if (sheets.length > 1) {
    warnings.add('工作簿含多个工作表，自动填写会按每个工作表的结构分别匹配字段。');
  }

  for (const sheet of sheets) {
    if (sheet.getImages().length > 0) {
      warnings.add('工作表含图片或图表，自动填写只覆盖文字单元格，请完成后检查版面。');
    }

    const matrix = readSheet(sheet);
    const header = findHeaderRow(matrix);
    const sheetFields = header
      ? parseHeaderSheet(matrix, header, sheet.name)
      : parseVerticalSheet(matrix, sheet.name);
    fields.push(...sheetFields);
  }

  if (fields.length === 0) {
    throw new FormParseError(
      'form_not_fillable',
      '没有在 Excel 里找到可填写的空白单元格；请确认左侧有标签、右侧留空的表格结构，或改用 Word / 可填写 PDF。'
    );
  }

  return {
    format: 'xlsx',
    ...(title ? { title } : {}),
    fields,
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};
