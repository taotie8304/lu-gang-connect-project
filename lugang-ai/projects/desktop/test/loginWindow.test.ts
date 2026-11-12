import { describe, expect, it, vi } from 'vitest';
import {
  computeLoginWindowBounds,
  createLoginWindowController,
  isLoginPageUrl
} from '../src/main/loginWindow';

const createFakeHost = ({
  maximized = false,
  bounds = { x: 100, y: 80, width: 1440, height: 900 },
  workArea = { x: 0, y: 0, width: 1920, height: 1040 }
}: {
  maximized?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  workArea?: { x: number; y: number; width: number; height: number };
} = {}) => {
  const state = {
    maximized,
    bounds: { ...bounds },
    resizable: true,
    maximizable: true
  };

  const host = {
    getNormalBounds: vi.fn(() => ({ ...state.bounds })),
    getWorkArea: vi.fn(() => workArea),
    isMaximized: vi.fn(() => state.maximized),
    unmaximize: vi.fn(() => {
      state.maximized = false;
    }),
    maximize: vi.fn(() => {
      state.maximized = true;
    }),
    setResizable: vi.fn((resizable: boolean) => {
      state.resizable = resizable;
    }),
    setMaximizable: vi.fn((maximizable: boolean) => {
      state.maximizable = maximizable;
    }),
    setBounds: vi.fn((next: { x: number; y: number; width: number; height: number }) => {
      state.bounds = { ...next };
    })
  };

  return { host, state };
};

describe('computeLoginWindowBounds', () => {
  it('在工作区内居中 1280×800', () => {
    expect(computeLoginWindowBounds({ x: 0, y: 0, width: 1920, height: 1040 })).toEqual({
      x: 320,
      y: 120,
      width: 1280,
      height: 800
    });
  });

  it('工作区小于目标尺寸时夹取到工作区', () => {
    expect(computeLoginWindowBounds({ x: 0, y: 0, width: 1024, height: 700 })).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 700
    });
  });

  it('多显示器按工作区绝对坐标居中', () => {
    expect(computeLoginWindowBounds({ x: 1920, y: 0, width: 1920, height: 1040 })).toEqual({
      x: 2240,
      y: 120,
      width: 1280,
      height: 800
    });
  });
});

describe('isLoginPageUrl', () => {
  it('识别同源 /login 路由', () => {
    expect(isLoginPageUrl('https://www.airscend.com/login', 'https://www.airscend.com')).toBe(
      true
    );
    expect(
      isLoginPageUrl('https://www.airscend.com/login?lastRoute=%2Fchat', 'https://www.airscend.com')
    ).toBe(true);
  });

  it('同源其他路由不是登录页', () => {
    expect(isLoginPageUrl('https://www.airscend.com/chat', 'https://www.airscend.com')).toBe(false);
    expect(isLoginPageUrl('https://www.airscend.com/loginx', 'https://www.airscend.com')).toBe(
      false
    );
  });

  it('第三方地址或非法地址不视为登录页', () => {
    expect(isLoginPageUrl('https://example.com/login', 'https://www.airscend.com')).toBe(false);
    expect(isLoginPageUrl('not a url', 'https://www.airscend.com')).toBe(false);
  });
});

describe('createLoginWindowController', () => {
  it('进入登录模式：保存原状态、取消最大化、锁定尺寸并居中', () => {
    const { host } = createFakeHost({ maximized: true });
    const controller = createLoginWindowController(host);

    controller.enterLoginMode();

    expect(host.getNormalBounds).toHaveBeenCalledTimes(1);
    expect(host.unmaximize).toHaveBeenCalledTimes(1);
    expect(host.setResizable).toHaveBeenCalledWith(false);
    expect(host.setMaximizable).toHaveBeenCalledWith(false);
    expect(host.setBounds).toHaveBeenCalledWith({ x: 320, y: 120, width: 1280, height: 800 });
    expect(controller.isLoginMode()).toBe(true);
  });

  it('重复进入登录模式不重复保存与调整窗口', () => {
    const { host } = createFakeHost();
    const controller = createLoginWindowController(host);

    controller.enterLoginMode();
    controller.enterLoginMode();

    expect(host.getNormalBounds).toHaveBeenCalledTimes(1);
    expect(host.setBounds).toHaveBeenCalledTimes(1);
  });

  it('退出登录模式：恢复原尺寸与缩放能力，并按需恢复最大化', () => {
    const { host, state } = createFakeHost({ maximized: true });
    const controller = createLoginWindowController(host);

    controller.enterLoginMode();
    controller.exitLoginMode();

    expect(host.setResizable).toHaveBeenLastCalledWith(true);
    expect(host.setMaximizable).toHaveBeenLastCalledWith(true);
    expect(host.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 1440, height: 900 });
    expect(host.maximize).toHaveBeenCalledTimes(1);
    expect(state.maximized).toBe(true);
    expect(controller.isLoginMode()).toBe(false);
  });

  it('未进入登录模式时退出不调整窗口', () => {
    const { host } = createFakeHost();
    const controller = createLoginWindowController(host);

    controller.exitLoginMode();

    expect(host.setResizable).not.toHaveBeenCalled();
    expect(host.setBounds).not.toHaveBeenCalled();
    expect(host.maximize).not.toHaveBeenCalled();
  });
});
