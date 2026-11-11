// 鲁港通 - 下载任务条：最多保留 5 条，超出优先移除最早的已结束项
import { extname, join } from 'node:path';
import type { DesktopDownloadStatus } from '../../shared/ipc';

export const MAX_DOWNLOAD_ROWS = 5;

type DownloadTrimItem = { status: DesktopDownloadStatus; startedAt: number };

export const trimDownloadRows = <T extends DownloadTrimItem>(
  rows: T[],
  max = MAX_DOWNLOAD_ROWS
): T[] => {
  const next = [...rows].sort((a, b) => a.startedAt - b.startedAt);
  while (next.length > max) {
    const index = next.findIndex((row) => row.status !== 'progressing');
    next.splice(index >= 0 ? index : 0, 1);
  }
  return next;
};

/** 另存为 PDF 的默认文件名：去掉 Windows 非法字符并限制长度 */
export const sanitizeFileBaseName = (input: string): string => {
  const cleaned = input
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'page';
};

/** 下载默认落盘路径：文件名重名时追加序号，避免覆盖已有文件 */
export const buildDownloadFilePath = (
  dir: string,
  fileName: string,
  exists: (path: string) => boolean
): string => {
  const safeName = sanitizeFileBaseName(fileName);
  const ext = extname(safeName);
  const base = ext ? safeName.slice(0, -ext.length) : safeName;
  let candidate = join(dir, safeName);
  for (let index = 1; index < 100 && exists(candidate); index += 1) {
    candidate = join(dir, `${base} (${index})${ext}`);
  }
  return candidate;
};
