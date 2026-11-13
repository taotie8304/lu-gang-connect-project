// 鲁港通 - 办事浏览器 AI 状态：运行中/已接管/已停止徽标与操作时间线文案映射
import type { DesktopAiState, DesktopAiStep } from './desktopBridge';

export type BuiltinBrowserAiBadge = {
  status: 'running' | 'paused' | 'stopped';
  labelKey:
    | 'common:builtin_browser_ai_running'
    | 'common:builtin_browser_ai_paused'
    | 'common:builtin_browser_ai_stopped';
  message?: string;
  /** 鲁港通 - 已接管或用户手动提交后，面板给出「让 AI 继续」入口 */
  canResume: boolean;
};

export const resolveBuiltinBrowserAiBadge = (
  state?: Pick<DesktopAiState, 'status' | 'message' | 'stopReason'>
): BuiltinBrowserAiBadge | undefined => {
  if (!state || state.status === 'idle') return undefined;

  return {
    status: state.status,
    labelKey:
      state.status === 'running'
        ? 'common:builtin_browser_ai_running'
        : state.status === 'paused'
          ? 'common:builtin_browser_ai_paused'
          : 'common:builtin_browser_ai_stopped',
    message: state.message,
    canResume:
      state.status === 'paused' ||
      (state.status === 'stopped' && state.stopReason === 'handed_over')
  };
};

const AI_STEP_LABELS: Record<string, string> = {
  navigate: 'common:builtin_browser_ai_step_navigate',
  read: 'common:builtin_browser_ai_step_read',
  read_image: 'common:builtin_browser_ai_step_read_image',
  click: 'common:builtin_browser_ai_step_click',
  type: 'common:builtin_browser_ai_step_type',
  select: 'common:builtin_browser_ai_step_select',
  scroll: 'common:builtin_browser_ai_step_scroll',
  upload: 'common:builtin_browser_ai_step_upload',
  generate_file: 'common:builtin_browser_ai_step_generate_file',
  open_form: 'common:builtin_browser_ai_step_open_form',
  fill_form: 'common:builtin_browser_ai_step_fill_form',
  open_document: 'common:builtin_browser_ai_step_open_document',
  edit_document: 'common:builtin_browser_ai_step_edit_document',
  fill_pdf: 'common:builtin_browser_ai_step_fill_pdf',
  stop: 'common:builtin_browser_ai_step_stop',
  pause: 'common:builtin_browser_ai_step_pause',
  resume: 'common:builtin_browser_ai_step_resume'
};

export const aiStepLabel = (action: string): string =>
  AI_STEP_LABELS[action] ?? 'common:builtin_browser_ai_step_generic';

const AI_STEP_STATUS_LABELS: Record<DesktopAiStep['status'], string> = {
  running: 'common:builtin_browser_ai_step_status_running',
  ok: 'common:builtin_browser_ai_step_status_ok',
  failed: 'common:builtin_browser_ai_step_status_failed',
  confirming: 'common:builtin_browser_ai_step_status_confirming',
  paused: 'common:builtin_browser_ai_step_status_paused'
};

export const aiStepStatusLabel = (status: DesktopAiStep['status']): string =>
  AI_STEP_STATUS_LABELS[status] ?? AI_STEP_STATUS_LABELS.running;
