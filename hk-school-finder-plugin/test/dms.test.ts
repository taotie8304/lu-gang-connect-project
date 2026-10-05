// 鲁港通 - DMS 坐标转换测试（TDD）：SCH_LOC 的「度-分-秒」→ 十进制度
import { describe, it, expect } from 'vitest';
import { parseDms } from '../src/dms';

describe('parseDms', () => {
  it('度-分-秒 → 十进制度（SCH_LOC 真实格式）', () => {
    expect(parseDms('114-10-52')).toBeCloseTo(114.1811, 4);
    expect(parseDms('22-19-8')).toBeCloseTo(22.3189, 4);
  });

  it('支持度-分-秒的个位数段', () => {
    // 114 + 3/60 + 58/3600 = 114.06611...
    expect(parseDms('114-3-58')).toBeCloseTo(114.0661, 4);
  });

  it('支持度-分（两段）变体', () => {
    // 114 + 10/60 = 114.16667
    expect(parseDms('114-10')).toBeCloseTo(114.1667, 4);
  });

  it('无效输入返回 undefined', () => {
    expect(parseDms('')).toBeUndefined();
    expect(parseDms('abc')).toBeUndefined();
    expect(parseDms('114-xx-52')).toBeUndefined();
    expect(parseDms('114')).toBeUndefined();
    expect(parseDms('114-10-52-1')).toBeUndefined();
  });
});
