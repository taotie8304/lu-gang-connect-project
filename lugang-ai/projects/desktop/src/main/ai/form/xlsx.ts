// 鲁港通 - Excel（.xlsx）空白表单解析：支持“标签在左、空格在右”与“首行表头、下方空白”两种版式
import ExcelJS from 'exceljs';
import { cleanLabel, isValidLabel, kindForLabel } from './labels';
import { FormParseError, type RawFormField, type RawFormParse } from './types';

const MAX_SCAN_ROWS = 500;
const MAX_SCAN_COLUMNS = 50;
const SAMPLE_SHEET_NAME = /^(sample|example|demo|範例|示例|范例|例子|樣本|样本)/i;

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

const isMergedSlave = (cell: ExcelJS.Cell): boolean =>
  cell.isMerged && cell.master !== undefined && cell.master.address !== cell.address;

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
      const cell = row.getCell(columnIndex);
      // 鲁港通 - 合并区域的从属单元格会读到主单元格的值，按空白处理，避免整行备注被当成表头
      cells.push(isMergedSlave(cell) ? '' : readCellText(cell));
    }
    rows.push(cells);
    cellCounts.push(Math.min(row.cellCount || 0, columnLimit));
  }

  return { rows, cellCounts };
};

const TEMPLATE_PLACEHOLDER = /^[xX×]{2,}$/;

const isBlankValue = (value: string | undefined): boolean => {
  if (!value) return true;
  const text = value.trim();
  return text.length === 0 || /^[\s_＿]+$/.test(text) || TEMPLATE_PLACEHOLDER.test(text);
};

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

const isWritableCell = (sheet: ExcelJS.Worksheet, row: number, column: number): boolean =>
  !isMergedSlave(sheet.getCell(row, column));

// 鲁港通 - 标签格本身跨列合并，通常是「交流項目預算支出」这类区块标题，不是可填写字段
const isMergedLabel = (sheet: ExcelJS.Worksheet, row: number, column: number): boolean => {
  const cell = sheet.getCell(row, column);
  return cell.isMerged && cell.master !== undefined && cell.master.address === cell.address;
};

// 鲁港通 - 横向跨列合并的标题格说明这一行是分区/表格行，整行都不该被当成表单字段
const isWideMergedLabel = (sheet: ExcelJS.Worksheet, row: number, column: number): boolean => {
  const cell = sheet.getCell(row, column);
  if (!cell.isMerged || cell.master === undefined || cell.master.address !== cell.address) {
    return false;
  }
  const next = sheet.getCell(row, column + 1);
  return next.isMerged && next.master !== undefined && next.master.address === cell.address;
};

const hasWideMergedLabel = (
  sheet: ExcelJS.Worksheet,
  row: number,
  cells: string[]
): boolean =>
  cells.some((cell, columnIndex) => isFilled(cell) && isWideMergedLabel(sheet, row, columnIndex + 1));

// 鲁港通 - 竖排版式要求整行都是「标签 + 紧邻空格」；出现冒号、公式值等片段说明是表格行而非表单行
const isSimpleLabelRow = (row: string[]): boolean => {
  for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
    if (!isFilled(row[columnIndex])) continue;
    if (!isValidLabel(cleanLabel(row[columnIndex]))) return false;
    if (isFilled(row[columnIndex + 1])) return false;
    columnIndex += 1;
  }
  return true;
};

type VerticalParse = { fields: RawFormField[]; tableRows: number };

const parseVerticalSheet = (
  matrix: SheetMatrix,
  sheet: ExcelJS.Worksheet
): VerticalParse => {
  const fields: RawFormField[] = [];
  let tableRows = 0;
  matrix.rows.forEach((row, rowIndex) => {
    if ((matrix.cellCounts[rowIndex] ?? 0) < 2) return;
    if (hasWideMergedLabel(sheet, rowIndex + 1, row)) {
      tableRows += 1;
      return;
    }
    if (!isSimpleLabelRow(row)) return;
    for (let columnIndex = 0; columnIndex + 1 < row.length; ) {
      const label = cleanLabel(row[columnIndex]);
      if (isValidLabel(label) && !isFilled(row[columnIndex + 1])) {
        if (isMergedLabel(sheet, rowIndex + 1, columnIndex + 1)) {
          columnIndex += 1;
          continue;
        }
        const targetRow = rowIndex + 1;
        const targetColumn = columnIndex + 2;
        if (!isWritableCell(sheet, targetRow, targetColumn)) {
          columnIndex += 1;
          continue;
        }
        fields.push({
          label,
          kind: kindForLabel(label),
          locator: {
            type: 'xlsx-cell',
            sheet: sheet.name,
            row: targetRow,
            column: targetColumn
          }
        });
        columnIndex += 2;
      } else {
        columnIndex += 1;
      }
    }
  });
  return { fields, tableRows };
};

const parseHeaderSheet = (
  matrix: SheetMatrix,
  header: HeaderMatch,
  sheet: ExcelJS.Worksheet
): RawFormField[] => {
  const headerRow = matrix.rows[header.row];
  const fields: RawFormField[] = [];
  for (const columnIndex of header.columns) {
    const label = cleanLabel(headerRow[columnIndex]);
    if (!isValidLabel(label)) continue;
    const targetRow = header.row + 2;
    const targetColumn = columnIndex + 1;
    if (!isWritableCell(sheet, targetRow, targetColumn)) continue;
    fields.push({
      label,
      kind: kindForLabel(label),
      locator: {
        type: 'xlsx-cell',
        sheet: sheet.name,
        row: targetRow,
        column: targetColumn
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

  // 鲁港通 - 名为 Sample/示例 的工作表通常是已填好的示范，拿它匹配字段只会产生假字段
  const sampleSheets = workbook.worksheets.filter(
    (sheet) => sheet.rowCount > 0 && SAMPLE_SHEET_NAME.test(sheet.name.trim())
  );
  const sheets = workbook.worksheets.filter(
    (sheet) => sheet.rowCount > 0 && !SAMPLE_SHEET_NAME.test(sheet.name.trim())
  );
  if (sampleSheets.length > 0) {
    warnings.add(
      `工作表${sampleSheets.map((sheet) => `「${sheet.name}」`).join('、')}看起来是填写示例，已跳过，只按正式表格匹配字段。`
    );
  }
  if (sheets.length === 1) title = sheets[0].name;
  if (sheets.length > 1) {
    warnings.add('工作簿含多个工作表，自动填写会按每个工作表的结构分别匹配字段。');
  }

  let tableRows = 0;
  for (const sheet of sheets) {
    if (sheet.getImages().length > 0) {
      warnings.add('工作表含图片或图表，自动填写只覆盖文字单元格，请完成后检查版面。');
    }

    const matrix = readSheet(sheet);
    const header = findHeaderRow(matrix);
    const headerFields = header ? parseHeaderSheet(matrix, header, sheet) : [];
    if (headerFields.length > 0) {
      fields.push(...headerFields);
      continue;
    }
    // 鲁港通 - 表头路线一个字段都产不出时回退竖排解析，避免整张表被判成不可填写
    const vertical = parseVerticalSheet(matrix, sheet);
    fields.push(...vertical.fields);
    tableRows += vertical.tableRows;
  }

  if (tableRows > 0) {
    warnings.add('表单里的明细表/预算表区域没有纳入自动填写，请在副本里手工核对补充。');
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
