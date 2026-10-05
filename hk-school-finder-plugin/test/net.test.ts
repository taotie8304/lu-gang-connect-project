// 鲁港通 - 校网查询测试（TDD）：POA 小一校网 + SSPA 中学派位校网 + 网编号↔区域映射
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import {
  parsePoa,
  parseSspa,
  findPoaByNet,
  searchPoaByArea,
  findSspaByName,
  findSspaByNet,
  netToDistrictZh,
} from '../src/queries/net';

const poa = parsePoa(fixtureText('poa-schoolnet-tc.csv'));
const sspa = parseSspa(fixtureText('sspa-schsrvnet-tc.csv'));

describe('parsePoa（小一校网范围）', () => {
  it('解析 36 个校网', () => {
    expect(poa).toHaveLength(36);
  });

  it('字段映射：网 95（西贡/将军澳）', () => {
    const p = poa.find((x) => x.net === '95');
    expect(p?.area).toBe('西貢、糧船灣、將軍澳、井欄樹、清水灣');
    expect(p?.webpage).toBe('http://www.edb.gov.hk/poa/tc-canet-95');
    expect(p?.districtZh).toBe('西贡区');
  });

  it('覆盖区域尾部空格被清除', () => {
    expect(poa.find((x) => x.net === '89')?.area).toBe('馬鞍山、十四鄉');
    expect(poa.find((x) => x.net === '88')?.area).toBe('大圍');
  });
});

describe('findPoaByNet / searchPoaByArea', () => {
  it('按网编号查：11 → 中西区范围', () => {
    expect(findPoaByNet(poa, '11')?.area).toContain('中環');
    expect(findPoaByNet(poa, '999')).toBeUndefined();
  });

  it('按地名查：將軍澳 → 95（文本包含，简繁容错）', () => {
    expect(searchPoaByArea(poa, '將軍澳').map((p) => p.net)).toEqual(['95']);
    expect(searchPoaByArea(poa, '将军澳').map((p) => p.net)).toEqual(['95']);
  });

  it('按区域查：沙田区 → 88/89/91 三个网', () => {
    expect(searchPoaByArea(poa, '沙田区').map((p) => p.net).sort()).toEqual(['88', '89', '91']);
    expect(searchPoaByArea(poa, '沙田').map((p) => p.net).sort()).toEqual(['88', '89', '91']);
  });

  it('简体地名：大围 → 88', () => {
    expect(searchPoaByArea(poa, '大围').map((p) => p.net)).toEqual(['88']);
  });

  it('未命中返回空数组', () => {
    expect(searchPoaByArea(poa, '火星')).toEqual([]);
  });
});

describe('parseSspa（中学派位校网）', () => {
  it('解析 392 条记录', () => {
    expect(sspa).toHaveLength(392);
  });

  it('字段映射：喇沙書院', () => {
    const s = sspa.find((x) => x.name === '喇沙書院');
    expect(s?.net).toBe('KL3');
    expect(s?.dist).toBe('KC');
    expect(s?.schCode).toBe('512583');
    expect(s?.servedNets).toEqual(['KL1', 'KL2', 'KL3']);
    expect(s?.districtZh).toBe('九龙城区');
  });

  it('字段映射：皇仁書院（5 个服务网，按列序）', () => {
    const s = sspa.find((x) => x.name === '皇仁書院');
    expect(s?.net).toBe('HK2');
    expect(s?.servedNets).toEqual(['HK1', 'HK2', 'HK3', 'HK4', 'NT9']);
  });

  it('映射完整性：全部记录 districtZh 非空、至少服务 1 个网', () => {
    expect(sspa.every((x) => x.districtZh !== '')).toBe(true);
    expect(sspa.every((x) => x.servedNets.length >= 1)).toBe(true);
  });
});

describe('findSspaByName / findSspaByNet', () => {
  it('精确匹配：喇沙書院 不误中陳瑞祺（喇沙）書院', () => {
    const s = findSspaByName(sspa, '喇沙書院');
    expect(s?.name).toBe('喇沙書院');
    expect(s?.net).toBe('KL3');
  });

  it('简体输入：喇沙书院 → 命中原记录', () => {
    expect(findSspaByName(sspa, '喇沙书院')?.name).toBe('喇沙書院');
  });

  it('未命中返回 undefined', () => {
    expect(findSspaByName(sspa, '不存在的学校')).toBeUndefined();
  });

  it('按网反查：HK1 → 46 所且全部服务 HK1', () => {
    const list = findSspaByNet(sspa, 'HK1');
    expect(list).toHaveLength(46);
    expect(list.every((x) => x.servedNets.includes('HK1'))).toBe(true);
    expect(list.some((x) => x.name === '皇仁書院')).toBe(true);
  });

  it('按网反查：NT9 → 85 所', () => {
    expect(findSspaByNet(sspa, 'NT9')).toHaveLength(85);
  });
});

describe('netToDistrictZh（网编号 ↔ 区域）', () => {
  it('中学 18 网：HK1/KL3/NT9', () => {
    expect(netToDistrictZh('HK1')).toBe('中西区');
    expect(netToDistrictZh('KL3')).toBe('九龙城区');
    expect(netToDistrictZh('NT9')).toBe('离岛区');
  });

  it('小学网：11/95/88', () => {
    expect(netToDistrictZh('11')).toBe('中西区');
    expect(netToDistrictZh('95')).toBe('西贡区');
    expect(netToDistrictZh('88')).toBe('沙田区');
  });

  it('未知网编号返回 undefined', () => {
    expect(netToDistrictZh('999')).toBeUndefined();
    expect(netToDistrictZh('')).toBeUndefined();
  });
});
