// 鲁港通 - 办事浏览器传输适配器：云端（AgentBay）与本地（桌面客户端）共用面板
import type {
  BuiltinBrowserTab,
  BuiltinBrowserViewport
} from '@fastgpt/global/support/builtinBrowser/type';
import type { DesktopBrowserControls } from '../desktopBridge';

export type BuiltinBrowserOpenResult = { resourceUrl?: string; expiresAt?: string };

export type BuiltinBrowserTransport = {
  kind: 'cloud' | 'local';
  usesNativeView: boolean;
  /** 鲁港通 - 桌面端 P0 原生能力；云端与老客户端没有该对象 */
  controls?: DesktopBrowserControls;
  open(viewport?: BuiltinBrowserViewport): Promise<BuiltinBrowserOpenResult>;
  close(): Promise<void>;
  reload(): Promise<boolean>;
  navigate(url: string): Promise<boolean>;
  resize(viewport: BuiltinBrowserViewport): Promise<boolean>;
  listTabs(): Promise<BuiltinBrowserTab[]>;
  createTab(): Promise<BuiltinBrowserTab[]>;
  switchTab(index: number): Promise<{ selected: boolean; tabs: BuiltinBrowserTab[] }>;
  closeTab(index: number): Promise<{ closed: boolean; tabs: BuiltinBrowserTab[] }>;
  subscribe?(listener: (tabs: BuiltinBrowserTab[]) => void): () => void;
  syncBounds?(rect: { x: number; y: number; width: number; height: number }): void;
  setViewVisible?(visible: boolean): void;
};
