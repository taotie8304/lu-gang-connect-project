// 鲁港通 - 主窗口预加载：只暴露办事浏览器需要的最小 API
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DesktopAiExecuteRequest,
  type DesktopAiExecuteResponse,
  type DesktopAiState,
  type DesktopBrowserState,
  type DesktopDocumentSnapshot,
  type DesktopDocumentSummary,
  type DesktopSessionSyncResponse,
  type DesktopUpdateStatus,
  type DesktopVersionInfo
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
