import { describe, expect, it } from 'vitest';
import {
  calcBuiltinBrowserPanelMaxWidth,
  clampBuiltinBrowserPanelWidth
} from '@fastgpt/global/support/builtinBrowser/panelWidth';
import {
  BUILTIN_BROWSER_PANEL_MAX_WIDTH,
  BUILTIN_BROWSER_PANEL_MIN_WIDTH
} from '@fastgpt/global/support/builtinBrowser/constant';

describe('calcBuiltinBrowserPanelMaxWidth', () => {
  it('对齐 Qoder 实测：1713px 窗口可拖到 1308px（窗口宽 − 405px 保留区）', () => {
    expect(calcBuiltinBrowserPanelMaxWidth(1713)).toBe(1308);
  });

  it('窗口足够宽时不超过云端视口上限', () => {
    expect(calcBuiltinBrowserPanelMaxWidth(2560)).toBe(BUILTIN_BROWSER_PANEL_MAX_WIDTH);
  });

  it('窄窗口下保留聊天区下限，面板不低于最小宽度', () => {
    expect(calcBuiltinBrowserPanelMaxWidth(600)).toBe(BUILTIN_BROWSER_PANEL_MIN_WIDTH);
  });

  it('非法窗口宽度回落默认面板宽度', () => {
    expect(calcBuiltinBrowserPanelMaxWidth(0)).toBe(BUILTIN_BROWSER_PANEL_MAX_WIDTH);
  });
});

describe('clampBuiltinBrowserPanelWidth', () => {
  it('超过上限按上限收敛', () => {
    expect(clampBuiltinBrowserPanelWidth(2000, 1713)).toBe(1308);
  });

  it('低于下限按下限收敛', () => {
    expect(clampBuiltinBrowserPanelWidth(200, 1713)).toBe(BUILTIN_BROWSER_PANEL_MIN_WIDTH);
  });

  it('合法宽度取整后原样返回', () => {
    expect(clampBuiltinBrowserPanelWidth(530.4, 1713)).toBe(530);
  });
});
