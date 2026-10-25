// 鲁港通 - 窗口外壳：Windows 去原生边框，窗口按钮由网页标题栏驱动
export type WindowFrameOptions = { frame: false } | Record<string, never>;

export const createWindowFrameOptions = (platform: NodeJS.Platform): WindowFrameOptions =>
  platform === 'win32' ? { frame: false } : {};

export type WindowControlHost = {
  minimize: () => void;
  maximize: () => void;
  unmaximize: () => void;
  isMaximized: () => boolean;
  close: () => void;
  /** 订阅系统级最大化/还原（贴边、双击标题栏、快捷键），返回取消订阅 */
  subscribeMaximize: (listener: () => void) => () => void;
};

export type MaximizeListener = (maximized: boolean) => void;

export const createWindowControls = (window: WindowControlHost) => {
  const listeners = new Set<MaximizeListener>();

  const notify = () => {
    const maximized = window.isMaximized();
    listeners.forEach((listener) => listener(maximized));
  };

  // 鲁港通 - 系统级最大化（贴边、双击、快捷键）与按钮操作共用同一条状态推送
  window.subscribeMaximize(notify);

  return {
    minimize: () => window.minimize(),
    isMaximized: () => window.isMaximized(),
    // 返回本次请求的目标状态；实际结果仍以 maximize/unmaximize 事件为准
    toggleMaximize: () => {
      const nextMaximized = !window.isMaximized();
      if (nextMaximized) window.maximize();
      else window.unmaximize();
      return nextMaximized;
    },
    // 走 close 而不是直接退出，复用「收进托盘」关闭策略
    close: () => window.close(),
    subscribe: (listener: MaximizeListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};

export type WindowControls = ReturnType<typeof createWindowControls>;
