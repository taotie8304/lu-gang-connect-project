// 鲁港通 - Excel 生成器：沿用桌面端表头/列宽/合并/冻结与公式白名单逻辑
import ExcelJS from 'exceljs';
import type { GeneratedSheet } from '../../llm/agentLoop/domain/systemTool/generatedSchema';
import { isSafeFormula } from '../formulaSafety';
import {
  assertGenerateInputWithinLimits,
  DocumentGenerationError,
  type DocumentGenerateInput
} from '../types';

const INVALID_SHEET_NAME = /[\\/*?:[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

const resolveSheetName = (raw: string | undefined, index: number, used: Set<string>): string => {
  const fallback = `Sheet${index + 1}`;
  const base = (raw ?? '')
    .replace(INVALID_SHEET_NAME, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH)
    .replace(/[. ]+$/g, '');
  const stem = base || fallback;
  let name = stem;
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    const tail = `(${suffix})`;
    name = `${stem.slice(0, MAX_SHEET_NAME_LENGTH - tail.length).replace(/[. ]+$/g, '')}${tail}`;
    suffix += 1;
  }
  used.add(name.toLowerCase());
  return name;
};

const appendRow = (sheet: ExcelJS.Worksheet, values: string[]): ExcelJS.Row => {
  const row = sheet.addRow([]);
  values.forEach((value, index) => {
    const cell = row.getCell(index + 1);
    const text = value ?? '';
    if (text.length > 1 && text.startsWith('=') && isSafeFormula(text.slice(1))) {
      cell.value = { formula: text.slice(1) };
    } else {
      cell.value = text;
    }
  });
  return row;
};

const styleHeaderRow = (row: ExcelJS.Row): void => {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
};

// 鲁港通 - 中文按两格宽度估算，避免中文表头被切得太窄
const displayWidth = (value: string): number =>
  Array.from(value).reduce((total, char) => total + (char.charCodeAt(0) > 0xff ? 2 : 1), 0);

const autofitColumnWidth = (values: string[]): number => {
  const longest = values.reduce((max, value) => Math.max(max, displayWidth(value)), 0);
  return Math.min(60, Math.max(10, longest + 2));
};

const applyColumnWidths = (
  sheet: ExcelJS.Worksheet,
  header: string[],
  rows: string[][],
  widths: number[] | undefined
): void => {
  const columnCount = Math.max(header.length, ...rows.map((row) => row.length), widths?.length ?? 0);
  for (let index = 1; index <= columnCount; index += 1) {
    const explicit = widths?.[index - 1];
    sheet.getColumn(index).width =
      explicit ??
      autofitColumnWidth([header[index - 1] ?? '', ...rows.map((row) => row[index - 1] ?? '')]);
  }
};

const applyMerges = (sheet: ExcelJS.Worksheet, merges: string[] | undefined): void => {
  for (const range of merges ?? []) {
    try {
      sheet.mergeCells(range.toUpperCase());
    } catch {
      // 鲁港通 - 重叠或越界的合并范围直接跳过，不影响其余内容
    }
  }
};

const writeSheet = (
  workbook: ExcelJS.Workbook,
  sheetInput: GeneratedSheet,
  index: number,
  used: Set<string>
): void => {
  const sheet = workbook.addWorksheet(resolveSheetName(sheetInput.name, index, used));
  const header = sheetInput.header ?? [];
  const rows = sheetInput.rows ?? [];

  if (header.length > 0) {
    styleHeaderRow(appendRow(sheet, header));
    if (sheetInput.freeze !== false) {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }
  for (const row of rows) appendRow(sheet, row);
  applyColumnWidths(sheet, header, rows, sheetInput.widths);
  applyMerges(sheet, sheetInput.merges);
};

/**
 * 鲁港通 - 生成 Excel 文档 Buffer；上限或空缺内容抛出可直接展示的中文错误。
 */
export const generateXlsx = async (input: DocumentGenerateInput): Promise<Buffer> => {
  assertGenerateInputWithinLimits(input);

  const sheets = input.sheets ?? [];
  if (sheets.length === 0) {
    throw new DocumentGenerationError('生成 Excel 需要用 sheets 提供工作表内容');
  }

  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  sheets.forEach((sheetInput, index) => writeSheet(workbook, sheetInput, index, used));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};
