import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_STATE,
  isWindowStateVisible,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  normalizeWindowState
} from '../src/main/windowState';

describe('normalizeWindowState', () => {
  it('非法输入回落默认值', () => {
    expect(normalizeWindowState(undefined)).toEqual(DEFAULT_WINDOW_STATE);
    expect(normalizeWindowState('bad')).toEqual(DEFAULT_WINDOW_STATE);
  });

  it('过小尺寸夹紧到最小值', () => {
    expect(normalizeWindowState({ width: 500, height: 300, isMaximized: false })).toEqual({
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT,
      x: undefined,
      y: undefined,
      isMaximized: false
    });
  });

  it('保留合法坐标与最大化标记', () => {
    expect(
      normalizeWindowState({ width: 1600, height: 900, x: 100, y: 80, isMaximized: true })
    ).toEqual({ width: 1600, height: 900, x: 100, y: 80, isMaximized: true });
  });

  it('NaN 尺寸回落默认值', () => {
    expect(normalizeWindowState({ width: Number.NaN, height: Number.POSITIVE_INFINITY })).toEqual(
      DEFAULT_WINDOW_STATE
    );
  });
});

describe('isWindowStateVisible', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1040 };

  it('无坐标视为可见（居中打开）', () => {
    expect(isWindowStateVisible({ width: 1440, height: 900, isMaximized: false }, [display])).toBe(
      true
    );
  });

  it('与显示器有足够重叠时可见', () => {
    expect(
      isWindowStateVisible(
        { width: 1440, height: 900, x: 100, y: 80, isMaximized: false },
        [display]
      )
    ).toBe(true);
  });

  it('完全移出显示器时不可见', () => {
    expect(
      isWindowStateVisible(
        { width: 1440, height: 900, x: 5000, y: 80, isMaximized: false },
        [display]
      )
    ).toBe(false);
  });
});
