// 鲁港通 - 桌面客户端主进程入口
import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';
import { join } from 'node:path';
import { BrowserManager } from './browser/manager';
import { registerIpc } from './ipc';
import { setupAutoUpdate } from './update';
import { resolveAppUrl } from '../shared/url';
import { createMainWindow } from './window';

// 鲁港通 - 必须先 setName：electron-log 与 userData 路径都按应用名取目录
app.setName('鲁港通');

// 鲁港通 - 关闭 electron-log 的渲染进程注入：否则其 preload 会进入标签页分区，向第三方页面暴露 __electronLog
log.initialize({ preload: false });
log.transports.file.maxSize = 5 * 1024 * 1024;

process.on('uncaughtException', (error) => {
  log.error('uncaughtException', error);
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', reason);
});

let mainWindow: BrowserWindow | undefined;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app
    .whenReady()
    .then(() => {
      app.setAppUserModelId('com.airscend.lugang');

      const appUrl = resolveAppUrl(process.env.LUGANG_WEB_URL);
      const userDataDir = app.getPath('userData');
      const rendererDir = join(__dirname, '../renderer');

      mainWindow = createMainWindow({
        appUrl,
        preloadPath: join(__dirname, '../preload/index.cjs'),
        rendererDir,
        userDataDir
      });

      const browser = new BrowserManager({
        window: mainWindow,
        tabPreloadPath: join(__dirname, '../preload/tab.cjs'),
        rendererDir,
        permissionStorePath: join(userDataDir, 'permissions.json')
      });

      registerIpc({ mainWindow, appUrl, appVersion: app.getVersion(), browser });
      setupAutoUpdate(mainWindow);

      if (process.env.LUGANG_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }

      mainWindow.on('closed', () => {
        browser.destroy();
        mainWindow = undefined;
      });

      log.info(`[lugang-desktop] ready, appUrl=${appUrl}`);
    })
    .catch((error) => {
      log.error('bootstrap failed', error);
      dialog.showErrorBox(
        '鲁港通启动失败',
        '客户端初始化失败，请重启后重试。如仍无法使用，请联系管理员。'
      );
      app.quit();
    });
}
