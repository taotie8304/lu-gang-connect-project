// 鲁港通 - TypeScript 类型定义

// ============================================================
// Parser types
// ============================================================

export interface ParsedQuestion {
  origin?: string;
  destination?: string;
  transportPreference?: string[];
  timeRequirement?: string;
  keywords: string[];
  routeNumbers?: string[];
  isETAQuery?: boolean;
}

// ============================================================
// Geocoder types
// ============================================================

export interface GeoLocation {
  lat: number;
  lng: number;
  name: string;
}

// ============================================================
// Router types
// ============================================================

export interface APICallPlan {
  useTDAS: boolean;
  tdasParams?: {
    start: { lat: number; long: number };
    end: { lat: number; long: number };
  };
  etaQueries: ETAQuery[];
}

export interface ETAQuery {
  type: 'kmb' | 'ctb' | 'gmb' | 'mtr' | 'nlb';
  stopId?: string;
  route?: string;
  params?: Record<string, string>;
}

// ============================================================
// API response types
// ============================================================

export interface APIResponse {
  type: string;
  data: unknown;
  error?: string;
}

// KMB ETA response
export interface KMBETAItem {
  co: string;
  route: string;
  dir: string;
  service_type: string;
  seq: number;
  dest_tc: string;
  dest_sc: string;
  dest_en: string;
  eta: string | null;
  rmk_tc: string;
  rmk_sc: string;
  rmk_en: string;
  eta_seq: number;
  data_timestamp: string;
}

// CTB ETA response
export interface CTBETAItem {
  co: string;
  route: string;
  dir: string;
  seq: number;
  dest_tc: string;
  dest_sc: string;
  dest_en: string;
  eta: string | null;
  rmk_tc: string;
  rmk_sc: string;
  rmk_en: string;
  eta_seq: number;
  data_timestamp: string;
}

// GMB ETA response
export interface GMBETAItem {
  enabled: boolean;
  route_seq: number;
  eta_seq: number;
  diff: number;
  timestamp: string;
  remarks_tc: string | null;
  remarks_sc: string | null;
  remarks_en: string | null;
}

// GMB ETA stop response (wraps route-level data)
export interface GMBETARouteStop {
  route_id: number;
  route_seq: number;
  stop_seq: number;
  eta: GMBETAItem[];
}

// TDAS route response
export interface TDASSegment {
  segId: number;
  mode: string;
  routeNo?: string;
  from?: string;
  to?: string;
  distM?: number;
  eta?: string;
  stops?: number;
}

export interface TDASRouteResult {
  jSpeed?: string;
  distM?: number;
  distU?: string;
  eta?: string;
  route?: TDASSegment[];
}

// MTR schedule response
export interface MTRTrainInfo {
  time: string;
  plat: string;
  dest: string;
  seq: string;
}

export interface MTRStationSchedule {
  curr_time: string;
  sys_time: string;
  UP?: MTRTrainInfo[];
  DOWN?: MTRTrainInfo[];
}

export interface MTRScheduleResponse {
  status: number;
  message: string;
  data: Record<string, MTRStationSchedule>;
  isdelay: string;
}

// NLB ETA response
export interface NLBETAItem {
  estimatedArrivalTime: string;
  routeVariantName: string;
  departed: number;
  noGPS: number;
  wheelChair: number;
  generateTime: string;
}

// KMB route data
export interface KMBRoute {
  route: string;
  bound: string;
  service_type: string;
  orig_tc: string;
  orig_sc: string;
  orig_en: string;
  dest_tc: string;
  dest_sc: string;
  dest_en: string;
}

// KMB stop data（全港站点列表项）
export interface KMBStop {
  stop: string;      // 16 位站点 ID
  name_en: string;
  name_tc: string;
  name_sc: string;
  lat: string;       // 纬度字符串
  long: string;      // 经度字符串
}

// KMB route-stop data（每路线每站的关系）
export interface KMBRouteStop {
  route: string;
  bound: 'I' | 'O';
  service_type: string;
  seq: string;       // 站序（字符串格式，需要 parseInt）
  stop: string;      // 对应 KMBStop.stop
}

// CTB route data
export interface CTBRoute {
  co: string;
  route: string;
  orig_tc: string;
  orig_sc: string;
  orig_en: string;
  dest_tc: string;
  dest_sc: string;
  dest_en: string;
}

// Fetcher result wrapper
export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// Output types (matching design doc)
// ============================================================

export interface RouteStep {
  type: 'walk' | 'bus' | 'mtr' | 'gmb' | 'tram' | 'ferry';
  description: string;
  route?: string;
  routeDetail?: string;
  from?: string;
  to?: string;
  duration: number;
  stops?: number;
  cost?: number;
}

export interface RouteOption {
  id: string;
  totalTime: number;
  totalDistance: string;
  type: 'direct' | 'transfer';
  steps: RouteStep[];
  estimatedCost: number;
  recommended?: boolean;      // 是否为推荐路线（基于实时数据的最优选择）
  realTimeData?: {
    nextBusArrival: string;   // 下一班车到达时间（如 "3分钟后" 或 "15:30"）
    totalTravelTime: number;  // 实时总时长（分钟）
    dataTimestamp: string;    // 数据获取时间戳
  };
}

export interface NextBusInfo {
  eta: string | null;
  minutesAway: number;
  remarks?: string;
}

export interface StopETAItem {
  route: string;
  destination: string;
  company: string;
  nextBuses: NextBusInfo[];
}

export interface StopETAList {
  stopId: string;
  stopName: string;
  etas: StopETAItem[];
}

export interface PaymentInfo {
  octopus: boolean;
  cash: boolean;
  creditCard: boolean;
  mobilePayment: boolean;
  notes: string[];
}

export interface ResponseMetadata {
  dataTimestamp: string;
  apisCalled: string[];
  apiStatus?: Record<string, 'success' | 'failed' | 'skipped'>;
}

// ============================================================
// 公交规划相关类型（planner.ts 使用）
// ============================================================

/** 搜索半径内的一个巴士站（含距离） */
export interface NearbyStop {
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
  distanceM: number;  // 距离查询坐标的米数
  company: 'KMB' | 'CTB';
}

/** 一个候选直达路线方案 */
export interface TransitCandidate {
  /** 运营公司/品牌：KMB/CTB/NLB/LWB/GMB/MTR/TRAM/FERRY/PTRAM */
  company: string;
  /** 交通方式：bus/gmb/tram/ferry/ptram/mtr */
  mode?: string;
  route: string;
  bound: string;              // KMB: 'I'/'O'；CTB: 'inbound'/'outbound'
  serviceType: string;
  boardStopId: string;
  boardStopName: string;
  boardSeq: number;
  alightStopId: string;
  alightStopName: string;
  alightSeq: number;
  numStops: number;           // 乘坐站数 = alightSeq - boardSeq
  walkInMeters: number;       // 起点到上车站步行距离
  walkOutMeters: number;      // 下车站到终点步行距离
  destination: string;        // 路线终点站名
  fare?: number | null;       // 票价（HKD）
  score: number;              // 综合评分（越小越优）
  
  // MTR 实时数据字段（由 buildMTRStationMap 填充）
  stationCode?: string;       // MTR 车站代码，如 "HUH"（红磡）
  mtrLine?: string;           // MTR 线路代码，如 "EAL"（东铁线）
  
  // 实时数据字段（由 enrichCandidateWithRealTimeETA 填充）
  realTimeETA?: {
    nextBusMinutes: number;   // 下一班车到达上车站的分钟数（-1 表示无数据）
    estimatedTripMinutes: number; // 预估行程时间（基于站数和历史数据）
    totalMinutes: number;     // 总时间 = 等待 + 行程 + 步行
    dataSource: 'kmb' | 'ctb' | 'lwb' | 'nlb' | 'gmb' | 'mtr' | 'static'; // 数据来源
    timestamp: string;        // ISO 时间戳
  };
}
