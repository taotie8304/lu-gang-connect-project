// 鲁港通 - 主窗口：加载线上聊天页；站内跳转放行，站外交系统浏览器
import { BrowserWindow, screen, shell } from 'electron';
import { join } from 'node:path';
import { stripElectronFromUserAgent } from '../shared/ua';
import {
  decideMainWindowNavigation,
  decideMainWindowWindowOpen,
  isManualBrowserNavigationAllowed
} from './navigation';
import { installNavigationGuard } from './navigationGuard';
import { decideMainWindowPermission } from './mainWindowPermissions';
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

  // 鲁港通 - 主窗口只对应用源开放剪贴板读写（聊天页复制/粘贴），其余权限一律拒绝
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const requestingOrigin =
        (details && 'requestingUrl' in details ? details.requestingUrl : undefined) ??
        window.webContents.getURL();
      callback(decideMainWindowPermission({ permission, requestingOrigin, appOrigin }));
    }
  );
  window.webContents.session.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      decideMainWindowPermission({ permission, requestingOrigin: requestingOrigin ?? '', appOrigin })
  );

  installNavigationGuard({
    target: window.webContents,
    decide: (url) => {
      const decision = decideMainWindowNavigation({
        currentUrl: window.webContents.getURL(),
        targetUrl: url,
        appOrigin
      });
      if (decision.type === 'allow') return { type: 'allow' };
      if (decision.type === 'external') {
        return { type: 'prevent', openExternal: decision.url };
      }
      return { type: 'prevent' };
    },
    openExternal: (url) => void shell.openExternal(url)
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideMainWindowWindowOpen({
      currentUrl: window.webContents.getURL(),
      targetUrl: url,
      appOrigin
    });
    if (decision.type === 'external') {
      void shell.openExternal(decision.url);
      return { action: 'deny' };
    }
    if (decision.type === 'block') return { action: 'deny' };
    // 鲁港通 - 放行目标用受控弹窗承载 OAuth 等 window.opener 型流程，不注入主窗口 preload
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: false
        }
      }
    };
  });

  window.webContents.on('did-create-window', (child) => {
    child.setMenuBarVisibility(false);
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    installNavigationGuard({
      target: child.webContents,
      decide: (url) =>
        isManualBrowserNavigationAllowed(url) ? { type: 'allow' } : { type: 'prevent' }
    });
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
