// 鲁港通 - 桌面客户端桥类型：与 projects/desktop/src/shared/ipc.ts 保持结构一致
export type DesktopCssRect = { x: number; y: number; width: number; height: number };

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

export type DesktopSessionSyncResponse = {
  registered: boolean;
};

/** 自绘标题栏的窗口按钮；老客户端没有这个能力，网页端据此决定是否渲染标题栏 */
export type DesktopWindowControls = {
  minimize(): void;
  toggleMaximize(): Promise<boolean>;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(callback: (maximized: boolean) => void): () => void;
};

export type DesktopBridge = {
  isAvailable(): boolean;
  getVersion(): Promise<DesktopVersionInfo>;
  openPanel(): Promise<DesktopBrowserState>;
  closePanel(): Promise<DesktopBrowserState>;
  getState(): Promise<DesktopBrowserState>;
  setBounds(rect: DesktopCssRect): void;
  setVisible(visible: boolean): void;
  navigate(url: string): Promise<boolean>;
  reload(): Promise<boolean>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  tabs: {
    create(url?: string): Promise<DesktopBrowserState>;
    switch(id: number): Promise<DesktopBrowserState>;
    close(id: number): Promise<DesktopBrowserState>;
    list(): Promise<DesktopBrowserState>;
  };
  onStateChange(callback: (state: DesktopBrowserState) => void): () => void;
  ai: {
    getState(): Promise<DesktopAiState>;
    stop(): Promise<DesktopAiState>;
    execute(request: DesktopAiExecuteRequest): Promise<DesktopAiExecuteResponse>;
    onStateChange(callback: (state: DesktopAiState) => void): () => void;
  };
  session: {
    sync(): Promise<DesktopSessionSyncResponse>;
    logout(): Promise<void>;
  };
  windowControls?: DesktopWindowControls;
  retryLoad(): void;
};

declare global {
  interface Window {
    lugangDesktop?: DesktopBridge;
  }
}

export const isDesktopBridgeAvailable = (): boolean =>
  typeof window !== 'undefined' && window.lugangDesktop?.isAvailable?.() === true;
