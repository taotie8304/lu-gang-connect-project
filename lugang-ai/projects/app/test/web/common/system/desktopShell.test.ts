import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDesktopSidebarControl,
  getDesktopWindowControls,
  hasDesktopTitleBar,
  setDesktopSidebarControl,
  subscribeDesktopSidebar
} from '@/web/common/system/desktopShell';

const createControls = () => ({
  minimize: vi.fn(),
  toggleMaximize: vi.fn(async () => true),
  close: vi.fn(),
  isMaximized: vi.fn(async () => false),
  onMaximizeChange: vi.fn(() => () => undefined)
});

afterEach(() => {
  delete window.lugangDesktop;
  setDesktopSidebarControl(undefined);
});

describe('getDesktopWindowControls', () => {
  it('浏览器里没有桌面桥时为 undefined', () => {
    expect(getDesktopWindowControls()).toBeUndefined();
  });

  it('老客户端没有窗口控制能力时为 undefined', () => {
    window.lugangDesktop = { isAvailable: () => true } as never;
    expect(getDesktopWindowControls()).toBeUndefined();
  });

  it('新客户端返回窗口控制能力', () => {
    const windowControls = createControls();
    window.lugangDesktop = { isAvailable: () => true, windowControls } as never;

    expect(getDesktopWindowControls()).toBe(windowControls);
  });
});

describe('hasDesktopTitleBar', () => {
  it('浏览器与老客户端都不渲染自绘标题栏', () => {
    expect(hasDesktopTitleBar()).toBe(false);
    window.lugangDesktop = { isAvailable: () => true } as never;
    expect(hasDesktopTitleBar()).toBe(false);
  });

  it('新客户端渲染自绘标题栏', () => {
    window.lugangDesktop = { isAvailable: () => true, windowControls: createControls() } as never;
    expect(hasDesktopTitleBar()).toBe(true);
  });
});

describe('desktop sidebar bridge', () => {
  it('默认没有侧栏控制', () => {
    expect(getDesktopSidebarControl()).toBeUndefined();
  });

  it('注册后订阅者能读到最新折叠状态', () => {
    const toggle = vi.fn();
    const listener = vi.fn();
    subscribeDesktopSidebar(listener);

    setDesktopSidebarControl({ collapsed: false, toggle });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDesktopSidebarControl()).toEqual({ collapsed: false, toggle });
  });

  it('折叠状态变化时再次通知', () => {
    const toggle = vi.fn();
    const listener = vi.fn();
    subscribeDesktopSidebar(listener);

    setDesktopSidebarControl({ collapsed: false, toggle });
    setDesktopSidebarControl({ collapsed: true, toggle });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(getDesktopSidebarControl()?.collapsed).toBe(true);
  });

  it('状态与回调都未变化时不重复通知', () => {
    const toggle = vi.fn();
    const listener = vi.fn();
    subscribeDesktopSidebar(listener);
    const control = { collapsed: true, toggle };

    setDesktopSidebarControl(control);
    setDesktopSidebarControl({ collapsed: true, toggle });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('取消订阅后不再通知', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesktopSidebar(listener);

    unsubscribe();
    setDesktopSidebarControl({ collapsed: true, toggle: vi.fn() });

    expect(listener).not.toHaveBeenCalled();
  });

  it('注销后回到空状态并通知订阅者', () => {
    const listener = vi.fn();
    subscribeDesktopSidebar(listener);
    setDesktopSidebarControl({ collapsed: true, toggle: vi.fn() });

    setDesktopSidebarControl(undefined);

    expect(getDesktopSidebarControl()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
