// 鲁港通 - 桌面客户端主进程入口
import { app, BrowserWindow, dialog, Menu, safeStorage } from 'electron';
import log from 'electron-log/main';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { BrowserManager } from './browser/manager';
import { createDeviceStore } from './deviceStore';
import { registerIpc } from './ipc';
import { decideWindowCloseAction } from './lifecycle';
import { createTray, type TrayController } from './tray';
import { setupAutoUpdate } from './update';
import { resolveAppUrl } from '../shared/url';
import { createMainWindow } from './window';
import { createWindowControls } from './windowChrome';
import { createAiAuditStore } from './ai/auditWriter';
import { CdpPageDriver } from './ai/cdpDriver';
import { createAiConfirmer } from './ai/confirmDialog';
import { AiController } from './ai/controller';
import { createDeviceChannel, type DeviceChannel } from './ai/deviceChannel';
import { createFileGenerator } from './ai/fileGenerator';
import { createFilePicker } from './ai/filePicker';

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
let tray: TrayController | undefined;
let deviceChannel: DeviceChannel | undefined;
let isQuitting = false;

const markQuitting = () => {
  isQuitting = true;
};

const quitApp = () => {
  markQuitting();
  app.quit();
};

const focusMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);

  app.on('before-quit', markQuitting);

  app.on('will-quit', () => {
    deviceChannel?.stop();
    deviceChannel = undefined;
    tray?.destroy();
    tray = undefined;
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
    .then(async () => {
      app.setAppUserModelId('com.airscend.lugang');
      // 鲁港通 - 客户端不保留原生菜单栏（File/Edit/View/Window）
      Menu.setApplicationMenu(null);

      const appUrl = resolveAppUrl(process.env.LUGANG_WEB_URL);
      const userDataDir = app.getPath('userData');
      const rendererDir = join(__dirname, '../renderer');
      let aiController: AiController | undefined;

      mainWindow = createMainWindow({
        appUrl,
        preloadPath: join(__dirname, '../preload/index.cjs'),
        rendererDir,
        userDataDir,
        shouldHideOnClose: () =>
          decideWindowCloseAction({ isQuitting, hasTray: Boolean(tray) }) === 'hide-to-tray',
        onHideToTray: () => tray?.notifyHidden()
      });

      // 鲁港通 - 自绘标题栏的窗口按钮：关闭走 close，复用「收进托盘」策略
      const main = mainWindow;
      const windowControls = createWindowControls({
        minimize: () => main.minimize(),
        maximize: () => main.maximize(),
        unmaximize: () => main.unmaximize(),
        isMaximized: () => main.isMaximized(),
        close: () => main.close(),
        // 鲁港通 - 系统级最大化（贴边、双击标题栏、快捷键）同样要同步给标题栏
        subscribeMaximize: (listener) => {
          main.on('maximize', listener);
          main.on('unmaximize', listener);
          return () => {
            if (main.isDestroyed()) return;
            main.removeListener('maximize', listener);
            main.removeListener('unmaximize', listener);
          };
        }
      });

      const browser = new BrowserManager({
        window: mainWindow,
        tabPreloadPath: join(__dirname, '../preload/tab.cjs'),
        rendererDir,
        permissionStorePath: join(userDataDir, 'permissions.json'),
        events: {
          onTabClosed: (event) => {
            void aiController?.handleTabClosed(event).catch((error) => {
              log.warn('[lugang-desktop] ai tab reopen failed', error);
            });
          },
          onPanelClosed: () => {
            void aiController?.handlePanelClosed().catch((error) => {
              log.warn('[lugang-desktop] ai panel reopen failed', error);
            });
          }
        }
      });

      const aiDriver = new CdpPageDriver({
        getSession: () => browser.getActiveDebuggerSession(),
        navigate: async (url) => {
          if (!browser.navigate(url)) throw new Error('页面导航被拒绝');
        }
      });
      const aiAudit = createAiAuditStore(join(userDataDir, 'ai-audit'));
      // 鲁港通 - 生成文件只记录本机路径用于上传默认定位，不进入 IPC 结果或审计
      const generateFile = createFileGenerator();
      let lastGeneratedPath: string | undefined;
      const ai = new AiController({
        browser,
        driver: aiDriver,
        audit: (record) => aiAudit.append(record),
        generateFile: async (input) => {
          const file = await generateFile(input);
          lastGeneratedPath = file.path;
          return file;
        },
        pickFile: createFilePicker({
          showOpenDialog: (options) =>
            mainWindow && !mainWindow.isDestroyed()
              ? dialog.showOpenDialog(mainWindow, options)
              : dialog.showOpenDialog(options),
          getDefaultPath: () => lastGeneratedPath
        }),
        confirm: createAiConfirmer({
          getParentWindow: () => mainWindow,
          preloadPath: join(__dirname, '../preload/confirm.cjs'),
          rendererDir
        })
      });
      aiController = ai;

      // 鲁港通 - 设备令牌只留在主进程：用应用会话 Cookie 注册，safeStorage 加密后落盘
      const deviceStore = createDeviceStore({
        filePath: join(userDataDir, 'desktop-device.json'),
        safeStorage,
        log: (message, error) => log.warn(`[lugang-desktop] ${message}`, error)
      });
      const appSession = mainWindow.webContents.session;
      deviceChannel = createDeviceChannel({
        baseUrl: appUrl,
        deviceId: deviceStore.deviceId,
        deviceName: hostname().trim().slice(0, 64) || '桌面客户端',
        appVersion: app.getVersion(),
        tokenStore: {
          load: deviceStore.loadToken,
          save: deviceStore.saveToken,
          clear: deviceStore.clearToken
        },
        getSessionCookie: async () => {
          const cookies = await appSession.cookies.get({
            url: appUrl,
            name: 'fastgpt_token'
          });
          return cookies[0]?.value;
        },
        executeCommand: (command, { commandId }) =>
          ai.execute(command, { resume: true, commandId }),
        stopExecution: () => ai.stop(),
        log: (message, error) => log.warn(`[lugang-desktop] ${message}`, error)
      });
      const activeDeviceChannel = deviceChannel;

      let syncTimer: NodeJS.Timeout | undefined;
      const cancelScheduledSync = () => {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = undefined;
      };
      const scheduleSync = () => {
        cancelScheduledSync();
        syncTimer = setTimeout(() => {
          syncTimer = undefined;
          void activeDeviceChannel.syncSession();
        }, 300);
      };
      const onCookieChanged = (
        _event: Electron.Event,
        cookie: Electron.Cookie,
        _cause: string,
        removed: boolean
      ) => {
        if (cookie.name !== 'fastgpt_token') return;
        if (removed) {
          cancelScheduledSync();
          void activeDeviceChannel.clearSession();
          return;
        }
        scheduleSync();
      };
      appSession.cookies.on('changed', onCookieChanged);
      mainWindow.webContents.on('did-finish-load', scheduleSync);

      registerIpc({
        mainWindow,
        appUrl,
        appVersion: app.getVersion(),
        browser,
        ai,
        deviceChannel: activeDeviceChannel,
        windowControls
      });
      setupAutoUpdate({ window: mainWindow, onBeforeQuit: markQuitting });

      // 鲁港通 - 托盘创建失败时回落为普通关闭，避免窗口藏起来后找不回
      try {
        tray = await createTray({ window: mainWindow, onQuit: quitApp });
      } catch (error) {
        log.warn('[lugang-desktop] tray unavailable, close will quit', error);
      }

      if (process.env.LUGANG_DEVTOOLS === '1') {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }

      mainWindow.on('closed', () => {
        cancelScheduledSync();
        appSession.cookies.removeListener('changed', onCookieChanged);
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
