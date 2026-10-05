// 鲁港通 - 学校搜索测试（TDD）：SCH_LOC 解析 + 简繁匹配 + 过滤 + 相近候选 + 截断
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import { normalizeCategory, parseSchLoc, searchSchools } from '../src/queries/search';

const records = parseSchLoc(fixtureText('SCH_LOC_EDB.utf8.csv'));

describe('parseSchLoc（学校位置总表）', () => {
  it('解析 3461 条记录（36 列制式）', () => {
    expect(records).toHaveLength(3461);
  });

  it('字段映射：陈瑞祺(喇沙)小学', () => {
    const s = records[0];
    expect(s.nameZh).toBe('陳瑞祺(喇沙)小學');
    expect(s.nameEn).toBe('CHAN SUI KI (LA SALLE) PRIMARY SCHOOL');
    expect(s.level).toBe('primary');
    expect(s.district).toBe('KOWLOON CITY');
    expect(s.districtZh).toBe('九龍城區');
    expect(s.telephone).toBe('27116278');
    expect(s.financeType).toBe('AIDED');
    expect(s.website).toBe('http://www.cskps.edu.hk');
  });

  it('DMS 坐标转换为十进制度', () => {
    const s = records[0];
    expect(s.longitude).toBeCloseTo(114.1811, 3);
    expect(s.latitude).toBeCloseTo(22.3189, 3);
  });

  it('级别归一化：5 种原值 → 4 类（含特殊学校 other）', () => {
    const counts = { kg: 0, primary: 0, secondary: 0, other: 0 };
    for (const r of records) counts[r.level]++;
    expect(counts.kg).toBe(2177); // KINDERGARTEN + KINDERGARTEN-CUM-CHILD CARE CENTRES
    expect(counts.primary).toBe(590);
    expect(counts.secondary).toBe(547);
    expect(counts.other).toBe(147); // 特殊学校（LEVEL 列为空）
  });

  it('引号地址正确解析（含逗号）', () => {
    const marymount = records.find((r) => r.nameZh === '瑪利曼小學');
    expect(marymount?.addressEn).toContain('336 TAI HANG ROAD');
    expect(marymount?.addressEn).toContain('1/F, 2/F, 3/F');
  });

  it('简体归一化名（搜索支撑字段）', () => {
    const stPaul = records.find((r) => r.nameZh === '聖保羅書院');
    expect(stPaul?.nameSimp).toBe('圣保罗书院');
  });
});

describe('searchSchools（学校搜索）', () => {
  it('中文包含匹配（繁体输入）', () => {
    const r = searchSchools(records, { name: '喇沙' });
    expect(r.total).toBe(5);
    expect(r.items.map((s) => s.nameZh)).toContain('喇沙書院');
  });

  it('简体输入命中繁体数据（简繁归一）', () => {
    const r = searchSchools(records, { name: '圣保罗' });
    expect(r.total).toBe(6);
    expect(r.items.map((s) => s.nameZh)).toContain('聖保羅書院');
  });

  it('繁体输入与简体输入命中一致', () => {
    const simp = searchSchools(records, { name: '圣保罗' });
    const trad = searchSchools(records, { name: '聖保羅' });
    expect(trad.total).toBe(simp.total);
  });

  it('英文名匹配（大小写不敏感）', () => {
    const r = searchSchools(records, { name: 'la salle' });
    expect(r.total).toBe(5);
  });

  it('区域过滤（英文/繁体/简体均可）', () => {
    expect(searchSchools(records, { district: 'SHA TIN', level: 'primary' }).total).toBe(44);
    expect(searchSchools(records, { district: '沙田區', level: 'primary' }).total).toBe(44);
    expect(searchSchools(records, { district: '沙田区', level: 'primary' }).total).toBe(44);
  });

  it('名称 + 区域组合过滤', () => {
    const r = searchSchools(records, { name: '喇沙', district: '九龙城区' });
    expect(r.total).toBe(4);
    expect(r.items.every((s) => s.district === 'KOWLOON CITY')).toBe(true);
  });

  it('超过 50 条截断并标记', () => {
    const r = searchSchools(records, { name: '中学' });
    expect(r.total).toBe(457);
    expect(r.items).toHaveLength(50);
    expect(r.truncated).toBe(true);
  });

  it('无命中给出相近名称候选（top 3）', () => {
    const r = searchSchools(records, { name: '喇沙书完' });
    expect(r.total).toBe(0);
    expect(r.suggestions[0]).toBe('喇沙书院');
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('无法识别的区域返回空结果', () => {
    const r = searchSchools(records, { district: '浦东新区' });
    expect(r.total).toBe(0);
    expect(r.items).toHaveLength(0);
  });

  it('无任何条件返回前 50 条并标记截断', () => {
    const r = searchSchools(records, {});
    expect(r.total).toBe(3461);
    expect(r.items).toHaveLength(50);
    expect(r.truncated).toBe(true);
  });
});

// ============================================================
// 鲁港通 - 办学类型过滤与数量构成（数据支撑：SCH_LOC「ENGLISH CATEGORY」口径）
// ============================================================

describe('searchSchools（办学类型过滤与数量构成）', () => {
  it('类别过滤：国际学校 64（小学 42 + 中学 22），构成仅一类', () => {
    const r = searchSchools(records, { category: 'international' });
    expect(r.total).toBe(64);
    expect(r.levelCounts.primary).toBe(42);
    expect(r.levelCounts.secondary).toBe(22);
    expect(r.categoryCounts).toEqual([{ label: '国际学校', count: 64 }]);
  });

  it('类别过滤：全港直资中学 62', () => {
    expect(searchSchools(records, { category: 'direct_subsidy', level: 'secondary' }).total).toBe(62);
  });

  it('区域+级别+类别：油尖旺区直资中学 4', () => {
    const r = searchSchools(records, { district: '油尖旺区', level: 'secondary', category: 'direct_subsidy' });
    expect(r.total).toBe(4);
    expect(r.items.every((s) => s.district === 'YAU TSIM MONG')).toBe(true);
  });

  it('类别构成降序：油尖旺区中学 25（资助 13、私立 5、直资 4、官立 2、按额津贴 1）', () => {
    const r = searchSchools(records, { district: '油尖旺区', level: 'secondary' });
    expect(r.total).toBe(25);
    expect(r.categoryCounts).toEqual([
      { label: '资助', count: 13 },
      { label: '私立', count: 5 },
      { label: '直资', count: 4 },
      { label: '官立', count: 2 },
      { label: '按额津贴', count: 1 },
    ]);
  });

  it('类别过滤：政府（官立+资助合并口径）1002 / 资助 937 / 英基 18', () => {
    const gov = searchSchools(records, { category: 'government' });
    expect(gov.total).toBe(1002);
    expect(gov.categoryCounts).toEqual([
      { label: '资助', count: 937 },
      { label: '官立', count: 65 },
    ]);
    expect(searchSchools(records, { category: 'aided' }).total).toBe(937);
    expect(searchSchools(records, { category: 'esf' }).total).toBe(18);
  });

  it('区域+级别+类别（合并口径）：沙田区政府小学 38（资助 37 + 官立 1）', () => {
    const r = searchSchools(records, { district: '沙田区', level: 'primary', category: 'government' });
    expect(r.total).toBe(38);
    expect(r.categoryCounts).toEqual([
      { label: '资助', count: 37 },
      { label: '官立', count: 1 },
    ]);
  });

  it('沙田区小学 44 的构成：资助 37 居首', () => {
    const r = searchSchools(records, { district: '沙田区', level: 'primary' });
    expect(r.total).toBe(44);
    expect(r.categoryCounts[0]).toEqual({ label: '资助', count: 37 });
    expect(r.categoryCounts).toContainEqual({ label: '私立', count: 3 });
    expect(r.categoryCounts).toContainEqual({ label: '直资', count: 2 });
  });
});

// ============================================================
// 鲁港通 - normalizeCategory（参数归一化：枚举直通 + 中文类别词识别）
// ============================================================

describe('normalizeCategory（办学类型归一化）', () => {
  it('枚举值直通', () => {
    expect(normalizeCategory('direct_subsidy')).toBe('direct_subsidy');
    expect(normalizeCategory('international')).toBe('international');
  });

  it('中文类别词识别（简繁归一）', () => {
    expect(normalizeCategory('直资')).toBe('direct_subsidy');
    expect(normalizeCategory('國際學校')).toBe('international');
  });

  it('未识别返回 undefined', () => {
    expect(normalizeCategory('foo')).toBeUndefined();
    expect(normalizeCategory('')).toBeUndefined();
  });
});
