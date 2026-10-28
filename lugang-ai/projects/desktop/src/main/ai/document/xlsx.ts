// 鲁港通 - Excel 文档提纲：列出工作表、表头与样例行，并提示副本可能丢失的对象
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { columnLetters } from './xlsxRefs';
import { DocumentParseError, type DocumentSheetColumn, type RawDocumentOutline } from './types';

const MAX_SHEETS = 12;
const MAX_SHEET_COLUMNS = 12;
const MAX_SAMPLE_ROWS = 8;
const MAX_CONTEXT_ROWS = 2;
const MAX_ROW_LABELS = 40;
const MAX_ROW_LABEL_CHARS = 40;
const MAX_CELL_PREVIEW = 60;
const HEADER_SCAN_ROWS = 50;
const MAX_DATA_SCAN_ROWS = 500;
const MAX_TAIL_SCAN_ROWS = 200;
const MAX_COLUMN_SCAN_ROWS = 30;

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

const isFormulaValue = (value: ExcelJS.CellValue): boolean => {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  const record = value as { formula?: unknown; sharedFormula?: unknown };
  return typeof record.formula === 'string' || typeof record.sharedFormula === 'string';
};

// 鲁港通 - 列对照：告诉模型每一列的真实字母、哪几列并入主列、哪一列由公式算出
const buildColumns = (
  sheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  columnCount: number,
  rowCount: number
): DocumentSheetColumn[] => {
  const columns: DocumentSheetColumn[] = [];
  const scanStart = headerRowNumber + 1;
  const scanEnd = Math.min(rowCount, scanStart + MAX_COLUMN_SCAN_ROWS - 1);
  for (let column = 1; column <= columnCount; column += 1) {
    const headerCell =
      headerRowNumber > 0 ? sheet.getRow(headerRowNumber).getCell(column) : undefined;
    const header =
      headerCell && headerCell.master === headerCell
        ? readCellText(headerCell).replace(/\s+/g, ' ').slice(0, MAX_CELL_PREVIEW)
        : '';
    // 鲁港通 - 并入列只看表头行的横向合并：表头跨行合并是同列延伸，不是并入别的列
    const headerMasterCol = headerCell?.master.fullAddress.col;
    let mergedTo =
      headerCell && headerCell.master !== headerCell && headerMasterCol !== column
        ? columnLetters(headerMasterCol!)
        : undefined;
    let formulas = 0;
    let filled = 0;
    let writable = 0;
    let horizontalSlaves = 0;
    const slaveTargets = new Map<number, number>();
    for (let rowNumber = scanStart; rowNumber <= scanEnd; rowNumber += 1) {
      const cell = sheet.getRow(rowNumber).getCell(column);
      const master = cell.master;
      // 鲁港通 - 表头跨行合并的续行属于表头，不能算作数据行
      if (headerRowNumber > 0 && master !== cell && master.fullAddress.row === headerRowNumber) {
        continue;
      }
      if (master !== cell) {
        const masterCol = master.fullAddress.col;
        if (master.fullAddress.row === rowNumber && masterCol !== column) {
          horizontalSlaves += 1;
          slaveTargets.set(masterCol, (slaveTargets.get(masterCol) ?? 0) + 1);
        }
        continue;
      }
      writable += 1;
      if (readCellText(cell) !== '') filled += 1;
      if (isFormulaValue(cell.value)) formulas += 1;
    }
    // 鲁港通 - 没有表头可依据时，按数据区里横向合并占多数来认定并入列
    if (!mergedTo && horizontalSlaves > writable && slaveTargets.size > 0) {
      const [target] = [...slaveTargets.entries()].sort((a, b) => b[1] - a[1]);
      mergedTo = columnLetters(target![0]);
    }
    const formula = formulas > 0 && formulas >= Math.max(1, Math.ceil((formulas + filled) / 2));
    columns.push({
      col: columnLetters(column),
      header,
      ...(mergedTo ? { mergedTo } : {}),
      ...(formula ? { formula: true } : {})
    });
  }
  return columns;
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

      // 鲁港通 - 表单类工作表行数多时样例窗口看不到逐行标签，补一份首列标签清单
      const sampledRows = new Set(sampleRows.map((row) => row.rowNumber));
      const rowLabels: Array<{ row: number; text: string }> = [];
      let rowLabelsTruncated = false;
      const labelScanEnd = Math.min(rowCount, HEADER_SCAN_ROWS + MAX_DATA_SCAN_ROWS);
      for (let rowNumber = 1; rowNumber <= labelScanEnd; rowNumber += 1) {
        if (rowNumber === headerRowNumber || sampledRows.has(rowNumber)) continue;
        const labelCell = sheet.getRow(rowNumber).getCell(1);
        const label = labelCell.master === labelCell ? readCellText(labelCell) : '';
        if (!label) continue;
        if (rowLabels.length >= MAX_ROW_LABELS) {
          rowLabelsTruncated = true;
          break;
        }
        rowLabels.push({ row: rowNumber, text: label.slice(0, MAX_ROW_LABEL_CHARS) });
      }

      if (sheet.getImages().length > 0) {
        warnings.add('工作表含图片，副本会尽量保留图片，请完成后核对版面。');
      }
      return {
        name: sheet.name,
        rowCount,
        columnCount,
        headerRow: headerRowNumber,
        header: headerRow?.cells ?? [],
        columns: buildColumns(sheet, headerRowNumber, previewColumns, rowCount),
        sampleRows: sampleRows.map((row) => row.cells),
        sampleRowNumbers: sampleRows.map((row) => row.rowNumber),
        ...(rowLabels.length > 0 ? { rowLabels } : {}),
        ...(rowLabelsTruncated ? { rowLabelsTruncated: true } : {})
      };
    });

  return {
    format: 'xlsx',
    sheets,
    ...(worksheets.length > sheets.length ? { sheetsTruncated: true } : {}),
    ...(warnings.size > 0 ? { warnings: [...warnings] } : {})
  };
};