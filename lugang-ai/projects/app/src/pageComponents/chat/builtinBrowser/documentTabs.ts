// 鲁港通 - 右栏文件标签纯逻辑：内容区路由、自动认领、文本差异与审阅进度
import type {
  DesktopDocumentChange,
  DesktopDocumentSheet,
  DesktopDocumentSnapshot,
  DesktopDocumentSummary
} from './desktopBridge';

export type DocPanelView = 'doc' | 'landing' | 'browser';

// 鲁港通 - 内容区路由：文件优先；原生空白页显示落地页，其余保持浏览器画面
export const resolveDocPanelView = (input: {
  activeDocToken: string | null;
  status: 'loading' | 'active' | 'error';
  currentTabUrl?: string;
}): DocPanelView => {
  if (input.activeDocToken) return 'doc';
  if (input.status !== 'active') return 'browser';
  const url = input.currentTabUrl ?? '';
  if (!url || url === 'about:blank') return 'landing';
  return 'browser';
};

// 鲁港通 - 自动认领：保持当前文件；当前文件已关闭时接管新的待审会话
export const resolveActiveDocToken = (
  list: DesktopDocumentSummary[],
  current: string | null | undefined
): string | null => {
  // 鲁港通 - 新的待审会话必须抢占激活，否则右栏停在上一轮结果上，模型拿不到这一轮确认
  const pending = list.find((item) => item.mode === 'review' && item.state === 'pending');
  if (pending && pending.token !== current) return pending.token;
  if (current && list.some((item) => item.token === current)) return current;
  return pending?.token ?? null;
};

export type PreviewDiffSegment = { kind: 'same' | 'removed' | 'added'; text: string };

// 鲁港通 - 最长公共前后缀 diff：只标出真正变化的片段，未变化部分保持原样
export const diffPreviewText = (original: string, next: string): PreviewDiffSegment[] => {
  if (original === next) return next ? [{ kind: 'same', text: next }] : [];

  let start = 0;
  const limit = Math.min(original.length, next.length);
  while (start < limit && original[start] === next[start]) start += 1;

  let endOriginal = original.length;
  let endNext = next.length;
  while (
    endOriginal > start &&
    endNext > start &&
    original[endOriginal - 1] === next[endNext - 1]
  ) {
    endOriginal -= 1;
    endNext -= 1;
  }

  const segments: PreviewDiffSegment[] = [];
  if (start > 0) segments.push({ kind: 'same', text: original.slice(0, start) });
  if (endOriginal > start) {
    segments.push({ kind: 'removed', text: original.slice(start, endOriginal) });
  }
  if (endNext > start) segments.push({ kind: 'added', text: next.slice(start, endNext) });
  const tail = original.slice(endOriginal);
  if (tail) segments.push({ kind: 'same', text: tail });
  return segments;
};

export const resolveReviewProgress = (
  snapshot: DesktopDocumentSnapshot
): { total: number; decided: number; percent: number } => {
  const total = snapshot.changes.length;
  const decided = snapshot.changes.filter((change) => change.status !== 'pending').length;
  const percent = total ? Math.round((decided / total) * 100) : 0;
  return { total, decided, percent };
};

export const findPendingChange = (
  snapshot: DesktopDocumentSnapshot
): DesktopDocumentChange | null =>
  snapshot.changes.find((change) => change.status === 'pending') ?? null;

export const canReviewNow = (snapshot: DesktopDocumentSnapshot): boolean =>
  snapshot.mode === 'review' && snapshot.state === 'reviewing';

// 鲁港通 - Excel 网格列名：0 → A，26 → AA
export const xlsxColumnLabel = (index: number): string => {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

// 鲁港通 - 网格宽度取已渲染内容与新增行的最大列数，缺失单元格补空串
export const resolveSheetWidth = (sheet: DesktopDocumentSheet): number => {
  let width = 0;
  for (const row of sheet.rows ?? []) width = Math.max(width, row.length);
  for (const row of sheet.appendedRows ?? []) width = Math.max(width, row.values.length);
  return width;
};

export const readSheetCell = (
  sheet: DesktopDocumentSheet,
  row: number,
  cell: number
): string => sheet.rows?.[row]?.[cell] ?? '';

export const findSheetCellMark = (sheet: DesktopDocumentSheet, row: number, cell: number) =>
  sheet.cellMarks?.find((mark) => mark.row === row && mark.cell === cell);
