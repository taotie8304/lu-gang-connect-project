// 鲁港通 - 右栏文件标签纯逻辑：内容区路由、自动认领、文本差异与审阅进度
import type {
  DesktopDocumentChange,
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
  if (current && list.some((item) => item.token === current)) return current;
  const review = list.find((item) => item.mode === 'review' && item.state === 'pending');
  return review?.token ?? null;
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
