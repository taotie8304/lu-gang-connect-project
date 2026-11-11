import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ZOOM_PERCENT,
  ZOOM_LEVELS,
  clampZoomPercent,
  normalizeZoomPercent,
  parseZoomStore,
  stepZoomPercent
} from '../src/main/browser/zoom';

describe('normalizeZoomPercent', () => {
  it('任意百分比吸附到最近档位', () => {
    expect(normalizeZoomPercent(101)).toBe(100);
    expect(normalizeZoomPercent(173)).toBe(175);
    expect(normalizeZoomPercent(63)).toBe(67);
  });

  it('越界值先收敛再吸附', () => {
    expect(normalizeZoomPercent(10)).toBe(50);
    expect(normalizeZoomPercent(500)).toBe(200);
    expect(normalizeZoomPercent(Number.NaN)).toBe(DEFAULT_ZOOM_PERCENT);
  });
});

describe('clampZoomPercent', () => {
  it('限定在 50 到 200 之间并取整', () => {
    expect(clampZoomPercent(49.4)).toBe(50);
    expect(clampZoomPercent(201)).toBe(200);
    expect(clampZoomPercent(99.6)).toBe(100);
  });
});

describe('stepZoomPercent', () => {
  it('按档位逐级放大与缩小', () => {
    expect(stepZoomPercent(100, 'in')).toBe(110);
    expect(stepZoomPercent(100, 'out')).toBe(90);
    expect(stepZoomPercent(67, 'out')).toBe(50);
  });

  it('到达两端后保持边界档位', () => {
    expect(stepZoomPercent(200, 'in')).toBe(200);
    expect(stepZoomPercent(50, 'out')).toBe(50);
  });

  it('非档位输入先吸附再步进', () => {
    expect(stepZoomPercent(104, 'in')).toBe(110);
    expect(stepZoomPercent(104, 'out')).toBe(90);
  });
});

describe('parseZoomStore', () => {
  it('只保留 http(s) 站点并吸附档位', () => {
    const store = parseZoomStore({
      'https://www.gov.hk': 125,
      'http://example.com': 88,
      'file:///tmp/a.html': 150,
      'chrome://settings': 100,
      'https://bad.example': '120'
    });
    expect(store).toEqual({
      'https://www.gov.hk': 125,
      'http://example.com': 90
    });
  });

  it('非法输入返回空对象', () => {
    expect(parseZoomStore(null)).toEqual({});
    expect(parseZoomStore([1, 2])).toEqual({});
    expect(parseZoomStore('not-json')).toEqual({});
  });
});

describe('ZOOM_LEVELS', () => {
  it('档位严格递增且包含默认值', () => {
    for (let i = 1; i < ZOOM_LEVELS.length; i += 1) {
      expect(ZOOM_LEVELS[i]).toBeGreaterThan(ZOOM_LEVELS[i - 1]);
    }
    expect(ZOOM_LEVELS).toContain(DEFAULT_ZOOM_PERCENT);
  });
});
