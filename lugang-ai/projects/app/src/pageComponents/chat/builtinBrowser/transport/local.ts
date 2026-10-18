// 鲁港通 - 本地传输适配器：把桌面桥的原生标签状态映射成面板使用的 index 模型
import type {
  BuiltinBrowserTab,
  BuiltinBrowserViewport
} from '@fastgpt/global/support/builtinBrowser/type';
import type {
  DesktopBridge,
  DesktopBrowserState
} from '../desktopBridge';
import type { BuiltinBrowserTransport } from './type';

const TAB_ACTION_FAILED = '标签操作失败，请稍后重试';
const OPEN_FAILED = '无法打开本地浏览器，请重启桌面客户端后重试';
const NAVIGATE_FAILED = '无法打开该网址，请检查后重试';

export const createLocalTransport = (bridge: DesktopBridge): BuiltinBrowserTransport => {
  const idByIndex = new Map<number, number>();

  const toTabs = (state: DesktopBrowserState): BuiltinBrowserTab[] => {
    idByIndex.clear();
    return state.tabs.map((tab, index) => {
      idByIndex.set(index, tab.id);
      return { index, title: tab.title, url: tab.url, current: tab.current };
    });
  };

  const resolveId = async (index: number): Promise<number | null> => {
    const cached = idByIndex.get(index);
    if (cached !== undefined) return cached;
    const state = await bridge.tabs.list();
    toTabs(state);
    return idByIndex.get(index) ?? null;
  };

  return {
    kind: 'local',
    usesNativeView: true,
    open: async (_viewport?: BuiltinBrowserViewport) => {
      try {
        await bridge.openPanel();
        return {};
      } catch {
        throw new Error(OPEN_FAILED);
      }
    },
    close: async () => {
      try {
        await bridge.closePanel();
      } catch {
        // 鲁港通 - 关闭失败不阻塞面板收起
      }
    },
    reload: async () => {
      try {
        return await bridge.reload();
      } catch {
        return false;
      }
    },
    navigate: async (url) => {
      try {
        return await bridge.navigate(url);
      } catch {
        throw new Error(NAVIGATE_FAILED);
      }
    },
    resize: async () => true,
    listTabs: async () => {
      try {
        return toTabs(await bridge.tabs.list());
      } catch {
        throw new Error(TAB_ACTION_FAILED);
      }
    },
    createTab: async () => {
      try {
        return toTabs(await bridge.tabs.create());
      } catch {
        throw new Error(TAB_ACTION_FAILED);
      }
    },
    switchTab: async (index) => {
      try {
        const id = await resolveId(index);
        if (id === null) return { selected: false, tabs: toTabs(await bridge.getState()) };
        const state = await bridge.tabs.switch(id);
        return { selected: state.activeTabId === id, tabs: toTabs(state) };
      } catch {
        throw new Error(TAB_ACTION_FAILED);
      }
    },
    closeTab: async (index) => {
      try {
        const id = await resolveId(index);
        if (id === null) return { closed: false, tabs: toTabs(await bridge.getState()) };
        const state = await bridge.tabs.close(id);
        return { closed: !state.tabs.some((tab) => tab.id === id), tabs: toTabs(state) };
      } catch {
        throw new Error(TAB_ACTION_FAILED);
      }
    },
    subscribe: (listener) =>
      bridge.onStateChange((state) => {
        if (state.panelOpen) listener(toTabs(state));
      }),
    syncBounds: (rect) => bridge.setBounds(rect),
    setViewVisible: (visible) => bridge.setVisible(visible)
  };
};
