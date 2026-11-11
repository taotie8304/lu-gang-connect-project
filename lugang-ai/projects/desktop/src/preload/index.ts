// 鲁港通 - 主窗口预加载：只暴露办事浏览器需要的最小 API
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DesktopAiExecuteRequest,
  type DesktopAiExecuteResponse,
  type DesktopAiState,
  type DesktopBrowserNavState,
  type DesktopBrowserState,
  type DesktopClearBrowsingDataOptions,
  type DesktopDiagnosticsExportResponse,
  type DesktopDownloadItem,
  type DesktopFindResult,
  type DesktopPanelCommand,
  type DesktopDocumentBytes,
  type DesktopDocumentSnapshot,
  type DesktopDocumentSummary,
  type DesktopSessionSyncResponse,
  type DesktopUpdateStatus,
  type DesktopVersionInfo,
  type DesktopZoomRestore
} from '../shared/ipc';
import type { CssRect } from '../shared/geometry';

const api = {
  isAvailable: () => true,
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion) as Promise<DesktopVersionInfo>,
  openPanel: () => ipcRenderer.invoke(IPC_CHANNELS.openPanel) as Promise<DesktopBrowserState>,
  closePanel: () => ipcRenderer.invoke(IPC_CHANNELS.closePanel) as Promise<DesktopBrowserState>,
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState) as Promise<DesktopBrowserState>,
  setBounds: (rect: CssRect) => ipcRenderer.send(IPC_CHANNELS.setBounds, rect),
  setVisible: (visible: boolean) => ipcRenderer.send(IPC_CHANNELS.setVisible, visible),
  navigate: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.navigate, url) as Promise<boolean>,
  reload: () => ipcRenderer.invoke(IPC_CHANNELS.reload) as Promise<boolean>,
  goBack: () => ipcRenderer.invoke(IPC_CHANNELS.goBack) as Promise<boolean>,
  goForward: () => ipcRenderer.invoke(IPC_CHANNELS.goForward) as Promise<boolean>,
  tabs: {
    create: (url?: string) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.tabCreate,
        url ? { url } : undefined
      ) as Promise<DesktopBrowserState>,
    switch: (id: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.tabSwitch, id) as Promise<DesktopBrowserState>,
    close: (id: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.tabClose, id) as Promise<DesktopBrowserState>,
    list: () => ipcRenderer.invoke(IPC_CHANNELS.tabList) as Promise<DesktopBrowserState>
  },
  // 鲁港通 - 内置浏览器 P0：查找、缩放、下载、页面动作与原生更多菜单
  browser: {
    getNav: async (): Promise<DesktopBrowserNavState> => {
      const state = (await ipcRenderer.invoke(IPC_CHANNELS.getState)) as DesktopBrowserState;
      return {
        canGoBack: state.canGoBack ?? false,
        canGoForward: state.canGoForward ?? false,
        zoomPercent: state.zoomPercent ?? 100
      };
    },
    onNavChange: (callback: (state: DesktopBrowserNavState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: DesktopBrowserState) =>
        callback({
          canGoBack: state.canGoBack ?? false,
          canGoForward: state.canGoForward ?? false,
          zoomPercent: state.zoomPercent ?? 100
        });
      ipcRenderer.on(IPC_CHANNELS.stateChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, listener);
      };
    },
    goBack: () => ipcRenderer.invoke(IPC_CHANNELS.goBack) as Promise<boolean>,
    goForward: () => ipcRenderer.invoke(IPC_CHANNELS.goForward) as Promise<boolean>,
    findStart: (query: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.findStart, { query }) as Promise<void>,
    findNext: (direction: 'next' | 'previous') =>
      ipcRenderer.invoke(IPC_CHANNELS.findNext, { direction }) as Promise<void>,
    findStop: () => ipcRenderer.invoke(IPC_CHANNELS.findStop) as Promise<void>,
    onFindResult: (callback: (result: DesktopFindResult) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, result: DesktopFindResult) =>
        callback(result);
      ipcRenderer.on(IPC_CHANNELS.findResult, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.findResult, listener);
      };
    },
    setZoom: (percent: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.zoomSet, { percent }) as Promise<number>,
    resetZoom: () => ipcRenderer.invoke(IPC_CHANNELS.zoomReset) as Promise<number>,
    onZoomChange: (callback: (percent: number) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, percent: number) => callback(percent);
      ipcRenderer.on(IPC_CHANNELS.zoomChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.zoomChanged, listener);
      };
    },
    onZoomRestore: (callback: (payload: DesktopZoomRestore) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: DesktopZoomRestore) =>
        callback(payload);
      ipcRenderer.on(IPC_CHANNELS.zoomRestored, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.zoomRestored, listener);
      };
    },
    listDownloads: () =>
      ipcRenderer.invoke(IPC_CHANNELS.downloadsList) as Promise<DesktopDownloadItem[]>,
    onDownloadsChange: (callback: (list: DesktopDownloadItem[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, list: DesktopDownloadItem[]) =>
        callback(list);
      ipcRenderer.on(IPC_CHANNELS.downloadsChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.downloadsChanged, listener);
      };
    },
    openDownload: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.downloadOpen, { id }) as Promise<boolean>,
    showDownloadInFolder: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.downloadShowInFolder, { id }) as Promise<boolean>,
    cancelDownload: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.downloadCancel, { id }) as Promise<void>,
    dismissDownload: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.downloadDismiss, { id }) as Promise<void>,
    print: () => ipcRenderer.invoke(IPC_CHANNELS.pagePrint) as Promise<boolean>,
    savePdf: () => ipcRenderer.invoke(IPC_CHANNELS.pageSavePdf) as Promise<boolean>,
    copyLink: () => ipcRenderer.invoke(IPC_CHANNELS.pageCopyLink) as Promise<boolean>,
    openExternal: () => ipcRenderer.invoke(IPC_CHANNELS.pageOpenExternal) as Promise<boolean>,
    openMenu: () => ipcRenderer.invoke(IPC_CHANNELS.pageMenu) as Promise<void>,
    clearData: (options: DesktopClearBrowsingDataOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.clearBrowsingData, options) as Promise<boolean>,
    onCommand: (callback: (command: DesktopPanelCommand) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: DesktopPanelCommand) =>
        callback(command);
      ipcRenderer.on(IPC_CHANNELS.panelCommand, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.panelCommand, listener);
      };
    }
  },
  onStateChange: (callback: (state: DesktopBrowserState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: DesktopBrowserState) =>
      callback(state);
    ipcRenderer.on(IPC_CHANNELS.stateChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, listener);
    };
  },
  ai: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.aiStatus) as Promise<DesktopAiState>,
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.aiStop) as Promise<DesktopAiState>,
    execute: (request: DesktopAiExecuteRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.aiExecute, request) as Promise<DesktopAiExecuteResponse>,
    onStateChange: (callback: (state: DesktopAiState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: DesktopAiState) =>
        callback(state);
      ipcRenderer.on(IPC_CHANNELS.aiStatusChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.aiStatusChanged, listener);
      };
    }
  },
  session: {
    sync: () => ipcRenderer.invoke(IPC_CHANNELS.sessionSync) as Promise<DesktopSessionSyncResponse>,
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.sessionLogout) as Promise<void>
  },
  // 鲁港通 - 设置面板导出诊断包：单文件文本由主进程拉起系统保存对话框
  diagnostics: {
    exportBundle: () =>
      ipcRenderer.invoke(IPC_CHANNELS.diagnosticsExport) as Promise<DesktopDiagnosticsExportResponse>
  },
  // 鲁港通 - 文档预览：文件只在本机解析，快照不含本机路径；老客户端没有这个对象，网页端据此降级
  documents: {
    openLocal: () =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenLocal) as Promise<DesktopDocumentSnapshot | null>,
    list: () => ipcRenderer.invoke(IPC_CHANNELS.documentsList) as Promise<DesktopDocumentSummary[]>,
    get: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsGet, { token }) as Promise<
        DesktopDocumentSnapshot | null
      >,
    claim: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsClaim, { token }) as Promise<
        DesktopDocumentSnapshot | null
      >,
    decide: (token: string, index: number, decision: 'apply' | 'skip') =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsDecide, { token, index, decision }) as Promise<
        DesktopDocumentSnapshot | null
      >,
    applyAll: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsApplyAll, { token }) as Promise<
        DesktopDocumentSnapshot | null
      >,
    close: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsClose, { token }) as Promise<void>,
    openCopy: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenCopy, { token }) as Promise<boolean>,
    read: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsRead, { token }) as Promise<
        DesktopDocumentBytes | null
      >,
    openExternal: (token: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.documentsOpenExternal, { token }) as Promise<boolean>,
    setActive: (token: string | null) => {
      ipcRenderer.send(IPC_CHANNELS.documentsSetActive, { token });
    },
    onChanged: (callback: (list: DesktopDocumentSummary[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, list: DesktopDocumentSummary[]) =>
        callback(list);
      ipcRenderer.on(IPC_CHANNELS.documentsChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.documentsChanged, listener);
      };
    }
  },
  // 鲁港通 - 自绘标题栏的窗口按钮；网页端据此判定当前客户端是否支持去边框标题栏
  windowControls: {
    minimize: () => {
      void ipcRenderer.invoke(IPC_CHANNELS.windowMinimize);
    },
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowToggleMaximize) as Promise<boolean>,
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized) as Promise<boolean>,
    close: () => {
      void ipcRenderer.invoke(IPC_CHANNELS.windowClose);
    },
    onMaximizeChange: (callback: (maximized: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
        callback(maximized);
      ipcRenderer.on(IPC_CHANNELS.windowMaximizeChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.windowMaximizeChanged, listener);
      };
    }
  },
  retryLoad: () => ipcRenderer.send(IPC_CHANNELS.retryLoad),
  // 鲁港通 - 设置面板的「检查更新」：下载仍由主进程自动完成，这里只查询、重试与安装
  update: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.updateStatus) as Promise<DesktopUpdateStatus>,
    check: () => ipcRenderer.invoke(IPC_CHANNELS.updateCheck) as Promise<DesktopUpdateStatus>,
    install: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall) as Promise<void>,
    onStatusChange: (callback: (status: DesktopUpdateStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: DesktopUpdateStatus) =>
        callback(status);
      ipcRenderer.on(IPC_CHANNELS.updateStatusChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.updateStatusChanged, listener);
      };
    }
  }
};

// 鲁港通 - 自绘标题栏占位：首帧就抬升网页内容，避免加载完成后再整体下移
const TITLE_BAR_HEIGHT = '36px';
const applyTitleBarHeight = () => {
  const root = document.documentElement;
  if (!root) return false;
  root.style.setProperty('--lugang-titlebar-height', TITLE_BAR_HEIGHT);
  return true;
};

// 鲁港通 - 只在应用源页面暴露桌面桥：登录跳转的第三方 OAuth 页面同样会加载本 preload
const appOriginArg = process.argv.find((item) => item.startsWith('--lugang-app-origin='));
const appOrigin = appOriginArg?.slice('--lugang-app-origin='.length);
const isAppFrame = window.location.protocol === 'file:' || window.location.origin === appOrigin;

if (isAppFrame) {
  contextBridge.exposeInMainWorld('lugangDesktop', api);
  if (!applyTitleBarHeight()) {
    document.addEventListener('DOMContentLoaded', applyTitleBarHeight, { once: true });
  }
}
