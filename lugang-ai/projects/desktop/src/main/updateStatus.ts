// 鲁港通 - 自动更新状态机：主进程与单测共用，保证设置面板看到的状态可预期
import type { DesktopUpdateProgress, DesktopUpdateStatus } from '../shared/ipc';

export const createInitialUpdateStatus = ({
  supported,
  currentVersion
}: {
  supported: boolean;
  currentVersion: string;
}): DesktopUpdateStatus => ({
  state: supported ? 'idle' : 'unsupported',
  currentVersion
});

export const startUpdateCheck = (status: DesktopUpdateStatus): DesktopUpdateStatus => {
  if (
    status.state === 'unsupported' ||
    status.state === 'checking' ||
    status.state === 'downloading' ||
    status.state === 'downloaded'
  ) {
    return status;
  }
  return { state: 'checking', currentVersion: status.currentVersion };
};

export const markUpdateAvailable = (
  status: DesktopUpdateStatus,
  latestVersion: string
): DesktopUpdateStatus => ({
  state: 'downloading',
  currentVersion: status.currentVersion,
  latestVersion
});

export const markUpdateNotAvailable = (status: DesktopUpdateStatus): DesktopUpdateStatus => ({
  state: 'up-to-date',
  currentVersion: status.currentVersion
});

export const markUpdateDownloaded = (
  status: DesktopUpdateStatus,
  latestVersion: string
): DesktopUpdateStatus => ({
  state: 'downloaded',
  currentVersion: status.currentVersion,
  latestVersion
});

export const markUpdateError = (status: DesktopUpdateStatus): DesktopUpdateStatus => ({
  state: 'error',
  currentVersion: status.currentVersion
});

const toPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

const toByteCount = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

/** 鲁港通 - 下载进度只挂在 downloading 状态上，避免面板在其他状态显示过期的百分比 */
export const markUpdateProgress = (
  status: DesktopUpdateStatus,
  progress: DesktopUpdateProgress
): DesktopUpdateStatus => {
  if (status.state !== 'downloading') return status;
  return {
    ...status,
    progress: {
      percent: toPercent(progress.percent),
      transferred: toByteCount(progress.transferred),
      total: toByteCount(progress.total),
      bytesPerSecond: toByteCount(progress.bytesPerSecond)
    }
  };
};

export const canInstallUpdate = (status: DesktopUpdateStatus): boolean =>
  status.state === 'downloaded';
