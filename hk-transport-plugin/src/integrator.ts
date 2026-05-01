// 鲁港通 - 数据整合器模块
// 整合多个 API 数据，生成综合交通响应

import type {
  TDASRouteResult,
  TDASSegment,
  RouteOption,
  RouteStep,
  KMBETAItem,
  CTBETAItem,
  StopETAList,
  StopETAItem,
  NextBusInfo,
  PaymentInfo,
} from './types';
import type { BatchFetchResult } from './fetcher';

// ============================================================
// 7.1 TDAS 路线方案解析（Requirements 2.2, 2.3, 2.4, 2.6）
// ============================================================

/** 将 TDAS mode 字符串映射为 RouteStep type */
function mapTDASMode(mode: string): RouteStep['type'] {
  const modeMap: Record<string, RouteStep['type']> = {
    WALK: 'walk',
    BUS: 'bus',
    MTR: 'mtr',
    GMB: 'gmb',
    TRAM: 'tram',
    FERRY: 'ferry',
    RAIL: 'mtr',
    LRT: 'mtr',
  };
  return modeMap[mode?.toUpperCase()] || 'bus';
}

/** 将 TDAS 单个 segment 转换为 RouteStep */
function parseTDASSegment(seg: TDASSegment): RouteStep {
  const stepType = mapTDASMode(seg.mode);
  const duration = seg.eta ? parseTDASETA(seg.eta) : 0;

  let description = '';
  if (stepType === 'walk') {
    const distKm = seg.distM ? (seg.distM / 1000).toFixed(1) : '?';
    description = `步行 ${duration} 分钟 (${distKm}公里)`;
  } else {
    const routeLabel = seg.routeNo || '';
    const stopsLabel = seg.stops ? `${seg.stops} 站` : '';
    description = `${routeLabel} ${stopsLabel}`.trim();
  }

  return {
    type: stepType,
    description,
    route: seg.routeNo,
    from: seg.from,
    to: seg.to,
    duration,
    stops: seg.stops,
  };
}

/** 解析 TDAS eta 字符串（如 "00:48"）为分钟数 */
function parseTDASETA(eta: string): number {
  if (!eta) return 0;
  const parts = eta.split(':');
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return parseInt(eta, 10) || 0;
}

/** 判断路线是直达还是换乘 */
function classifyRouteType(steps: RouteStep[]): 'direct' | 'transfer' {
  const transitSteps = steps.filter(s => s.type !== 'walk');
  return transitSteps.length <= 1 ? 'direct' : 'transfer';
}

/**
 * 将 TDAS 响应数组转换为 RouteOption 列表
 */
export function parseTDASRoutes(tdasResults: TDASRouteResult[]): RouteOption[] {
  if (!tdasResults || tdasResults.length === 0) return [];

  return tdasResults.map((result, index) => {
    const steps = (result.route || []).map(parseTDASSegment);
    const totalTime = result.eta ? parseTDASETA(result.eta) : steps.reduce((sum, s) => sum + s.duration, 0);
    const distKm = result.distM ? (result.distM / 1000).toFixed(1) : result.distU || '0';
    const totalDistance = typeof distKm === 'string' && distKm.includes('km') ? distKm : `${distKm}公里`;

    return {
      id: `route-${index + 1}`,
      totalTime,
      totalDistance,
      type: classifyRouteType(steps),
      steps,
      estimatedCost: 0, // 费用在后续步骤中填充
    };
  });
}


// ============================================================
// 7.2 站点 ETA 列表生成（Requirements 3.1, 3.2, 3.3）
// ============================================================

/** 计算距离当前时间的分钟数 */
function minutesFromNow(isoTime: string | null): number {
  if (!isoTime) return -1;
  const eta = new Date(isoTime).getTime();
  const now = Date.now();
  const diff = Math.round((eta - now) / 60000);
  return diff < 0 ? 0 : diff;
}

/** 将 KMB ETA 数据转换为 StopETAItem 列表 */
function convertKMBETAs(items: KMBETAItem[]): StopETAItem[] {
  // 按路线+方向分组
  const grouped = new Map<string, KMBETAItem[]>();
  for (const item of items) {
    const key = `${item.route}-${item.dir}-${item.service_type}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const result: StopETAItem[] = [];
  for (const [, group] of grouped) {
    const first = group[0];
    const nextBuses: NextBusInfo[] = group
      .sort((a, b) => a.eta_seq - b.eta_seq)
      .map(item => ({
        eta: item.eta,
        minutesAway: minutesFromNow(item.eta),
        remarks: item.rmk_tc || undefined,
      }));

    result.push({
      route: first.route,
      destination: first.dest_tc || first.dest_en,
      company: 'KMB',
      nextBuses,
    });
  }
  return result;
}

/** 将 CTB ETA 数据转换为 StopETAItem 列表 */
function convertCTBETAs(items: CTBETAItem[]): StopETAItem[] {
  const grouped = new Map<string, CTBETAItem[]>();
  for (const item of items) {
    const key = `${item.route}-${item.dir}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const result: StopETAItem[] = [];
  for (const [, group] of grouped) {
    const first = group[0];
    const nextBuses: NextBusInfo[] = group
      .sort((a, b) => a.eta_seq - b.eta_seq)
      .map(item => ({
        eta: item.eta,
        minutesAway: minutesFromNow(item.eta),
        remarks: item.rmk_tc || undefined,
      }));

    result.push({
      route: first.route,
      destination: first.dest_tc || first.dest_en,
      company: 'CTB',
      nextBuses,
    });
  }
  return result;
}

/**
 * 合并 KMB 和 CTB 的 ETA 数据，按最近到站时间排序
 */
export function mergeStopETAs(
  stopId: string,
  stopName: string,
  kmbItems?: KMBETAItem[],
  ctbItems?: CTBETAItem[]
): StopETAList {
  const etas: StopETAItem[] = [];

  if (kmbItems && kmbItems.length > 0) {
    etas.push(...convertKMBETAs(kmbItems));
  }
  if (ctbItems && ctbItems.length > 0) {
    etas.push(...convertCTBETAs(ctbItems));
  }

  // 按最近一班车的到站时间排序
  etas.sort((a, b) => {
    const aMin = a.nextBuses[0]?.minutesAway ?? Infinity;
    const bMin = b.nextBuses[0]?.minutesAway ?? Infinity;
    return aMin - bMin;
  });

  return { stopId, stopName, etas };
}

// ============================================================
// 7.3 路线筛选功能（Requirements 4.1, 4.2, 4.3）
// ============================================================

/**
 * 按路线号筛选 ETA 列表，支持模糊匹配
 * 如输入 "215" 可匹配 "215X"、"215P"
 */
export function filterETAByRoute(
  etaList: StopETAList,
  routeFilter: string
): StopETAList {
  if (!routeFilter || routeFilter.trim() === '') return etaList;

  const filter = routeFilter.trim().toUpperCase();
  const filtered = etaList.etas.filter(item => {
    const route = item.route.toUpperCase();
    // 精确匹配或前缀匹配（模糊匹配）
    return route === filter || route.startsWith(filter);
  });

  return {
    ...etaList,
    etas: filtered,
  };
}

// ============================================================
// 7.5 直达路线优先排序（Requirements 2.5）
// ============================================================

/**
 * 对路线方案排序：直达路线排在换乘路线之前
 * 同类型内按总时间升序排列
 */
export function sortRoutesByDirectFirst(routes: RouteOption[]): RouteOption[] {
  return [...routes].sort((a, b) => {
    // 直达优先
    if (a.type === 'direct' && b.type !== 'direct') return -1;
    if (a.type !== 'direct' && b.type === 'direct') return 1;
    // 同类型按时间排序
    return a.totalTime - b.totalTime;
  });
}

// ============================================================
// 7.7 付款信息生成（Requirements 11.1, 11.3, 11.4）
// ============================================================

/** 交通工具类型到付款方式的映射 */
const PAYMENT_BY_TRANSPORT: Record<string, { cash: boolean; creditCard: boolean; notes: string[] }> = {
  bus: { cash: true, creditCard: false, notes: ['巴士接受八达通和现金支付', '使用八达通可享受转乘优惠'] },
  mtr: { cash: false, creditCard: true, notes: ['港铁接受八达通、信用卡和二维码支付', '单程票可在售票机购买'] },
  gmb: { cash: true, creditCard: false, notes: ['小巴接受八达通和现金支付', '部分小巴只接受现金，请准备零钱'] },
  tram: { cash: true, creditCard: false, notes: ['电车接受八达通和现金支付', '成人票价 HK$3.0'] },
  ferry: { cash: true, creditCard: false, notes: ['渡轮接受八达通和现金支付'] },
  walk: { cash: false, creditCard: false, notes: [] },
};

/**
 * 根据路线方案中的交通工具类型生成付款信息
 */
export function generatePaymentInfo(routes: RouteOption[]): PaymentInfo {
  const allStepTypes = new Set<string>();
  for (const route of routes) {
    for (const step of route.steps) {
      allStepTypes.add(step.type);
    }
  }

  let cash = false;
  let creditCard = false;
  const notes: string[] = [];
  const seenNotes = new Set<string>();

  for (const type of allStepTypes) {
    const payment = PAYMENT_BY_TRANSPORT[type];
    if (payment) {
      if (payment.cash) cash = true;
      if (payment.creditCard) creditCard = true;
      for (const note of payment.notes) {
        if (!seenNotes.has(note)) {
          seenNotes.add(note);
          notes.push(note);
        }
      }
    }
  }

  // 八达通几乎所有交通工具都接受
  const hasTransit = allStepTypes.size > 0 && !(allStepTypes.size === 1 && allStepTypes.has('walk'));

  return {
    octopus: hasTransit,
    cash,
    creditCard,
    mobilePayment: hasTransit, // 大部分交通工具支持手机支付
    notes: notes.length > 0 ? notes : ['请准备八达通或现金支付'],
  };
}

// ============================================================
// 7.9 注意事项生成（Requirements 12.1, 12.2, 12.3, 12.4）
// ============================================================

/** 口岸关键词列表 */
const BORDER_KEYWORDS = ['口岸', '落马洲', '罗湖', '深圳湾', '港珠澳', '莲塘', '西九龙站', '福田'];

/** 检查地点名称是否涉及口岸 */
function involvesBorder(origin?: string, destination?: string): boolean {
  const text = `${origin || ''} ${destination || ''}`;
  return BORDER_KEYWORDS.some(kw => text.includes(kw));
}

/** 检查是否在高峰时段 */
function isPeakHour(date?: Date): boolean {
  const d = date || new Date();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const timeVal = hour * 60 + minute;
  // 早高峰 07:00-09:30，晚高峰 17:00-19:30
  return (timeVal >= 420 && timeVal <= 570) || (timeVal >= 1020 && timeVal <= 1170);
}

/** 计算路线中的总步行距离（米） */
function totalWalkingDistance(routes: RouteOption[]): number {
  let total = 0;
  for (const route of routes) {
    for (const step of route.steps) {
      if (step.type === 'walk') {
        // 从 description 中提取距离，格式如 "步行 11 分钟 (1.2公里)"
        const match = step.description.match(/\((\d+\.?\d*)公里\)/);
        if (match) {
          total += parseFloat(match[1]) * 1000;
        }
      }
    }
  }
  return total;
}

/**
 * 根据路线方案和上下文生成注意事项
 */
export function generateTips(
  routes: RouteOption[],
  origin?: string,
  destination?: string,
  currentTime?: Date
): string[] {
  const tips: string[] = [];

  // 高峰时段提示（Requirements 12.1）
  if (isPeakHour(currentTime)) {
    tips.push('当前为高峰时段（早 07:00-09:30 / 晚 17:00-19:30），交通可能较为拥挤，建议预留额外时间');
  }

  // 口岸通关提示（Requirements 12.2）
  if (involvesBorder(origin, destination)) {
    tips.push('路线涉及口岸通关，请携带有效证件（港澳通行证/护照）');
    tips.push('口岸通关时间可能较长，建议预留 30-60 分钟');
  }

  // 步行距离提示（Requirements 12.3）
  const walkDist = totalWalkingDistance(routes);
  if (walkDist > 500) {
    const walkKm = (walkDist / 1000).toFixed(1);
    const walkMin = Math.ceil(walkDist / 80); // 约 80 米/分钟步行速度
    tips.push(`路线包含约 ${walkKm} 公里步行距离，预计步行 ${walkMin} 分钟，请穿着舒适的鞋子`);
  }

  // 无障碍设施提示（Requirements 12.4）
  const hasMTR = routes.some(r => r.steps.some(s => s.type === 'mtr'));
  if (hasMTR) {
    tips.push('港铁各站均设有无障碍设施，包括升降机和轮椅通道');
  }

  return tips;
}

// ============================================================
// 主整合函数
// ============================================================

export interface IntegrateOptions {
  origin?: string;
  destination?: string;
  routeFilter?: string;
  currentTime?: Date;
}

export interface IntegratedResult {
  routes: RouteOption[];
  stopETAs?: StopETAList;
  paymentInfo: PaymentInfo;
  tips: string[];
}

/**
 * 整合所有 API 数据，生成最终响应
 */
export function integrateData(
  fetchResult: BatchFetchResult,
  options: IntegrateOptions = {}
): IntegratedResult {
  // 1. 解析 TDAS 路线方案
  let routes: RouteOption[] = [];
  if (fetchResult.tdas?.success && fetchResult.tdas.data) {
    routes = parseTDASRoutes(fetchResult.tdas.data);
  }

  // 2. 直达路线优先排序
  routes = sortRoutesByDirectFirst(routes);

  // 3. 合并站点 ETA
  let stopETAs: StopETAList | undefined;
  if (fetchResult.kmbETA?.data || fetchResult.ctbETA?.data) {
    stopETAs = mergeStopETAs(
      'query-stop',
      options.origin || '查询站点',
      fetchResult.kmbETA?.data,
      fetchResult.ctbETA?.data
    );

    // 4. 路线筛选
    if (options.routeFilter && stopETAs) {
      stopETAs = filterETAByRoute(stopETAs, options.routeFilter);
    }
  }

  // 5. 付款信息
  const paymentInfo = generatePaymentInfo(routes);

  // 6. 注意事项
  const tips = generateTips(routes, options.origin, options.destination, options.currentTime);

  return { routes, stopETAs, paymentInfo, tips };
}
