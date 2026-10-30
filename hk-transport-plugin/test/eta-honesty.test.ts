// 鲁港通 - 交通 ETA 诚实化与事实口径测试
// 目标：静态兜底候车时间不得伪装成实时；运营商/票价/服务日口径不得误导模型

import { describe, it, expect } from 'vitest';
import {
  formatNextBusArrival,
  isEstimatedEta,
  ESTIMATE_TIP,
  companyLabel,
  routeServiceHint,
} from '../src/eta';
import { transitCandidateToRouteOption, generateTips } from '../src/integrator';
import { buildRouteOptions, buildRealTimeData, OutputType } from '../src/index';
import type { TransitCandidate } from '../src/types';

function busCandidate(over: Partial<TransitCandidate> = {}): TransitCandidate {
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

function etaOf(nextBusMinutes: number, dataSource: 'static' | 'kmb' | 'ctb' | 'mtr') {
  return {
    nextBusMinutes,
    estimatedTripMinutes: 40,
    totalMinutes: 40 + nextBusMinutes + 5,
    dataSource,
    timestamp: '2026-10-30T12:00:00.000Z',
  };
}

describe('候车时间措辞：估算 vs 实时', () => {
  it('静态兜底必须标注「估算」', () => {
    expect(formatNextBusArrival(5, 'static')).toBe('约5分钟（估算）');
    expect(formatNextBusArrival(0, 'static')).toBe('即将到达（估算）');
  });

  it('真实数据源不得加估算字样', () => {
    expect(formatNextBusArrival(5, 'kmb')).toBe('5分钟后');
    expect(formatNextBusArrival(2, 'mtr')).toBe('2分钟后');
    expect(formatNextBusArrival(0, 'ctb')).toBe('即将到达');
  });

  it('无数据与缺省来源都按估算处理', () => {
    expect(formatNextBusArrival(-1, 'static')).toBe('暂无数据');
    expect(isEstimatedEta(undefined)).toBe(true);
    expect(isEstimatedEta('static')).toBe(true);
    expect(isEstimatedEta('nlb')).toBe(false);
  });

  it('估算说明文案包含可操作指引', () => {
    expect(ESTIMATE_TIP).toContain('估算');
    expect(ESTIMATE_TIP).toContain('非实时');
  });
});

describe('运营商中文名', () => {
  it('常见公司代码转中文', () => {
    expect(companyLabel('KMB')).toBe('九巴');
    expect(companyLabel('CTB')).toBe('城巴');
    expect(companyLabel('LWB')).toBe('龙运巴士');
    expect(companyLabel('NLB')).toBe('屿巴');
    expect(companyLabel('GMB')).toBe('专线小巴');
    expect(companyLabel('MTR')).toBe('港铁');
    expect(companyLabel('TRAM')).toBe('香港电车');
    expect(companyLabel('FERRY')).toBe('渡轮');
  });

  it('联营线路与未知代码', () => {
    expect(companyLabel('KMB+CTB')).toBe('九巴/城巴联营');
    expect(companyLabel('XYZ')).toBe('XYZ');
    expect(companyLabel(undefined)).toBe('巴士');
  });
});

describe('服务日提示', () => {
  it('R 字尾提示假日/特别路线', () => {
    const hint = routeServiceHint('92R', 'bus');
    expect(hint).toContain('假日');
  });

  it('小巴 S 字尾提示通宵/特别班次', () => {
    const hint = routeServiceHint('61S', 'gmb');
    expect(hint).toContain('通宵');
    expect(routeServiceHint('805S', 'gmb')).toContain('通宵');
  });

  it('常规路线不额外提示', () => {
    expect(routeServiceHint('960', 'bus')).toBeUndefined();
    expect(routeServiceHint('973', 'bus')).toBeUndefined();
  });
});

describe('路线渲染：来源与票价口径', () => {
  it('静态候车在步骤文案里写「估算」', () => {
    const route = transitCandidateToRouteOption(
      busCandidate({ realTimeETA: etaOf(5, 'static') })
    );
    const ride = route.steps.find((s) => s.type === 'bus')!;
    expect(ride.description).toContain('估算');
    expect(ride.description).toContain('约5分钟');
    expect(ride.description).not.toContain('实时');
  });

  it('实时候车不加估算字样', () => {
    const route = transitCandidateToRouteOption(
      busCandidate({ realTimeETA: etaOf(5, 'kmb') })
    );
    const ride = route.steps.find((s) => s.type === 'bus')!;
    expect(ride.description).toContain('5分钟后');
    expect(ride.description).not.toContain('估算');
  });

  it('运营商用中文名，避免模型把 KMB 写成城巴', () => {
    const route = transitCandidateToRouteOption(busCandidate());
    const ride = route.steps.find((s) => s.type === 'bus')!;
    expect(ride.description).toContain('九巴');
    expect(ride.routeDetail).toContain('九巴');
    expect(ride.routeDetail).not.toContain('KMB');
  });

  it('巴士票价标注为全程票价', () => {
    const route = transitCandidateToRouteOption(busCandidate());
    expect(route.fareNote).toContain('全程票价');
    expect(route.fareNote).toContain('分段');
  });

  it('港铁不套用巴士票价口径', () => {
    const route = transitCandidateToRouteOption(
      busCandidate({ company: 'MTR', mode: 'mtr', fare: 27 })
    );
    expect(route.fareNote).toBeUndefined();
  });
});

describe('注意事项：不得宣称已查实时', () => {
  it('全为估算时不出现「已查询实时数据」', () => {
    const routes = buildRouteOptions([busCandidate({ realTimeETA: etaOf(5, 'static') })]);
    const tips = generateTips(routes, '屯门', '会展');
    expect(tips.some(t => t.includes('已查询实时数据'))).toBe(false);
    expect(tips.some(t => t.includes('估算'))).toBe(true);
  });

  it('真有实时数据时才说明，并与估算并存时限定范围', () => {
    const routes = buildRouteOptions([
      busCandidate({ realTimeETA: etaOf(5, 'static') }),
      busCandidate({ route: '961', realTimeETA: etaOf(3, 'kmb') }),
    ]);
    const tips = generateTips(routes, '屯门', '会展');
    const line = tips.find(t => t.includes('实时'));
    expect(line).toBeDefined();
    expect(line).toContain('部分路线');
    expect(line).toContain('估算');
  });
});

describe('输出层 realTimeData', () => {
  it('静态来源带 dataBasis=estimate', () => {
    const data = buildRealTimeData(etaOf(5, 'static'));
    expect(data.nextBusArrival).toBe('约5分钟（估算）');
    expect(data.dataBasis).toBe('estimate');
  });

  it('实时来源带 dataBasis=realtime', () => {
    const data = buildRealTimeData(etaOf(2, 'mtr'));
    expect(data.nextBusArrival).toBe('2分钟后');
    expect(data.dataBasis).toBe('realtime');
  });

  it('buildRouteOptions 标记推荐并汇总估算提示', () => {
    const routes = buildRouteOptions([
      busCandidate({ realTimeETA: etaOf(5, 'static') }),
      busCandidate({ route: '961', realTimeETA: etaOf(3, 'kmb') }),
    ]);
    expect(routes[0].recommended).toBe(true);
    expect(routes[0].realTimeData?.dataBasis).toBe('estimate');
    expect(routes[1].realTimeData?.dataBasis).toBe('realtime');
  });

  it('outputSchema 接受 dataBasis 与 fareNote', () => {    const sample = {
      routes: [{
        id: 'r1', totalTime: 30, totalDistance: '5km', type: 'direct',
        steps: [{ type: 'bus', description: '乘 1 号巴士', duration: 25 }],
        estimatedCost: 3.7,
        fareNote: '全程票价 HK$3.7，中途上车按分段收费',
        realTimeData: {
          nextBusArrival: '约5分钟（估算）',
          totalTravelTime: 30,
          dataTimestamp: '2026-10-30T12:00:00.000Z',
          dataBasis: 'estimate',
        },
      }],
      paymentInfo: { octopus: true, cash: true, creditCard: false, mobilePayment: true, notes: [] },
      tips: [ESTIMATE_TIP],
      metadata: { dataTimestamp: '2026-10-30T12:00:00.000Z', apisCalled: ['kmb'] },
    };
    expect(OutputType.safeParse(sample).success).toBe(true);
  });
});
