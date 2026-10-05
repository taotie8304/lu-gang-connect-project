// 鲁港通 - 18 区解析测试（TDD）：英文/繁体/简体/缺「区」容错
import { describe, it, expect } from 'vitest';
import { DISTRICTS, resolveDistrict } from '../src/districts';

describe('18 区解析', () => {
  it('18 条，英文名与 SCH_LOC 数据一致', () => {
    expect(DISTRICTS).toHaveLength(18);
    const ens = DISTRICTS.map((d) => d.en);
    expect(ens).toContain('SHA TIN');
    expect(ens).toContain('CENTRAL AND WESTERN');
    expect(ens).toContain('ISLANDS');
  });

  it('英文区名（大小写不敏感）', () => {
    expect(resolveDistrict('SHA TIN')?.en).toBe('SHA TIN');
    expect(resolveDistrict('sha tin')?.en).toBe('SHA TIN');
  });

  it('繁体与简体区名', () => {
    expect(resolveDistrict('沙田區')?.en).toBe('SHA TIN');
    expect(resolveDistrict('沙田区')?.en).toBe('SHA TIN');
    expect(resolveDistrict('九龍城區')?.en).toBe('KOWLOON CITY');
    expect(resolveDistrict('觀塘區')?.en).toBe('KWUN TONG');
  });

  it('缺「区」字容错', () => {
    expect(resolveDistrict('沙田')?.en).toBe('SHA TIN');
    expect(resolveDistrict('觀塘')?.en).toBe('KWUN TONG');
  });

  it('无法识别返回 undefined', () => {
    expect(resolveDistrict('浦东新区')).toBeUndefined();
    expect(resolveDistrict('')).toBeUndefined();
  });
});
