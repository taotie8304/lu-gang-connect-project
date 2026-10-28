// 鲁港通 - 自动更新：启动静默检查 + 设置面板手动检查，下载完成后由用户确认重启安装
import { app, dialog, type BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import type { DesktopUpdateStatus } from '../shared/ipc';
import {
  canInstallUpdate,
  createInitialUpdateStatus,
  markUpdateAvailable,
  markUpdateDownloaded,
  markUpdateError,
  markUpdateNotAvailable,
  startUpdateCheck
} from './updateStatus';

type SetupAutoUpdateOptions = {
  window: BrowserWindow;
  onBeforeQuit: () => void;
};

export type UpdateController = {
  getStatus(): DesktopUpdateStatus;
  check(): Promise<DesktopUpdateStatus>;
  install(): void;
  start(): void;
  subscribe(listener: (status: DesktopUpdateStatus) => void): () => void;
};

export const setupAutoUpdate = ({
  window,
  onBeforeQuit
}: SetupAutoUpdateOptions): UpdateController => {
  const supported = app.isPackaged;
  let status = createInitialUpdateStatus({ supported, currentVersion: app.getVersion() });
  const listeners = new Set<(status: DesktopUpdateStatus) => void>();

  const publish = (next: DesktopUpdateStatus) => {
    status = next;
    listeners.forEach((listener) => listener(status));
  };

  if (supported) {
    autoUpdater.logger = {
      info: (message: unknown) => log.info(message),
      warn: (message: unknown) => log.warn(message),
      error: (message: unknown) => log.error(message),
      debug: (message: unknown) => log.debug(message)
    };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      publish(markUpdateAvailable(status, info.version));
    });
    autoUpdater.on('update-not-available', () => {
      publish(markUpdateNotAvailable(status));
    });
    autoUpdater.on('update-downloaded', async (info) => {
      publish(markUpdateDownloaded(status, info.version));
      if (window.isDestroyed()) return;
      const { response } = await dialog.showMessageBox(window, {
        type: 'info',
        title: '更新已就绪',
        message: `新版本 ${info.version} 已下载完成`,
        detail: '重启客户端即可完成安装。',
        buttons: ['稍后', '重启安装'],
        defaultId: 1,
        cancelId: 0,
        noLink: true
      });
      if (response === 1) {
        // 鲁港通 - 先标记退出，否则关闭到托盘的拦截会阻止更新安装
        onBeforeQuit();
        autoUpdater.quitAndInstall();
      }
    });
    autoUpdater.on('error', (error) => {
      log.warn('[lugang-desktop] auto update error', error);
      publish(markUpdateError(status));
    });
  }

  const check = async (): Promise<DesktopUpdateStatus> => {
    if (!supported) return status;
    const next = startUpdateCheck(status);
    if (next === status) return status;
    publish(next);

    try {
      const result = await autoUpdater.checkForUpdates();
      // 正常情况下 update-available / update-not-available 事件已更新状态
      if (status.state === 'checking') {
        const latestVersion = result?.updateInfo.version;
        publish(
          latestVersion && latestVersion !== app.getVersion()
            ? markUpdateAvailable(status, latestVersion)
            : markUpdateNotAvailable(status)
        );
      }
    } catch (error) {
      log.warn('[lugang-desktop] check update failed', error);
      if (status.state === 'checking') publish(markUpdateError(status));
    }
    return status;
  };

  const install = () => {
    if (!canInstallUpdate(status)) return;
    onBeforeQuit();
    autoUpdater.quitAndInstall();
  };

  return {
    getStatus: () => status,
    check,
    install,
    start: () => {
      if (!supported) return;
      setTimeout(() => {
        void check();
      }, 10_000);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};
