// 鲁港通 - 车程估算与港铁线网寻路测试
// 覆盖：官方全程时数/站距模型三口径估算、港铁真实线路与换乘、多段行程渲染

import { describe, it, expect } from 'vitest';
import { estimateRideMinutes, segmentRunMinutes } from '../src/journey-time';
import { planMtrJourney, MTR_LINES } from '../src/data/mtr-network';
import { transitCandidateToRouteOption } from '../src/integrator';
import { enrichCandidateWithRealTimeETA } from '../src/fetcher';
import { planPublicTransit } from '../src/planner';
import type { TransitCandidate } from '../src/types';

// ============================================================
// 车程估算：不能再用「每站 2 分钟」
// ============================================================

describe('estimateRideMinutes（按官方全程时数 + 站距模型）', () => {
  it('站距越长，每公里用时越短（快速路 vs 市区支路）', () => {
    const shortHop = segmentRunMinutes(0.3) / 0.3;
    const highway = segmentRunMinutes(9) / 9;
    expect(shortHop).toBeGreaterThan(highway * 3);
  });

  it('深圳湾口岸→屯门市中心这类「1 站跨 12 公里」不应算成 2 分钟', () => {
    const minutes = estimateRideMinutes({
      officialMinutes: 32,
      legStops: 1,
      totalStops: 3,
      legKm: 12.6,
      totalKm: 12.6,
    });
    expect(minutes).toBeGreaterThanOrEqual(14);
    expect(minutes).toBeLessThanOrEqual(40);
  });

  it('屯门→中环长途巴士应超过 50 分钟（旧算法只有 27 分钟）', () => {
    const minutes = estimateRideMinutes({
      officialMinutes: 78,
      legStops: 28,
      totalStops: 33,
      legKm: 33,
      totalKm: 37,
    });
    expect(minutes).toBeGreaterThan(50);
  });

  it('市区短途不应被高估', () => {
    // 真实市区慢线量级：全程 45 分钟 / 11 公里 / 20 站，乘坐 4 站 2.4 公里
    const minutes = estimateRideMinutes({
      officialMinutes: 45,
      legStops: 4,
      totalStops: 20,
      legKm: 2.4,
      totalKm: 11,
    });
    expect(minutes).toBeGreaterThanOrEqual(6);
    expect(minutes).toBeLessThanOrEqual(16);
  });

  it('平均速度上限兜底：任何区间都不可能超过 70 公里/小时', () => {
    const minutes = estimateRideMinutes({
      officialMinutes: 30,
      legStops: 35,
      totalStops: 40,
      legKm: 40,
      totalKm: 45,
    });
    expect(minutes).toBeGreaterThanOrEqual(Math.floor((40 / 70) * 60));
  });

  it('零里程零站数返回 0', () => {
    expect(estimateRideMinutes({ legStops: 0, totalStops: 10, legKm: 0, totalKm: 10 })).toBe(0);
  });
});

// ============================================================
// 港铁线网：真实线路与换乘
// ============================================================

describe('planMtrJourney（静态线网寻路）', () => {
  it('中环→迪士尼必须经欣澳换乘迪士尼线，不能声称直达', () => {
    const journey = planMtrJourney('中环', '迪士尼');
    expect(journey).not.toBeNull();
    const legs = journey!.legs;

    expect(legs.length).toBeGreaterThanOrEqual(2);
    expect(legs[legs.length - 1].lineId).toBe('DRL');
    expect(legs.some((l) => l.to === '欣澳' || l.from === '欣澳')).toBe(true);
    expect(journey!.totalMinutes).toBeGreaterThan(20);
    expect(journey!.totalMinutes).toBeLessThan(60);
  });

  it('屯门→中环必须换乘，且耗时超过 35 分钟', () => {
    const journey = planMtrJourney('屯门', '中环');
    expect(journey).not.toBeNull();
    const legs = journey!.legs;

    expect(legs.length).toBeGreaterThanOrEqual(2);
    expect(legs[0].lineId).toBe('TML');
    // 屯马线不到中环，必须换荃湾线/东涌线/港岛线之一
    expect(legs.some((l) => ['TWL', 'TCL', 'ISL'].includes(l.lineId))).toBe(true);
    expect(journey!.transferMinutes).toBeGreaterThan(0);
    expect(journey!.totalMinutes).toBeGreaterThan(35);
  });

  it('香港机场→中环经香港站步行通道连通，不虚构铁路直达', () => {
    const journey = planMtrJourney('香港机场', '中环');
    expect(journey).not.toBeNull();
    expect(journey!.legs[0].lineId).toBe('AEL');
    const walkSteps = journey!.transferSteps.filter((s) => s.type === 'walk');
    expect(walkSteps.length).toBe(1);
    expect(walkSteps[0].station).toBe('香港');
    expect(walkSteps[0].toStation).toBe('中环');
    expect(walkSteps[0].minutes).toBe(6);
  });

  it('纯站外步行可达（旺角东→旺角）不产出港铁方案', () => {
    expect(planMtrJourney('旺角东', '旺角')).toBeNull();
  });

  it('马场→旺角不能给出「东铁线直达旺角站」的单段行程', () => {
    const journey = planMtrJourney('马场', '旺角');
    if (!journey) return;
    const singleEalToMongkok =
      journey.legs.length === 1 && journey.legs[0].lineId === 'EAL' && journey.legs[0].to === '旺角';
    expect(singleEalToMongkok).toBe(false);
  });

  it('罗湖→落马洲经上水转落马洲支线（2 段）', () => {
    const journey = planMtrJourney('罗湖', '落马洲');
    expect(journey).not.toBeNull();
    expect(journey!.legs.length).toBe(2);
    expect(journey!.legs[0].lineId).toBe('EAL');
    expect(journey!.legs[1].lineId).toBe('EAL_LMC');
  });

  it('同站或不存在的车站返回 null（禁止自行推断直达）', () => {
    expect(planMtrJourney('中环', '中环')).toBeNull();
    expect(planMtrJourney('不存在的地方', '中环')).toBeNull();
  });

  it('线网覆盖 11 条线路且站序无空值', () => {
    expect(MTR_LINES.length).toBe(11);
    for (const line of MTR_LINES) {
      expect(line.stations.length).toBeGreaterThanOrEqual(2);
      expect(line.stations.every((s) => typeof s === 'string' && s.length > 0)).toBe(true);
    }
  });
});

// ============================================================
// 输出渲染：多段港铁逐线成步
// ============================================================

function mtrCandidate(over: Partial<TransitCandidate> = {}): TransitCandidate {
  return {
    company: 'MTR',
    mode: 'mtr',
    route: '荃湾线 → 东涌线 → 迪士尼线',
    bound: 'O',
    serviceType: '1',
    boardStopId: 'mtr-中环',
    boardStopName: '中环站',
    boardSeq: 1,
    alightStopId: 'mtr-迪士尼',
    alightStopName: '迪士尼站',
    alightSeq: 12,
    numStops: 11,
    walkInMeters: 240,
    walkOutMeters: 160,
    destination: '迪士尼站',
    fare: 27,
    score: 40,
    rideMinutes: 34,
    mtrLegs: [
      { lineId: 'TWL', lineName: '荃湾线', from: '中环', to: '荔景', stops: 5, minutes: 12 },
      { lineId: 'TCL', lineName: '东涌线', from: '荔景', to: '欣澳', stops: 3, minutes: 9 },
      { lineId: 'DRL', lineName: '迪士尼线', from: '欣澳', to: '迪士尼', stops: 1, minutes: 4 },
    ],
    mtrTransferSteps: [
      { type: 'transfer', station: '荔景', minutes: 4, label: '荔景站内换乘（约4分钟）' },
      { type: 'transfer', station: '欣澳', minutes: 4, label: '欣澳站内换乘（约4分钟）' },
    ],
    ...over,
  };
}

describe('transitCandidateToRouteOption（港铁多段渲染）', () => {
  it('每条线路单独成步，换乘动作插在段间', () => {
    const route = transitCandidateToRouteOption(mtrCandidate());

    expect(route.type).toBe('transfer');
    const rideSteps = route.steps.filter((s) => s.type === 'mtr' && s.route !== undefined);
    expect(rideSteps.length).toBe(3);
    expect(rideSteps.map((s) => s.route)).toEqual(['荃湾线', '东涌线', '迪士尼线']);
    expect(rideSteps.map((s) => s.duration)).toEqual([12, 9, 4]);
    expect(rideSteps[0].description).toContain('中环 → 荔景');
    expect(rideSteps[2].description).toContain('欣澳 → 迪士尼');

    const labels = route.steps.map((s) => s.description).join(' | ');
    expect(labels).toContain('荔景站内换乘');
    expect(labels).toContain('欣澳站内换乘');
  });

  it('总时长使用规划阶段真实车程，不再按站数硬套', () => {
    const route = transitCandidateToRouteOption(mtrCandidate());
    // 步行 3 + 候车 0 + 车程 34 + 步行 2
    expect(route.totalTime).toBe(39);
  });

  it('单段港铁仍标记为直达', () => {
    const route = transitCandidateToRouteOption(
      mtrCandidate({
        rideMinutes: 15,
        mtrLegs: [{ lineId: 'TWL', lineName: '荃湾线', from: '金钟', to: '中环', stops: 1, minutes: 2 }],
        mtrTransferSteps: [],
      })
    );
    expect(route.type).toBe('direct');
    expect(route.steps.filter((s) => s.type === 'mtr').length).toBe(1);
  });

  it('巴士候选使用 rideMinutes 而非站数估算', () => {
    const cand: TransitCandidate = {
      company: 'CTB',
      mode: 'bus',
      route: '962',
      bound: 'O',
      serviceType: '1',
      boardStopId: 'CTB-001',
      boardStopName: '屯门码头',
      boardSeq: 1,
      alightStopId: 'CTB-030',
      alightStopName: '中环',
      alightSeq: 30,
      numStops: 29,
      walkInMeters: 160,
      walkOutMeters: 80,
      destination: '中环',
      fare: 21.5,
      score: 60,
      rideMinutes: 68,
    };
    const route = transitCandidateToRouteOption(cand);
    const busStep = route.steps.find((s) => s.type === 'bus')!;
    expect(busStep.duration).toBe(68);
    expect(route.totalTime).toBe(2 + 68 + 1);
  });
});

// ============================================================
// 实时注入：车程取候选真实值
// ============================================================

describe('enrichCandidateWithRealTimeETA（车程来源）', () => {
  const base: TransitCandidate = {
    company: 'GMB',
    mode: 'gmb',
    route: '1',
    bound: 'O',
    serviceType: '1',
    boardStopId: 'GMB-001',
    boardStopName: '上车站',
    boardSeq: 1,
    alightStopId: 'GMB-020',
    alightStopName: '下车站',
    alightSeq: 20,
    numStops: 19,
    walkInMeters: 400,
    walkOutMeters: 400,
    destination: '终点站',
    fare: 8,
    score: 30,
  };

  it('有 rideMinutes 时优先使用（小巴无实时接口，走静态候车 5 分钟）', async () => {
    const enriched = await enrichCandidateWithRealTimeETA({ ...base, rideMinutes: 45 });
    expect(enriched.realTimeETA?.estimatedTripMinutes).toBe(45);
    // 步行 5 + 候车 5 + 车程 45 + 步行 5
    expect(enriched.realTimeETA?.totalMinutes).toBe(60);
  });

  it('缺少 rideMinutes 时才退回站数估算', async () => {
    const enriched = await enrichCandidateWithRealTimeETA({ ...base, numStops: 10, rideMinutes: undefined });
    expect(enriched.realTimeETA?.estimatedTripMinutes).toBe(15);
  });
});

// ============================================================
// 港铁票价：机场快线票价是普通港铁的十倍量级，不能按直线距离估算
// ============================================================

describe('港铁票价估算', () => {
  const MONG_KOK = { lat: 22.3193, lng: 114.1694 };
  const AIRPORT = { lat: 22.313642, lng: 113.937089 };
  const TST = { lat: 22.2783, lng: 114.1747 };

  it('旺角→机场走机场快线时票价应在 HK$70 以上（旧算法只算出 HK$30）', async () => {
    const res = await planPublicTransit(MONG_KOK.lat, MONG_KOK.lng, AIRPORT.lat, AIRPORT.lng);
    const mtr = res.candidates.find((c) => c.mode === 'mtr');
    expect(mtr).toBeDefined();
    expect(mtr!.mtrLegs?.some((leg) => leg.lineId === 'AEL')).toBe(true);
    expect(mtr!.fare).toBeGreaterThanOrEqual(70);
  });

  it('不含机场快线的市区行程仍是普通港铁票价量级', async () => {
    const res = await planPublicTransit(MONG_KOK.lat, MONG_KOK.lng, TST.lat, TST.lng);
    const mtr = res.candidates.find((c) => c.mode === 'mtr');
    expect(mtr).toBeDefined();
    expect(mtr!.mtrLegs?.some((leg) => leg.lineId === 'AEL')).toBe(false);
    expect(mtr!.fare).toBeLessThanOrEqual(30);
  });
});
