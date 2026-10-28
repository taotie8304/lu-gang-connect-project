// 鲁港通 - Excel 副本编辑：按工作表与单元格改值、追加行，只写副本不改原件
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import ExcelJS from 'exceljs';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from '../fileNaming';
import { isSafeFormula } from '../formulaSafety';
import type { DocumentEditOperation } from '../protocol';
import {
  DocumentEditError,
  type DocumentEditOutcome,
  type EditedDocumentCopy
} from './editTypes';
import type { ParsedDocument } from './types';

export const CELL_REFERENCE = /^([A-Za-z]{1,3})([1-9]\d{0,5})$/;
const PLAIN_NUMBER = /^(0|-?[1-9]\d*)(\.\d+)?$/;
export const MAX_REPLACEMENTS = 500;
export const MAX_SCAN_ROWS = 5000;
export const MAX_SCAN_COLUMNS = 100;

export const columnIndex = (letters: string): number => {
  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index;
};

export const readCellText = (cell: ExcelJS.Cell): string => {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const record = value as {
      richText?: Array<{ text?: string }>;
      text?: unknown;
      result?: unknown;
    };
    if (Array.isArray(record.richText)) {
      return record.richText.map((item) => item.text ?? '').join('');
    }
    if (typeof record.text === 'string') return record.text;
    if (record.result !== undefined && record.result !== null) return String(record.result);
  }
  return '';
};

export const isFormulaCell = (cell: ExcelJS.Cell): boolean =>
  Boolean(cell.value && typeof cell.value === 'object' && 'formula' in cell.value);

export const isMergedSlave = (cell: ExcelJS.Cell): boolean =>
  cell.isMerged && cell.master !== undefined && cell.master.address !== cell.address;

export const findSheet = (workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined => {
  const exact = workbook.getWorksheet(name);
  if (exact) return exact;
  const lower = name.trim().toLowerCase();
  return workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === lower);
};

const writeCellValue = (
  cell: ExcelJS.Cell,
  value: string,
  warnings: Set<string>
): void => {
  if (value.length > 1 && value.startsWith('=')) {
    const formula = value.slice(1);
    if (isSafeFormula(formula)) {
      cell.value = { formula };
    } else {
      cell.value = value;
      warnings.add('部分以等号开头的内容因公式安全限制按文本写入。');
    }
    return;
  }
  if (PLAIN_NUMBER.test(value)) {
    cell.value = Number(value);
    return;
  }
  cell.value = value;
};

const countAndReplace = (text: string, find: string, replace: string): { value: string; count: number } => {
  let count = 0;
  let from = 0;
  for (;;) {
    const index = text.indexOf(find, from);
    if (index < 0) break;
    count += 1;
    from = index + find.length;
  }
  if (count === 0) return { value: text, count: 0 };
  return { value: text.split(find).join(replace), count };
};

export const editXlsxWorkbook = (
  workbook: ExcelJS.Workbook,
  operations: DocumentEditOperation[]
): DocumentEditOutcome => {
  const skipped: string[] = [];
  const warnings = new Set<string>();
  let applied = 0;

  for (const operation of operations) {
    if (operation.op === 'set_cell') {
      const sheet = findSheet(workbook, operation.sheet);
      if (!sheet) {
        skipped.push(`工作表「${operation.sheet}」不存在，已跳过`);
        continue;
      }
      const match = CELL_REFERENCE.exec(operation.cell);
      if (!match) {
        skipped.push(`单元格「${operation.cell}」格式不正确，已跳过`);
        continue;
      }
      const row = Number(match[2]);
      const cell = sheet.getCell(row, columnIndex(match[1]));
      const target =
        isMergedSlave(cell) && cell.master ? (cell.master as ExcelJS.Cell) : cell;
      writeCellValue(target, operation.value, warnings);
      applied += 1;
      continue;
    }

    if (operation.op === 'append_row') {
      const sheet = findSheet(workbook, operation.sheet);
      if (!sheet) {
        skipped.push(`工作表「${operation.sheet}」不存在，已跳过`);
        continue;
      }
      const row = sheet.getRow((sheet.rowCount || 0) + 1);
      operation.values.forEach((value, index) => {
        writeCellValue(row.getCell(index + 1), value, warnings);
      });
      row.commit?.();
      applied += operation.values.length;
      continue;
    }

    if (operation.op === 'replace_text') {
      if (operation.paragraph !== undefined) {
        skipped.push('按段落替换只适用于 Word，已跳过');
        continue;
      }
      const sheets = operation.sheet
        ? [findSheet(workbook, operation.sheet)].filter(
            (sheet): sheet is ExcelJS.Worksheet => Boolean(sheet)
          )
        : workbook.worksheets;
      if (operation.sheet && sheets.length === 0) {
        skipped.push(`工作表「${operation.sheet}」不存在，已跳过`);
        continue;
      }

      let matched = 0;
      for (const sheet of sheets) {
        if (sheet.rowCount > MAX_SCAN_ROWS || sheet.columnCount > MAX_SCAN_COLUMNS) {
          warnings.add(
            `工作表「${sheet.name}」较大，本次只扫描前 ${MAX_SCAN_ROWS} 行、${MAX_SCAN_COLUMNS} 列用于替换。`
          );
        }
        const rowLimit = Math.min(sheet.rowCount, MAX_SCAN_ROWS);
        const columnLimit = Math.min(sheet.columnCount, MAX_SCAN_COLUMNS);
        for (let rowIndex = 1; rowIndex <= rowLimit && matched < MAX_REPLACEMENTS; rowIndex += 1) {
          const row = sheet.getRow(rowIndex);
          for (
            let cellIndex = 1;
            cellIndex <= columnLimit && matched < MAX_REPLACEMENTS;
            cellIndex += 1
          ) {
            const cell = row.getCell(cellIndex);
            if (isMergedSlave(cell) || isFormulaCell(cell)) continue;
            const text = readCellText(cell);
            if (!text) continue;
            const result = countAndReplace(text, operation.find, operation.replace);
            if (result.count === 0) continue;
            cell.value = result.value;
            matched += result.count;
          }
        }
      }

      if (matched === 0) {
        skipped.push(`没有找到「${operation.find}」，已跳过`);
      } else {
        applied += matched;
        if (matched >= MAX_REPLACEMENTS) {
          warnings.add(`替换次数较多，本次只处理了前 ${MAX_REPLACEMENTS} 处。`);
        }
      }
      continue;
    }

    skipped.push('段落操作只适用于 Word，已跳过');
  }

  return { applied, skipped, warnings: [...warnings] };
};

export type EditXlsxCopyOptions = {
  document: ParsedDocument;
  operations: DocumentEditOperation[];
  outputDir: string;
  now?: Date;
};

export const editXlsxCopy = async (options: EditXlsxCopyOptions): Promise<EditedDocumentCopy> => {
  const folder = join(options.outputDir, GENERATED_FILE_FOLDER);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(options.document.path);
  } catch {
    throw new DocumentEditError(
      'document_edit_failed',
      '无法读取这个 Excel 文件，可能已损坏；请确认文件能正常打开后再试。'
    );
  }

  const outcome = editXlsxWorkbook(workbook, options.operations);
  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      'document_no_change',
      `没有找到与要求匹配的内容，未生成副本。${detail ? `${detail}。` : ''}请核对工作表或单元格后重试。`
    );
  }

  await mkdir(folder, { recursive: true });
  const baseName = basename(options.document.name, extname(options.document.name));
  const name = resolveGeneratedFileName({
    fileName: `${baseName}-已修改`,
    format: 'xlsx',
    exists: (candidate) => existsSync(join(folder, candidate)),
    ...(options.now ? { now: options.now } : {})
  });
  const path = join(folder, name);

  try {
    await workbook.xlsx.writeFile(path);
  } catch {
    throw new DocumentEditError(
      'document_edit_failed',
      '修改副本没有保存成功，请确认文件未被其他程序占用、磁盘空间充足后重试。'
    );
  }

  const warnings = new Set([...(options.document.warnings ?? []), ...outcome.warnings]);

  return {
    name,
    format: 'xlsx',
    folder: GENERATED_FILE_FOLDER,
    path,
    applied: outcome.applied,
    skipped: outcome.skipped,
    warnings: [...warnings]
  };
};