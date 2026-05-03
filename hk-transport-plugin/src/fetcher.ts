// 鲁港通 - API 调用器模块
// 并发调用多个香港交通 API，含超时、错误处理和内存缓存

import type {
  FetchResult,
  KMBETAItem,
  CTBETAItem,
  GMBETARouteStop,
  NLBETAItem,
  MTRScheduleResponse,
  TDASRouteResult,
  KMBRoute,
  CTBRoute,
  KMBStop,
  KMBRouteStop,
} from './types';

// ============================================================
// 内存缓存（静态数据 TTL 24 小时）
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new MemoryCache();

// 24 小时 TTL（毫秒）
const STATIC_TTL = 24 * 60 * 60 * 1000;

// ============================================================
// 通用 HTTP 调用函数
// ============================================================

const DEFAULT_TIMEOUT = 10_000; // 10 秒
const TDAS_TIMEOUT = 15_000;    // TDAS 15 秒

/**
 * 带超时的 fetch 封装
 * - 支持 GET/POST
 * - 超时自动 abort
 * - 错误捕获返回 FetchResult
 */
export async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT,
  options?: RequestInit
): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: `请求超时 (${timeoutMs}ms)` };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : '未知网络错误',
    };
  } finally {
    clearTimeout(timer);
  }
}


// ============================================================
// TDAS 路径规划 API（Requirements 2.1-2.4）
// ============================================================

export async function fetchTDASRoute(
  start: { lat: number; long: number },
  end: { lat: number; long: number },
  options?: { tunnel?: 'cht' | 'eht' | 'wht' }
): Promise<FetchResult<TDASRouteResult[]>> {
  const url = 'https://tdas-api.hkemobility.gov.hk/tdas/api/route';
  // TDAS 实际返回单个对象而非数组，用 any 接收后包装成数组以兼容下游逻辑
  const raw = await fetchWithTimeout<any>(url, TDAS_TIMEOUT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start,
      end,
      lang: 'tc',
      type: 'ST',
      ...options,
    }),
  });

  if (!raw.success) return { success: false, error: raw.error };

  // 若 API 返回 { Message: "..." } 也视为失败（如"距離起點位置75米以內沒有街路"）
  if (raw.data && typeof raw.data === 'object' && 'Message' in raw.data && !('route' in raw.data)) {
    return { success: false, error: String(raw.data.Message) };
  }

  const arr: TDASRouteResult[] = Array.isArray(raw.data) ? raw.data : [raw.data];
  return { success: true, data: arr };
}

// ============================================================
// KMB ETA API（Requirements 5.1-5.3）
// ============================================================

interface KMBAPIResponse<T> {
  type: string;
  version: string;
  generated_timestamp: string;
  data: T;
}

/** 按站点查询 KMB ETA */
export async function fetchKMBStopETA(
  stopId: string
): Promise<FetchResult<KMBETAItem[]>> {
  const url = `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stopId}`;
  const result = await fetchWithTimeout<KMBAPIResponse<KMBETAItem[]>>(url);
  if (result.success && result.data) {
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

/** 按路线查询 KMB ETA */
export async function fetchKMBRouteETA(
  route: string,
  serviceType: string = '1'
): Promise<FetchResult<KMBETAItem[]>> {
  const url = `https://data.etabus.gov.hk/v1/transport/kmb/route-eta/${route}/${serviceType}`;
  const result = await fetchWithTimeout<KMBAPIResponse<KMBETAItem[]>>(url);
  if (result.success && result.data) {
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

/** KMB 路线列表（缓存 24 小时） */
export async function fetchKMBRoutes(): Promise<FetchResult<KMBRoute[]>> {
  const cacheKey = 'kmb:routes';
  const cached = cache.get<KMBRoute[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://data.etabus.gov.hk/v1/transport/kmb/route/';
  const result = await fetchWithTimeout<KMBAPIResponse<KMBRoute[]>>(url);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data.data, STATIC_TTL);
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

/** KMB 全港站点列表（约 7000 个站，约 1MB，缓存 24 小时） */
export async function fetchKMBStops(): Promise<FetchResult<KMBStop[]>> {
  const cacheKey = 'kmb:stops';
  const cached = cache.get<KMBStop[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://data.etabus.gov.hk/v1/transport/kmb/stop';
  // 这个端点数据量大，给 30 秒超时
  const result = await fetchWithTimeout<KMBAPIResponse<KMBStop[]>>(url, 30_000);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data.data, STATIC_TTL);
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

/** KMB 路线-站点对应关系（约 40 万条记录，约 15MB，缓存 24 小时） */
export async function fetchKMBRouteStops(): Promise<FetchResult<KMBRouteStop[]>> {
  const cacheKey = 'kmb:route-stops';
  const cached = cache.get<KMBRouteStop[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://data.etabus.gov.hk/v1/transport/kmb/route-stop';
  const result = await fetchWithTimeout<KMBAPIResponse<KMBRouteStop[]>>(url, 30_000);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data.data, STATIC_TTL);
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

// ============================================================
// 地理距离工具：Haversine 公式（单位：米）
// ============================================================

/**
 * 计算两点之间的球面距离（单位：米）
 * 用于判断"某坐标附近的巴士站"
 */
export function haversineDistanceM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // 地球半径（米）
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================
// CTB ETA API（Requirements 6.1-6.3）
// ============================================================

interface CTBAPIResponse<T> {
  type: string;
  version: string;
  generated_timestamp: string;
  data: T;
}

/** 按站点+路线查询 CTB ETA */
export async function fetchCTBStopETA(
  stopId: string,
  route: string
): Promise<FetchResult<CTBETAItem[]>> {
  const url = `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stopId}/${route}`;
  const result = await fetchWithTimeout<CTBAPIResponse<CTBETAItem[]>>(url);
  if (result.success && result.data) {
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}

/** CTB 路线列表（缓存 24 小时） */
export async function fetchCTBRoutes(): Promise<FetchResult<CTBRoute[]>> {
  const cacheKey = 'ctb:routes';
  const cached = cache.get<CTBRoute[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://rt.data.gov.hk/v2/transport/citybus/route/CTB';
  const result = await fetchWithTimeout<CTBAPIResponse<CTBRoute[]>>(url);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data.data, STATIC_TTL);
    return { success: true, data: result.data.data };
  }
  return { success: false, error: result.error };
}


// ============================================================
// GMB ETA API（Requirements 7.1-7.3）
// ============================================================

interface GMBAPIResponse {
  type: string;
  version: string;
  generated_timestamp: string;
  data: {
    enabled: boolean;
    results: GMBETARouteStop[];
  };
}

/** 按站点查询 GMB ETA（支持 HKI/KLN/NT 三个区域） */
export async function fetchGMBStopETA(
  stopId: string
): Promise<FetchResult<GMBETARouteStop[]>> {
  const url = `https://data.etagmb.gov.hk/eta/stop/${stopId}`;
  const result = await fetchWithTimeout<GMBAPIResponse>(url);
  if (result.success && result.data) {
    return { success: true, data: result.data.data.results };
  }
  return { success: false, error: result.error };
}

// ============================================================
// MTR 服务状态 API（Requirements 8.1-8.3）
// ============================================================

/** 查询 MTR 实时列车服务状态 */
export async function fetchMTRSchedule(
  line?: string,
  sta?: string
): Promise<FetchResult<MTRScheduleResponse>> {
  let url = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';
  const params = new URLSearchParams();
  if (line) params.set('line', line);
  if (sta) params.set('sta', sta);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  return fetchWithTimeout<MTRScheduleResponse>(url);
}

// ============================================================
// NLB ETA API（Requirements 9.1-9.3）
// ============================================================

interface NLBETAResponse {
  estimatedArrivals: NLBETAItem[];
}

/** 查询 NLB 预计抵站时间 */
export async function fetchNLBStopETA(
  routeId: string,
  stopId: string,
  language: string = 'zh'
): Promise<FetchResult<NLBETAItem[]>> {
  const url = `https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId=${routeId}&stopId=${stopId}&language=${language}`;
  const result = await fetchWithTimeout<NLBETAResponse>(url);
  if (result.success && result.data) {
    return { success: true, data: result.data.estimatedArrivals };
  }
  return { success: false, error: result.error };
}

// ============================================================
// 静态数据（缓存 24 小时）（Requirements 10.1-10.5）
// ============================================================

/** 获取巴士路线收费 GeoJSON（缓存 24 小时） */
export async function fetchBusFares(): Promise<FetchResult<unknown>> {
  const cacheKey = 'static:bus-fares';
  const cached = cache.get<unknown>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json';
  const result = await fetchWithTimeout<unknown>(url);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data, STATIC_TTL);
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/** 获取小巴路线收费 GeoJSON（缓存 24 小时） */
export async function fetchGMBFares(): Promise<FetchResult<unknown>> {
  const cacheKey = 'static:gmb-fares';
  const cached = cache.get<unknown>(cacheKey);
  if (cached) return { success: true, data: cached };

  const url = 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json';
  const result = await fetchWithTimeout<unknown>(url);
  if (result.success && result.data) {
    cache.set(cacheKey, result.data, STATIC_TTL);
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ============================================================
// 批量并发调用（Promise.allSettled）
// ============================================================

export interface BatchFetchResult {
  tdas?: FetchResult<TDASRouteResult[]>;
  kmbETA?: FetchResult<KMBETAItem[]>;
  ctbETA?: FetchResult<CTBETAItem[]>;
  gmbETA?: FetchResult<GMBETARouteStop[]>;
  mtrSchedule?: FetchResult<MTRScheduleResponse>;
  nlbETA?: FetchResult<NLBETAItem[]>;
  apiStatus: Record<string, 'success' | 'failed' | 'skipped'>;
}

/**
 * 根据 APICallPlan 并发调用所有需要的 API
 * 使用 Promise.allSettled 确保部分失败不影响其他 API
 */
export async function executeBatchFetch(plan: {
  useTDAS: boolean;
  tdasParams?: { start: { lat: number; long: number }; end: { lat: number; long: number } };
  etaQueries: Array<{ type: string; stopId?: string; route?: string; params?: Record<string, string> }>;
}): Promise<BatchFetchResult> {
  const result: BatchFetchResult = { apiStatus: {} };
  const tasks: Array<{ key: string; promise: Promise<void> }> = [];

  // TDAS 路径规划
  if (plan.useTDAS && plan.tdasParams) {
    tasks.push({
      key: 'tdas',
      promise: fetchTDASRoute(plan.tdasParams.start, plan.tdasParams.end).then(r => {
        result.tdas = r;
        result.apiStatus['tdas'] = r.success ? 'success' : 'failed';
      }),
    });
  } else {
    result.apiStatus['tdas'] = 'skipped';
  }

  // ETA 查询
  for (const query of plan.etaQueries) {
    switch (query.type) {
      case 'kmb':
        if (query.stopId) {
          tasks.push({
            key: 'kmb',
            promise: fetchKMBStopETA(query.stopId).then(r => {
              result.kmbETA = r;
              result.apiStatus['kmb'] = r.success ? 'success' : 'failed';
            }),
          });
        } else {
          result.apiStatus['kmb'] = 'skipped';
        }
        break;
      case 'ctb':
        if (query.stopId && query.route) {
          tasks.push({
            key: 'ctb',
            promise: fetchCTBStopETA(query.stopId, query.route).then(r => {
              result.ctbETA = r;
              result.apiStatus['ctb'] = r.success ? 'success' : 'failed';
            }),
          });
        } else {
          result.apiStatus['ctb'] = 'skipped';
        }
        break;
      case 'gmb':
        if (query.stopId) {
          tasks.push({
            key: 'gmb',
            promise: fetchGMBStopETA(query.stopId).then(r => {
              result.gmbETA = r;
              result.apiStatus['gmb'] = r.success ? 'success' : 'failed';
            }),
          });
        } else {
          result.apiStatus['gmb'] = 'skipped';
        }
        break;
      case 'mtr':
        tasks.push({
          key: 'mtr',
          promise: fetchMTRSchedule(
            query.params?.line,
            query.params?.sta
          ).then(r => {
            result.mtrSchedule = r;
            result.apiStatus['mtr'] = r.success ? 'success' : 'failed';
          }),
        });
        break;
      case 'nlb':
        if (query.params?.routeId && query.stopId) {
          tasks.push({
            key: 'nlb',
            promise: fetchNLBStopETA(
              query.params.routeId,
              query.stopId,
              query.params?.language
            ).then(r => {
              result.nlbETA = r;
              result.apiStatus['nlb'] = r.success ? 'success' : 'failed';
            }),
          });
        } else {
          result.apiStatus['nlb'] = 'skipped';
        }
        break;
    }
  }

  // 并发执行所有任务
  await Promise.allSettled(tasks.map(t => t.promise));

  return result;
}
