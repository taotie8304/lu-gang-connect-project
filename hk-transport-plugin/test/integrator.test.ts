// 鲁港通 - 数据整合器测试

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseTDASRoutes,
  mergeStopETAs,
  filterETAByRoute,
  sortRoutesByDirectFirst,
  generatePaymentInfo,
  generateTips,
} from '../src/integrator';
import type {
  TDASRouteResult,
  RouteOption,
  StopETAList,
  KMBETAItem,
  CTBETAItem,
} from '../src/types';

// ============================================================
// 测试数据生成器
// ============================================================

/** 生成随机路线号（如 "12", "215X", "N21"） */
const routeNumberArb = fc.oneof(
  fc.integer({ min: 1, max: 999 }).map(n => String(n)),
  fc.integer({ min: 1, max: 999 }).chain(n =>
    fc.constantFrom('', 'X', 'P', 'A', 'S', 'K', 'M').map(suffix => `${n}${suffix}`)
  ),
  fc.constantFrom('N21', 'N241', 'A11', 'E11', 'R8', 'S1')
);

/** 生成随机 StopETAItem */
const stopETAItemArb = fc.record({
  route: routeNumberArb,
  destination: fc.constantFrom('尖沙咀碼頭', '旺角', '中環', '銅鑼灣', '沙田'),
  company: fc.constantFrom('KMB', 'CTB'),
  nextBuses: fc.array(
    fc.record({
      eta: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
      minutesAway: fc.integer({ min: 0, max: 60 }),
      remarks: fc.option(fc.string(), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 3 }
  ),
});

/** 生成随机 StopETAList */
const stopETAListArb = fc.record({
  stopId: fc.string({ minLength: 1, maxLength: 10 }),
  stopName: fc.constantFrom('廣東道,新港中心(YT205)', '旺角站', '中環站'),
  etas: fc.array(stopETAItemArb, { minLength: 1, maxLength: 10 }),
});

/** 生成随机 RouteOption */
const routeOptionArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  totalTime: fc.integer({ min: 5, max: 120 }),
  totalDistance: fc.integer({ min: 1, max: 50 }).map(n => `${n}公里`),
  type: fc.constantFrom('direct' as const, 'transfer' as const),
  steps: fc.array(
    fc.record({
      type: fc.constantFrom('walk' as const, 'bus' as const, 'mtr' as const, 'gmb' as const, 'tram' as const, 'ferry' as const),
      description: fc.string({ minLength: 1 }),
      route: fc.option(routeNumberArb, { nil: undefined }),
      from: fc.option(fc.string(), { nil: undefined }),
      to: fc.option(fc.string(), { nil: undefined }),
      duration: fc.integer({ min: 1, max: 60 }),
      stops: fc.option(fc.integer({ min: 1, max: 30 }), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 5 }
  ),
  estimatedCost: fc.integer({ min: 0, max: 100 }),
});

// ============================================================
// 单元测试：TDAS 路线方案解析
// ============================================================

describe('TDAS 路线方案解析', () => {
  it('应该正确解析 TDAS 响应', () => {
    const tdasResults: TDASRouteResult[] = [
      {
        eta: '00:48',
        distM: 17100,
        distU: '17.1 km',
        route: [
          { segId: 1, mode: 'WALK', distM: 500, eta: '00:06' },
          { segId: 2, mode: 'BUS', routeNo: '215X', from: '新港中心', to: '旺角', eta: '00:25', stops: 5 },
          { segId: 3, mode: 'WALK', distM: 200, eta: '00:03' },
        ],
      },
    ];

    const routes = parseTDASRoutes(tdasResults);
    expect(routes).toHaveLength(1);
    expect(routes[0].totalTime).toBe(48);
    expect(routes[0].steps).toHaveLength(3);
    expect(routes[0].steps[0].type).toBe('walk');
    expect(routes[0].steps[1].type).toBe('bus');
    expect(routes[0].steps[1].route).toBe('215X');
    expect(routes[0].type).toBe('direct'); // 只有一个非步行段
  });

  it('应该处理空 TDAS 响应', () => {
    expect(parseTDASRoutes([])).toEqual([]);
    expect(parseTDASRoutes(undefined as any)).toEqual([]);
  });

  it('应该正确识别换乘路线', () => {
    const tdasResults: TDASRouteResult[] = [
      {
        eta: '01:05',
        distM: 25000,
        route: [
          { segId: 1, mode: 'WALK', distM: 300, eta: '00:04' },
          { segId: 2, mode: 'BUS', routeNo: '12', from: 'A', to: 'B', eta: '00:20', stops: 8 },
          { segId: 3, mode: 'WALK', distM: 100, eta: '00:02' },
          { segId: 4, mode: 'MTR', routeNo: '荃湾线', from: 'B', to: 'C', eta: '00:15', stops: 4 },
          { segId: 5, mode: 'WALK', distM: 200, eta: '00:03' },
        ],
      },
    ];

    const routes = parseTDASRoutes(tdasResults);
    expect(routes[0].type).toBe('transfer'); // 两个非步行段
  });
});

// ============================================================
// 单元测试：站点 ETA 列表生成
// ============================================================

describe('站点 ETA 列表生成', () => {
  it('应该合并 KMB 和 CTB 的 ETA 数据', () => {
    const kmbItems: KMBETAItem[] = [
      {
        co: 'KMB', route: '12', dir: 'O', service_type: '1', seq: 1,
        dest_tc: '尖沙咀碼頭', dest_sc: '尖沙咀码头', dest_en: 'TST Ferry',
        eta: new Date(Date.now() + 5 * 60000).toISOString(),
        rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
      },
    ];
    const ctbItems: CTBETAItem[] = [
      {
        co: 'CTB', route: '5B', dir: 'O', seq: 1,
        dest_tc: '堅尼地城', dest_sc: '坚尼地城', dest_en: 'Kennedy Town',
        eta: new Date(Date.now() + 8 * 60000).toISOString(),
        rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
      },
    ];

    const result = mergeStopETAs('YT205', '廣東道,新港中心', kmbItems, ctbItems);
    expect(result.etas).toHaveLength(2);
    expect(result.etas.some(e => e.company === 'KMB')).toBe(true);
    expect(result.etas.some(e => e.company === 'CTB')).toBe(true);
  });

  it('应该按到站时间排序', () => {
    const kmbItems: KMBETAItem[] = [
      {
        co: 'KMB', route: '12', dir: 'O', service_type: '1', seq: 1,
        dest_tc: '尖沙咀碼頭', dest_sc: '', dest_en: '',
        eta: new Date(Date.now() + 10 * 60000).toISOString(),
        rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
      },
      {
        co: 'KMB', route: '215X', dir: 'O', service_type: '1', seq: 1,
        dest_tc: '旺角', dest_sc: '', dest_en: '',
        eta: new Date(Date.now() + 3 * 60000).toISOString(),
        rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '',
      },
    ];

    const result = mergeStopETAs('YT205', '廣東道', kmbItems);
    // 215X (3 min) 应该排在 12 (10 min) 前面
    expect(result.etas[0].route).toBe('215X');
    expect(result.etas[1].route).toBe('12');
  });
});

// ============================================================
// 属性测试：Property 8 - 路线筛选正确性
// Feature: hk-smart-transport-assistant, Property 8: 路线筛选正确性
// **Validates: Requirements 4.1, 4.2**
// ============================================================

describe('Property 8: 路线筛选正确性', () => {
  it('筛选后所有结果的路线号应该匹配筛选条件（精确或前缀匹配）', () => {
    fc.assert(
      fc.property(
        stopETAListArb,
        routeNumberArb,
        (etaList, filterRoute) => {
          const filtered = filterETAByRoute(etaList, filterRoute);
          const filterUpper = filterRoute.trim().toUpperCase();

          // 所有筛选结果的路线号应该精确匹配或以筛选条件开头
          for (const item of filtered.etas) {
            const routeUpper = item.route.toUpperCase();
            expect(
              routeUpper === filterUpper || routeUpper.startsWith(filterUpper)
            ).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('筛选结果应该是原列表的子集', () => {
    fc.assert(
      fc.property(
        stopETAListArb,
        routeNumberArb,
        (etaList, filterRoute) => {
          const filtered = filterETAByRoute(etaList, filterRoute);
          expect(filtered.etas.length).toBeLessThanOrEqual(etaList.etas.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// 属性测试：Property 7 - 直达路线优先级
// Feature: hk-smart-transport-assistant, Property 7: 直达路线优先级
// **Validates: Requirements 2.5**
// ============================================================

describe('Property 7: 直达路线优先级', () => {
  it('排序后直达路线应该排在换乘路线之前', () => {
    fc.assert(
      fc.property(
        fc.array(routeOptionArb, { minLength: 1, maxLength: 10 }),
        (routes) => {
          const sorted = sortRoutesByDirectFirst(routes);

          // 找到第一个换乘路线的位置
          let firstTransferIdx = -1;
          let lastDirectIdx = -1;
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].type === 'transfer' && firstTransferIdx === -1) {
              firstTransferIdx = i;
            }
            if (sorted[i].type === 'direct') {
              lastDirectIdx = i;
            }
          }

          // 如果同时存在直达和换乘，最后一个直达应该在第一个换乘之前
          if (firstTransferIdx !== -1 && lastDirectIdx !== -1) {
            expect(lastDirectIdx).toBeLessThan(firstTransferIdx);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('排序不应该改变路线数量', () => {
    fc.assert(
      fc.property(
        fc.array(routeOptionArb, { minLength: 0, maxLength: 10 }),
        (routes) => {
          const sorted = sortRoutesByDirectFirst(routes);
          expect(sorted.length).toBe(routes.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// 单元测试：直达路线排序
// ============================================================

describe('直达路线排序', () => {
  it('直达路线应该排在换乘路线之前', () => {
    const routes: RouteOption[] = [
      { id: 'r1', totalTime: 30, totalDistance: '10公里', type: 'transfer', steps: [], estimatedCost: 10 },
      { id: 'r2', totalTime: 45, totalDistance: '15公里', type: 'direct', steps: [], estimatedCost: 8 },
      { id: 'r3', totalTime: 25, totalDistance: '8公里', type: 'transfer', steps: [], estimatedCost: 12 },
    ];

    const sorted = sortRoutesByDirectFirst(routes);
    expect(sorted[0].type).toBe('direct');
    expect(sorted[0].id).toBe('r2');
  });

  it('同类型内应该按时间排序', () => {
    const routes: RouteOption[] = [
      { id: 'r1', totalTime: 50, totalDistance: '20公里', type: 'transfer', steps: [], estimatedCost: 15 },
      { id: 'r2', totalTime: 30, totalDistance: '10公里', type: 'transfer', steps: [], estimatedCost: 10 },
      { id: 'r3', totalTime: 40, totalDistance: '15公里', type: 'direct', steps: [], estimatedCost: 8 },
      { id: 'r4', totalTime: 35, totalDistance: '12公里', type: 'direct', steps: [], estimatedCost: 7 },
    ];

    const sorted = sortRoutesByDirectFirst(routes);
    // 直达先，按时间排序
    expect(sorted[0].id).toBe('r4'); // direct, 35min
    expect(sorted[1].id).toBe('r3'); // direct, 40min
    // 换乘后，按时间排序
    expect(sorted[2].id).toBe('r2'); // transfer, 30min
    expect(sorted[3].id).toBe('r1'); // transfer, 50min
  });
});

// ============================================================
// 属性测试：Property 9 - 付款信息完整性
// Feature: hk-smart-transport-assistant, Property 9: 付款信息完整性
// **Validates: Requirements 11.1**
// ============================================================

describe('Property 9: 付款信息完整性', () => {
  it('返回的 PaymentInfo 应该包含所有必需字段', () => {
    fc.assert(
      fc.property(
        fc.array(routeOptionArb, { minLength: 0, maxLength: 5 }),
        (routes) => {
          const info = generatePaymentInfo(routes);

          // 所有字段都应该存在且类型正确
          expect(typeof info.octopus).toBe('boolean');
          expect(typeof info.cash).toBe('boolean');
          expect(typeof info.creditCard).toBe('boolean');
          expect(typeof info.mobilePayment).toBe('boolean');
          expect(Array.isArray(info.notes)).toBe(true);
          expect(info.notes.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('包含公共交通步骤时八达通应该为 true', () => {
    fc.assert(
      fc.property(
        fc.array(routeOptionArb, { minLength: 1, maxLength: 5 }).filter(routes =>
          routes.some(r => r.steps.some(s => s.type !== 'walk'))
        ),
        (routes) => {
          const info = generatePaymentInfo(routes);
          expect(info.octopus).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// 单元测试：付款信息生成
// ============================================================

describe('付款信息生成', () => {
  it('巴士路线应该支持八达通和现金', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 30, totalDistance: '10公里', type: 'direct',
      steps: [{ type: 'bus', description: '12路', duration: 20 }],
      estimatedCost: 5,
    }];
    const info = generatePaymentInfo(routes);
    expect(info.octopus).toBe(true);
    expect(info.cash).toBe(true);
  });

  it('港铁路线应该支持信用卡', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 20, totalDistance: '5公里', type: 'direct',
      steps: [{ type: 'mtr', description: '荃湾线', duration: 15 }],
      estimatedCost: 10,
    }];
    const info = generatePaymentInfo(routes);
    expect(info.creditCard).toBe(true);
  });

  it('纯步行路线不应该需要八达通', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 10, totalDistance: '1公里', type: 'direct',
      steps: [{ type: 'walk', description: '步行 10 分钟', duration: 10 }],
      estimatedCost: 0,
    }];
    const info = generatePaymentInfo(routes);
    expect(info.octopus).toBe(false);
  });
});

// ============================================================
// 属性测试：Property 10 - 提示信息相关性
// Feature: hk-smart-transport-assistant, Property 10: 提示信息相关性
// **Validates: Requirements 12.1, 12.2, 12.3**
// ============================================================

describe('Property 10: 提示信息相关性', () => {
  const borderLocations = ['落马洲口岸', '罗湖口岸', '深圳湾口岸', '港珠澳大桥口岸', '莲塘口岸', '福田口岸', '西九龙站'];

  it('涉及口岸的路线应该包含通关相关提示', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...borderLocations),
        fc.constantFrom('中环', '尖沙咀', '旺角', '铜锣湾'),
        (borderLoc, otherLoc) => {
          // 测试口岸作为起点
          const tipsOrigin = generateTips([], borderLoc, otherLoc);
          const hasBorderTipOrigin = tipsOrigin.some(t => t.includes('口岸') || t.includes('证件') || t.includes('通关'));
          expect(hasBorderTipOrigin).toBe(true);

          // 测试口岸作为终点
          const tipsDest = generateTips([], otherLoc, borderLoc);
          const hasBorderTipDest = tipsDest.some(t => t.includes('口岸') || t.includes('证件') || t.includes('通关'));
          expect(hasBorderTipDest).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('高峰时段应该包含拥挤提示', () => {
    // 早高峰 08:00
    const morningPeak = new Date();
    morningPeak.setHours(8, 0, 0, 0);

    // 晚高峰 18:00
    const eveningPeak = new Date();
    eveningPeak.setHours(18, 0, 0, 0);

    const tipsAM = generateTips([], '中环', '旺角', morningPeak);
    expect(tipsAM.some(t => t.includes('高峰'))).toBe(true);

    const tipsPM = generateTips([], '中环', '旺角', eveningPeak);
    expect(tipsPM.some(t => t.includes('高峰'))).toBe(true);
  });

  it('步行超过 500 米应该包含步行距离提示', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 30, totalDistance: '5公里', type: 'direct',
      steps: [
        { type: 'walk', description: '步行 10 分钟 (0.8公里)', duration: 10 },
        { type: 'bus', description: '12路', duration: 20 },
      ],
      estimatedCost: 5,
    }];

    const tips = generateTips(routes);
    expect(tips.some(t => t.includes('步行'))).toBe(true);
  });
});

// ============================================================
// 单元测试：注意事项生成
// ============================================================

describe('注意事项生成', () => {
  it('非高峰时段不应该有高峰提示', () => {
    const offPeak = new Date();
    offPeak.setHours(14, 0, 0, 0); // 下午 2 点
    const tips = generateTips([], '中环', '旺角', offPeak);
    expect(tips.some(t => t.includes('高峰'))).toBe(false);
  });

  it('不涉及口岸时不应该有通关提示', () => {
    const tips = generateTips([], '中环', '旺角');
    expect(tips.some(t => t.includes('通关'))).toBe(false);
  });

  it('步行距离不超过 500 米时不应该有步行提示', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 20, totalDistance: '3公里', type: 'direct',
      steps: [
        { type: 'walk', description: '步行 3 分钟 (0.3公里)', duration: 3 },
        { type: 'bus', description: '12路', duration: 17 },
      ],
      estimatedCost: 5,
    }];

    const offPeak = new Date();
    offPeak.setHours(14, 0, 0, 0);
    const tips = generateTips(routes, '中环', '旺角', offPeak);
    expect(tips.some(t => t.includes('步行距离'))).toBe(false);
  });

  it('包含港铁步骤时应该有无障碍设施提示', () => {
    const routes: RouteOption[] = [{
      id: 'r1', totalTime: 20, totalDistance: '5公里', type: 'direct',
      steps: [{ type: 'mtr', description: '荃湾线', duration: 15 }],
      estimatedCost: 10,
    }];

    const offPeak = new Date();
    offPeak.setHours(14, 0, 0, 0);
    const tips = generateTips(routes, '中环', '旺角', offPeak);
    expect(tips.some(t => t.includes('无障碍'))).toBe(true);
  });
});
