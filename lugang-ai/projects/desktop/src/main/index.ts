// 鲁港通 - 桌面客户端主进程入口
import { app, dialog, Menu, safeStorage, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { hostname } from 'node:os';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { IPC_CHANNELS } from '../shared/ipc';
import { DocumentPreviewManager, type PreviewEditor } from './ai/documentPreview';
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
import { createAiFormConfirmer } from './ai/formConfirm';
import { AiController } from './ai/controller';
import type { AiDocumentPreviewer } from './ai/executor';
import { createDeviceChannel, type DeviceChannel } from './ai/deviceChannel';
import { editDocxCopy } from './ai/document/docxEdit';
import { editXlsxCopy } from './ai/document/xlsxEdit';
import { extractPdfOutline, writePdfOverlayCopy } from './ai/document/pdfOverlay';
import { parseDocumentFile } from './ai/document/parse';
import { createFileGenerator } from './ai/fileGenerator';
import { createFilePicker } from './ai/filePicker';
import { fillFormCopy } from './ai/form/fill';
import { parseFormFile } from './ai/form/parse';
import { createDiagnostics, type DiagnosticsDevice } from './diagnostics';
import { readFile, writeFile } from 'node:fs/promises';

// 鲁港通 - 必须先 setName：electron-log 与 userData 路径都按应用名取目录
app.setName('鲁港通');

// 鲁港通 - 关闭 electron-log 的渲染进程注入：否则其 preload 会进入标签页分区，向第三方页面暴露 __electronLog
log.initialize({ preload: false });
log.transports.file.maxSize = 5 * 1024 * 1024;

const appUrl = resolveAppUrl(process.env.LUGANG_WEB_URL);

// 鲁港通 - 崩溃早于窗口创建也可能发生：先在模块级装配诊断，设备信息就绪后再补上传
let diagnosticsDevice: DiagnosticsDevice | undefined;
let loadDiagnosticsToken: () => string | undefined = () => undefined;

const readRecentLogText = (maxChars: number): string | undefined => {
  try {
    const content = readFileSync(log.transports.file.getFile().path, 'utf8');
    return content.slice(-maxChars);
  } catch {
    return undefined;
  }
};

const diagnostics = createDiagnostics({
  baseUrl: appUrl,
  dir: join(app.getPath('userData'), 'diagnostics'),
  getDevice: () => diagnosticsDevice,
  getToken: () => loadDiagnosticsToken(),
  readRecentLog: readRecentLogText,
  saveBundle: async (defaultName, content) => {
    const options: Electron.SaveDialogOptions = {
      title: '导出诊断包',
      defaultPath: join(app.getPath('downloads'), defaultName),
      filters: [{ name: '诊断包', extensions: ['txt'] }]
    };
    const result =
      mainWindow && !mainWindow.isDestroyed()
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  },
  log: (message, error) => log.warn(`[lugang-desktop] ${message}`, error)
});

process.on('uncaughtException', (error) => {
  log.error('uncaughtException', error);
  diagnostics.recordCrash({ type: 'uncaught-exception', error });
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandledRejection', reason);
  diagnostics.recordCrash({ type: 'unhandled-rejection', error: reason });
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

      const userDataDir = app.getPath('userData');
      const rendererDir = join(__dirname, '../renderer');

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
      const pickFile = createFilePicker({
        showOpenDialog: (options) =>
          mainWindow && !mainWindow.isDestroyed()
            ? dialog.showOpenDialog(mainWindow, options)
            : dialog.showOpenDialog(options),
        getDefaultPath: () => lastGeneratedPath
      });
      // 鲁港通 - 文档副本写入下载目录，原文件不动；只记录本机路径用于后续打开
      const editDocumentCopy: PreviewEditor = async ({ document, operations }) => {
        const input = { document, operations, outputDir: app.getPath('downloads') };
        const copy =
          document.format === 'docx' ? await editDocxCopy(input) : await editXlsxCopy(input);
        lastGeneratedPath = copy.path;
        return copy;
      };
      // 鲁港通 - PDF 叠加同样只写副本：原文件保持原样，副本落到下载目录
      const writePdfCopy = async (input: {
        pdfBytes: Uint8Array;
        fileName: string;
        sourcePath: string;
        placements: Parameters<typeof writePdfOverlayCopy>[0]['placements'];
      }) => {
        const copy = await writePdfOverlayCopy({
          ...input,
          outputDir: app.getPath('downloads')
        });
        lastGeneratedPath = copy.path;
        return copy;
      };
      // 鲁港通 - 右栏文件标签与逐条确认：会话只在本机主进程，快照不含本机路径
      const documents = new DocumentPreviewManager({
        editDocument: editDocumentCopy,
        writePdf: writePdfCopy,
        openLocal: async () => {
          const picked = await pickFile({
            title: '选择要打开的文件',
            buttonLabel: '打开文件',
            filters: [{ name: 'Word / Excel / PDF', extensions: ['docx', 'xlsx', 'pdf'] }]
          });
          if (!picked) return null;
          if (picked.toLowerCase().endsWith('.pdf')) {
            return { format: 'pdf', name: basename(picked), path: picked };
          }
          const document = await parseDocumentFile(picked);
          return { format: document.format, document };
        },
        openCopy: async (path) => {
          const error = await shell.openPath(path);
          if (error) log.warn('[lugang-desktop] open copy failed', error);
        },
        emit: (list) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.documentsChanged, list);
          }
        }
      });
      // 鲁港通 - 停止 AI 或关闭面板时一并放弃未完成的预览会话（含 PDF 叠加）
      const previewDocument: AiDocumentPreviewer = Object.assign(
        (input: Parameters<AiDocumentPreviewer>[0]) => documents.preview(input),
        {
          cancel: () => documents.cancelAll(),
          previewPdf: documents.previewPdf
        }
      );
      const aiController = new AiController({
        browser,
        driver: aiDriver,
        audit: (record) => aiAudit.append(record),
        generateFile: async (input) => {
          const file = await generateFile(input);
          lastGeneratedPath = file.path;
          return file;
        },
        pickFile,
        confirm: createAiConfirmer({
          getParentWindow: () => mainWindow,
          preloadPath: join(__dirname, '../preload/confirm.cjs'),
          rendererDir
        }),
        // 鲁港通 - 表单只在用户亲手选定后读取，路径与字段定位留在主进程
        openForm: async () => {
          const picked = await pickFile({
            title: '选择要填写的空白表单',
            buttonLabel: '选择表单',
            filters: [{ name: '可填写表单', extensions: ['docx', 'xlsx', 'pdf'] }]
          });
          if (!picked) return null;
          return parseFormFile(picked);
        },
        // 鲁港通 - 右栏已经打开文件时按该文件路径直接读取，不再弹选择窗口
        openFormAtPath: parseFormFile,
        fillForm: async ({ form, values }) => {
          const copy = await fillFormCopy({
            form,
            values,
            outputDir: app.getPath('downloads')
          });
          lastGeneratedPath = copy.path;
          return copy;
        },
        confirmForm: createAiFormConfirmer({
          getParentWindow: () => mainWindow,
          preloadPath: join(__dirname, '../preload/formConfirm.cjs'),
          rendererDir
        }),
        // 鲁港通 - 文档修改：只读取用户亲手选定的文件，副本写入下载目录，原文件不动
        openDocument: async () => {
          const picked = await pickFile({
            title: '选择要修改的 Word 或 Excel 文件',
            buttonLabel: '选择文档',
            filters: [{ name: 'Word / Excel 文档', extensions: ['docx', 'xlsx'] }]
          });
          if (!picked) return null;
          return parseDocumentFile(picked);
        },
        // 鲁港通 - 修改只能在右栏源文件预览里逐条确认，没有第二套文字确认窗
        previewDocument,
        // 鲁港通 - 供读取失败时区分「右栏是文件」与「右栏没有网页」
        hasLocalDocuments: () => documents.list().length > 0,
        // 鲁港通 - AI 读取时优先读右栏当前打开的文件
        readActiveDocument: () => documents.readActiveDocument(),
        // 鲁港通 - 右栏是 PDF 时只提取标签提纲，模型据此决定 fill_pdf 的内容
        readPdfOutline: async (path: string) =>
          extractPdfOutline(new Uint8Array(await readFile(path))),
        // 鲁港通 - 改完副本后重新解析，让模型接着改同一份副本
        reloadDocument: parseDocumentFile
      });

      // 鲁港通 - 设备令牌只留在主进程：用应用会话 Cookie 注册，safeStorage 加密后落盘
      const deviceStore = createDeviceStore({
        filePath: join(userDataDir, 'desktop-device.json'),
        safeStorage,
        log: (message, error) => log.warn(`[lugang-desktop] ${message}`, error)
      });
      const appSession = mainWindow.webContents.session;
      const deviceName = hostname().trim().slice(0, 64) || '桌面客户端';
      diagnosticsDevice = {
        deviceId: deviceStore.deviceId,
        deviceName,
        appVersion: app.getVersion(),
        platform: `${process.platform} ${process.arch}`
      };
      loadDiagnosticsToken = deviceStore.loadToken;
      // 鲁港通 - 启动时先补传上次未发出去的崩溃记录，注册成功后再补一次
      void diagnostics.uploadPending();
      deviceChannel = createDeviceChannel({
        baseUrl: appUrl,
        deviceId: deviceStore.deviceId,
        deviceName,
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
          aiController.execute(command, { resume: true, commandId }),
        stopExecution: () => aiController.stop(),
        onRegistered: () => {
          void diagnostics.uploadPending();
        },
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
      // 鲁港通 - 界面进程崩溃不带走主进程：记录后由令牌补传
      mainWindow.webContents.on('render-process-gone', (_event, details) => {
        diagnostics.recordCrash({
          type: 'renderer-crash',
          message: `界面进程异常退出：${details.reason}（退出码 ${details.exitCode}）`
        });
      });

      // 鲁港通 - 更新控制器先装配再交给 IPC，网页端点「检查更新」才有落点
      const update = setupAutoUpdate({ window: mainWindow, onBeforeQuit: markQuitting });

      registerIpc({
        mainWindow,
        appUrl,
        appVersion: app.getVersion(),
        browser,
        ai: aiController,
        deviceChannel: activeDeviceChannel,
        documents,
        diagnostics,
        windowControls,
        update
      });
      update.start();

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
