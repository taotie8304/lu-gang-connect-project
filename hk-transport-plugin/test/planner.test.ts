// 鲁港通 - 深夜班次排序优化测试
// 覆盖：通宵线识别、香港时区日间判断、白天通宵线沉底排序、规划器真实数据集成

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOvernightRoute, isHongKongDaytime, planPublicTransit } from '../src/planner';
import { sortEnrichedCandidates } from '../src/index';
import type { TransitCandidate } from '../src/types';

// 固定时刻（避免测试随运行时段漂移）
const DAY_NOON = new Date('2026-10-07T12:00:00+08:00');
const NIGHT_2AM = new Date('2026-10-08T02:00:00+08:00');

// 尖沙咀码头 → 机场(地面运输中心)巴士总站（该 OD 对存在 N21/N21A/NA20 等通宵线）
const TST_PIER = { lat: 22.294114, lng: 114.169062 };
const AIRPORT_GTC = { lat: 22.313642, lng: 113.937089 };

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// 工具函数
// ============================================================

type EtaSource = NonNullable<TransitCandidate['realTimeETA']>['dataSource'];

function eta(totalMinutes: number, dataSource: EtaSource = 'ctb') {
  return {
    nextBusMinutes: 3,
    estimatedTripMinutes: totalMinutes - 3,
    totalMinutes,
    dataSource,
    timestamp: '2026-10-07T12:00:00+08:00',
  };
}

function makeCandidate(over: Partial<TransitCandidate> = {}): TransitCandidate {
  return {
    company: 'CTB',
    mode: 'bus',
    route: 'X1',
    bound: 'O',
    serviceType: '1',
    boardStopId: '1',
    boardStopName: '起点站',
    boardSeq: 1,
    alightStopId: '2',
    alightStopName: '终点站',
    alightSeq: 5,
    numStops: 4,
    walkInMeters: 100,
    walkOutMeters: 100,
    destination: '终点站',
    fare: 10,
    score: 10,
    ...over,
  };
}

// ============================================================
// 通宵线识别
// ============================================================

describe('isOvernightRoute（N/NA 字头通宵巴士）', () => {
  it('应识别常见通宵线（含 NA 特快通宵）', () => {
    for (const name of ['N23', 'NA21', 'N21A', 'N1', 'N118', 'N373', ' N23 ']) {
      expect(isOvernightRoute(name), `"${name}" 应识别为通宵线`).toBe(true);
    }
  });

  it('不应误伤日间线（A/E 字头、纯数字、含 Night 字样的全称）', () => {
    for (const name of ['A21', 'A25', 'E11', '21', '112', 'Night Express', 'N', '', 'KA21']) {
      expect(isOvernightRoute(name), `"${name}" 不应识别为通宵线`).toBe(false);
    }
  });
});

// ============================================================
// 香港时区日间判断（06:00–23:59 为日间）
// ============================================================

describe('isHongKongDaytime（香港时区 06:00–23:59 为日间）', () => {
  it('日间边界：06:00 起为日间，23:59 仍属日间', () => {
    for (const iso of [
      '2026-10-07T06:00:00+08:00',
      '2026-10-07T12:00:00+08:00',
      '2026-10-07T23:59:59+08:00',
    ]) {
      expect(isHongKongDaytime(new Date(iso)), `${iso} 应为日间`).toBe(true);
    }
  });

  it('深夜边界：00:00–05:59 为夜间', () => {
    for (const iso of [
      '2026-10-07T00:00:00+08:00',
      '2026-10-07T02:00:00+08:00',
      '2026-10-07T05:59:00+08:00',
    ]) {
      expect(isHongKongDaytime(new Date(iso)), `${iso} 应为夜间`).toBe(false);
    }
  });

  it('UTC 输入按香港时区换算（服务器时区无关）', () => {
    // UTC 00:00 = 香港 08:00 → 日间
    expect(isHongKongDaytime(new Date('2026-10-07T00:00:00Z'))).toBe(true);
    // UTC 20:00 = 香港次日 04:00 → 夜间
    expect(isHongKongDaytime(new Date('2026-10-06T20:00:00Z'))).toBe(false);
    // UTC 15:59 = 香港 23:59 → 日间；UTC 16:00 = 香港次日 00:00 → 夜间
    expect(isHongKongDaytime(new Date('2026-10-07T15:59:00Z'))).toBe(true);
    expect(isHongKongDaytime(new Date('2026-10-07T16:00:00Z'))).toBe(false);
  });
});

// ============================================================
// 候选路线排序：白天通宵线沉底
// ============================================================

describe('sortEnrichedCandidates（白天通宵线整列沉底）', () => {
  it('白天：通宵线即使时间更短也排在日间线之后', () => {
    const list = [
      makeCandidate({ route: 'N23', isOvernight: true, realTimeETA: eta(30) }),
      makeCandidate({ route: 'A21', realTimeETA: eta(60) }),
    ];
    sortEnrichedCandidates(list, DAY_NOON);
    expect(list.map((c) => c.route)).toEqual(['A21', 'N23']);
  });

  it('深夜：不做沉底，通宵线时间更短就排前', () => {
    const list = [
      makeCandidate({ route: 'N23', isOvernight: true, realTimeETA: eta(30) }),
      makeCandidate({ route: 'A21', realTimeETA: eta(60) }),
    ];
    sortEnrichedCandidates(list, NIGHT_2AM);
    expect(list.map((c) => c.route)).toEqual(['N23', 'A21']);
  });

  it('类别内部仍按实时总时长排序', () => {
    const list = [
      makeCandidate({ route: 'N23', isOvernight: true, realTimeETA: eta(30) }),
      makeCandidate({ route: 'N29', isOvernight: true, realTimeETA: eta(20) }),
      makeCandidate({ route: 'A21', realTimeETA: eta(50) }),
      makeCandidate({ route: 'A25', realTimeETA: eta(35) }),
    ];
    sortEnrichedCandidates(list, DAY_NOON);
    expect(list.map((c) => c.route)).toEqual(['A25', 'A21', 'N29', 'N23']);
  });

  it('时间相同时：实时数据优先于静态数据，再按票价', () => {
    const list = [
      makeCandidate({ route: 'B-static', realTimeETA: eta(40, 'static'), fare: 5 }),
      makeCandidate({ route: 'B-live', realTimeETA: eta(40, 'ctb'), fare: 30 }),
      makeCandidate({ route: 'B-live-cheap', realTimeETA: eta(40, 'ctb'), fare: 12 }),
    ];
    sortEnrichedCandidates(list, DAY_NOON);
    expect(list.map((c) => c.route)).toEqual(['B-live-cheap', 'B-live', 'B-static']);
  });

  it('无实时数据的候选排最后', () => {
    const list = [
      makeCandidate({ route: 'no-eta' }),
      makeCandidate({ route: 'with-eta', realTimeETA: eta(60) }),
    ];
    sortEnrichedCandidates(list, DAY_NOON);
    expect(list.map((c) => c.route)).toEqual(['with-eta', 'no-eta']);
  });
});

// ============================================================
// 规划器集成：真实站点数据（尖沙咀码头 → 机场）
// ============================================================

describe('planPublicTransit 集成（通宵线白天沉底 / 深夜恢复）', () => {
  it('白天 12:00：所有通宵线候选整列排在日间线之后，首位非通宵线', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DAY_NOON);

    const res = await planPublicTransit(TST_PIER.lat, TST_PIER.lng, AIRPORT_GTC.lat, AIRPORT_GTC.lng);
    expect(res.candidates.length).toBeGreaterThan(0);

    const overnight = res.candidates.filter((c) => c.isOvernight);
    const daytime = res.candidates.filter((c) => !c.isOvernight);
    // 前置条件：该 OD 对确实同时存在两类候选，断言才有意义
    expect(overnight.length).toBeGreaterThan(0);
    expect(daytime.length).toBeGreaterThan(0);

    const firstOvernight = res.candidates.findIndex((c) => c.isOvernight);
    const lastDaytime = res.candidates.reduce((acc, c, i) => (c.isOvernight ? acc : i), -1);
    expect(firstOvernight).toBeGreaterThan(lastDaytime);
    expect(res.candidates[0].isOvernight).toBeFalsy();

    // 沉底幅度：通宵线评分整体高于全部日间线（惩罚分生效）
    const minOvernight = Math.min(...overnight.map((c) => c.score));
    const maxDaytime = Math.max(...daytime.map((c) => c.score));
    expect(minOvernight).toBeGreaterThan(maxDaytime);
  });

  it('深夜 02:00：不加惩罚，通宵线评分回到正常区间', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NIGHT_2AM);

    const res = await planPublicTransit(TST_PIER.lat, TST_PIER.lng, AIRPORT_GTC.lat, AIRPORT_GTC.lng);
    const overnight = res.candidates.filter((c) => c.isOvernight);
    expect(overnight.length).toBeGreaterThan(0);

    // 深夜无惩罚：最高评分也应远低于惩罚阈值（正常评分 = 站数权重 + 步行校正，量级 < 100）
    const maxOvernight = Math.max(...overnight.map((c) => c.score));
    expect(maxOvernight).toBeLessThan(1000);
  });
});
