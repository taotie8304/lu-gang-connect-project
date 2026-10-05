// 鲁港通 - 简繁归一化测试（TDD）：香港繁体 → 简体（搜索匹配用）
import { describe, it, expect } from 'vitest';
import { normalizeCjk } from '../src/cjk';

describe('normalizeCjk（香港繁体 → 简体）', () => {
  it('繁体校名转简体', () => {
    expect(normalizeCjk('聖保羅男女中學')).toBe('圣保罗男女中学');
    expect(normalizeCjk('喇沙書院')).toBe('喇沙书院');
    expect(normalizeCjk('香港道教聯合會圓玄學院第二中學')).toBe('香港道教联合会圆玄学院第二中学');
  });

  it('简体输入保持不变', () => {
    expect(normalizeCjk('沙田区')).toBe('沙田区');
    expect(normalizeCjk('九龙城区')).toBe('九龙城区');
  });

  it('英文字母与数字不变', () => {
    expect(normalizeCjk('ABC 123 St.')).toBe('ABC 123 St.');
  });

  it('空字符串安全', () => {
    expect(normalizeCjk('')).toBe('');
  });
});
