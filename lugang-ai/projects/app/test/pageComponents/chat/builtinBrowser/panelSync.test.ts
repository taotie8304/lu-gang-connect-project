import { describe, expect, it } from 'vitest';
import { shouldAutoOpenPanel } from '@/pageComponents/chat/builtinBrowser/panelSync';

describe('桌面面板联动', () => {
  it('AI 在主进程打开原生面板后，网页外壳跟随铺开', () => {
    expect(
      shouldAutoOpenPanel({
        isOpen: false,
        browser: { panelOpen: true }
      })
    ).toBe(true);
  });

  it('AI 已开始工作但原生状态还没送达时也铺开', () => {
    expect(
      shouldAutoOpenPanel({
        isOpen: false,
        ai: { status: 'running' }
      })
    ).toBe(true);
  });

  it('面板已经打开时不重复处理', () => {
    expect(
      shouldAutoOpenPanel({
        isOpen: true,
        browser: { panelOpen: true },
        ai: { status: 'running' }
      })
    ).toBe(false);
  });

  it('面板关闭且 AI 空闲时保持关闭', () => {
    expect(
      shouldAutoOpenPanel({
        isOpen: false,
        browser: { panelOpen: false },
        ai: { status: 'idle' }
      })
    ).toBe(false);
  });
});
