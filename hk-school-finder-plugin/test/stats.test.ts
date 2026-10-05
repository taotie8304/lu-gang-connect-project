// 鲁港通 - 统计查询测试（TDD）：tab0407 解析（18 区 × 中一至中七）+ 单区/全港对比
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import { parseStudentStats, findStudentStats, rankDistrictsByTotal } from '../src/queries/stats';

const stats = parseStudentStats(fixtureText('tab0407-tc.csv'));

describe('parseStudentStats（tab0407 分区学生人数）', () => {
  it('解析 18 区 + 3 区域组 + 全港合计', () => {
    expect(stats.districts).toHaveLength(18);
    expect(stats.regions).toHaveLength(3);
    expect(stats.grandTotal?.total).toBe(347820);
  });

  it('字段映射：沙田（所有級別 34998，中一 6061，中六 5076，中七 395）', () => {
    const r = findStudentStats(stats, '沙田');
    expect(r?.total).toBe(34998);
    expect(r?.s1).toBe(6061);
    expect(r?.s6).toBe(5076);
    expect(r?.s7).toBe(395);
  });

  it('「-」表示不适用 → 0（黃大仙中七）', () => {
    expect(findStudentStats(stats, '黃大仙')?.s7).toBe(0);
  });

  it('18 区合计 = 所有分區 347820（数据完整性）', () => {
    const sum = stats.districts.reduce((acc, r) => acc + r.total, 0);
    expect(sum).toBe(347820);
  });

  it('区域组可查：九龍 109180', () => {
    expect(findStudentStats(stats, '九龍')?.total).toBe(109180);
  });
});

describe('findStudentStats（单区查询）', () => {
  it('简繁容错：黄大仙 / 黃大仙 均可命中', () => {
    expect(findStudentStats(stats, '黄大仙')?.zone).toBe('黃大仙');
    expect(findStudentStats(stats, '黃大仙')?.zone).toBe('黃大仙');
  });

  it('「区」字容错：沙田區 → 命中沙田', () => {
    expect(findStudentStats(stats, '沙田區')?.zone).toBe('沙田');
  });

  it('英文名：Sha Tin → 命中沙田', () => {
    expect(findStudentStats(stats, 'Sha Tin')?.zone).toBe('沙田');
  });

  it('全港别名：全港 → 返回合计行', () => {
    expect(findStudentStats(stats, '全港')?.total).toBe(347820);
  });

  it('未命中：不存在区域 → undefined', () => {
    expect(findStudentStats(stats, '火星')).toBeUndefined();
  });
});

describe('rankDistrictsByTotal（全港对比摘要）', () => {
  it('按人数降序：首位沙田 34998、末位離島 6584', () => {
    const ranked = rankDistrictsByTotal(stats);
    expect(ranked).toHaveLength(18);
    expect(ranked[0]?.zone).toBe('沙田');
    expect(ranked[0]?.total).toBe(34998);
    expect(ranked[17]?.zone).toBe('離島');
    expect(ranked[17]?.total).toBe(6584);
  });

  it('纯函数：不修改原 districts 顺序', () => {
    const first = stats.districts[0]?.zone;
    rankDistrictsByTotal(stats);
    expect(stats.districts[0]?.zone).toBe(first);
  });
});
