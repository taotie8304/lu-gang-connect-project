// 鲁港通 - 自动更新状态机：主进程与单测共用，保证设置面板看到的状态可预期
import type { DesktopUpdateStatus } from '../shared/ipc';

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

export const canInstallUpdate = (status: DesktopUpdateStatus): boolean =>
  status.state === 'downloaded';
