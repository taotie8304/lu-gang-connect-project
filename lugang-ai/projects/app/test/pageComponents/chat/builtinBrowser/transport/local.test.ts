import { describe, expect, it, vi } from 'vitest';
import { createLocalTransport } from '@/pageComponents/chat/builtinBrowser/transport/local';
import type {
  DesktopBridge,
  DesktopBrowserState,
  DesktopTab
} from '@/pageComponents/chat/builtinBrowser/desktopBridge';
import type { BuiltinBrowserTab } from '@fastgpt/global/support/builtinBrowser/type';

const makeTab = (id: number, title: string): DesktopTab => ({
  id,
  title,
  url: `https://${title}.com`,
  current: false
});

const createBridgeMock = () => {
  let tabList = [makeTab(11, 'a'), makeTab(12, 'b')];
  let activeId: number | null = 11;
  let panelOpen = true;
  const listeners = new Set<(state: DesktopBrowserState) => void>();

  const snapshot = (): DesktopBrowserState => ({
    panelOpen,
    activeTabId: activeId,
    tabs: tabList.map((tab) => ({ ...tab, current: tab.id === activeId })),
    loading: false
  });
  const emit = () => {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
  };

  const bridge: DesktopBridge = {
    isAvailable: () => true,
    getVersion: async () => ({ appVersion: '0.1.0', protocolVersion: 0 }),
    openPanel: async () => {
      panelOpen = true;
      return snapshot();
    },
    closePanel: async () => {
      panelOpen = false;
      tabList = [];
      activeId = null;
      return snapshot();
    },
    getState: async () => snapshot(),
    setBounds: vi.fn(),
    setVisible: vi.fn(),
    navigate: async () => true,
    reload: async () => true,
    goBack: async () => false,
    goForward: async () => false,
    tabs: {
      create: async () => {
        const id = 100 + tabList.length;
        tabList = [...tabList, makeTab(id, `t${id}`)];
        return snapshot();
      },
      switch: async (id) => {
        activeId = id;
        emit();
        return snapshot();
      },
      close: async (id) => {
        tabList = tabList.filter((tab) => tab.id !== id);
        if (activeId === id) activeId = tabList[0]?.id ?? null;
        emit();
        return snapshot();
      },
      list: async () => snapshot()
    },
    onStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retryLoad: () => {}
  };

  return {
    bridge,
    setPanelOpen: (open: boolean) => {
      panelOpen = open;
    },
    emit
  };
};

const indexes = (tabs: BuiltinBrowserTab[]) => tabs.map((tab) => tab.index);

describe('local transport', () => {
  it('把桌面标签 id 映射为面板下标', async () => {
    const { bridge } = createBridgeMock();
    const transport = createLocalTransport(bridge);
    const tabs = await transport.listTabs();
    expect(indexes(tabs)).toEqual([0, 1]);
    expect(tabs[0].current).toBe(true);
  });

  it('switchTab 用下标解析到真实 id', async () => {
    const { bridge } = createBridgeMock();
    const transport = createLocalTransport(bridge);
    const res = await transport.switchTab(1);
    expect(res.selected).toBe(true);
    expect(res.tabs[1].current).toBe(true);
  });

  it('closeTab 返回关闭结果并刷新列表', async () => {
    const { bridge } = createBridgeMock();
    const transport = createLocalTransport(bridge);
    const res = await transport.closeTab(0);
    expect(res.closed).toBe(true);
    expect(indexes(res.tabs)).toEqual([0]);
  });

  it('订阅映射状态，面板关闭时不推送', async () => {
    const { bridge, setPanelOpen, emit } = createBridgeMock();
    const transport = createLocalTransport(bridge);
    const seen: BuiltinBrowserTab[][] = [];
    const unsubscribe = transport.subscribe?.((tabs) => seen.push(tabs));

    setPanelOpen(false);
    emit();
    expect(seen).toHaveLength(0);

    setPanelOpen(true);
    emit();
    expect(indexes(seen[0])).toEqual([0, 1]);

    unsubscribe?.();
  });

  it('打开失败给出可操作中文提示', async () => {
    const { bridge } = createBridgeMock();
    bridge.openPanel = async () => {
      throw new Error('bridge down');
    };
    const transport = createLocalTransport(bridge);
    await expect(transport.open()).rejects.toThrow('无法打开本地浏览器，请重启桌面客户端后重试');
  });

  it('usesNativeView 为 true 并透传视口控制', () => {
    const { bridge } = createBridgeMock();
    const transport = createLocalTransport(bridge);
    transport.syncBounds?.({ x: 1, y: 2, width: 3, height: 4 });
    transport.setViewVisible?.(false);
    expect(transport.usesNativeView).toBe(true);
    expect(bridge.setBounds).toHaveBeenCalledWith({ x: 1, y: 2, width: 3, height: 4 });
    expect(bridge.setVisible).toHaveBeenCalledWith(false);
  });
});
