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
  retryLoad(): void;
};

declare global {
  interface Window {
    lugangDesktop?: DesktopBridge;
  }
}

export const isDesktopBridgeAvailable = (): boolean =>
  typeof window !== 'undefined' && window.lugangDesktop?.isAvailable?.() === true;
