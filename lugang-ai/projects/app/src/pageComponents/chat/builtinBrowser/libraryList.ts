// 鲁港通 - 资料库列表纯逻辑：筛选、排序、计数与展示文案都放这里，组件只负责渲染
import type {
  DesktopLibraryItem,
  DesktopLibraryKind,
  DesktopLibrarySource
} from './desktopBridge';

export type LibraryFilter = 'all' | 'docx' | 'xlsx' | 'pdf' | 'other';
export type LibrarySort = 'recent' | 'name' | 'size';

export type LibraryCounts = {
  all: number;
  docx: number;
  xlsx: number;
  pdf: number;
  other: number;
};

const SOURCE_LABELS: Record<DesktopLibrarySource, string> = {
  ai: 'AI 生成',
  download: '网页下载',
  edit: '编辑副本',
  import: '本机导入'
};

const SOURCE_LOCATIONS: Record<DesktopLibrarySource, string> = {
  ai: '文件保存在「下载 › 鲁港通生成文件」',
  edit: '文件保存在「下载 › 鲁港通生成文件」',
  download: '文件保存在系统的「下载」文件夹',
  import: '文件保留在本机原位置'
};

export const librarySourceLabel = (source: DesktopLibrarySource): string => SOURCE_LABELS[source];

export const libraryLocationLabel = (source: DesktopLibrarySource): string =>
  SOURCE_LOCATIONS[source];

export const libraryKindFilter = (kind: DesktopLibraryKind): Exclude<LibraryFilter, 'all'> => {
  if (kind === 'docx' || kind === 'xlsx' || kind === 'pdf') return kind;
  return 'other';
};

export const libraryKindBadge = (kind: DesktopLibraryKind): string => {
  if (kind === 'docx') return 'W';
  if (kind === 'xlsx') return 'X';
  if (kind === 'pdf') return 'P';
  if (kind === 'image') return '图';
  if (kind === 'archive') return 'ZIP';
  return '文件';
};

export const filterLibraryItems = (
  items: DesktopLibraryItem[],
  options: { keyword: string; filter: LibraryFilter }
): DesktopLibraryItem[] => {
  const keyword = options.keyword.trim().toLowerCase();
  return items.filter((item) => {
    if (options.filter !== 'all' && libraryKindFilter(item.kind) !== options.filter) return false;
    if (!keyword) return true;
    return item.name.toLowerCase().includes(keyword);
  });
};

const compareBySort = (a: DesktopLibraryItem, b: DesktopLibraryItem, sort: LibrarySort) => {
  if (sort === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
  if (sort === 'size') return b.size - a.size;
  return b.usedAt - a.usedAt;
};

export const sortLibraryItems = (
  items: DesktopLibraryItem[],
  sort: LibrarySort
): DesktopLibraryItem[] =>
  [...items].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return compareBySort(a, b, sort);
  });

export const libraryCounts = (items: DesktopLibraryItem[]): LibraryCounts => {
  const counts: LibraryCounts = { all: items.length, docx: 0, xlsx: 0, pdf: 0, other: 0 };
  for (const item of items) counts[libraryKindFilter(item.kind)] += 1;
  return counts;
};

export const formatLibrarySize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

export const canContinueLibraryItem = (kind: DesktopLibraryKind): boolean =>
  kind === 'docx' || kind === 'xlsx' || kind === 'pdf';

export const libraryContinueLabel = (kind: DesktopLibraryKind): string => {
  if (kind === 'pdf') return '用 AI 填写';
  if (kind === 'docx' || kind === 'xlsx') return '继续修改';
  return '';
};

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
};

export const libraryImageMime = (name: string): string => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME[extension] ?? 'application/octet-stream';
};

// 鲁港通 - 行菜单定位：贴住锚点右下角，右/下放不下时向内收或翻到上方
export const resolveLibraryMenuPosition = (
  anchor: { right: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  menuSize: { width: number; height: number }
): { left: number; top: number } => {
  const margin = 8;
  const gap = 4;
  const left = Math.max(
    margin,
    Math.min(anchor.right - menuSize.width, viewport.width - menuSize.width - margin)
  );
  const below = anchor.bottom + gap;
  const top =
    below + menuSize.height > viewport.height - margin
      ? Math.max(margin, anchor.top - menuSize.height - gap)
      : below;
  return { left, top };
};

const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const DAY_MS = 24 * 60 * 60 * 1000;

const padTwo = (value: number): string => String(value).padStart(2, '0');

const formatClock = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};

export const libraryGroupLabel = (timestamp: number, now: number): string => {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  return '更早';
};

export const formatLibraryTime = (timestamp: number, now: number): string => {
  const group = libraryGroupLabel(timestamp, now);
  if (group === '今天') return formatClock(timestamp);
  if (group === '昨天') return `昨天 ${formatClock(timestamp)}`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
};
