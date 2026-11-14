// 鲁港通 - 网页端右栏连接状态：桌面端随面板自动开台，网页端等用户主动连接，避免空跑云端会话
export type BrowserConnectPhase = 'idle' | 'loading' | 'active' | 'error';

export const initialConnectPhase = (isNative: boolean): BrowserConnectPhase =>
  isNative ? 'loading' : 'idle';

/** 鲁港通 - 只有桌面端在面板挂载时自动开台 */
export const shouldAutoConnectOnMount = (isNative: boolean): boolean => isNative;

/** 鲁港通 - 连接按钮文案：空闲连接、连接中禁用，失败后按钮转为重试 */
export const connectActionLabelKey = (phase: BrowserConnectPhase): string | null => {
  if (phase === 'idle') return 'common:builtin_browser_web_connect';
  if (phase === 'loading') return 'common:builtin_browser_web_connect_loading';
  if (phase === 'error') return 'common:builtin_browser_retry';
  return null;
};

export const connectErrorTextKey = (phase: BrowserConnectPhase): string | null =>
  phase === 'error' ? 'common:builtin_browser_web_connect_failed' : null;
