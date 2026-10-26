// 鲁港通 - Excel 表单回填：按工作表与单元格坐标写入副本
import type ExcelJS from 'exceljs';
import type { FormFillEntry } from './types';

export const fillXlsxDocument = (
  workbook: ExcelJS.Workbook,
  entries: FormFillEntry[]
): { filled: number; skipped: string[] } => {
  let filled = 0;
  const skipped: string[] = [];

  for (const { field, value } of entries) {
    const locator = field.locator;
    if (locator.type !== 'xlsx-cell') {
      skipped.push(`「${field.label}」不在 Excel 单元格里，已跳过`);
      continue;
    }
    const sheet = workbook.getWorksheet(locator.sheet);
    if (!sheet) {
      skipped.push(`「${field.label}」所在的工作表已不存在，已跳过`);
      continue;
    }
    sheet.getCell(locator.row, locator.column).value = value;
    filled += 1;
  }

  return { filled, skipped };
};
