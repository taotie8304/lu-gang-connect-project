import { describe, expect, it } from 'vitest';
import { resolveBuiltinBrowserAiBadge } from '@/pageComponents/chat/builtinBrowser/aiStatus';

describe('resolveBuiltinBrowserAiBadge', () => {
  it('没有状态或空闲时不显示徽标', () => {
    expect(resolveBuiltinBrowserAiBadge(undefined)).toBeUndefined();
    expect(resolveBuiltinBrowserAiBadge({ status: 'idle', reopens: 0 })).toBeUndefined();
  });

  it('运行中显示运行徽标并露出停止入口', () => {
    const badge = resolveBuiltinBrowserAiBadge({ status: 'running', reopens: 0 });

    expect(badge).toEqual({
      running: true,
      labelKey: 'common:builtin_browser_ai_running',
      message: undefined
    });
  });

  it('已停止显示停止徽标但不再露出停止入口', () => {
    const badge = resolveBuiltinBrowserAiBadge({
      status: 'stopped',
      reopens: 1,
      message: '连续两次操作没有成功，我已停止。'
    });

    expect(badge).toEqual({
      running: false,
      labelKey: 'common:builtin_browser_ai_stopped',
      message: '连续两次操作没有成功，我已停止。'
    });
  });
});
