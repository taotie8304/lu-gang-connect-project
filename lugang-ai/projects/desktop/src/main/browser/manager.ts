// 鲁港通 - 本地浏览器管理器：每个标签一个 WebContentsView，共享独立分区
import {
  BrowserWindow,
  Menu,
  WebContentsView,
  app,
  clipboard,
  dialog,
  session,
  shell
} from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { cssRectToDip, type DipRect } from '../bounds';
import {
  IPC_CHANNELS,
  type DesktopBrowserState,
  type DesktopClearBrowsingDataOptions,
  type DesktopDownloadItem,
  type DesktopDownloadStatus,
  type DesktopFindResult,
  type DesktopPanelCommand,
  type DesktopSiteAiMode
} from '../../shared/ipc';
import type { AiFailureHighlight } from '../ai/executor';
import {
  buildAiClearFailureHighlightExpression,
  buildAiFailureHighlightExpression
} from '../ai/failureHighlightScript';
import type { CssRect } from '../../shared/geometry';
import { isManualBrowserNavigationAllowed, parseManualBrowserUrl } from '../navigation';
import { installNavigationGuard } from '../navigationGuard';
import { stripElectronFromUserAgent } from '../../shared/ua';
import {
  MAX_TABS,
  addTabToOrder,
  isAiLockedTab,
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
import { buildDownloadFilePath, sanitizeFileBaseName, trimDownloadRows } from './downloads';
import {
  DEFAULT_ZOOM_PERCENT,
  loadZoomStore,
  normalizeZoomPercent,
  saveZoomStore,
  stepZoomPercent
} from './zoom';
import {
  loadSiteAiPrefStore,
  normalizeSiteOrigin,
  saveSiteAiPrefStore
} from './siteAiPrefs';
import { resolveBrowserShortcut } from './shortcuts';

type TabEntry = {
  view: WebContentsView;
  title: string;
  url: string;
  failedUrl?: string;
  loading: boolean;
  zoomOrigin?: string;
};

// 鲁港通 - 下载记录含本机保存路径，只在主进程内部使用
type DownloadRecord = {
  id: string;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  status: DesktopDownloadStatus;
  savePath: string;
  startedAt: number;
  item?: Electron.DownloadItem;
};

export type BrowserManagerOptions = {
  window: BrowserWindow;
  tabPreloadPath: string;
  rendererDir: string;
  permissionStorePath: string;
  zoomStorePath: string;
  siteAiPrefsStorePath: string;
  partition?: string;
  events?: BrowserManagerEvents;
};

export type BrowserTabClosedEvent = {
  id: number;
  url: string;
  active: boolean;
  reason: 'user' | 'crashed';
};

export type BrowserDownloadCompletedEvent = {
  path: string;
  fileName: string;
  url?: string;
};

export type BrowserManagerEvents = {
  onTabClosed?: (event: BrowserTabClosedEvent) => void;
  onPanelClosed?: () => void;
  // 鲁港通 - 下载完成后把落盘位置交给资料库暂存索引，浏览器本身不关心
  onDownloadCompleted?: (event: BrowserDownloadCompletedEvent) => void;
};

export type BrowserDebuggerSession = {
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
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
  private readonly zoomStorePath: string;
  private readonly siteAiPrefsStorePath: string;
  private readonly events: BrowserManagerEvents;
  private readonly tabs = new Map<number, TabEntry>();
  private readonly permissions: Record<string, PermissionDecision>;
  private readonly permissionPrompts = new Set<string>();
  private readonly zoomStore: Record<string, number>;
  private readonly siteAiPrefs: Record<string, DesktopSiteAiMode>;
  private readonly downloads = new Map<string, DownloadRecord>();
  private order: TabOrderState = { order: [], activeId: null };
  private bounds: DipRect = { x: 0, y: 0, width: 0, height: 0 };
  private viewVisible = false;
  private panelOpen = false;
  private notifyTimer: ReturnType<typeof setTimeout> | undefined;
  private notifyDownloadsTimer: ReturnType<typeof setTimeout> | undefined;
  private findQuery: string | null = null;
  private downloadSeq = 0;
  private aiLockedTabId: number | null = null;
  private destroyed = false;

  constructor(options: BrowserManagerOptions) {
    this.window = options.window;
    this.partition = options.partition ?? 'persist:lugang-browser';
    this.tabPreloadPath = options.tabPreloadPath;
    this.rendererDir = options.rendererDir;
    this.permissionStorePath = options.permissionStorePath;
    this.zoomStorePath = options.zoomStorePath;
    this.siteAiPrefsStorePath = options.siteAiPrefsStorePath;
    this.events = options.events ?? {};
    this.permissions = loadPermissionStore(options.permissionStorePath);
    this.zoomStore = loadZoomStore(options.zoomStorePath);
    this.siteAiPrefs = loadSiteAiPrefStore(options.siteAiPrefsStorePath);

    const browserSession = session.fromPartition(this.partition);
    browserSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents.getURL();
      this.handlePermissionRequest(webContents, permission, callback, requestingUrl);
    });
    browserSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
      this.handlePermissionCheck(permission, requestingOrigin)
    );
    browserSession.on('will-download', (_event, item) => {
      // 鲁港通 - 下载默认存到系统下载目录并自动开始，任务条负责进度与打开入口
      item.setSavePath(
        buildDownloadFilePath(app.getPath('downloads'), item.getFilename(), existsSync)
      );
      this.trackDownload(item);
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
    const hadContent = this.panelOpen || this.tabs.size > 0;
    if (!this.destroyed) {
      this.panelOpen = false;
      this.viewVisible = false;
      this.findQuery = null;
      for (const id of [...this.tabs.keys()]) this.closeTabInternal(id);
      this.order = { order: [], activeId: null };
      this.emitState();
    }
    if (hadContent && !this.destroyed) this.notifyPanelClosed();
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
      this.runFind(true);
    }
    return this.getState();
  };

  closeTab = (id: number): DesktopBrowserState => {
    const entry = this.tabs.get(id);
    if (!entry) return this.getState();
    // 鲁港通 - AI 锁定标签硬拦截：关闭按钮/中键/Ctrl+W/菜单最终都走这里
    if (isAiLockedTab(this.aiLockedTabId, id)) return this.getState();
    const event: BrowserTabClosedEvent = {
      id,
      url: entry.url,
      active: this.order.activeId === id,
      reason: 'user'
    };
    this.closeTabInternal(id);
    if (!this.destroyed && this.panelOpen && this.tabs.size === 0) this.createTab();
    this.applyVisibility();
    this.emitState();
    this.runFind(true);
    this.notifyTabClosed(event);
    return this.getState();
  };

  // 鲁港通 - AI 执行前切回绑定标签；与手工切换共用同一套可见性与广播逻辑
  activateTab = (id: number): DesktopBrowserState => this.selectTab(id);

  setAiLockedTab = (id: number | null): void => {
    if (this.aiLockedTabId === id) return;
    this.aiLockedTabId = id;
    this.emitState();
  };

  // 鲁港通 - 失败标注只注入页面视图，随页面导航自然消失，也可被下次操作主动清除
  showFailureHighlight = (tabId: number, highlight: AiFailureHighlight): void => {
    const entry = this.tabs.get(tabId);
    if (!entry || entry.failedUrl) return;
    const contents = entry.view.webContents;
    if (contents.isDestroyed()) return;
    void contents
      .executeJavaScript(buildAiFailureHighlightExpression(highlight), false)
      .catch(() => undefined);
  };

  clearFailureHighlight = (tabId: number): void => {
    const entry = this.tabs.get(tabId);
    if (!entry) return;
    const contents = entry.view.webContents;
    if (contents.isDestroyed()) return;
    void contents
      .executeJavaScript(buildAiClearFailureHighlightExpression(), false)
      .catch(() => undefined);
  };

  // 鲁港通 - 站点 AI 偏好按 origin 生效；allow 即删除记录，文件里只留收紧的站点
  getSiteAiMode = (origin?: string | null): DesktopSiteAiMode => {
    const key =
      origin === undefined || origin === null ? this.getActiveOrigin() : normalizeSiteOrigin(origin);
    if (!key) return 'allow';
    return this.siteAiPrefs[key] ?? 'allow';
  };

  setSiteAiMode = (origin: string, mode: DesktopSiteAiMode): DesktopSiteAiMode => {
    const key = normalizeSiteOrigin(origin);
    if (!key) return 'allow';
    if (mode === 'allow') delete this.siteAiPrefs[key];
    else this.siteAiPrefs[key] = mode;
    saveSiteAiPrefStore(this.siteAiPrefsStorePath, this.siteAiPrefs);
    this.send(IPC_CHANNELS.siteAiPrefChanged, { origin: key, mode });
    this.emitState();
    return mode;
  };

  // 鲁港通 - 地址栏盾牌徽标点击时直接弹出同一组权限选项
  showSiteAiMenu = () => {
    if (!this.getActiveEntry()) return;
    Menu.buildFromTemplate(this.buildSiteAiMenu()).popup({ window: this.window });
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

  // 鲁港通 - 页内查找：输入即从首个命中开始，Enter / Shift+Enter 走下一个 / 上一个
  findStart = (query: string) => {
    this.findQuery = query;
    this.runFind(true);
  };

  findNext = (direction: 'next' | 'previous') => {
    this.runFind(false, direction !== 'previous');
  };

  findStop = () => {
    this.findQuery = null;
    const entry = this.getActiveEntry();
    if (entry && !entry.view.webContents.isDestroyed()) {
      entry.view.webContents.stopFindInPage('clearSelection');
    }
  };

  setZoom = (value: number): number => {
    const entry = this.getActiveEntry();
    if (!entry) return DEFAULT_ZOOM_PERCENT;
    const percent = normalizeZoomPercent(value);
    const origin = normalizeOrigin(entry.url);
    if (origin) {
      this.zoomStore[origin] = percent;
      saveZoomStore(this.zoomStorePath, this.zoomStore);
      entry.zoomOrigin = origin;
    }
    this.applyZoomPercent(entry, percent);
    this.send(IPC_CHANNELS.zoomChanged, percent);
    this.emitState();
    return percent;
  };

  resetZoom = (): number => this.setZoom(DEFAULT_ZOOM_PERCENT);

  zoomIn = (): number => this.setZoom(stepZoomPercent(this.getActiveZoomPercent(), 'in'));

  zoomOut = (): number => this.setZoom(stepZoomPercent(this.getActiveZoomPercent(), 'out'));

  printPage = (): boolean => {
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl || entry.view.webContents.isDestroyed()) return false;
    entry.view.webContents.print({ printBackground: true, silent: false }, () => undefined);
    return true;
  };

  // 鲁港通 - 另存为 PDF 走系统保存对话框，完成后复用下载任务条打开/定位
  savePagePdf = async (): Promise<boolean> => {
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl || entry.view.webContents.isDestroyed()) return false;
    const baseName = sanitizeFileBaseName(entry.title || normalizeOrigin(entry.url) || 'page');
    const result = await dialog.showSaveDialog(this.window, {
      title: '另存为 PDF',
      defaultPath: join(app.getPath('downloads'), `${baseName}.pdf`),
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return false;
    const data = await entry.view.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    await writeFile(result.filePath, data);
    this.addSyntheticDownload(basename(result.filePath), result.filePath, data.byteLength);
    // 鲁港通 - 另存 PDF 同样算网页下载，资料库可直接找到
    this.events.onDownloadCompleted?.({
      path: result.filePath,
      fileName: basename(result.filePath),
      ...(entry.url ? { url: entry.url } : {})
    });
    return true;
  };

  copyLink = (): boolean => {
    const url = this.getActivePageUrl();
    if (!url) return false;
    clipboard.writeText(url);
    return true;
  };

  openExternal = async (): Promise<boolean> => {
    const url = this.getActivePageUrl();
    if (!url) return false;
    try {
      await shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  };

  // 鲁港通 - 更多菜单用 Electron 原生菜单：WebContentsView 会遮挡网页层浮层
  showPageMenu = () => {
    if (!this.getActiveEntry()) return;
    const percent = this.getActiveZoomPercent();
    const template: Electron.MenuItemConstructorOptions[] = [
      { label: '打印页面', accelerator: 'CmdOrCtrl+P', click: () => this.printPage() },
      { label: '另存为 PDF…', click: () => void this.savePagePdf().catch(() => undefined) },
      { label: '复制页面链接', click: () => this.copyLink() },
      { label: '在系统浏览器中打开', click: () => void this.openExternal() },
      { type: 'separator' },
      { label: `放大（${percent}%）`, click: () => this.zoomIn() },
      { label: '缩小', click: () => this.zoomOut() },
      {
        label: percent === DEFAULT_ZOOM_PERCENT ? '重置缩放' : `重置缩放（当前 ${percent}%）`,
        click: () => this.resetZoom()
      },
      { type: 'separator' },
      { label: '本站点 AI 权限', submenu: this.buildSiteAiMenu() },
      { label: '本次操作记录', click: () => this.sendPanelCommand('timeline') },
      { label: '清除浏览数据…', click: () => this.sendPanelCommand('clear-data') },
      { label: '键盘快捷键', click: () => this.sendPanelCommand('shortcuts') }
    ];
    Menu.buildFromTemplate(template).popup({ window: this.window });
  };

  // 鲁港通 - 清除范围仅内置浏览器分区与站点权限，应用登录态与缩放记忆不受影响
  clearBrowsingData = async (options: DesktopClearBrowsingDataOptions): Promise<boolean> => {
    if (!options.cookies && !options.cache && !options.permissions) return false;
    try {
      const browserSession = session.fromPartition(this.partition);
      if (options.cookies) {
        await browserSession.clearStorageData({
          storages: [
            'cookies',
            'localstorage',
            'indexdb',
            'cachestorage',
            'serviceworkers',
            'shadercache',
            'filesystem'
          ]
        });
      }
      if (options.cache) await browserSession.clearCache();
      if (options.permissions) {
        for (const key of Object.keys(this.permissions)) delete this.permissions[key];
        savePermissionStore(this.permissionStorePath, this.permissions);
      }
      for (const [id, entry] of this.tabs) {
        if (entry.failedUrl) this.retryTab(id);
        else if (!entry.view.webContents.isDestroyed()) entry.view.webContents.reload();
      }
      this.emitState();
      return true;
    } catch {
      return false;
    }
  };

  listDownloads = (): DesktopDownloadItem[] => this.getDownloadRows();

  openDownload = async (id: string): Promise<boolean> => {
    const record = this.downloads.get(id);
    if (!record || record.status !== 'completed' || !record.savePath) return false;
    const error = await shell.openPath(record.savePath);
    return error === '';
  };

  showDownloadInFolder = (id: string): boolean => {
    const record = this.downloads.get(id);
    if (!record || !record.savePath) return false;
    shell.showItemInFolder(record.savePath);
    return true;
  };

  cancelDownload = (id: string) => {
    this.downloads.get(id)?.item?.cancel();
  };

  dismissDownload = (id: string) => {
    const record = this.downloads.get(id);
    if (!record) return;
    record.item?.cancel();
    this.downloads.delete(id);
    this.emitDownloads();
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

  getState = (): DesktopBrowserState => {
    const entry = this.getActiveEntry();
    let canGoBack = false;
    let canGoForward = false;
    if (entry && !entry.failedUrl && !entry.view.webContents.isDestroyed()) {
      try {
        canGoBack = entry.view.webContents.navigationHistory.canGoBack();
        canGoForward = entry.view.webContents.navigationHistory.canGoForward();
      } catch {
        // 鲁港通 - 窗口销毁过程中读取历史可能抛错，按不可导航处理
      }
    }
    return {
      panelOpen: this.panelOpen,
      activeTabId: this.order.activeId,
      tabs: this.order.order.map((id) => {
        const item = this.tabs.get(id)!;
        return {
          id,
          title: item.title,
          url: item.url,
          current: id === this.order.activeId,
          ...(isAiLockedTab(this.aiLockedTabId, id) ? { locked: true } : {})
        };
      }),
      loading:
        this.order.activeId !== null && !!this.tabs.get(this.order.activeId)?.loading,
      canGoBack,
      canGoForward,
      zoomPercent: this.getActiveZoomPercent(),
      siteAiMode: this.getSiteAiMode()
    };
  };

  // 鲁港通 - AI 操作时按需挂上调试器；每次取当前活动标签，重开后自动切换新页面
  getActiveDebuggerSession = (): BrowserDebuggerSession | null => {
    const entry = this.getActiveEntry();
    if (!entry) return null;
    const contents = entry.view.webContents;
    if (contents.isDestroyed()) return null;
    try {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
    } catch {
      return null;
    }
    return {
      sendCommand: (method, params) => contents.debugger.sendCommand(method, params)
    };
  };

  destroy = () => {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = undefined;
    }
    if (this.notifyDownloadsTimer) {
      clearTimeout(this.notifyDownloadsTimer);
      this.notifyDownloadsTimer = undefined;
    }
    for (const id of [...this.tabs.keys()]) this.closeTabInternal(id);
    this.order = { order: [], activeId: null };
    this.panelOpen = false;
    this.viewVisible = false;
  };

  private getActiveEntry = (): TabEntry | null =>
    this.order.activeId === null ? null : this.tabs.get(this.order.activeId) ?? null;

  private getActiveOrigin(): string | null {
    const entry = this.getActiveEntry();
    // 鲁港通 - 只有 http(s) 网页才有站点 AI 权限，内置错误页/空白页不显示徽标也不记忆
    return entry?.url ? normalizeSiteOrigin(entry.url) : null;
  }

  // 鲁港通 - 三档单选 + 恢复默认；没有可识别站点时整组禁用
  private buildSiteAiMenu(): Electron.MenuItemConstructorOptions[] {
    const origin = this.getActiveOrigin();
    const mode = this.getSiteAiMode(origin);
    const choose = (next: DesktopSiteAiMode) => () => {
      if (origin) this.setSiteAiMode(origin, next);
    };
    return [
      {
        label: '允许操作（默认）',
        type: 'radio',
        checked: mode === 'allow',
        enabled: Boolean(origin),
        click: choose('allow')
      },
      {
        label: '仅读取',
        type: 'radio',
        checked: mode === 'read_only',
        enabled: Boolean(origin),
        click: choose('read_only')
      },
      {
        label: '禁止 AI',
        type: 'radio',
        checked: mode === 'blocked',
        enabled: Boolean(origin),
        click: choose('blocked')
      },
      { type: 'separator' },
      {
        label: '恢复默认（允许操作）',
        enabled: Boolean(origin) && mode !== 'allow',
        click: choose('allow')
      }
    ];
  }

  private getActivePageUrl(): string | null {
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl) return null;
    return entry.url.startsWith('http://') || entry.url.startsWith('https://') ? entry.url : null;
  }

  private getActiveZoomPercent(): number {
    const entry = this.getActiveEntry();
    if (!entry) return DEFAULT_ZOOM_PERCENT;
    const origin = normalizeOrigin(entry.url);
    if (!origin) return DEFAULT_ZOOM_PERCENT;
    return this.zoomStore[origin] ?? DEFAULT_ZOOM_PERCENT;
  }

  private applyZoomPercent(entry: TabEntry, percent: number) {
    const contents = entry.view.webContents;
    if (contents.isDestroyed()) return;
    try {
      contents.setZoomFactor(percent / 100);
    } catch {
      // 鲁港通 - 页面销毁过程中忽略缩放失败
    }
  }

  // 鲁港通 - 换站点时恢复该 origin 上次的缩放档位，同一站点内导航不重置
  private restoreZoomForEntry(entry: TabEntry, url: string) {
    const origin = normalizeOrigin(url);
    if (!origin || entry.zoomOrigin === origin) return;
    entry.zoomOrigin = origin;
    const percent = this.zoomStore[origin] ?? DEFAULT_ZOOM_PERCENT;
    this.applyZoomPercent(entry, percent);
    // 鲁港通 - 仅对非默认档位提示，且只在本次导航确实恢复记忆时提示
    if (
      percent !== DEFAULT_ZOOM_PERCENT &&
      this.order.activeId === entry.view.webContents.id
    ) {
      this.send(IPC_CHANNELS.zoomRestored, { origin, percent });
    }
  }

  // 鲁港通 - Electron 语义：findNext=true 开启新查找会话，false 沿当前会话跳到下一个命中
  private runFind(findNext: boolean, forward = true) {
    if (!this.findQuery) return;
    const entry = this.getActiveEntry();
    if (!entry || entry.failedUrl || entry.view.webContents.isDestroyed()) return;
    entry.view.webContents.findInPage(this.findQuery, { findNext, forward });
  }

  private trackDownload(item: Electron.DownloadItem) {
    const record: DownloadRecord = {
      id: randomUUID(),
      fileName: item.getFilename() || `download-${++this.downloadSeq}`,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      status: 'progressing',
      savePath: '',
      startedAt: Date.now() + this.downloadSeq,
      item
    };
    this.downloads.set(record.id, record);
    const sync = () => {
      record.fileName = item.getFilename() || record.fileName;
      record.receivedBytes = item.getReceivedBytes();
      record.totalBytes = item.getTotalBytes();
      record.savePath = item.getSavePath() || record.savePath;
    };
    item.on('updated', (_event, state) => {
      sync();
      if (state === 'interrupted') record.status = 'interrupted';
      this.emitDownloads();
    });
    item.once('done', (_event, state) => {
      sync();
      record.status = state;
      record.item = undefined;
      this.trimDownloads();
      this.emitDownloads();
      if (state === 'completed' && record.savePath) {
        const url = item.getURL();
        this.events.onDownloadCompleted?.({
          path: record.savePath,
          fileName: record.fileName,
          ...(url ? { url } : {})
        });
      }
    });
    this.emitDownloads();
  }

  private addSyntheticDownload(fileName: string, savePath: string, size: number) {
    const record: DownloadRecord = {
      id: randomUUID(),
      fileName,
      receivedBytes: size,
      totalBytes: size,
      status: 'completed',
      savePath,
      startedAt: Date.now() + ++this.downloadSeq
    };
    this.downloads.set(record.id, record);
    this.trimDownloads();
    this.emitDownloads();
  }

  private getDownloadRows(): DesktopDownloadItem[] {
    return trimDownloadRows([...this.downloads.values()]).map((record) => ({
      id: record.id,
      fileName: record.fileName,
      receivedBytes: record.receivedBytes,
      totalBytes: record.totalBytes,
      status: record.status
    }));
  }

  private trimDownloads() {
    const sorted = trimDownloadRows([...this.downloads.values()]);
    if (sorted.length === this.downloads.size) return;
    const keep = new Set(sorted.map((record) => record.id));
    for (const [id, record] of this.downloads) {
      if (keep.has(id)) continue;
      record.item?.cancel();
      this.downloads.delete(id);
    }
  }

  private emitDownloads() {
    if (this.destroyed || this.notifyDownloadsTimer) return;
    this.notifyDownloadsTimer = setTimeout(() => {
      this.notifyDownloadsTimer = undefined;
      if (this.destroyed || this.window.isDestroyed()) return;
      this.window.webContents.send(IPC_CHANNELS.downloadsChanged, this.getDownloadRows());
    }, 100);
  }

  private send(channel: string, payload: unknown) {
    if (this.destroyed || this.window.isDestroyed()) return;
    this.window.webContents.send(channel, payload);
  }

  private sendPanelCommand(command: DesktopPanelCommand) {
    this.send(IPC_CHANNELS.panelCommand, command);
  }

  // 鲁港通 - 网页焦点在原生视图时由主进程统一接快捷键，面板 UI 焦点由渲染层处理
  private handleTabShortcut(event: Electron.Event, input: Electron.Input) {
    // 鲁港通 - 查找条开着且焦点在网页内时，Esc 同时收起查找条并清除高亮
    if (
      input.type === 'keyDown' &&
      !input.isAutoRepeat &&
      input.key === 'Escape' &&
      !input.control &&
      !input.meta &&
      !input.alt &&
      this.findQuery
    ) {
      event.preventDefault();
      this.findStop();
      this.sendPanelCommand('close-find');
      return;
    }
    const action = resolveBrowserShortcut(input);
    if (!action) return;
    event.preventDefault();
    switch (action) {
      case 'back':
        this.goBack();
        this.emitState();
        break;
      case 'forward':
        this.goForward();
        this.emitState();
        break;
      case 'find':
        this.sendPanelCommand('find');
        break;
      case 'new-tab':
        this.createTab();
        this.sendPanelCommand('focus-url');
        break;
      case 'close-tab':
        if (this.order.activeId !== null) this.closeTab(this.order.activeId);
        break;
      case 'focus-url':
        this.sendPanelCommand('focus-url');
        break;
      case 'reload':
        this.reload();
        break;
      case 'print':
        this.printPage();
        break;
      case 'zoom-in':
        this.zoomIn();
        break;
      case 'zoom-out':
        this.zoomOut();
        break;
      case 'zoom-reset':
        this.resetZoom();
        break;
      default:
        break;
    }
  }

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
      // 鲁港通 - 查找条开着时换页/换标签自动在新页面重查，命中序号由 found-in-page 重置
      if (this.order.activeId === webContents.id) setTimeout(() => this.runFind(true), 80);
    });
    webContents.on('did-navigate', (_event, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        entry.url = url;
        entry.failedUrl = undefined;
        this.restoreZoomForEntry(entry, url);
      }
      this.emitState();
    });
    webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return;
      entry.url = url;
      this.emitState();
      if (this.order.activeId === webContents.id) setTimeout(() => this.runFind(true), 80);
    });
    webContents.on('found-in-page', (_event, result) => {
      if (this.order.activeId !== webContents.id) return;
      const payload: DesktopFindResult = {
        activeMatchOrdinal: result.activeMatchOrdinal ?? 0,
        matches: result.matches ?? 0,
        finalUpdate: Boolean(result.finalUpdate)
      };
      this.send(IPC_CHANNELS.findResult, payload);
    });
    webContents.on('before-input-event', (event, input) => this.handleTabShortcut(event, input));
    // 鲁港通 - Ctrl+滚轮由 Chromium 请求缩放，主进程改按档位设置并记忆到站点
    webContents.on('zoom-changed', (_event, direction) => {
      if (this.order.activeId !== webContents.id) return;
      if (direction === 'in') this.zoomIn();
      else this.zoomOut();
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
      const entry = this.tabs.get(webContents.id);
      if (!entry) return;
      const event: BrowserTabClosedEvent = {
        id: webContents.id,
        url: entry.url,
        active: this.order.activeId === webContents.id,
        reason: 'crashed'
      };
      this.closeTabInternal(webContents.id);
      if (this.panelOpen && this.tabs.size === 0) this.createTab();
      this.notifyTabClosed(event);
    });
    // 鲁港通 - 标签页导航与 302 重定向同受守卫：只允许 http(s)，about:blank 起始页放行；
    // 主帧与子帧同一口径（协议校验），标签页内不做系统浏览器外开
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
    // 鲁港通 - 标签被外部关闭/面板收起时解除绑定，控制器重开页面后会重新绑定新标签
    if (id === this.aiLockedTabId) this.aiLockedTabId = null;
    this.order = removeTabFromOrder(this.order, id);
    this.tabs.delete(id);
    try {
      if (!this.window.isDestroyed()) this.window.contentView.removeChildView(entry.view);
      const contents = entry.view.webContents;
      if (!contents.isDestroyed() && contents.debugger.isAttached()) {
        contents.debugger.detach();
      }
      entry.view.webContents.close();
    } catch {
      // 鲁港通 - 窗口销毁过程中忽略移除异常
    }
    if (!this.destroyed) {
      this.applyVisibility();
      this.emitState();
    }
  };

  private notifyTabClosed = (event: BrowserTabClosedEvent) => {
    try {
      this.events.onTabClosed?.(event);
    } catch {
      // 鲁港通 - 事件回调异常不影响标签关闭本身
    }
  };

  private notifyPanelClosed = () => {
    try {
      this.events.onPanelClosed?.();
    } catch {
      // 鲁港通 - 事件回调异常不影响面板关闭本身
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
