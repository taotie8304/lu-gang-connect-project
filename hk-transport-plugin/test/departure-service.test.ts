// 鲁港通 - 交通 D 类整改验收测试（bench5 D 类翻盘）
// 覆盖：P0-1 出发时刻 / P0-2 服务期与收车诚实化 / P0-3 方向真实终点 /
//       P0-4 门到门与车程 / P1-1 备选保障 / P1-2 票价来源

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyService } from '../src/service-window';
import { parseDepartureAt, extractDepartureTime, resolveDeparture } from '../src/parser';
import { planPublicTransit } from '../src/planner';
import { formatNextBusArrival } from '../src/eta';
import { transitCandidateToRouteOption, generateTips } from '../src/integrator';
import { buildRouteOptions, OutputType } from '../src/index';
import { enrichCandidateWithRealTimeETA, cache } from '../src/fetcher';
import { TRANSIT_DATA } from '../src/data/transit';
import type { TransitCandidate } from '../src/types';

// 香港时间构造（HKT 无夏令时，UTC+8 固定偏移）
function hk(y: number, mo: number, d: number, h: number, mi = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - 8 * 3600 * 1000);
}

// 2026-11-25 周三 / 2026-11-28 周六
const WED_NOON = hk(2026, 11, 25, 12, 0);
const WED_4AM = hk(2026, 11, 25, 4, 0);
const THU_2AM = hk(2026, 11, 26, 2, 0);
const SAT_10AM = hk(2026, 11, 28, 10, 0);

const TST_PIER = { lat: 22.294114, lng: 114.169062 };
const AIRPORT_GTC = { lat: 22.313642, lng: 113.937089 };
const TUEN_MUN = { lat: 22.3934, lng: 113.9729 };
const CENTRAL = { lat: 22.2819, lng: 114.1583 };
const TAI_PO = { lat: 22.4468, lng: 114.17 };
const YUEN_LONG = { lat: 22.4445, lng: 114.0348 };
const MONG_KOK = { lat: 22.3193, lng: 114.1694 };
const TST = { lat: 22.2783, lng: 114.1747 };

function makeCandidate(over: Partial<TransitCandidate> = {}): TransitCandidate {
  return {
    company: 'KMB',
    mode: 'bus',
    route: '960',
    bound: 'O',
    serviceType: '1',
    boardStopId: 'S1',
    boardStopName: '屯门站',
    boardSeq: 3,
    alightStopId: 'S2',
    alightStopName: '会展站',
    alightSeq: 25,
    numStops: 22,
    walkInMeters: 240,
    walkOutMeters: 160,
    destination: '会展站',
    fare: 24.1,
    score: 50,
    rideMinutes: 55,
    ...over,
  };
}

// ============================================================
// P0-2 服务期判定（按出发时刻，而不是按「现在」）
// ============================================================

describe('classifyService（按出发时刻判定线路是否在服务期）', () => {
  it('常规线路 04:00 已收车，05:30 起恢复', () => {
    const before = classifyService('960', 'bus', WED_4AM);
    expect(before.status).toBe('out-of-service');
    expect(before.note).toContain('收车');

    const after = classifyService('960', 'bus', hk(2026, 11, 25, 5, 30));
    expect(after.status).toBe('in-service');
  });

  it('常规线路跨午夜窗口：00:15 仍在服务，00:45 已收车', () => {
    expect(classifyService('960', 'bus', hk(2026, 11, 25, 0, 15)).status).toBe('in-service');
    expect(classifyService('960', 'bus', hk(2026, 11, 25, 0, 45)).status).toBe('out-of-service');
  });

  it('通宵线深夜服务、白天停开', () => {
    expect(classifyService('N21', 'bus', THU_2AM).status).toBe('in-service');
    const day = classifyService('N21', 'bus', WED_NOON);
    expect(day.status).toBe('out-of-service');
  });

  it('R 字尾假日专线：平日停开、周六服务需确认当日安排', () => {
    const weekday = classifyService('92R', 'bus', WED_NOON);
    expect(weekday.status).toBe('out-of-service');
    expect(weekday.note).toContain('假日');

    const weekend = classifyService('92R', 'bus', SAT_10AM);
    expect(weekend.status).toBe('in-service');
    expect(weekend.note).toContain('公众假期');
  });

  it('港铁服务窗口约 05:30–01:00', () => {
    expect(classifyService('荃湾线', 'mtr', hk(2026, 11, 25, 0, 45)).status).toBe('in-service');
    expect(classifyService('荃湾线', 'mtr', hk(2026, 11, 25, 3, 0)).status).toBe('out-of-service');
    expect(classifyService('荃湾线', 'mtr', hk(2026, 11, 25, 5, 45)).status).toBe('in-service');
  });

  it('小巴 S 字尾不可静态判定，标 unverified 而非收车', () => {
    expect(classifyService('61S', 'gmb', WED_4AM).status).toBe('unverified');
  });
});

// ============================================================
// P0-1 出发时刻解析（明早5点 / 凌晨0:30）
// ============================================================

describe('出发时刻解析', () => {
  it('仅给 HH:mm 且已过，视为次日', () => {
    const now = hk(2026, 11, 27, 23, 0);
    expect(parseDepartureAt('05:00', now)?.getTime()).toBe(hk(2026, 11, 28, 5, 0).getTime());
  });

  it('无时区的日期时刻按香港时间解释', () => {
    const at = parseDepartureAt('2026-11-28 05:00');
    expect(at?.getTime()).toBe(hk(2026, 11, 28, 5, 0).getTime());
  });

  it('自然语言：明天早上5点', () => {
    const now = hk(2026, 11, 27, 23, 0);
    expect(extractDepartureTime('明天早上5点从屯门出发到机场', now).at?.getTime())
      .toBe(hk(2026, 11, 28, 5, 0).getTime());
  });

  it('自然语言：凌晨0:30 视为次日凌晨', () => {
    const now = hk(2026, 11, 27, 22, 0);
    expect(extractDepartureTime('凌晨0:30从机场到市区怎么走', now).at?.getTime())
      .toBe(hk(2026, 11, 28, 0, 30).getTime());
  });

  it('自然语言：下午3点半 = 15:30', () => {
    const now = hk(2026, 11, 27, 9, 0);
    expect(extractDepartureTime('下午3点半出发', now).at?.getTime())
      .toBe(hk(2026, 11, 27, 15, 30).getTime());
  });

  it('没有时刻词时不臆造出发时间', () => {
    const now = hk(2026, 11, 27, 22, 0);
    expect(extractDepartureTime('从屯门到机场怎么走', now).at).toBeUndefined();
    const resolved = resolveDeparture(undefined, '现在从屯门到机场', now);
    expect(resolved.explicit).toBe(false);
    expect(resolved.at.getTime()).toBe(now.getTime());
  });

  it('结构化 departAt 优先于文本解析', () => {
    const now = hk(2026, 11, 27, 22, 0);
    const resolved = resolveDeparture('2026-11-28 05:00', '明天早上8点出发', now);
    expect(resolved.explicit).toBe(true);
    expect(resolved.at.getTime()).toBe(hk(2026, 11, 28, 5, 0).getTime());
  });
});

// ============================================================
// P0-2 / P0-3 规划器：服务期过滤 + 真实方向终点（真实数据）
// ============================================================

/** 从内置数据独立推算某 rid+方向 的末站名（不复用被测实现） */
function expectedTerminal(mode: string, rid: number, seq: number): string | undefined {
  const md = (TRANSIT_DATA as Record<string, { stops: Array<{ sid: number; name: string }>; routeStops: Array<{ rid: number; seq: number; sseq: number; sid: number }> }>)[mode];
  if (!md) return undefined;
  const rows = md.routeStops.filter((r) => r.rid === rid && r.seq === seq).sort((a, b) => a.sseq - b.sseq);
  const last = rows[rows.length - 1];
  return last ? md.stops.find((s) => s.sid === last.sid)?.name : undefined;
}

describe('planPublicTransit 服务期过滤', () => {
  it('白天 12:00：通宵线整列排除并记录在 excludedServiceRoutes', async () => {
    const res = await planPublicTransit(TST_PIER.lat, TST_PIER.lng, AIRPORT_GTC.lat, AIRPORT_GTC.lng, {
      departure: WED_NOON,
    });
    expect(res.candidates.length).toBeGreaterThan(0);
    expect(res.candidates.some((c) => c.isOvernight)).toBe(false);
    expect(res.excludedServiceRoutes?.some((e) => /^N/.test(e.route))).toBe(true);
  });

  it('深夜 02:00：通宵线在服务且在候选池', async () => {
    const res = await planPublicTransit(TST_PIER.lat, TST_PIER.lng, AIRPORT_GTC.lat, AIRPORT_GTC.lng, {
      departure: THU_2AM,
    });
    expect(res.candidates.some((c) => c.isOvernight)).toBe(true);
  });

  it('凌晨 04:00 无通宵覆盖的 OD：不出已收车日间线，excluded 说明收车', async () => {
    const res = await planPublicTransit(TAI_PO.lat, TAI_PO.lng, YUEN_LONG.lat, YUEN_LONG.lng, {
      departure: WED_4AM,
    });
    expect(res.candidates.length).toBe(0);
    expect(res.excludedServiceRoutes?.length).toBeGreaterThan(0);
    expect(res.excludedServiceRoutes?.some((e) => e.reason.includes('收车'))).toBe(true);
  });

  it('白天有解场景给出至少 2 条备选方案（P1-1）', async () => {
    const res = await planPublicTransit(TUEN_MUN.lat, TUEN_MUN.lng, CENTRAL.lat, CENTRAL.lng, {
      departure: WED_NOON,
    });
    expect(res.candidates.length).toBeGreaterThanOrEqual(2);
  });
});

describe('P0-3 方向真实终点', () => {
  it('巴士候选的 directionLabel 等于该方向实际末站，而非路线元信息终点', async () => {
    const res = await planPublicTransit(TUEN_MUN.lat, TUEN_MUN.lng, CENTRAL.lat, CENTRAL.lng, {
      departure: WED_NOON,
    });
    const buses = res.candidates.filter((c) => c.mode === 'bus' && typeof c.rid === 'number');
    expect(buses.length).toBeGreaterThan(0);
    for (const c of buses) {
      const seq = c.bound === 'O' ? 1 : 2;
      const expected = expectedTerminal('bus', c.rid!, seq);
      expect(c.directionLabel, `${c.route} 方向终点`).toBe(expected);
    }
  });

  it('渲染层使用 directionLabel（往 X），不把另一方向的终点写进方案', () => {
    const route = transitCandidateToRouteOption(
      makeCandidate({ destination: '湾仔北（另一方向）', directionLabel: '屯门（建生）' })
    );
    const ride = route.steps.find((s) => s.type === 'bus')!;
    expect(ride.description).toContain('屯门（建生）');
    expect(ride.description).not.toContain('湾仔北（另一方向）');
    expect(ride.routeDetail).toContain('屯门（建生）');
  });
});

// ============================================================
// P0-4 门到门与车程
// ============================================================

describe('门到门总时长与车程分离', () => {
  it('buildRouteOptions 同时给出 doorToDoorMinutes 与 inVehicleMinutes', () => {
    const routes = buildRouteOptions([
      makeCandidate({
        realTimeETA: {
          nextBusMinutes: 5,
          estimatedTripMinutes: 55,
          totalMinutes: 68,
          dataSource: 'kmb',
          timestamp: '2026-11-25T04:00:00.000Z',
        },
      }),
    ]);
    expect(routes[0].totalTime).toBe(68);
    expect(routes[0].doorToDoorMinutes).toBe(68);
    expect(routes[0].inVehicleMinutes).toBe(55);
    expect(routes[0].doorToDoorMinutes!).toBeGreaterThanOrEqual(routes[0].inVehicleMinutes!);
  });
});

// ============================================================
// P1-2 票价来源
// ============================================================

describe('票价来源与估算标记', () => {
  it('巴士/小巴票价来自 data.gov.hk 全程票价，标记非估算', async () => {
    const res = await planPublicTransit(TUEN_MUN.lat, TUEN_MUN.lng, CENTRAL.lat, CENTRAL.lng, {
      departure: WED_NOON,
    });
    const bus = res.candidates.find((c) => c.mode === 'bus' && typeof c.fare === 'number');
    expect(bus).toBeDefined();
    expect(bus!.fareIsEstimate).toBe(false);
    expect(bus!.fareSource).toContain('data.gov.hk');
  });

  it('普通港铁距离公式票价标记为估算；机场快线按官方票价表', async () => {
    const toAirport = await planPublicTransit(MONG_KOK.lat, MONG_KOK.lng, AIRPORT_GTC.lat, AIRPORT_GTC.lng, {
      departure: WED_NOON,
    });
    const ael = toAirport.candidates.find((c) => c.mode === 'mtr' && c.mtrLegs?.some((l) => l.lineId === 'AEL'));
    expect(ael).toBeDefined();
    expect(ael!.fareIsEstimate).toBe(false);
    expect(ael!.fareSource).toContain('机场快线');

    const city = await planPublicTransit(MONG_KOK.lat, MONG_KOK.lng, TST.lat, TST.lng, {
      departure: WED_NOON,
    });
    const mtr = city.candidates.find((c) => c.mode === 'mtr');
    expect(mtr).toBeDefined();
    expect(mtr!.fareIsEstimate).toBe(true);
  });
});

// ============================================================
// P0-2 ETA 诚实化（不得虚构 2/5 分钟候车）
// ============================================================

describe('ETA 诚实化与方向过滤', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('无班次时措辞为「暂无班次信息（可能已收车）」', () => {
    expect(formatNextBusArrival(-1, 'static')).toBe('暂无班次信息（可能已收车）');
  });

  it('KMB 只有反方向数据时不得用于候车，保持无数据', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        type: 'ETA', version: '1.0',
        data: [{
          co: 'KMB', route: '960', dir: 'I', service_type: '1', seq: 1,
          dest_tc: '屯门（建生）', dest_sc: '', dest_en: '',
          eta: new Date(Date.now() + 5 * 60000).toISOString(),
          rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
        }],
      }), { status: 200 })
    );

    const enriched = await enrichCandidateWithRealTimeETA(makeCandidate({ bound: 'O' }));
    expect(enriched.realTimeETA?.nextBusMinutes).toBe(-1);
    expect(enriched.realTimeETA?.dataSource).toBe('static');
    // 步行 3 + 无候车 + 车程 55 + 步行 2
    expect(enriched.realTimeETA?.totalMinutes).toBe(60);
  });

  it('KMB 同方向数据正常采用', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        type: 'ETA', version: '1.0',
        data: [{
          co: 'KMB', route: '960', dir: 'O', service_type: '1', seq: 3,
          dest_tc: '湾仔北', dest_sc: '', dest_en: '',
          eta: new Date(Date.now() + 5 * 60000).toISOString(),
          rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
        }],
      }), { status: 200 })
    );

    const enriched = await enrichCandidateWithRealTimeETA(makeCandidate({ bound: 'O' }));
    expect(enriched.realTimeETA?.nextBusMinutes).toBeGreaterThanOrEqual(4);
    expect(enriched.realTimeETA?.nextBusMinutes).toBeLessThanOrEqual(6);
    expect(enriched.realTimeETA?.dataSource).toBe('kmb');
  });

  it('小巴没有实时接口，保留静态估算并标注估算来源', async () => {
    const enriched = await enrichCandidateWithRealTimeETA(
      makeCandidate({ company: 'GMB', mode: 'gmb', route: '1' })
    );
    expect(enriched.realTimeETA?.nextBusMinutes).toBe(5);
    expect(enriched.realTimeETA?.dataSource).toBe('static');
  });

  it('港铁查不到时刻表时不虚构 2 分钟候车', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 1, message: 'ok', sys_time: '', curr_time: '', data: {} }), { status: 200 })
    );
    const enriched = await enrichCandidateWithRealTimeETA(
      makeCandidate({ company: 'MTR', mode: 'mtr', route: '荃湾线', stationCode: 'CEN', mtrLine: 'TWL' })
    );
    expect(enriched.realTimeETA?.nextBusMinutes).toBe(-1);
    expect(enriched.realTimeETA?.dataSource).toBe('static');
  });

  it('无班次信息时生成注意事项，说明总时长未含候车', () => {
    const route = transitCandidateToRouteOption(makeCandidate());
    route.realTimeData = {
      nextBusArrival: '暂无班次信息（可能已收车）',
      totalTravelTime: 60,
      dataTimestamp: '2026-11-26T18:00:00.000Z',
      dataBasis: 'estimate',
    };
    const tips = generateTips([route]);
    expect(tips.some((t) => t.includes('可能已收车'))).toBe(true);
  });
});

// ============================================================
// 输出 schema 兼容新字段
// ============================================================

describe('outputSchema 接受门到门/票价来源字段', () => {
  it('RouteOptionSchema 不剥离新字段', () => {
    const sample = {
      routes: [{
        id: 'r1',
        totalTime: 68,
        totalDistance: '22 站 + 步行 0.40 公里',
        type: 'direct',
        steps: [{ type: 'bus', description: '乘 960（往 湾仔北）', duration: 60 }],
        estimatedCost: 24.1,
        doorToDoorMinutes: 68,
        inVehicleMinutes: 55,
        fareIsEstimate: false,
        fareSource: 'data.gov.hk 路线票价（全程）',
      }],
      paymentInfo: { octopus: true, cash: true, creditCard: false, mobilePayment: true, notes: [] },
      tips: [],
      metadata: { dataTimestamp: '2026-11-25T04:00:00.000Z', apisCalled: ['transit-planner'] },
    };
    const parsed = OutputType.safeParse(sample);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.routes[0].doorToDoorMinutes).toBe(68);
      expect(parsed.data.routes[0].fareSource).toContain('data.gov.hk');
    }
  });
});