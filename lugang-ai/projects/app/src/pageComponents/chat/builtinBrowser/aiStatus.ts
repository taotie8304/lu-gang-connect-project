// 鲁港通 - 办事浏览器 AI 状态徽标：运行中/已停止时展示，只有运行中才露出停止入口
import type { DesktopAiState } from './desktopBridge';

export type BuiltinBrowserAiBadge = {
  running: boolean;
  labelKey: 'common:builtin_browser_ai_running' | 'common:builtin_browser_ai_stopped';
  message?: string;
};

export const resolveBuiltinBrowserAiBadge = (
  state?: Pick<DesktopAiState, 'status' | 'message'>
): BuiltinBrowserAiBadge | undefined => {
  if (!state || state.status === 'idle') return undefined;

  return {
    running: state.status === 'running',
    labelKey:
      state.status === 'running'
        ? 'common:builtin_browser_ai_running'
        : 'common:builtin_browser_ai_stopped',
    message: state.message
  };
};
