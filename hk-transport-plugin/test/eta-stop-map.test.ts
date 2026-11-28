// 鲁港通 - 实时到站站点映射：data.gov.hk 路线数据集的 sid 与九巴 ETA 接口不互通，
// 必须按站名+坐标解析九巴哈希站 ID；解析不到时如实返回无实时数据

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cache, resolveKMBStopId, resolveKMBStopByRouteSeq, resolveCTBStopByRouteSeq, enrichCandidateWithRealTimeETA } from '../src/fetcher';
import { formatNextBusArrival } from '../src/eta';
import type { TransitCandidate } from '../src/types';

const KMB_STOPS = {
  type: 'Stop',
  version: '1.0',
  data: [
    { stop: 'AAA0000000000001', name_en: 'TUEN MUN CENTRAL', name_tc: '屯門市中心總站', name_sc: '屯门市中心总站', lat: '22.3912', long: '113.9759' },
    { stop: 'AAA0000000000002', name_en: 'TUEN MUN CENTRAL', name_tc: '屯門市中心總站', name_sc: '屯门市中心总站', lat: '22.4000', long: '113.9900' },
    { stop: 'AAA0000000000003', name_en: 'HOI WONG', name_tc: '海皇路', name_sc: '海皇路', lat: '22.3920', long: '113.9760' }
  ]
};

const etaIn = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();

function mockFetch(etaMinutes: number | null) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/v1/transport/kmb/stop')) {
      return new Response(JSON.stringify(KMB_STOPS), { status: 200 });
    }
    if (url.includes('/v1/transport/kmb/stop-eta/')) {
      const data = etaMinutes === null
        ? []
        : [{ co: 'KMB', route: '960', dir: 'O', service_type: 1, seq: 1, dest_tc: '會展站', dest_sc: '会展站', dest_en: 'EXHIBITION CENTRE', eta: etaIn(etaMinutes), eta_seq: 1, rmk_tc: '', rmk_sc: '', rmk_en: '', data_timestamp: '' }];
      return new Response(JSON.stringify({ type: 'StopETA', version: '1.0', data }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

function candidate(over: Partial<TransitCandidate> = {}): TransitCandidate {
  return {
    company: 'KMB',
    mode: 'bus',
    route: '960',
    bound: 'O',
    serviceType: '1',
    boardStopId: '9784',
    boardStopName: '屯門市中心總站',
    boardStopLat: 22.3913,
    boardStopLng: 113.9758,
    boardSeq: 1,
    alightStopId: '1000',
    alightStopName: '會展站巴士總站',
    alightSeq: 20,
    numStops: 19,
    walkInMeters: 80,
    walkOutMeters: 80,
    destination: '會展站',
    fare: 24,
    score: 40,
    rideMinutes: 55,
    ...over
  };
}

describe('九巴站点解析：数字 sid 不可直接查 ETA', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('按站名+坐标匹配到最近的九巴哈希站 ID', async () => {
    mockFetch(10);
    const id = await resolveKMBStopId('屯門市中心總站', 22.3913, 113.9758);
    expect(id).toBe('AAA0000000000001');
  });

  it('同名站距离均过远时不返回站点（避免串站）', async () => {
    mockFetch(10);
    const id = await resolveKMBStopId('屯門市中心總站', 22.5000, 114.2000);
    expect(id).toBeNull();
  });

  it('站名不存在时返回 null', async () => {
    mockFetch(10);
    const id = await resolveKMBStopId('不存在的车站', 22.3913, 113.9758);
    expect(id).toBeNull();
  });

  it('候选路线带坐标时能取到实时到站分钟数', async () => {
    mockFetch(10);
    const enriched = await enrichCandidateWithRealTimeETA(candidate());
    expect(enriched.realTimeETA.dataSource).toBe('kmb');
    expect(enriched.realTimeETA.nextBusMinutes).toBeGreaterThanOrEqual(9);
    expect(enriched.realTimeETA.nextBusMinutes).toBeLessThanOrEqual(11);
  });

  it('解析不到站点时如实返回无实时数据（-1），不虚构候车', async () => {
    mockFetch(10);
    const enriched = await enrichCandidateWithRealTimeETA(candidate({ boardStopName: '不存在的车站' }));
    expect(enriched.realTimeETA.nextBusMinutes).toBe(-1);
    expect(enriched.realTimeETA.dataSource).toBe('static');
  });

  it('该站该方向暂无班次时返回 -1', async () => {
    mockFetch(null);
    const enriched = await enrichCandidateWithRealTimeETA(candidate());
    expect(enriched.realTimeETA.nextBusMinutes).toBe(-1);
  });
});

describe('路线序号定位：站名带总站后缀差异时按 KMB 路线站点表取真实站 ID', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  function mockRouteSeq(seqHit: number | null, etaMinutes: number | null) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/transport/kmb/route-stop/')) {
        const data = seqHit === null ? [
          { route: 'A33X', bound: 'O', service_type: '1', seq: '1', stop: 'OTHER1' }
        ] : [
          { route: 'A33X', bound: 'O', service_type: '1', seq: '1', stop: 'OTHER1' },
          { route: 'A33X', bound: 'O', service_type: '1', seq: String(seqHit), stop: 'A859FDC2ED9ECEA1' }
        ];
        return new Response(JSON.stringify({ type: 'RouteStop', version: '1.0', data }), { status: 200 });
      }
      if (url.endsWith('/v1/transport/kmb/stop')) {
        return new Response(JSON.stringify(KMB_STOPS), { status: 200 });
      }
      if (url.includes('/v1/transport/kmb/stop-eta/')) {
        const data = etaMinutes === null ? [] : [{
          co: 'LWB', route: 'A33X', dir: 'O', service_type: 1, seq: 9, dest_tc: '機場', dest_sc: '机场', dest_en: 'AIRPORT',
          eta: etaIn(etaMinutes), eta_seq: 1, rmk_tc: '', rmk_sc: '', rmk_en: '', data_timestamp: ''
        }];
        return new Response(JSON.stringify({ type: 'StopETA', version: '1.0', data }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
  }

  it('按路线+方向+序号取到哈希站 ID', async () => {
    mockRouteSeq(9, 10);
    const id = await resolveKMBStopByRouteSeq('A33X', 'O', '1', 9);
    expect(id).toBe('A859FDC2ED9ECEA1');
  });

  it('序号不存在时返回 null（交由站名回退）', async () => {
    mockRouteSeq(null, 10);
    const id = await resolveKMBStopByRouteSeq('A33X', 'O', '1', 9);
    expect(id).toBeNull();
  });

  it('龙运候选即使站名带总站后缀差异也能取到实时到站', async () => {
    mockRouteSeq(9, 10);
    const enriched = await enrichCandidateWithRealTimeETA(candidate({
      company: 'LWB',
      mode: 'bus',
      route: 'A33X',
      bound: 'O',
      boardStopName: '屯門市中心總站',
      boardStopLat: 22.3913,
      boardStopLng: 113.9758,
      boardSeq: 9
    }));
    expect(enriched.realTimeETA.dataSource).toBe('lwb');
    expect(enriched.realTimeETA.nextBusMinutes).toBeGreaterThanOrEqual(9);
    expect(enriched.realTimeETA.nextBusMinutes).toBeLessThanOrEqual(11);
  });
});

describe('城巴站点解析：数据集 sid 对城巴接口同样无效', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  function mockCTB(etaMinutes: number | null) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v2/transport/citybus/route-stop/CTB/')) {
        return new Response(JSON.stringify({
          type: 'RouteStop', version: '1.0',
          data: [
            { co: 'CTB', route: '973', dir: 'O', seq: 1, stop: '001540' },
            { co: 'CTB', route: '973', dir: 'O', seq: 5, stop: '002731' }
          ]
        }), { status: 200 });
      }
      if (url.includes('/v2/transport/citybus/eta/CTB/')) {
        const data = etaMinutes === null ? [] : [{
          co: 'CTB', route: '973', dir: 'O', eta: etaIn(etaMinutes),
          dest_tc: '赤柱村', dest_sc: '赤柱村', dest_en: 'STANLEY VILLAGE',
          seq: 5, rmk_tc: '', rmk_sc: '', rmk_en: '', data_timestamp: ''
        }];
        return new Response(JSON.stringify({ type: 'ETA', version: '1.0', data }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
  }

  it('按路线+方向+序号取到城巴站点 ID', async () => {
    mockCTB(8);
    const id = await resolveCTBStopByRouteSeq('973', 'O', 5);
    expect(id).toBe('002731');
  });

  it('城巴候选带序号时取到实时到站', async () => {
    mockCTB(8);
    const enriched = await enrichCandidateWithRealTimeETA(candidate({
      company: 'CTB',
      route: '973',
      bound: 'O',
      boardSeq: 5,
      boardStopName: '尖沙咀東'
    }));
    expect(enriched.realTimeETA.dataSource).toBe('ctb');
    expect(enriched.realTimeETA.nextBusMinutes).toBeGreaterThanOrEqual(7);
    expect(enriched.realTimeETA.nextBusMinutes).toBeLessThanOrEqual(9);
  });
});

describe('无实时数据措辞：不得断言已收车', () => {
  it('无数据时只说明暂无实时到站数据', () => {
    expect(formatNextBusArrival(-1, 'static')).toBe('暂无实时到站数据');
  });
});