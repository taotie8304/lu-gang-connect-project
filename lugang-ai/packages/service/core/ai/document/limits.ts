// 鲁港通 - 文档读取/编辑的安全护栏：源文件体积、压缩包条目数与解压总量都要先卡住
import JSZip from 'jszip';
import { DocumentReadError } from './types';

export const MAX_DOCUMENT_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 2000;
export const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 120 * 1024 * 1024;

export const SOURCE_TOO_LARGE_MESSAGE =
  '文件超过 20MB，暂时无法读取或修改。请压缩到 20MB 以内再上传。';
const TOO_MANY_ENTRIES_MESSAGE =
  '文件内部结构过于复杂（压缩包条目过多），出于安全考虑无法处理；请用原软件重新另存后再试。';
const ARCHIVE_TOO_LARGE_MESSAGE =
  '文件解压后体积过大，出于安全考虑无法处理；请压缩或精简内容后再试。';
const ARCHIVE_BROKEN_MESSAGE = '文件压缩结构已损坏，无法读取；请重新导出或另存后再试。';

export type ArchiveEntryInfo = {
  name: string;
  dir: boolean;
  uncompressedBytes: number;
};

/** 鲁港通 - Office 文档都是 zip 容器，先核对魔数再交给 JSZip，避免把其它格式误报成压缩包损坏 */
export const hasZipMagic = (buffer: Buffer): boolean =>
  buffer.length >= 4 &&
  buffer[0] === 0x50 &&
  buffer[1] === 0x4b &&
  buffer[2] === 0x03 &&
  buffer[3] === 0x04;

export const assertSourceBytesWithinLimit = (bytes: number): void => {
  if (bytes > MAX_DOCUMENT_SOURCE_BYTES) throw new DocumentReadError(SOURCE_TOO_LARGE_MESSAGE);
};

/** 鲁港通 - 条目数与声明解压总量在真正解压前先校验，避免压缩炸弹占满内存 */
export const assertArchiveEntriesWithinLimit = (entries: ArchiveEntryInfo[]): void => {
  const files = entries.filter((entry) => !entry.dir);
  if (files.length > MAX_ARCHIVE_ENTRIES) {
    throw new DocumentReadError(TOO_MANY_ENTRIES_MESSAGE);
  }
  let total = 0;
  for (const entry of files) {
    if (!Number.isFinite(entry.uncompressedBytes) || entry.uncompressedBytes <= 0) continue;
    total += entry.uncompressedBytes;
    if (total > MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
      throw new DocumentReadError(ARCHIVE_TOO_LARGE_MESSAGE);
    }
  }
};

// 鲁港通 - JSZip 不公开解压后大小，只能读中央目录里的声明值；实际读取时再按长度兜底
const readEntryUncompressedBytes = (file: JSZip.JSZipObject): number => {
  const data = (
    file as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } }
  )._data;
  return Number.isFinite(data?.uncompressedSize) ? Number(data?.uncompressedSize) : 0;
};

export const loadDocumentArchive = async (buffer: Buffer): Promise<JSZip> => {
  assertSourceBytesWithinLimit(buffer.length);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new DocumentReadError(ARCHIVE_BROKEN_MESSAGE);
  }

  assertArchiveEntriesWithinLimit(
    Object.values(zip.files).map((file) => ({
      name: file.name,
      dir: file.dir,
      uncompressedBytes: readEntryUncompressedBytes(file)
    }))
  );
  return zip;
};
