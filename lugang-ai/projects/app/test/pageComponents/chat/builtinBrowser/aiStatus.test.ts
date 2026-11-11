import { describe, expect, it } from 'vitest';
import {
  aiStepLabel,
  aiStepStatusLabel,
  resolveBuiltinBrowserAiBadge
} from '@/pageComponents/chat/builtinBrowser/aiStatus';

describe('resolveBuiltinBrowserAiBadge', () => {
  it('没有状态或空闲时不显示徽标', () => {
    expect(resolveBuiltinBrowserAiBadge(undefined)).toBeUndefined();
    expect(resolveBuiltinBrowserAiBadge({ status: 'idle', reopens: 0 })).toBeUndefined();
  });

  it('运行中显示运行徽标并露出接管与停止入口', () => {
    const badge = resolveBuiltinBrowserAiBadge({ status: 'running', reopens: 0 });

    expect(badge).toEqual({
      status: 'running',
      labelKey: 'common:builtin_browser_ai_running',
      message: undefined,
      canResume: false
    });
  });

  it('已接管显示暂停徽标并可让 AI 继续', () => {
    const badge = resolveBuiltinBrowserAiBadge({ status: 'paused', reopens: 0 });

    expect(badge).toEqual({
      status: 'paused',
      labelKey: 'common:builtin_browser_ai_paused',
      message: undefined,
      canResume: true
    });
  });

  it('已停止显示停止徽标但不再露出停止入口', () => {
    const badge = resolveBuiltinBrowserAiBadge({
      status: 'stopped',
      reopens: 1,
      message: '连续两次操作没有成功，我已停止。'
    });

    expect(badge).toEqual({
      status: 'stopped',
      labelKey: 'common:builtin_browser_ai_stopped',
      message: '连续两次操作没有成功，我已停止。',
      canResume: false
    });
  });

  it('用户选择自己提交（handed_over）停止后仍可继续', () => {
    const badge = resolveBuiltinBrowserAiBadge({
      status: 'stopped',
      reopens: 0,
      stopReason: 'handed_over'
    });

    expect(badge?.canResume).toBe(true);
  });
});

describe('aiStepLabel', () => {
  it('已知动作映射到中文文案 key', () => {
    expect(aiStepLabel('navigate')).toBe('common:builtin_browser_ai_step_navigate');
    expect(aiStepLabel('fill_pdf')).toBe('common:builtin_browser_ai_step_fill_pdf');
    expect(aiStepLabel('resume')).toBe('common:builtin_browser_ai_step_resume');
  });

  it('未知动作回落到通用文案 key', () => {
    expect(aiStepLabel('launch_rocket')).toBe('common:builtin_browser_ai_step_generic');
  });
});

describe('aiStepStatusLabel', () => {
  it('五种步骤状态都有对应文案 key', () => {
    expect(aiStepStatusLabel('running')).toBe('common:builtin_browser_ai_step_status_running');
    expect(aiStepStatusLabel('ok')).toBe('common:builtin_browser_ai_step_status_ok');
    expect(aiStepStatusLabel('failed')).toBe('common:builtin_browser_ai_step_status_failed');
    expect(aiStepStatusLabel('confirming')).toBe(
      'common:builtin_browser_ai_step_status_confirming'
    );
    expect(aiStepStatusLabel('paused')).toBe('common:builtin_browser_ai_step_status_paused');
  });
});
