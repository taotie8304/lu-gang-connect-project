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
  markUpdateProgress,
  startUpdateCheck
} from './updateStatus';

// 鲁港通 - 下载进度约 4 次/秒推给面板即可，避免每个分片都跨进程发消息
const PROGRESS_THROTTLE_MS = 250;
// 鲁港通 - 长时间挂机的客户端每 6 小时自动复检一次
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// 鲁港通 - 检查/下载出错后 30 分钟自动重试，用户手动点击仍可立即重试
const ERROR_RETRY_DELAY_MS = 30 * 60 * 1000;

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
  let lastProgressAt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const publish = (next: DesktopUpdateStatus) => {
    status = next;
    listeners.forEach((listener) => listener(status));
  };

  // 鲁港通 - 出错后自动重试一次；定时复检与手动点击共用 check()，其内部守卫会跳过不合适的时机
  const scheduleErrorRetry = () => {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void check();
    }, ERROR_RETRY_DELAY_MS);
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
    autoUpdater.on('download-progress', (progress) => {
      const now = Date.now();
      if (progress.percent < 100 && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
      lastProgressAt = now;
      publish(
        markUpdateProgress(status, {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond
        })
      );
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
      scheduleErrorRetry();
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
      if (status.state === 'checking') {
        publish(markUpdateError(status));
        scheduleErrorRetry();
      }
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
      setInterval(() => {
        void check();
      }, AUTO_CHECK_INTERVAL_MS);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};
