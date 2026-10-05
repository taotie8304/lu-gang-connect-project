// 鲁港通 - 附近学校测试（TDD）：URL 构造 / 距离 / 去重合并 / 过滤 / 错误处理
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import {
  buildNearbyUrl,
  haversineMeters,
  parseNearestResponse,
  queryNearbySchools,
} from '../src/queries/nearby';

const sample = JSON.parse(fixtureText('r28-nearest.json'));
const samePoint = { lat: 22.301474, lng: 114.1726722 };
const offsetPoint = { lat: 22.3, lng: 114.17 };

// 合成记录助手（nearest-schools API 关键字段子集）
const rec = (name: string, level: string, lat: number, lng: number, session = '上午', addr = '测试地址') => ({
  'lat-long': [lat, lng],
  'category-en': 'Kindergartens',
  'category-zh': '幼稚園',
  'name-en': `EN ${name}`,
  'name-zh': name,
  'address-en': 'TEST ADDR',
  'address-zh': addr,
  'student-gender-en': 'CO-ED',
  'student-gender-zh': '男女',
  'session-en': 'A.M.',
  'session-zh': session,
  'district-en': 'CENTRAL AND WESTERN',
  'district-zh': '中西區',
  'finance-type-en': 'PRIVATE',
  'finance-type-zh': '私立',
  'level-en': level,
  'level-zh': '幼稚園',
  telephone: '12345678',
  fax: '87654321',
  website: 'https://example.com',
  'religion-en': 'NOT APPLICABLE',
  'religion-zh': '不適用',
});

describe('buildNearbyUrl', () => {
  it('构造 nearest-schools URL', () => {
    expect(buildNearbyUrl(22.3, 114.17, 10)).toBe(
      'https://api.data.gov.hk/v1/nearest-schools?lat=22.3&long=114.17&max=10'
    );
  });

  it('max 上限 20 / 下限 1', () => {
    expect(buildNearbyUrl(22.3, 114.17, 50)).toContain('max=20');
    expect(buildNearbyUrl(22.3, 114.17, 0)).toContain('max=1');
  });
});

describe('haversineMeters', () => {
  it('同点距离为 0', () => {
    expect(haversineMeters(22.28, 114.16, 22.28, 114.16)).toBe(0);
  });

  it('中环 ↔ 尖沙咀 ≈ 2.35 km', () => {
    const d = haversineMeters(22.2819, 114.1585, 22.2988, 114.1722);
    expect(d).toBeCloseTo(2349, -2);
  });
});

describe('parseNearestResponse（去重合并 + 距离 + 过滤）', () => {
  it('样本：同校两条（P.M./WHOLE DAY）合并为一条', () => {
    const list = parseNearestResponse(sample, samePoint);
    expect(list).toHaveLength(1);
    const s = list[0];
    expect(s.name).toBe('卓尔中英文幼稚园');
    expect(s.sessions).toEqual(['下午', '全日']);
    expect(s.level).toBe('kg');
    expect(s.district).toBe('油尖旺区');
    expect(s.telephone).toBe('23676680');
    expect(s.address).toContain('弥敦道');
    expect(s.website).toBe('https://www.smartkidskg.edu.hk/en/index.php');
  });

  it('样本：距离按锚点计算（米）', () => {
    const list = parseNearestResponse(sample, offsetPoint);
    expect(list[0].distanceMeters).toBeGreaterThan(200);
    expect(list[0].distanceMeters).toBeLessThan(450);
  });

  it('level 过滤', () => {
    const json = {
      results: [
        rec('甲幼稚園', 'KINDERGARTEN', 22.3, 114.17),
        rec('乙小學', 'PRIMARY', 22.31, 114.18),
        rec('丙中學', 'SECONDARY', 22.32, 114.19),
      ],
    };
    const list = parseNearestResponse(json, samePoint, { level: 'primary' });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('乙小学');
  });

  it('坏记录容错：缺坐标跳过', () => {
    const json = {
      results: [
        { ...rec('壞學校', 'KINDERGARTEN', 22.3, 114.17), 'lat-long': null },
        rec('好學校', 'KINDERGARTEN', 22.3, 114.17),
      ],
    };
    const list = parseNearestResponse(json, samePoint);
    expect(list.map((s) => s.name)).toEqual(['好学校']);
  });

  it('name-zh 缺失时用 name-en 兜底', () => {
    const r = rec('X', 'KINDERGARTEN', 22.3, 114.17);
    delete (r as Record<string, unknown>)['name-zh'];
    const list = parseNearestResponse({ results: [r] }, samePoint);
    expect(list[0].name).toBe('EN X');
  });

  it('不同学校不合并（同校多班次仅合并 sessions）', () => {
    const json = {
      results: [
        rec('甲幼稚園', 'KINDERGARTEN', 22.3, 114.17, '上午'),
        rec('甲幼稚園', 'KINDERGARTEN', 22.3, 114.17, '下午'),
        rec('乙幼稚園', 'KINDERGARTEN', 22.31, 114.18, '全日'),
      ],
    };
    const list = parseNearestResponse(json, samePoint);
    expect(list).toHaveLength(2);
    expect(list[0].sessions).toEqual(['上午', '下午']);
    expect(list[1].sessions).toEqual(['全日']);
  });
});

describe('queryNearbySchools（注入 fetchJson）', () => {
  it('注入桩返回样本 → 去重结果', async () => {
    const list = await queryNearbySchools({
      anchor: samePoint,
      fetchJson: async () => sample,
    });
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('卓尔中英文幼稚园');
  });

  it('数据服务失败 → 可操作中文错误', async () => {
    await expect(
      queryNearbySchools({
        anchor: samePoint,
        fetchJson: async () => {
          throw new Error('boom');
        },
      })
    ).rejects.toThrow(/稍后重试/);
  });
});
