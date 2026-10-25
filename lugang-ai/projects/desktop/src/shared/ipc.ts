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
  retryLoad: 'lugang:retry-load',
  aiStatus: 'lugang:ai-status',
  aiStop: 'lugang:ai-stop',
  aiExecute: 'lugang:ai-execute',
  aiStatusChanged: 'lugang:ai-status-changed',
  sessionSync: 'lugang:session-sync',
  sessionLogout: 'lugang:session-logout',
  confirmDecision: 'lugang:confirm-decision',
  windowMinimize: 'lugang:window-minimize',
  windowToggleMaximize: 'lugang:window-toggle-maximize',
  windowIsMaximized: 'lugang:window-is-maximized',
  windowClose: 'lugang:window-close',
  windowMaximizeChanged: 'lugang:window-maximize-changed'
} as const;

export type DesktopTab = { id: number; title: string; url: string; current: boolean };

export type DesktopBrowserState = {
  panelOpen: boolean;
  activeTabId: number | null;
  tabs: DesktopTab[];
  loading: boolean;
};

export type DesktopVersionInfo = { appVersion: string; protocolVersion: number };

export type DesktopAiStatus = 'idle' | 'running' | 'stopped';

export type DesktopAiState = {
  status: DesktopAiStatus;
  reopens: number;
  stopReason?: string;
  message?: string;
  sessionUrl?: string;
};

export type DesktopAiCommand = {
  action: string;
  [key: string]: unknown;
};

export type DesktopAiExecuteRequest = {
  command: DesktopAiCommand;
  resume?: boolean;
  commandId?: string;
};

export type DesktopAiExecuteResponse = {
  result: {
    ok: boolean;
    code?: string;
    message?: string;
    changed?: boolean;
    stopped?: boolean;
  };
  state: DesktopAiState;
};

/** 会话同步结果：只有 registered=true 表示设备已拿到令牌并开始接收指令 */
export type DesktopSessionSyncResponse = {
  registered: boolean;
};

export type { CssRect };
