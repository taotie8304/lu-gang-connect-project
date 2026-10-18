// 鲁港通 - 本地浏览器管理器：每个标签一个 WebContentsView，共享独立分区
import { BrowserWindow, WebContentsView, dialog, session } from 'electron';
import { join } from 'node:path';
import { cssRectToDip, type DipRect } from '../bounds';
import { IPC_CHANNELS, type DesktopBrowserState } from '../../shared/ipc';
import type { CssRect } from '../../shared/geometry';
import { isManualBrowserNavigationAllowed, parseManualBrowserUrl } from '../navigation';
import { installNavigationGuard } from '../navigationGuard';
import { stripElectronFromUserAgent } from '../../shared/ua';
import {
  MAX_TABS,
  addTabToOrder,
  removeTabFromOrder,
  selectTabInOrder,
  type TabOrderState
} from '../tabs';
import {
  loadPermissionStore,
  permissionKey,
  savePermissionStore,
  type PermissionDecision
} from '../permissionStore';

type TabEntry = {
  view: WebContentsView;
  title: string;
  url: string;
  failedUrl?: string;
  loading: boolean;
};

export type BrowserManagerOptions = {
  window: BrowserWindow;
  tabPreloadPath: string;
  rendererDir: string;
  permissionStorePath: string;
  partition?: string;
};

const PERMISSION_LABELS: Record<string, string> = {
  media: '摄像头与麦克风',
  geolocation: '位置信息',
  notifications: '通知',
  midi: 'MIDI 设备',
  midiSysex: 'MIDI 设备',
  hid: 'HID 设备',
  serial: '串口设备',
  usb: 'USB 设备',
  'clipboard-read': '读取剪贴板',
  'clipboard-sanitized-write': '写入剪贴板',
  'display-capture': '屏幕共享',
  'speaker-selection': '扬声器选择',
  'storage-access': '存储访问',
  'top-level-storage-access': '存储访问',
  'window-management': '窗口管理'
};

const normalizeOrigin = (input: string): string | null => {
  try {
    const url = new URL(input);
    return url.origin === 'null' ? null : url.origin;
  } catch {
    return null;
  }
};

export class BrowserManager {
  private readonly window: BrowserWindow;
  private readonly partition: string;
  private readonly tabPreloadPath: string;
  private readonly rendererDir: string;
  private readonly permissionStorePath: string;
  private readonly tabs = new Map<number, TabEntry>();
  private readonly permissions: Record<string, PermissionDecision>;
  private readonly permissionPrompts = new Set<string>();
  private order: TabOrderState = { order: [], activeId: null };
  private bounds: DipRect = { x: 0, y: 0, width: 0, height: 0 };
  private viewVisible = false;
  private panelOpen = false;
  private notifyTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor(options: BrowserManagerOptions) {
    this.window = options.window;
    this.partition = options.partition ?? 'persist:lugang-browser';
    this.tabPreloadPath = options.tabPreloadPath;
    this.rendererDir = options.rendererDir;
    this.permissionStorePath = options.permissionStorePath;
    this.permissions = loadPermissionStore(options.permissionStorePath);

    const browserSession = session.fromPartition(this.partition);
    browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents.getURL();
      this.handlePermissionRequest(webContents, permission, callback, requestingUrl);
    });
    browserSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
      this.handlePermissionCheck(permission, requestingOrigin)
    );
    browserSession.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: '保存下载文件', buttonLabel: '保存' });
    });
  }

  openPanel = (): DesktopBrowserState => {
    if (!this.destroyed) {
      this.panelOpen = true;
      if (this.tabs.size === 0) this.createTab();
      else {
        this.applyVisibility();
        this.emitState();
      }
    }
    return this.getState();
  };

  closePanel = (): DesktopBrowserState => {
    if (!this.destroyed) {
      this.panelOpen = false;
      this.viewVisible = false;
      for (const id of [...this.tabs.keys()]) this.closeTabInternal(id);
      this.order = { order: [], activeId: null };
      this.emitState();
    }
    return this.getState();
  };

  createTab = (rawUrl?: string): DesktopBrowserState => {
    if (this.destroyed || this.tabs.size >= MAX_TABS) return this.getState();
    const target = rawUrl ? parseManualBrowserUrl(rawUrl) : null;
    const initialUrl = target ?? 'about:blank';

    const view = new WebContentsView({
      webPreferences: {
        partition: this.partition,
        preload: this.tabPreloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false
      }
    });
    const webContents = view.webContents;
    const entry: TabEntry = {
      view,
      title: '',
      url: initialUrl === 'about:blank' ? '' : initialUrl,
      loading: false
    };

    this.tabs.set(webContents.id, entry);
    const next = addTabToOrder(this.order, webContents.id, MAX_TABS);
    if (!next) {
      this.tabs.delete(webContents.id);
      webContents.close();
      return this.getState();
    }
    // 鲁港通 - 新建标签立即选中：面板新建后网址栏直接作用于新标签
    this.order = selectTabInOrder(next, webContents.id);

    view.setBackgroundColor('#ffffff');
    view.setBounds(this.bounds);
    view.setVisible(false);
    this.window.contentView.addChildView(view);
    webContents.setUserAgent(stripElectronFromUserAgent(webContents.getUserAgent()));
    this.wireTabEvents(webContents, entry);

    this.panelOpen = true;
    this.applyVisibility();
    if (initialUrl !== 'about:blank') {
      void webContents.loadURL(initialUrl).catch(() => undefined);
    }
    this.emitState();
    return this.getState();
  };

  selectTab = (id: number): DesktopBrowserState => {
    const previousActiveId = this.order.activeId;
    this.order = selectTabInOrder(this.order, id);
    // 鲁港通 - 重复选中当前标签或传入不存在的 id 时 activeId 未变化，跳过冗余的 state-changed 广播
    if (this.order.activeId !== previousActiveId) {
      this.applyVisibility();
      this.emitState();
    }
    return this.getState();
  };

  closeTab = (id: number): DesktopBrowserState => {
    if (!this.tabs.has(id)) return this.getState();
    this.closeTabInternal(id);
    if (!this.destroyed && this.panelOpen && this.tabs.size === 0) this.createTab();
    this.applyVisibility();
    this.emitState();
    return this.getState();
  };

  navigate = (rawUrl: string): boolean => {
    const target = parseManualBrowserUrl(rawUrl);
    const entry = this.getActiveEntry();
    if (!target || !entry) return false;
    entry.failedUrl = undefined;
    entry.url = target;
    void entry.view.webContents.loadURL(target).catch(() => undefined);
    this.emitState();
    return true;
  };

  reload = (): boolean => {
    const entry = this.getActiveEntry();
    if (!entry) return false;
    const target = entry.failedUrl ?? entry.url;
    if (target) {
      entry.failedUrl = undefined;
      void entry.view.webContents.loadURL(target).catch(() => undefined);
    } else {
      entry.view.webContents.reload();
    }
    return true;
  };

  goBack = (): boolean => {
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl) return false;
    const history = entry.view.webContents.navigationHistory;
    if (!history.canGoBack()) return false;
    history.goBack();
    return true;
  };

  goForward = (): boolean => {
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl) return false;
    const history = entry.view.webContents.navigationHistory;
    if (!history.canGoForward()) return false;
    history.goForward();
    return true;
  };

  retryTab = (webContentsId: number) => {
    const entry = this.tabs.get(webContentsId);
    if (!entry) return;
    const target = entry.failedUrl ?? entry.url;
    entry.failedUrl = undefined;
    if (!target) {
      void entry.view.webContents.loadURL('about:blank').catch(() => undefined);
      return;
    }
    void entry.view.webContents.loadURL(target).catch(() => undefined);
  };

  setBounds = (rect: CssRect) => {
    if (this.destroyed || this.window.isDestroyed()) return;
    const zoom = this.window.webContents.getZoomFactor();
    const content = this.window.getContentBounds();
    this.bounds = cssRectToDip(rect, zoom, { width: content.width, height: content.height });
    for (const entry of this.tabs.values()) entry.view.setBounds(this.bounds);
  };

  setVisible = (visible: boolean) => {
    if (this.destroyed) return;
    this.viewVisible = visible;
    this.applyVisibility();
  };

  getState = (): DesktopBrowserState => ({
    panelOpen: this.panelOpen,
    activeTabId: this.order.activeId,
    tabs: this.order.order.map((id) => {
      const entry = this.tabs.get(id)!;
      return { id, title: entry.title, url: entry.url, current: id === this.order.activeId };
    }),
    loading:
      this.order.activeId !== null && !!this.tabs.get(this.order.activeId)?.loading
  });

  destroy = () => {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = undefined;
    }
    for (const id of [...this.tabs.keys()]) this.closeTabInternal(id);
    this.order = { order: [], activeId: null };
    this.panelOpen = false;
    this.viewVisible = false;
  };

  private getActiveEntry = (): TabEntry | null =>
    this.order.activeId === null ? null : this.tabs.get(this.order.activeId) ?? null;

  private wireTabEvents(webContents: Electron.WebContents, entry: TabEntry) {
    webContents.on('page-title-updated', (_event, title) => {
      if (entry.failedUrl) return;
      entry.title = title;
      this.emitState();
    });
    webContents.on('did-start-loading', () => {
      entry.loading = true;
      this.emitState();
    });
    webContents.on('did-stop-loading', () => {
      entry.loading = false;
      this.emitState();
    });
    webContents.on('did-navigate', (_event, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        entry.url = url;
        entry.failedUrl = undefined;
      }
      this.emitState();
    });
    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return;
      entry.url = url;
      this.emitState();
    });
    webContents.on(
      'did-fail-load',
      (_event, errorCode, _description, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return;
        if (!validatedURL.startsWith('http://') && !validatedURL.startsWith('https://')) return;
        entry.failedUrl = validatedURL;
        entry.url = validatedURL;
        entry.loading = false;
        void webContents.loadFile(join(this.rendererDir, 'tab-error.html')).catch(() => undefined);
        this.emitState();
      }
    );
    webContents.on('render-process-gone', () => {
      if (!this.tabs.has(webContents.id)) return;
      this.closeTabInternal(webContents.id);
      if (this.panelOpen && this.tabs.size === 0) this.createTab();
    });
    // 鲁港通 - 标签页导航与 302 重定向同受守卫：只允许 http(s)，about:blank 起始页放行
    installNavigationGuard({
      target: webContents,
      decide: (url) =>
        isManualBrowserNavigationAllowed(url) ? { type: 'allow' } : { type: 'prevent' }
    });
    webContents.setWindowOpenHandler(({ url }) => {
      const target = parseManualBrowserUrl(url);
      if (target) this.createTab(target);
      return { action: 'deny' };
    });
  }

  private closeTabInternal = (id: number) => {
    const entry = this.tabs.get(id);
    if (!entry) return;
    this.order = removeTabFromOrder(this.order, id);
    this.tabs.delete(id);
    try {
      if (!this.window.isDestroyed()) this.window.contentView.removeChildView(entry.view);
      entry.view.webContents.close();
    } catch {
      // 鲁港通 - 窗口销毁过程中忽略移除异常
    }
    if (!this.destroyed) {
      this.applyVisibility();
      this.emitState();
    }
  };

  private applyVisibility = () => {
    for (const [id, entry] of this.tabs) {
      entry.view.setVisible(
        !this.destroyed && this.panelOpen && this.viewVisible && this.order.activeId === id
      );
    }
  };

  private emitState = () => {
    if (this.destroyed || this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      if (this.destroyed || this.window.isDestroyed()) return;
      this.window.webContents.send(IPC_CHANNELS.stateChanged, this.getState());
    }, 80);
  };

  private handlePermissionRequest(
    webContents: Electron.WebContents,
    permission: string,
    callback: (granted: boolean) => void,
    requestingUrl: string
  ) {
    if (permission === 'fullscreen' || permission === 'pointerLock') {
      callback(true);
      return;
    }
    const origin = normalizeOrigin(requestingUrl);
    if (!origin) {
      callback(false);
      return;
    }
    const key = permissionKey(origin, permission);
    const stored = this.permissions[key];
    if (stored) {
      callback(stored === 'allow');
      return;
    }
    if (this.permissionPrompts.has(key)) {
      callback(false);
      return;
    }
    // 鲁港通 - 未知权限一律拒绝：弹窗文案只有中文标签，未收录的权限无法向用户解释
    const label = PERMISSION_LABELS[permission];
    if (!label) {
      callback(false);
      return;
    }
    this.permissionPrompts.add(key);
    void dialog
      .showMessageBox(this.window, {
        type: 'question',
        title: '网站权限请求',
        message: `${origin} 请求使用「${label}」`,
        detail: '仅在你信任该网站时允许。你的选择会被记住。',
        buttons: ['拒绝', '允许'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      .then(({ response }) => {
        const allow = response === 1;
        this.permissions[key] = allow ? 'allow' : 'deny';
        savePermissionStore(this.permissionStorePath, this.permissions);
        callback(allow);
      })
      .catch(() => callback(false))
      .finally(() => this.permissionPrompts.delete(key));
  }

  private handlePermissionCheck(permission: string, requestingOrigin: string): boolean {
    if (permission === 'fullscreen' || permission === 'pointerLock') return true;
    const origin = normalizeOrigin(requestingOrigin);
    if (!origin) return false;
    return this.permissions[permissionKey(origin, permission)] === 'allow';
  }
}
