// 鲁港通 - 主窗口预加载：只暴露办事浏览器需要的最小 API
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type DesktopBrowserState,
  type DesktopVersionInfo
} from '../shared/ipc';
import type { CssRect } from '../shared/geometry';

const api = {
  isAvailable: () => true,
  getVersion: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getVersion) as Promise<DesktopVersionInfo>,
  openPanel: () =>
    ipcRenderer.invoke(IPC_CHANNELS.openPanel) as Promise<DesktopBrowserState>,
  closePanel: () =>
    ipcRenderer.invoke(IPC_CHANNELS.closePanel) as Promise<DesktopBrowserState>,
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState) as Promise<DesktopBrowserState>,
  setBounds: (rect: CssRect) => ipcRenderer.send(IPC_CHANNELS.setBounds, rect),
  setVisible: (visible: boolean) => ipcRenderer.send(IPC_CHANNELS.setVisible, visible),
  navigate: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.navigate, url) as Promise<boolean>,
  reload: () => ipcRenderer.invoke(IPC_CHANNELS.reload) as Promise<boolean>,
  goBack: () => ipcRenderer.invoke(IPC_CHANNELS.goBack) as Promise<boolean>,
  goForward: () => ipcRenderer.invoke(IPC_CHANNELS.goForward) as Promise<boolean>,
  tabs: {
    create: (url?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.tabCreate, url ? { url } : undefined) as Promise<DesktopBrowserState>,
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
  retryLoad: () => ipcRenderer.send(IPC_CHANNELS.retryLoad)
};

// 鲁港通 - 只在应用源页面暴露桌面桥：登录跳转的第三方 OAuth 页面同样会加载本 preload
const appOriginArg = process.argv.find((item) => item.startsWith('--lugang-app-origin='));
const appOrigin = appOriginArg?.slice('--lugang-app-origin='.length);
const isAppFrame = window.location.protocol === 'file:' || window.location.origin === appOrigin;

if (isAppFrame) {
  contextBridge.exposeInMainWorld('lugangDesktop', api);
}
