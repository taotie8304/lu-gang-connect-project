// 鲁港通 - 本地生成文件命名：内容命名 + 格式后缀，重名追加时间后缀
import type { AiFileFormat } from './executor';

export const GENERATED_FILE_FOLDER = '鲁港通生成文件';

const MAX_BASE_NAME_LENGTH = 60;
const ILLEGAL_CHAR_PATTERN = /[\\/:*?"<>|\u0000-\u001f]/g;
const TRAILING_DOT_SPACE_PATTERN = /[. ]+$/g;
const KNOWN_EXTENSION_PATTERN = /\.(docx|xlsx|pdf)$/i;
const WINDOWS_RESERVED_PATTERN = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const sanitizeGeneratedFileBaseName = (input: string, format: AiFileFormat): string => {
  let base = input.trim().replace(KNOWN_EXTENSION_PATTERN, '');
  base = base
    .replace(ILLEGAL_CHAR_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TRAILING_DOT_SPACE_PATTERN, '');
  if (!base) base = GENERATED_FILE_FOLDER;
  if (WINDOWS_RESERVED_PATTERN.test(base)) base = `${base}_文件`;
  return base.slice(0, MAX_BASE_NAME_LENGTH).trim() || GENERATED_FILE_FOLDER;
};

export const formatGeneratedFileTimestamp = (date: Date): string =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-` +
  `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

export const resolveGeneratedFileName = (input: {
  fileName: string;
  format: AiFileFormat;
  exists: (fileName: string) => boolean;
  now?: Date;
}): string => {
  const base = sanitizeGeneratedFileBaseName(input.fileName, input.format);
  const first = `${base}.${input.format}`;
  if (!input.exists(first)) return first;

  const stamp = formatGeneratedFileTimestamp(input.now ?? new Date());
  const stamped = `${base}-${stamp}.${input.format}`;
  if (!input.exists(stamped)) return stamped;

  let index = 2;
  while (input.exists(`${base}-${stamp}-${index}.${input.format}`)) index += 1;
  return `${base}-${stamp}-${index}.${input.format}`;
};
