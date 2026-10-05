// 鲁港通 - 地理定位测试（TDD）：坐标文本 / 校名匹配 / 地标词典 / 区域中心
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import { resolveLocation } from '../src/geocode';
import { parseSchLoc } from '../src/queries/search';

const records = parseSchLoc(fixtureText('SCH_LOC_EDB.utf8.csv'));

describe('resolveLocation（地点 → 坐标锚点）', () => {
  it('解析「纬度,经度」文本', () => {
    expect(resolveLocation('22.31,114.17')).toEqual({ lat: 22.31, lng: 114.17, label: '22.31,114.17' });
  });

  it('坐标文本容忍空格与中文逗号', () => {
    expect(resolveLocation(' 22.31， 114.17 ')).toEqual({ lat: 22.31, lng: 114.17, label: '22.31,114.17' });
  });

  it('超范围坐标不当作坐标解析', () => {
    expect(resolveLocation('999,999')).toBeUndefined();
  });

  it('校名精确匹配（简体输入 → 繁体数据）', () => {
    const a = resolveLocation('喇沙书院', records);
    expect(a?.label).toBe('喇沙书院');
    expect(a?.lat).toBeCloseTo(22.3289, 3);
    expect(a?.lng).toBeCloseTo(114.1822, 3);
  });

  it('校名包含匹配（关键词命中第一所）', () => {
    const a = resolveLocation('喇沙', records);
    expect(a?.label).toBe('陈瑞祺(喇沙)小学');
  });

  it('英文校名精确匹配', () => {
    const a = resolveLocation('LA SALLE COLLEGE', records);
    expect(a?.label).toBe('喇沙书院');
  });

  it('命中记录缺坐标时跳过（取下一所）', () => {
    const fake = [
      { nameSimp: '测试书院', nameEn: 'TEST COLLEGE', latitude: undefined, longitude: undefined },
      { nameSimp: '测试书院(分校)', nameEn: 'TEST COLLEGE ANNEX', latitude: 22.33, longitude: 114.18 },
    ];
    const a = resolveLocation('测试书院', fake);
    expect(a?.label).toBe('测试书院(分校)');
    expect(a?.lat).toBeCloseTo(22.33, 3);
  });

  it('地标词典精确匹配', () => {
    expect(resolveLocation('尖沙咀')).toEqual({ lat: 22.2988, lng: 114.1722, label: '尖沙咀' });
  });

  it('繁体地标输入（觀塘 → 观塘）', () => {
    expect(resolveLocation('觀塘')).toEqual({ lat: 22.3132, lng: 114.2252, label: '观塘' });
  });

  it('地标优先于区域（沙田 → 地标坐标）', () => {
    const a = resolveLocation('沙田');
    expect(a?.label).toBe('沙田');
    expect(a?.lat).toBeCloseTo(22.3813, 3);
  });

  it('区域名命中 → 区域中心（沙田区）', () => {
    const a = resolveLocation('沙田区');
    expect(a?.label).toBe('沙田区');
    expect(a?.lat).toBeCloseTo(22.3912, 3);
    expect(a?.lng).toBeCloseTo(114.2023, 3);
  });

  it('区域补字容错（葵青 → 葵青区）', () => {
    const a = resolveLocation('葵青');
    expect(a?.label).toBe('葵青区');
    expect(a?.lat).toBeCloseTo(22.3595, 3);
  });

  it('空输入返回 undefined', () => {
    expect(resolveLocation('')).toBeUndefined();
    expect(resolveLocation(undefined)).toBeUndefined();
  });

  it('完全未知地点返回 undefined', () => {
    expect(resolveLocation('火星殖民地')).toBeUndefined();
  });
});
