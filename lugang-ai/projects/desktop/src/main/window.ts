// 鲁港通 - 主窗口：加载线上聊天页；站内跳转放行，站外交系统浏览器
import { BrowserWindow, screen, shell } from 'electron';
import { join } from 'node:path';
import { stripElectronFromUserAgent } from '../shared/ua';
import { decideMainWindowNavigation } from './navigation';
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  isWindowStateVisible,
  loadWindowState,
  saveWindowState
} from './windowState';

type CreateMainWindowOptions = {
  appUrl: string;
  preloadPath: string;
  rendererDir: string;
  userDataDir: string;
};

export const createMainWindow = ({
  appUrl,
  preloadPath,
  rendererDir,
  userDataDir
}: CreateMainWindowOptions) => {
  const appOrigin = new URL(appUrl).origin;
  const stored = loadWindowState(userDataDir);
  const displays = screen.getAllDisplays().map((display) => display.workArea);
  const restorePosition = isWindowStateVisible(stored, displays);
  const restoreBounds =
    restorePosition && stored.x !== undefined && stored.y !== undefined
      ? { x: stored.x, y: stored.y, width: stored.width, height: stored.height }
      : undefined;
  // 鲁港通 - 恢复尺寸按目标显示器工作区夹取，避免大屏位置在小屏上溢出
  const workArea = restoreBounds
    ? screen.getDisplayMatching(restoreBounds).workArea
    : screen.getPrimaryDisplay().workArea;
  const width = Math.min(stored.width, workArea.width);
  const height = Math.min(stored.height, workArea.height);

  const window = new BrowserWindow({
    width,
    height,
    ...(restorePosition && stored.x !== undefined && stored.y !== undefined
      ? { x: stored.x, y: stored.y }
      : {}),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    backgroundColor: '#ffffff',
    title: '鲁港通',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      // 鲁港通 - 供 preload 判断当前页面是否为本应用源，避免 OAuth 第三方页拿到桌面桥
      additionalArguments: [`--lugang-app-origin=${appOrigin}`]
    }
  });

  window.webContents.setUserAgent(
    stripElectronFromUserAgent(window.webContents.getUserAgent())
  );

  // 鲁港通 - 主窗口只承载聊天页，不申请任何系统权限；本地浏览器视图走独立分区
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  window.webContents.session.setPermissionCheckHandler(() => false);

  window.webContents.on('will-navigate', (event, targetUrl) => {
    const decision = decideMainWindowNavigation({
      currentUrl: window.webContents.getURL(),
      targetUrl,
      appOrigin
    });
    if (decision.type === 'allow') return;
    event.preventDefault();
    if (decision.type === 'external') void shell.openExternal(decision.url);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideMainWindowNavigation({
      currentUrl: window.webContents.getURL(),
      targetUrl: url,
      appOrigin
    });
    if (decision.type === 'external') {
      void shell.openExternal(decision.url);
    } else if (decision.type === 'allow') {
      void window.loadURL(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, _description, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      if (validatedURL.startsWith('file://')) return;
      void window.loadFile(join(rendererDir, 'main-error.html'));
    }
  );

  const persist = () => {
    if (window.isDestroyed()) return;
    saveWindowState(userDataDir, {
      ...window.getNormalBounds(),
      isMaximized: window.isMaximized()
    });
  };
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };
  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('maximize', scheduleSave);
  window.on('unmaximize', scheduleSave);
  window.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer);
    persist();
  });

  window.once('ready-to-show', () => {
    if (restorePosition && stored.isMaximized) window.maximize();
    window.show();
  });

  void window.loadURL(appUrl).catch(() => undefined);

  return window;
};
