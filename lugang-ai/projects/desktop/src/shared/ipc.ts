// 鲁港通 - 桌面桥 IPC 通道与数据类型（preload 与主进程共用）
import type { CssRect } from './geometry';

export const IPC_CHANNELS = {
  getVersion: 'lugang:get-version',
  openPanel: 'lugang:open-panel',
  closePanel: 'lugang:close-panel',
  getState: 'lugang:get-state',
  setBounds: 'lugang:set-bounds',
  setVisible: 'lugang:set-visible',
  navigate: 'lugang:navigate',
  reload: 'lugang:reload',
  goBack: 'lugang:go-back',
  goForward: 'lugang:go-forward',
  tabCreate: 'lugang:tab-create',
  tabSwitch: 'lugang:tab-switch',
  tabClose: 'lugang:tab-close',
  tabList: 'lugang:tab-list',
  tabRetry: 'lugang:tab-retry',
  stateChanged: 'lugang:state-changed',
  retryLoad: 'lugang:retry-load'
} as const;

export type DesktopTab = { id: number; title: string; url: string; current: boolean };

export type DesktopBrowserState = {
  panelOpen: boolean;
  activeTabId: number | null;
  tabs: DesktopTab[];
  loading: boolean;
};

export type DesktopVersionInfo = { appVersion: string; protocolVersion: number };

export type { CssRect };
