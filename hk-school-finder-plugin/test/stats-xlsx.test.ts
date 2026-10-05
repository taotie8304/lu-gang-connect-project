// 鲁港通 - 统计查询 XLSX 数据源测试（TDD）：官方 XLSX 提取与 CSV 口径逐值对照
import { describe, it, expect } from 'vitest';
import { fixture, fixtureText } from './fixture';
import {
  parseStudentStats,
  parseStudentStatsFromXlsx,
  findStudentStats,
  type StudentStats,
  type StudentCountRow,
} from '../src/queries/stats';

const fromCsv: StudentStats = parseStudentStats(fixtureText('tab0407-tc.csv'));
const fromXlsx: StudentStats = parseStudentStatsFromXlsx(fixture('statistics-by-district-tc.xlsx'));

/** zoneSimp → 行映射（全港合计 + 区域组 + 18 区） */
function keyed(stats: StudentStats): Map<string, StudentCountRow> {
  const all: StudentCountRow[] = [
    ...(stats.grandTotal ? [stats.grandTotal] : []),
    ...stats.regions,
    ...stats.districts,
  ];
  return new Map(all.map((r) => [r.zoneSimp, r]));
}

describe('parseStudentStatsFromXlsx（官方 XLSX 表3(b) → 统计结构）', () => {
  it('结构：18 区 + 3 区域组 + 全港合计', () => {
    expect(fromXlsx.districts).toHaveLength(18);
    expect(fromXlsx.regions).toHaveLength(3);
    expect(fromXlsx.grandTotal?.total).toBe(347820);
  });

  it('与 CSV 口径逐值一致：22 个分区/组全字段相等', () => {
    const base = keyed(fromCsv);
    const actual = keyed(fromXlsx);
    expect(base.size).toBe(22);
    expect(actual.size).toBe(22);
    for (const [zone, row] of base) {
      expect(actual.get(zone), `缺少分区「${zone}」`).toEqual(row);
    }
  });

  it('区域组求和口径：香港島 60709 / 九龍 109180 / 新界 177931', () => {
    expect(findStudentStats(fromXlsx, '香港島')?.total).toBe(60709);
    expect(findStudentStats(fromXlsx, '九龍')?.total).toBe(109180);
    expect(findStudentStats(fromXlsx, '新界')?.total).toBe(177931);
  });

  it('单区明细：沙田 34998（中一 6061 / 中六 5076 / 中七 395）', () => {
    const r = findStudentStats(fromXlsx, '沙田');
    expect(r?.total).toBe(34998);
    expect(r?.s1).toBe(6061);
    expect(r?.s6).toBe(5076);
    expect(r?.s7).toBe(395);
  });

  it('「-」口径：黃大仙中七 → 0（与 CSV 一致）', () => {
    expect(findStudentStats(fromXlsx, '黃大仙')?.s7).toBe(0);
  });

  it('18 区合计 = 全港 347820（数据完整性）', () => {
    expect(fromXlsx.districts.reduce((acc, r) => acc + r.total, 0)).toBe(347820);
  });
});
