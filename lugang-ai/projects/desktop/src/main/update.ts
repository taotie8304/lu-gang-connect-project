// 鲁港通 - 自动更新：打包后静默检查，下载完成由用户确认重启安装
import { app, dialog, type BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';

export const setupAutoUpdate = (window: BrowserWindow) => {
  if (!app.isPackaged) return;

  autoUpdater.logger = {
    info: (message: unknown) => log.info(message),
    warn: (message: unknown) => log.warn(message),
    error: (message: unknown) => log.error(message),
    debug: (message: unknown) => log.debug(message)
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async (info) => {
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
    if (response === 1) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (error) => {
    log.warn('[lugang-desktop] auto update error', error);
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      log.warn('[lugang-desktop] check update failed', error);
    });
  }, 10_000);
};
