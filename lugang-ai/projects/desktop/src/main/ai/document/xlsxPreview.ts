// 鲁港通 - Excel 预览模型：工作表网格 + 逐条改动模拟 + 单元格黄底标记
import ExcelJS from 'exceljs';
import type { DocumentEditOperation } from '../protocol';
import type { PreviewChange, PreviewMark, PreviewTableCellMark } from './docxPreview';
import { DocumentParseError } from './types';
import {
  CELL_REFERENCE,
  MAX_REPLACEMENTS,
  MAX_SCAN_COLUMNS,
  MAX_SCAN_ROWS,
  columnIndex,
  findSheet,
  isFormulaCell,
  isMergedSlave,
  readCellText
} from './xlsxEdit';

export const MAX_XLSX_PREVIEW_ROWS = 200;
export const MAX_XLSX_PREVIEW_COLUMNS = 26;
export const MAX_XLSX_PREVIEW_SHEETS = 12;
const MAX_PREVIEW_CELL_CHARS = 120;

export type XlsxPreviewSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  rows: string[][];
  truncatedRows: boolean;
  truncatedColumns: boolean;
};

export type XlsxPreviewModel = {
  workbook: ExcelJS.Workbook;
  sheets: XlsxPreviewSheet[];
};

export type XlsxAppendedRow = {
  rowNumber: number;
  values: string[];
  mark: PreviewMark;
};

export type XlsxSheetView = XlsxPreviewSheet & {
  header: string[];
  sampleRows: string[][];
  cellMarks?: PreviewTableCellMark[];
  appendedRows?: XlsxAppendedRow[];
};

const unavailable = (index: number, note: string): PreviewChange => ({
  index,
  target: '不适用',
  before: '',
  after: '',
  status: 'unavailable',
  scope: 'none',
  note
});

const sheetText = (sheet: ExcelJS.Worksheet, row: number, column: number): string =>
  readCellText(sheet.getCell(row, column));

const countMatches = (sheet: ExcelJS.Worksheet, find: string, limit: number): number => {
  let count = 0;
  const rowLimit = Math.min(sheet.rowCount || 0, MAX_SCAN_ROWS);
  const columnLimit = Math.min(sheet.columnCount || 0, MAX_SCAN_COLUMNS);
  for (let row = 1; row <= rowLimit && count < limit; row += 1) {
    for (let column = 1; column <= columnLimit && count < limit; column += 1) {
      const cell = sheet.getCell(row, column);
      if (isMergedSlave(cell) || isFormulaCell(cell)) continue;
      const text = readCellText(cell);
      if (!text.includes(find)) continue;
      let from = 0;
      for (;;) {
        const at = text.indexOf(find, from);
        if (at < 0) break;
        count += 1;
        from = at + find.length;
        if (count >= limit) break;
      }
    }
  }
  return count;
};

export const extractXlsxPreview = async (filePath: string): Promise<XlsxPreviewModel> => {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    throw new DocumentParseError(
      'document_parse_failed',
      '无法读取这个 Excel 文件，可能已损坏或不是 .xlsx 格式；请用 Excel 另存为 .xlsx 后再试。'
    );
  }

  const sheets = workbook.worksheets.slice(0, MAX_XLSX_PREVIEW_SHEETS).map((sheet) => {
    const rowCount = sheet.rowCount || 0;
    const columnCount = sheet.columnCount || 0;
    const rowLimit = Math.min(rowCount, MAX_XLSX_PREVIEW_ROWS);
    const columnLimit = Math.min(columnCount, MAX_XLSX_PREVIEW_COLUMNS);
    const rows: string[][] = [];
    for (let row = 1; row <= rowLimit; row += 1) {
      const values: string[] = [];
      for (let column = 1; column <= columnLimit; column += 1) {
        values.push(sheetText(sheet, row, column).slice(0, MAX_PREVIEW_CELL_CHARS));
      }
      rows.push(values);
    }
    return {
      name: sheet.name,
      rowCount,
      columnCount,
      rows,
      truncatedRows: rowCount > rowLimit,
      truncatedColumns: columnCount > columnLimit
    };
  });

  return { workbook, sheets };
};

type AppendCursor = Map<number, number>;

const buildSetCellChange = (
  model: XlsxPreviewModel,
  operation: Extract<DocumentEditOperation, { op: 'set_cell' }>,
  index: number
): PreviewChange => {
  const sheet = findSheet(model.workbook, operation.sheet);
  if (!sheet) return unavailable(index, `工作表「${operation.sheet}」不存在，这一条会跳过。`);
  const match = CELL_REFERENCE.exec(operation.cell);
  if (!match) return unavailable(index, `单元格「${operation.cell}」格式不正确，这一条会跳过。`);

  const row = Number(match[2]);
  const column = columnIndex(match[1]);
  const cell = sheet.getCell(row, column);
  const target = isMergedSlave(cell) && cell.master ? (cell.master as ExcelJS.Cell) : cell;
  const notes: string[] = [];
  if (target !== cell) notes.push(`这是合并单元格，会写入主格 ${target.address}。`);
  if (isFormulaCell(target)) notes.push('这个单元格原本是公式，采用后会替换成新内容。');

  return {
    index,
    target: `工作表「${sheet.name}」${target.address}`,
    before: readCellText(target),
    after: operation.value,
    status: 'pending',
    scope: 'table',
    ...(notes.length > 0 ? { note: notes.join(' ') } : {})
  };
};

const buildAppendRowChange = (
  model: XlsxPreviewModel,
  operation: Extract<DocumentEditOperation, { op: 'append_row' }>,
  index: number,
  cursor: AppendCursor
): PreviewChange => {
  const sheet = findSheet(model.workbook, operation.sheet);
  if (!sheet) return unavailable(index, `工作表「${operation.sheet}」不存在，这一条会跳过。`);
  const appended = cursor.get(sheet.id) ?? 0;
  cursor.set(sheet.id, appended + 1);
  const rowNumber = (sheet.rowCount || 0) + appended + 1;
  return {
    index,
    target: `工作表「${sheet.name}」新增第 ${rowNumber} 行`,
    before: '',
    after: operation.values.join(' · '),
    status: 'pending',
    scope: 'table'
  };
};

const buildReplaceTextChange = (
  model: XlsxPreviewModel,
  operation: Extract<DocumentEditOperation, { op: 'replace_text' }>,
  index: number
): PreviewChange => {
  if (operation.paragraph !== undefined) {
    return unavailable(index, '按段落替换只适用于 Word，Excel 会跳过这一条。');
  }

  let sheets: ExcelJS.Worksheet[];
  if (operation.sheet) {
    const sheet = findSheet(model.workbook, operation.sheet);
    if (!sheet) return unavailable(index, `工作表「${operation.sheet}」不存在，这一条会跳过。`);
    sheets = [sheet];
  } else {
    sheets = model.workbook.worksheets;
  }

  let matched = 0;
  for (const sheet of sheets) {
    matched += countMatches(sheet, operation.find, MAX_REPLACEMENTS - matched);
    if (matched >= MAX_REPLACEMENTS) break;
  }
  if (matched === 0) {
    return unavailable(index, `没有找到「${operation.find}」，这一条会跳过。`);
  }

  return {
    index,
    target: operation.sheet
      ? `工作表「${operation.sheet}」共 ${matched} 处`
      : `全部工作表共 ${matched} 处`,
    before: operation.find,
    after: operation.replace,
    status: 'pending',
    scope: 'document',
    ...(matched >= MAX_REPLACEMENTS
      ? { note: `命中处数较多，只会处理前 ${MAX_REPLACEMENTS} 处。` }
      : {})
  };
};

export const buildXlsxPreviewChanges = (
  model: XlsxPreviewModel,
  operations: DocumentEditOperation[]
): PreviewChange[] => {
  const cursor: AppendCursor = new Map();
  return operations.map((operation, index) => {
    if (operation.op === 'set_cell') return buildSetCellChange(model, operation, index);
    if (operation.op === 'append_row') return buildAppendRowChange(model, operation, index, cursor);
    if (operation.op === 'replace_text') return buildReplaceTextChange(model, operation, index);
    return unavailable(index, '段落操作只适用于 Word，Excel 会跳过这一条。');
  });
};

type SheetState = {
  sheet: ExcelJS.Worksheet;
  rows: string[][];
  cellMarks: PreviewTableCellMark[];
  appendedRows: XlsxAppendedRow[];
};

const mergeMark = (current: PreviewMark | undefined, next: PreviewMark): PreviewMark =>
  current === 'pending' || next === 'pending' ? 'pending' : 'applied';

const markCell = (
  state: SheetState,
  row: number,
  column: number,
  mark: PreviewMark,
  original: string
): void => {
  const existing = state.cellMarks.find((item) => item.row === row && item.cell === column);
  if (existing) {
    existing.mark = mergeMark(existing.mark, mark);
    return;
  }
  state.cellMarks.push({ row, cell: column, mark, original });
};

const applyReplaceToGrid = (
  state: SheetState,
  find: string,
  replace: string,
  mark: PreviewMark
): void => {
  state.rows.forEach((values, rowIndex) => {
    values.forEach((text, columnIndexValue) => {
      if (!text.includes(find)) return;
      const cell = state.sheet.getCell(rowIndex + 1, columnIndexValue + 1);
      if (isMergedSlave(cell) || isFormulaCell(cell)) return;
      markCell(state, rowIndex, columnIndexValue, mark, text);
      values[columnIndexValue] = text.split(find).join(replace);
    });
  });
};

export const computeXlsxPreviewSheets = (
  model: XlsxPreviewModel,
  operations: DocumentEditOperation[],
  changes: PreviewChange[]
): XlsxSheetView[] => {
  const states = new Map<number, SheetState>();
  for (const sheet of model.workbook.worksheets) {
    const preview = model.sheets.find((item) => item.name === sheet.name);
    states.set(sheet.id, {
      sheet,
      rows: (preview?.rows ?? []).map((row) => [...row]),
      cellMarks: [],
      appendedRows: []
    });
  }

  const appendCursor: AppendCursor = new Map();
  operations.forEach((operation, index) => {
    const change = changes[index];
    if (!change || (change.status !== 'pending' && change.status !== 'applied')) return;
    const mark: PreviewMark = change.status;

    if (operation.op === 'set_cell') {
      const sheet = findSheet(model.workbook, operation.sheet);
      const match = CELL_REFERENCE.exec(operation.cell);
      if (!sheet || !match) return;
      const state = states.get(sheet.id);
      if (!state) return;
      const row = Number(match[2]) - 1;
      const column = columnIndex(match[1]) - 1;
      if (row < 0 || row >= state.rows.length) return;
      if (column < 0 || column >= (state.rows[row]?.length ?? 0)) return;
      const original = state.rows[row][column];
      markCell(state, row, column, mark, original);
      state.rows[row][column] = operation.value;
      return;
    }

    if (operation.op === 'append_row') {
      const sheet = findSheet(model.workbook, operation.sheet);
      if (!sheet) return;
      const state = states.get(sheet.id);
      if (!state) return;
      const appended = appendCursor.get(sheet.id) ?? 0;
      appendCursor.set(sheet.id, appended + 1);
      state.appendedRows.push({
        rowNumber: (sheet.rowCount || 0) + appended + 1,
        values: [...operation.values],
        mark
      });
      return;
    }

    if (operation.op === 'replace_text') {
      if (operation.paragraph !== undefined) return;
      const sheets = operation.sheet
        ? [findSheet(model.workbook, operation.sheet)].filter(
            (sheet): sheet is ExcelJS.Worksheet => Boolean(sheet)
          )
        : model.workbook.worksheets;
      for (const sheet of sheets) {
        const state = states.get(sheet.id);
        if (!state) continue;
        applyReplaceToGrid(state, operation.find, operation.replace, mark);
      }
    }
  });

  return model.sheets.map((preview) => {
    const sheet = model.workbook.worksheets.find((item) => item.name === preview.name);
    const state = sheet ? states.get(sheet.id) : undefined;
    const rows = state?.rows ?? preview.rows;
    return {
      ...preview,
      rows,
      header: rows[0] ? [...rows[0]] : [],
      sampleRows: rows.slice(1, 4).map((row) => [...row]),
      ...(state && state.cellMarks.length > 0
        ? { cellMarks: state.cellMarks.map((mark) => ({ ...mark })) }
        : {}),
      ...(state && state.appendedRows.length > 0
        ? { appendedRows: state.appendedRows.map((row) => ({ ...row, values: [...row.values] })) }
        : {})
    };
  });
};
