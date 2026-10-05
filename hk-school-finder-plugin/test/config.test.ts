// 鲁港通 - 数据源注册表与 TTL 判断测试（TDD）：缓存过期策略 + 16 源声明完整性
import { describe, it, expect } from 'vitest';
import { TTL_MS, isFresh, SOURCES, getSource, NEAREST_SCHOOLS_API } from '../src/config';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('TTL 判断', () => {
  it('weekly：12 小时有效期', () => {
    expect(TTL_MS.weekly).toBe(12 * HOUR);
    expect(isFresh('weekly', 11 * HOUR)).toBe(true);
    expect(isFresh('weekly', 12 * HOUR + 1)).toBe(false);
  });

  it('termly：7 天有效期', () => {
    expect(TTL_MS.termly).toBe(7 * DAY);
    expect(isFresh('termly', 6 * DAY)).toBe(true);
    expect(isFresh('termly', 8 * DAY)).toBe(false);
  });

  it('yearly：30 天有效期', () => {
    expect(TTL_MS.yearly).toBe(30 * DAY);
    expect(isFresh('yearly', 29 * DAY)).toBe(true);
    expect(isFresh('yearly', 31 * DAY)).toBe(false);
  });

  it('realtime：永不新鲜（不缓存）', () => {
    expect(TTL_MS.realtime).toBeNull();
    expect(isFresh('realtime', 0)).toBe(false);
    expect(isFresh('realtime', HOUR)).toBe(false);
  });
});

describe('数据源注册表', () => {
  it('共 16 个文件源（12 CSV + 3 XML + 1 XLSX）', () => {
    expect(SOURCES).toHaveLength(16);
    expect(SOURCES.filter((s) => s.format === 'csv')).toHaveLength(12);
    expect(SOURCES.filter((s) => s.format === 'xml')).toHaveLength(3);
    expect(SOURCES.filter((s) => s.format === 'xlsx')).toHaveLength(1);
  });

  it('统计源 tab0407：官方 XLSX、每年刷新', () => {
    const s = getSource('tab0407');
    expect(s.format).toBe('xlsx');
    expect(s.refresh).toBe('yearly');
    expect(s.url).toContain('Statistics_by_district_C.xlsx');
  });

  it('id 唯一、URL 为 http(s)、说明非空', () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SOURCES) {
      expect(s.url).toMatch(/^https?:\/\//);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });

  it('每个源声明合法 refresh 策略', () => {
    const policies = ['realtime', 'weekly', 'termly', 'yearly'];
    for (const s of SOURCES) {
      expect(policies).toContain(s.refresh);
    }
  });

  it('核心源在册：学校位置总表 / 幼稚园概览 / K1-K3 空缺（每周）', () => {
    expect(getSource('sch_loc').delimiter).toBe('\t');
    expect(getSource('kgp').delimiter).toBe('^');
    expect(getSource('k1k3_vacancy').refresh).toBe('weekly');
  });

  it('getSource 未注册 id 抛中文错误', () => {
    expect(() => getSource('not_exists')).toThrow(/未注册/);
  });

  it('附近学校实时接口地址集中声明', () => {
    expect(NEAREST_SCHOOLS_API).toContain('api.data.gov.hk');
  });
});
