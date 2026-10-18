// 鲁港通 - 传输工厂：桌面客户端内走本地浏览器，网页端保持云端
import { isDesktopBridgeAvailable } from '../desktopBridge';
import { createCloudTransport } from './cloud';
import { createLocalTransport } from './local';
import type { BuiltinBrowserTransport } from './type';

export const createBuiltinBrowserTransport = (): BuiltinBrowserTransport => {
  if (isDesktopBridgeAvailable() && typeof window !== 'undefined' && window.lugangDesktop) {
    return createLocalTransport(window.lugangDesktop);
  }
  return createCloudTransport();
};
