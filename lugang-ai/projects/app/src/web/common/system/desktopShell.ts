// 鲁港通 - 桌面自绘标题栏：能力判定与聊天侧栏折叠联动
import type { DesktopWindowControls } from '@/pageComponents/chat/builtinBrowser/desktopBridge';

export const getDesktopWindowControls = (): DesktopWindowControls | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.lugangDesktop?.windowControls;
};

// 鲁港通 - 自绘标题栏只在支持窗口控制的新客户端渲染；浏览器与老客户端保持原生标题栏
export const hasDesktopTitleBar = () => getDesktopWindowControls() !== undefined;

// 鲁港通 - 标题栏能力在页面生命周期内不会变化，订阅函数只为 useSyncExternalStore 占位
export const subscribeDesktopTitleBar = () => () => undefined;

export const DESKTOP_TITLE_BAR_HEIGHT = 36;

export type DesktopSidebarControl = {
  collapsed: boolean;
  toggle: () => void;
};

let sidebarControl: DesktopSidebarControl | undefined;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

export const setDesktopSidebarControl = (next: DesktopSidebarControl | undefined) => {
  if (sidebarControl === next) return;
  if (
    sidebarControl &&
    next &&
    sidebarControl.collapsed === next.collapsed &&
    sidebarControl.toggle === next.toggle
  ) {
    return;
  }
  sidebarControl = next;
  emit();
};

export const getDesktopSidebarControl = () => sidebarControl;

export const subscribeDesktopSidebar = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
