// 鲁港通 - 资料库条目纯逻辑：格式归类、路径去重、上限淘汰，全部无副作用便于单测
import type { DesktopLibraryItem, DesktopLibraryKind, DesktopLibrarySource } from '../../shared/ipc';

export const MAX_LIBRARY_ITEMS = 500;

export type LibraryRecord = {
  id: string;
  path: string;
  name: string;
  kind: DesktopLibraryKind;
  source: DesktopLibrarySource;
  size: number;
  addedAt: number;
  usedAt: number;
  starred: boolean;
  origin?: string;
  parentName?: string;
};

const KIND_BY_EXTENSION: Record<string, DesktopLibraryKind> = {
  docx: 'docx',
  xlsx: 'xlsx',
  xls: 'xlsx',
  csv: 'xlsx',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive'
};

export const classifyLibraryKind = (name: string): DesktopLibraryKind => {
  const match = /\.([^.]+)$/.exec(name.trim());
  if (!match) return 'other';
  return KIND_BY_EXTENSION[match[1].toLowerCase()] ?? 'other';
};

// 鲁港通 - 路径只做展示无关的规范化：统一斜杠与大小写，用于判断「是不是同一个文件」
export const normalizeLibraryPath = (path: string): string =>
  path.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

export const sanitizeOrigin = (url: string): string | undefined => {
  try {
    const hostname = new URL(url).hostname.trim().toLowerCase();
    return hostname || undefined;
  } catch {
    return undefined;
  }
};

export const toDesktopLibraryItem = (
  record: LibraryRecord,
  missing: boolean
): DesktopLibraryItem => ({
  id: record.id,
  name: record.name,
  kind: record.kind,
  source: record.source,
  size: record.size,
  addedAt: record.addedAt,
  usedAt: record.usedAt,
  starred: record.starred,
  missing,
  ...(record.origin ? { origin: record.origin } : {}),
  ...(record.parentName ? { parentName: record.parentName } : {})
});

export type MergeLibraryRecordResult = {
  records: LibraryRecord[];
  record: LibraryRecord;
  created: boolean;
};

// 鲁港通 - 同路径只保留一条：更新展示属性与最近使用，收藏状态和最初来源不被覆盖
export const mergeLibraryRecord = (
  records: LibraryRecord[],
  input: LibraryRecord,
  idFactory: () => string
): MergeLibraryRecordResult => {
  const target = normalizeLibraryPath(input.path);
  const index = records.findIndex((item) => normalizeLibraryPath(item.path) === target);

  if (index >= 0) {
    const current = records[index];
    const next: LibraryRecord = {
      ...current,
      name: input.name,
      kind: input.kind,
      size: input.size,
      usedAt: input.usedAt,
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.parentName ? { parentName: input.parentName } : {})
    };
    const nextRecords = [...records];
    nextRecords[index] = next;
    return { records: nextRecords, record: next, created: false };
  }

  const record: LibraryRecord = { ...input, id: idFactory() };
  return { records: [...records, record], record, created: true };
};

// 鲁港通 - 上限只淘汰最旧的未收藏记录，收藏记录始终保留
export const pruneLibraryRecords = (
  records: LibraryRecord[],
  limit = MAX_LIBRARY_ITEMS
): LibraryRecord[] => {
  if (records.length <= limit) return records;

  const starred = records.filter((item) => item.starred);
  const rest = records
    .filter((item) => !item.starred)
    .sort((a, b) => b.usedAt - a.usedAt)
    .slice(0, Math.max(0, limit - starred.length));
  const keep = new Set([...starred, ...rest].map((item) => item.id));

  return records.filter((item) => keep.has(item.id));
};
