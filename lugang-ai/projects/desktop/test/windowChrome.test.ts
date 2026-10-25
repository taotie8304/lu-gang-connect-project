import { describe, expect, it, vi } from 'vitest';
import { createWindowControls, createWindowFrameOptions } from '../src/main/windowChrome';

const createFakeWindow = ({ maximized = false }: { maximized?: boolean } = {}) => {
  const listeners = new Set<() => void>();
  const state = { maximized };

  const window = {
    minimize: vi.fn(),
    maximize: vi.fn(() => {
      state.maximized = true;
    }),
    unmaximize: vi.fn(() => {
      state.maximized = false;
    }),
    isMaximized: vi.fn(() => state.maximized),
    close: vi.fn(),
    subscribeMaximize: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    })
  };

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return { window, emit, state };
};

describe('createWindowFrameOptions', () => {
  it('Windows 去掉原生边框，交给网页自绘标题栏', () => {
    expect(createWindowFrameOptions('win32')).toEqual({ frame: false });
  });

  it('其他平台保留原生边框与系统标题栏', () => {
    expect(createWindowFrameOptions('darwin')).toEqual({});
    expect(createWindowFrameOptions('linux')).not.toHaveProperty('frame');
  });
});

describe('createWindowControls', () => {
  it('最小化转交给窗口', () => {
    const { window } = createFakeWindow();
    createWindowControls(window).minimize();
    expect(window.minimize).toHaveBeenCalledTimes(1);
  });

  it('未最大化时切换为最大化，并返回目标状态', () => {
    const { window } = createFakeWindow();
    const controls = createWindowControls(window);

    expect(controls.toggleMaximize()).toBe(true);
    expect(window.maximize).toHaveBeenCalledTimes(1);
    expect(window.unmaximize).not.toHaveBeenCalled();
  });

  it('已最大化时切换为还原，并返回目标状态', () => {
    const { window } = createFakeWindow({ maximized: true });
    const controls = createWindowControls(window);

    expect(controls.toggleMaximize()).toBe(false);
    expect(window.unmaximize).toHaveBeenCalledTimes(1);
    expect(window.maximize).not.toHaveBeenCalled();
  });

  it('关闭走窗口 close，复用收进托盘策略', () => {
    const { window } = createFakeWindow();
    createWindowControls(window).close();
    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('最大化状态变化时通知订阅者', () => {
    const { window, emit, state } = createFakeWindow();
    const controls = createWindowControls(window);
    const listener = vi.fn();
    controls.subscribe(listener);

    state.maximized = true;
    emit();
    state.maximized = false;
    emit();

    expect(listener.mock.calls).toEqual([[true], [false]]);
  });

  it('取消订阅后不再收到通知', () => {
    const { window, emit } = createFakeWindow();
    const controls = createWindowControls(window);
    const listener = vi.fn();
    const unsubscribe = controls.subscribe(listener);

    unsubscribe();
    emit();

    expect(listener).not.toHaveBeenCalled();
  });
});
