// 鲁港通 - 登录页窗口锁尺寸：1280×800 居中、不可缩放/最大化；离开登录页恢复用户原窗口状态
import type { DisplayWorkArea } from './windowState';

export const LOGIN_WINDOW_WIDTH = 1280;
export const LOGIN_WINDOW_HEIGHT = 800;

export type WindowBounds = { x: number; y: number; width: number; height: number };

export const computeLoginWindowBounds = (workArea: DisplayWorkArea): WindowBounds => {
  const width = Math.min(LOGIN_WINDOW_WIDTH, workArea.width);
  const height = Math.min(LOGIN_WINDOW_HEIGHT, workArea.height);
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2)
  };
};

export const isLoginPageUrl = (url: string, appOrigin: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === appOrigin &&
      (parsed.pathname === '/login' || parsed.pathname.startsWith('/login/'))
    );
  } catch {
    return false;
  }
};

export type LoginWindowHost = {
  getNormalBounds: () => WindowBounds;
  getWorkArea: () => DisplayWorkArea;
  isMaximized: () => boolean;
  unmaximize: () => void;
  maximize: () => void;
  setResizable: (resizable: boolean) => void;
  setMaximizable: (maximizable: boolean) => void;
  setBounds: (bounds: WindowBounds) => void;
};

export type LoginWindowController = ReturnType<typeof createLoginWindowController>;

export const createLoginWindowController = (host: LoginWindowHost) => {
  let saved: { bounds: WindowBounds; isMaximized: boolean } | undefined;

  const isLoginMode = () => saved !== undefined;

  const enterLoginMode = () => {
    if (saved) return;
    // 鲁港通 - getNormalBounds 在最大化状态下仍返回还原尺寸，先保存再取消最大化
    const bounds = host.getNormalBounds();
    const wasMaximized = host.isMaximized();
    saved = { bounds: { ...bounds }, isMaximized: wasMaximized };
    if (wasMaximized) host.unmaximize();
    host.setResizable(false);
    host.setMaximizable(false);
    host.setBounds(computeLoginWindowBounds(host.getWorkArea()));
  };

  const exitLoginMode = () => {
    if (!saved) return;
    const { bounds, isMaximized } = saved;
    saved = undefined;
    host.setResizable(true);
    host.setMaximizable(true);
    host.setBounds(bounds);
    if (isMaximized) host.maximize();
  };

  return { enterLoginMode, exitLoginMode, isLoginMode };
};
