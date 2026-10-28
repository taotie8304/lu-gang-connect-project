// 鲁港通 - Excel 单元格地址换算：真实列字母与行列索引互转

export const CELL_REFERENCE = /^([A-Za-z]{1,3})([1-9]\d{0,5})$/;

export const PLAIN_NUMBER = /^(0|-?[1-9]\d*)(\.\d+)?$/;

export const MAX_REPLACEMENTS = 500;
export const MAX_SCAN_ROWS = 5000;
export const MAX_SCAN_COLUMNS = 100;

export type CellAddress = { row: number; col: number };

export const columnIndex = (letters: string): number => {
  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index;
};

export const columnLetters = (index: number): string => {
  let letters = '';
  let value = index;
  while (value > 0) {
    letters = String.fromCharCode(65 + ((value - 1) % 26)) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
};

export const parseCellReference = (reference: string): CellAddress | undefined => {
  const match = CELL_REFERENCE.exec(reference.trim());
  if (!match) return undefined;
  return { row: Number(match[2]), col: columnIndex(match[1]) };
};

export const formatCellReference = (address: CellAddress): string =>
  `${columnLetters(address.col)}${address.row}`;
