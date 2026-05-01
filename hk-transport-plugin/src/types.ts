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
