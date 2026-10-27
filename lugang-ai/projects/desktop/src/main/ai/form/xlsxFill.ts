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
    const cell = sheet.getCell(locator.row, locator.column);
    // 鲁港通 - 合并区域的从属单元格写入后界面不可见，直接跳过并说明
    if (cell.isMerged && cell.master !== undefined && cell.master.address !== cell.address) {
      skipped.push(`「${field.label}」落在合并单元格的从属格里，写入后看不到，已跳过`);
      continue;
    }
    cell.value = value;
    filled += 1;
  }

  return { filled, skipped };
};
