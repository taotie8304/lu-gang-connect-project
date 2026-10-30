// 鲁港通 - 多模态公交路径规划器
//
// 数据源：src/data/transit.ts（由 scripts/prepare-data.mjs 从香港政府官方
// JSON_BUS/JSON_GMB/JSON_TRAM/JSON_FERRY/JSON_PTRAM 紧凑而来）
// 覆盖交通工具：KMB/CTB/NLB/LWB 巴士、专线小巴、电车、渡轮、山顶缆车、港铁站
//
// 算法（MVP：多模态直达 + MTR 推荐）：
//   1. 起终点坐标附近（800m）内的所有站（不分 mode）
//   2. 找"同时经过 A 中某站和 B 中某站，A 站序 < B 站序（同方向）"的路线
//   3. MTR 特殊：若起终点附近各有 MTR 站，推荐"起 MTR 站 → 终 MTR 站"
//   4. 评分：mode 权重（MTR=0.5, 巴士=1, 小巴=1.1, 电车=1.2）× 站数 + 步行距离/100

import type { TransitCandidate, NearbyStop } from './types';
import { haversineDistanceM } from './fetcher';
import { TRANSIT_DATA, type TransitStop } from './data/transit';
import { planMtrJourney } from './data/mtr-network';
import { estimateRideMinutes, segmentRunMinutes } from './journey-time';

const NEARBY_RADIUS_M = 1200;
const MAX_NEARBY_STOPS = 15;
const MAX_CANDIDATES = 10;

// 步行路径校正系数（城市中直线距离 vs 实际道路距离的典型比例）
const WALK_DETOUR_FACTOR = 1.4;

// ============================================================
// 通宵线识别与香港时区判断（深夜排序优化：通宵线白天沉底）
// ============================================================

// N/NA 字头 = 通宵巴士线（如 N23 / N21A / NA21；实测全库 N 字头均为通宵巴士）。
// 通宵线车程短，历史问题：白天规划时因评分低排到首位，误导"日间推荐"
const OVERNIGHT_ROUTE_RE = /^N[A-Z]?\d/;

// 鲁港通 - 机场快线成人八达通单程票价（按上车站），普通港铁票价的十倍量级
const AEL_FARE_BY_BOARD: Record<string, number> = {
  '香港': 115,
  '九龙': 105,
  '青衣': 70,
  '香港机场': 6,
  '博览馆': 6,
};
// 转乘机场快线前的普通港铁接驳段票价
const MTR_FEEDER_FARE = 10;
// 日间惩罚值：兜底场景（未过滤干净）仍确保日间候选整列排前
const OVERNIGHT_DAYTIME_PENALTY = 1000;

export function isOvernightRoute(routeName: string): boolean {
  return OVERNIGHT_ROUTE_RE.test((routeName || '').trim());
}

const HK_HOUR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Hong_Kong',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** 香港时区是否处于日间（06:00–23:59）；通宵线只在 00:00–05:59 保持原始排序 */
export function isHongKongDaytime(now: Date = new Date()): boolean {
  const hour = parseInt(HK_HOUR_FORMAT.format(now), 10);
  return hour >= 6 && hour <= 23;
}

// MTR 站点名 → { line(线路代码), code(车站代码) } 映射表
// 数据来源: https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv (2025)
// 换乘站取其主要线路
const MTR_STATION_MAP: Record<string, { line: string; code: string }> = {
  '坚尼地城': { line: 'ISL', code: 'KET' },
  '香港大学': { line: 'ISL', code: 'HKU' },
  '西营盘': { line: 'ISL', code: 'SYP' },
  '上环': { line: 'ISL', code: 'SHW' },
  '中环': { line: 'TWL', code: 'CEN' },
  '金钟': { line: 'TWL', code: 'ADM' },
  '湾仔': { line: 'ISL', code: 'WAC' },
  '铜锣湾': { line: 'ISL', code: 'CAB' },
  '天后': { line: 'ISL', code: 'TIH' },
  '炮台山': { line: 'ISL', code: 'FOH' },
  '北角': { line: 'ISL', code: 'NOP' },
  '鲗鱼涌': { line: 'ISL', code: 'QUB' },
  '太古': { line: 'ISL', code: 'TAK' },
  '西湾河': { line: 'ISL', code: 'SWH' },
  '筲箕湾': { line: 'ISL', code: 'SKW' },
  '杏花邨': { line: 'ISL', code: 'HFC' },
  '柴湾': { line: 'ISL', code: 'CHW' },
  '尖沙咀': { line: 'TWL', code: 'TST' },
  '佐敦': { line: 'TWL', code: 'JOR' },
  '油麻地': { line: 'TWL', code: 'YMT' },
  '旺角': { line: 'TWL', code: 'MOK' },
  '太子': { line: 'TWL', code: 'PRE' },
  '深水埗': { line: 'TWL', code: 'SSP' },
  '长沙湾': { line: 'TWL', code: 'CSW' },
  '荔枝角': { line: 'TWL', code: 'LCK' },
  '美孚': { line: 'TWL', code: 'MEF' },
  '荔景': { line: 'TWL', code: 'LAK' },
  '葵芳': { line: 'TWL', code: 'KWF' },
  '葵兴': { line: 'TWL', code: 'KWH' },
  '大窝口': { line: 'TWL', code: 'TWH' },
  '荃湾': { line: 'TWL', code: 'TSW' },
  '油塘': { line: 'KTL', code: 'YAT' },
  '调景岭': { line: 'KTL', code: 'TIK' },
  '将军澳': { line: 'TKL', code: 'TKO' },
  '坑口': { line: 'TKL', code: 'HAH' },
  '宝琳': { line: 'TKL', code: 'POA' },
  '九龙塘': { line: 'KTL', code: 'KOT' },
  '乐富': { line: 'KTL', code: 'LOF' },
  '黄大仙': { line: 'KTL', code: 'WTS' },
  '钻石山': { line: 'KTL', code: 'DIH' },
  '彩虹': { line: 'KTL', code: 'CHH' },
  '九龙湾': { line: 'KTL', code: 'KOB' },
  '牛头角': { line: 'KTL', code: 'NTK' },
  '观塘': { line: 'KTL', code: 'KWT' },
  '蓝田': { line: 'KTL', code: 'LAT' },
  '何文田': { line: 'KTL', code: 'HOM' },
  '黄埔': { line: 'KTL', code: 'WHA' },
  '东涌': { line: 'TCL', code: 'TUC' },
  '欣澳': { line: 'TCL', code: 'SUN' },
  '青衣': { line: 'TCL', code: 'TSY' },
  '南昌': { line: 'TCL', code: 'NAC' },
  '奥运': { line: 'TCL', code: 'OLY' },
  '九龙': { line: 'TCL', code: 'KOW' },
  '香港机场': { line: 'AEL', code: 'AIR' },
  '博览馆': { line: 'AEL', code: 'AWE' },
  '红磡': { line: 'EAL', code: 'HUH' },
  '旺角东': { line: 'EAL', code: 'MKK' },
  '大围': { line: 'EAL', code: 'TAW' },
  '沙田': { line: 'EAL', code: 'SHT' },
  '火炭': { line: 'EAL', code: 'FOT' },
  '马场': { line: 'EAL', code: 'RAC' },
  '大学': { line: 'EAL', code: 'UNI' },
  '大埔墟': { line: 'EAL', code: 'TAP' },
  '太和': { line: 'EAL', code: 'TWO' },
  '粉岭': { line: 'EAL', code: 'FAN' },
  '上水': { line: 'EAL', code: 'SHS' },
  '罗湖': { line: 'EAL', code: 'LOW' },
  '落马洲': { line: 'EAL', code: 'LMC' },
  '屯门': { line: 'TML', code: 'TUM' },
  '兆康': { line: 'TML', code: 'SIH' },
  '天水围': { line: 'TML', code: 'TIS' },
  '朗屏': { line: 'TML', code: 'LOP' },
  '元朗': { line: 'TML', code: 'YUL' },
  '锦上路': { line: 'TML', code: 'KSR' },
  '柯士甸': { line: 'TML', code: 'AUS' },
  '宋皇臺': { line: 'TML', code: 'SUW' },
  '土瓜湾': { line: 'TML', code: 'TKW' },
  '石硖尾': { line: 'KTL', code: 'SKM' },
  '海洋公园': { line: 'SIL', code: 'OCP' },
  '黄竹坑': { line: 'SIL', code: 'WCH' },
  '利东': { line: 'SIL', code: 'LET' },
  '海怡半岛': { line: 'SIL', code: 'SOH' },
  '西九龙站': { line: 'TML', code: 'AUS' },
  '迪士尼': { line: 'DRL', code: 'DIS' },
  // 鲁港通 - 线网补齐：车站代码用于港铁实时班次查询，缺失时退化为静态候车时间
  '香港': { line: 'TCL', code: 'HOK' },
  '尖东': { line: 'TML', code: 'ETS' },
  '会展': { line: 'EAL', code: 'EXH' },
  '荃湾西': { line: 'TML', code: 'TWW' },
  '启德': { line: 'TML', code: 'KAI' },
  '康城': { line: 'TKL', code: 'LHP' },
  '车公庙': { line: 'TML', code: 'CKT' },
  '沙田围': { line: 'TML', code: 'SHM' },
  '第一城': { line: 'TML', code: 'CIO' },
  '石门': { line: 'TML', code: 'SHE' },
  '大水坑': { line: 'TML', code: 'TSH' },
  '恒安': { line: 'TML', code: 'HEO' },
  '马鞍山': { line: 'TML', code: 'MOS' },
  '乌溪沙': { line: 'TML', code: 'WKS' },
};

// ============================================================
// 索引（启动时构建一次，模块级单例）
// ============================================================

interface StopWithMode extends TransitStop {
  mode: string;  // 'bus' | 'gmb' | 'tram' | 'ferry' | 'ptram' | 'mtr'
}

interface RouteInfo {
  rid: number;
  co: string;
  mode: string;
  name: string;
  origin: string;
  dest: string;
  fare: number | null;
  time: number | null;
}

interface RouteStopEntry {
  rid: number;
  seq: number;  // 方向 1/2
  sseq: number; // 站序
}

/** routeStop 展平后的坐标索引项：每条路线上的每个站一个条目 */
interface RouteStopPoint {
  rid: number;
  seq: number;
  sseq: number;
  sid: number;
  lat: number;
  lng: number;
  stopName: string;
}

/** 路线方向几何：按站序累计里程与物理耗时，供车程估算 */
interface RouteGeometry {
  totalKm: number;
  bySseq: Map<number, { cumKm: number; cumMinutes: number }>;
}

interface TransitIndex {
  /** sid → stop (含 mode) */
  stopById: Map<number, StopWithMode>;
  /** sid → 经过该站的路线序列列表 */
  routesByStop: Map<number, Array<{ key: string } & RouteStopEntry>>;
  /** "rid|seq" → 该路线方向的所有站（按 sseq 升序） */
  stopsByRoute: Map<string, Array<{ sid: number; sseq: number }>>;
  /** rid → 路线元信息 */
  routeMeta: Map<number, RouteInfo>;
  /** 所有 MTR 站（供 MTR 推荐快捷路径） */
  mtrStops: StopWithMode[];
  /** 所有路线-站点的展平坐标索引（关键！用于按坐标查附近 "路线上的某站"） */
  routeStopPoints: RouteStopPoint[];
  /** "rid|seq" → 沿线路的累计里程/耗时 */
  routeGeom: Map<string, RouteGeometry>;
}

let indexCache: TransitIndex | null = null;

function buildIndex(): TransitIndex {
  if (indexCache) return indexCache;

  const stopById = new Map<number, StopWithMode>();
  const routesByStop = new Map<number, Array<{ key: string } & RouteStopEntry>>();
  const stopsByRoute = new Map<string, Array<{ sid: number; sseq: number }>>();
  const routeMeta = new Map<number, RouteInfo>();
  const mtrStops: StopWithMode[] = [];
  const routeStopPoints: RouteStopPoint[] = [];
  const routeGeom = new Map<string, RouteGeometry>();

  for (const [mode, modeData] of Object.entries(TRANSIT_DATA)) {
    if (!modeData) continue;

    for (const s of modeData.stops) {
      const withMode: StopWithMode = { ...s, mode };
      stopById.set(s.sid, withMode);
      if (mode === 'mtr') mtrStops.push(withMode);
    }

    for (const r of modeData.routes) {
      routeMeta.set(r.rid, { ...r, mode });
    }

    for (const rs of modeData.routeStops) {
      const key = `${rs.rid}|${rs.seq}`;
      if (!routesByStop.has(rs.sid)) routesByStop.set(rs.sid, []);
      routesByStop.get(rs.sid)!.push({ key, rid: rs.rid, seq: rs.seq, sseq: rs.sseq });
      if (!stopsByRoute.has(key)) stopsByRoute.set(key, []);
      stopsByRoute.get(key)!.push({ sid: rs.sid, sseq: rs.sseq });

      const stop = stopById.get(rs.sid);
      if (stop) {
        routeStopPoints.push({
          rid: rs.rid,
          seq: rs.seq,
          sseq: rs.sseq,
          sid: rs.sid,
          lat: stop.lat,
          lng: stop.lng,
          stopName: stop.name,
        });
      }
    }
  }

  for (const arr of stopsByRoute.values()) {
    arr.sort((a, b) => a.sseq - b.sseq);
  }

  // 鲁港通 - 预计算每条路线方向的累计里程与物理耗时（一次构建，长期复用）
  for (const [key, arr] of stopsByRoute.entries()) {
    const bySseq = new Map<number, { cumKm: number; cumMinutes: number }>();
    let cumKm = 0;
    let cumMinutes = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i > 0) {
        const prev = stopById.get(arr[i - 1].sid);
        const cur = stopById.get(arr[i].sid);
        if (prev && cur) {
          const km = haversineDistanceM(prev.lat, prev.lng, cur.lat, cur.lng) / 1000;
          cumKm += km;
          cumMinutes += segmentRunMinutes(km);
        }
      }
      bySseq.set(arr[i].sseq, { cumKm, cumMinutes });
    }
    routeGeom.set(key, { totalKm: cumKm, bySseq });
  }

  indexCache = { stopById, routesByStop, stopsByRoute, routeMeta, mtrStops, routeStopPoints, routeGeom };
  return indexCache;
}

// ============================================================
// 工具：mode → NearbyStop.company（UI 显示公司名）
// ============================================================

function modeToCompany(stopMode: string, routeCo?: string): string {
  if (stopMode === 'mtr') return 'MTR';
  if (stopMode === 'gmb') return 'GMB';
  if (stopMode === 'tram') return 'TRAM';
  if (stopMode === 'ferry') return 'FERRY';
  if (stopMode === 'ptram') return 'PTRAM';
  return routeCo || 'BUS';
}

// ============================================================
// 附近站点查找（所有 mode 合并）
// ============================================================

function findNearbyStops(
  index: TransitIndex,
  lat: number, lng: number,
  radius: number = NEARBY_RADIUS_M
): NearbyStop[] {
  const out: NearbyStop[] = [];
  for (const s of index.stopById.values()) {
    if (Math.abs(s.lat - lat) > 0.01 || Math.abs(s.lng - lng) > 0.01) continue;
    const d = haversineDistanceM(lat, lng, s.lat, s.lng);
    if (d <= radius) {
      out.push({
        stopId: String(s.sid),
        stopName: s.name,
        lat: s.lat,
        lng: s.lng,
        distanceM: d,
        company: (modeToCompany(s.mode) === 'MTR' ? 'KMB' : 'KMB') as 'KMB' | 'CTB', // 占位，详细公司由路线元信息给出
      });
    }
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, MAX_NEARBY_STOPS);
}

// ============================================================
// 直达路线搜索（按坐标匹配，而非 sid；关键修复：同一物理位置
// 在不同公司/路线的 stopId 不同，按 sid 匹配会漏掉大量直达）
// ============================================================

function findDirectRoutes(
  index: TransitIndex,
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  radius: number = NEARBY_RADIUS_M,
  includeOvernight = false
): TransitCandidate[] {
  // 对所有 routeStopPoints 做单次扫描，分别收集：
  //   nearOrigin[rid|seq] → 该路线方向上，距起点最近的那个站
  //   nearDest[rid|seq]   → 该路线方向上，距终点最近的那个站
  interface NearEntry {
    sseq: number;
    sid: number;
    stopName: string;
    distanceM: number;
  }
  const nearOrigin = new Map<string, NearEntry>();
  const nearDest = new Map<string, NearEntry>();

  // 鲁港通 - 日间标记：通宵线（N/NA 字头）在日间时段加惩罚分沉底
  const daytime = isHongKongDaytime();

  const latEps = 0.01, lngEps = 0.01;

  for (const p of index.routeStopPoints) {
    // 快速地理剪枝
    const dLatO = Math.abs(p.lat - originLat);
    const dLngO = Math.abs(p.lng - originLng);
    if (dLatO <= latEps && dLngO <= lngEps) {
      const d = haversineDistanceM(originLat, originLng, p.lat, p.lng);
      if (d <= radius) {
        const key = `${p.rid}|${p.seq}`;
        const prev = nearOrigin.get(key);
        // 取"距起点最近的站"但优先 sseq 较小的（更早上车 = 有更长同路可行）
        // 其实对起点：优先最近的，如果并列再取 sseq 小
        if (!prev || d < prev.distanceM) {
          nearOrigin.set(key, { sseq: p.sseq, sid: p.sid, stopName: p.stopName, distanceM: d });
        }
      }
    }
    const dLatD = Math.abs(p.lat - destLat);
    const dLngD = Math.abs(p.lng - destLng);
    if (dLatD <= latEps && dLngD <= lngEps) {
      const d = haversineDistanceM(destLat, destLng, p.lat, p.lng);
      if (d <= radius) {
        const key = `${p.rid}|${p.seq}`;
        const prev = nearDest.get(key);
        if (!prev || d < prev.distanceM) {
          nearDest.set(key, { sseq: p.sseq, sid: p.sid, stopName: p.stopName, distanceM: d });
        }
      }
    }
  }

  // 交集：同 rid|seq，且 起点站 sseq < 终点站 sseq
  const candidates: TransitCandidate[] = [];
  for (const [key, o] of nearOrigin.entries()) {
    const d = nearDest.get(key);
    if (!d) continue;
    if (o.sseq >= d.sseq) continue;  // 方向不对

    const [ridStr, seqStr] = key.split('|');
    const rid = parseInt(ridStr, 10);
    const seq = parseInt(seqStr, 10);
    const meta = index.routeMeta.get(rid);
    if (!meta) continue;

    const numStops = d.sseq - o.sseq;
    if (numStops <= 0) continue;

    // 鲁港通 - 真实车程：官方全程时间 × 站数/距离分摊，与物理速度模型取中位数
    const geom = index.routeGeom.get(key);
    const totalStops = index.stopsByRoute.get(key)?.length ?? 0;
    const totalKm = geom?.totalKm ?? 0;
    const fromCum = geom?.bySseq.get(o.sseq);
    const toCum = geom?.bySseq.get(d.sseq);
    const legKm = fromCum && toCum ? Math.max(0, toCum.cumKm - fromCum.cumKm) : 0;
    const physicalMinutes = fromCum && toCum
      ? Math.max(0, toCum.cumMinutes - fromCum.cumMinutes)
      : null;
    const rideMinutes = estimateRideMinutes({
      officialMinutes: meta.time,
      legStops: numStops,
      totalStops,
      legKm,
      totalKm,
      physicalMinutes,
    });

    const isOvernight = isOvernightRoute(meta.name);

    // 白天直接剔除通宵线，不再给出「白天可乘 N 线」的误导方案
    if (isOvernight && daytime && !includeOvernight) continue;

    // 步行距离校正（城市直线距离 × 1.4 ≈ 实际道路距离）
    const correctedWalkIn = o.distanceM === 0 ? 0 : Math.round(o.distanceM * WALK_DETOUR_FACTOR);
    const correctedWalkOut = d.distanceM === 0 ? 0 : Math.round(d.distanceM * WALK_DETOUR_FACTOR);
    const walkMinutes = (correctedWalkIn + correctedWalkOut) / 80;
    const score = rideMinutes + walkMinutes + (isOvernight && daytime ? OVERNIGHT_DAYTIME_PENALTY : 0);

    candidates.push({
      company: modeToCompany(meta.mode, meta.co),
      mode: meta.mode,
      route: meta.name,
      bound: seq === 1 ? 'O' : 'I',
      serviceType: '1',
      boardStopId: String(o.sid),
      boardStopName: o.stopName,
      boardSeq: o.sseq,
      alightStopId: String(d.sid),
      alightStopName: d.stopName,
      alightSeq: d.sseq,
      numStops,
      walkInMeters: correctedWalkIn,
      walkOutMeters: correctedWalkOut,
      destination: meta.dest,
      fare: meta.fare,
      score,
      isOvernight,
      rideMinutes,
      officialRouteMinutes: meta.time,
      legKm: Math.round(legKm * 10) / 10,
      totalKm: Math.round(totalKm * 10) / 10,
      serviceNote: isOvernight ? '通宵线（约 00:30–05:00 提供服务），日间不适用' : undefined,
    });
  }

  // 去重：同一 "路线名+方向" 可能有多条 rid（KMB vs CTB 共营或子路线），留评分最好
  const best = new Map<string, TransitCandidate>();
  for (const c of candidates) {
    const k = `${c.company}|${c.route}|${c.bound}`;
    const prev = best.get(k);
    if (!prev || c.score < prev.score) best.set(k, c);
  }

  const arr = Array.from(best.values());
  arr.sort((a, b) => a.score - b.score);
  return arr.slice(0, MAX_CANDIDATES);
}

// ============================================================
// MTR 推荐（站网连通，起终点附近各有 MTR 站就推）
// ============================================================

function recommendMTR(
  index: TransitIndex,
  originLat: number, originLng: number,
  destLat: number, destLng: number
): TransitCandidate | null {
  let nearA: { stop: StopWithMode; d: number } | null = null;
  let nearB: { stop: StopWithMode; d: number } | null = null;

  for (const s of index.mtrStops) {
    const dA = haversineDistanceM(originLat, originLng, s.lat, s.lng);
    if (dA <= 1000 && (!nearA || dA < nearA.d)) nearA = { stop: s, d: dA };
    const dB = haversineDistanceM(destLat, destLng, s.lat, s.lng);
    if (dB <= 1000 && (!nearB || dB < nearB.d)) nearB = { stop: s, d: dB };
  }

  if (!nearA || !nearB) return null;
  if (nearA.stop.sid === nearB.stop.sid) return null;

  // 鲁港通 - 必须由线网寻路得出真实线路，不允许「最近两站即直达」
  const journey = planMtrJourney(nearA.stop.name, nearB.stop.name);
  if (!journey) return null;

  // 起点/终点若需经站外步行通道换站（如中环→香港），计入步行段
  let walkInMeters = nearA.d === 0 ? 0 : Math.round(nearA.d * WALK_DETOUR_FACTOR);
  let walkOutMeters = nearB.d === 0 ? 0 : Math.round(nearB.d * WALK_DETOUR_FACTOR);
  const boardStation = journey.legs[0].from;
  const alightStation = journey.legs[journey.legs.length - 1].to;

  const leadStep = journey.transferSteps[0];
  if (leadStep && leadStep.type === 'walk' && leadStep.station === nearA.stop.name && leadStep.toStation === boardStation) {
    walkInMeters += leadStep.minutes * 80;
    journey.transferSteps.shift();
  }
  const tailStep = journey.transferSteps[journey.transferSteps.length - 1];
  if (tailStep && tailStep.type === 'walk' && tailStep.toStation === nearB.stop.name && tailStep.station === alightStation) {
    walkOutMeters += tailStep.minutes * 80;
    journey.transferSteps.pop();
  }

  const approxStations = journey.legs.reduce((sum, leg) => sum + leg.stops, 0);

  // 港铁票价大致估算：普通线路单程约 HK$5-30，按直线距离线性估；
  // 机场快线票价远高于普通港铁，按上车站单独计价，不能套用距离公式
  const distM = haversineDistanceM(nearA.stop.lat, nearA.stop.lng, nearB.stop.lat, nearB.stop.lng);
  const aelLeg = journey.legs.find(leg => leg.lineId === 'AEL');
  const estFare = aelLeg
    ? (AEL_FARE_BY_BOARD[aelLeg.from] ?? 70) + (journey.legs.length > 1 ? MTR_FEEDER_FARE : 0)
    : Math.min(30, Math.max(5, Math.round(distM / 1000 * 2.5)));

  const boardMapping = MTR_STATION_MAP[boardStation];
  const rideMinutes = journey.rideMinutes + journey.transferMinutes;

  return {
    company: 'MTR',
    mode: 'mtr',
    route: journey.legs.map(leg => leg.lineName).join(' → '),
    bound: 'O',
    serviceType: '1',
    boardStopId: `mtr-${boardStation}`,
    boardStopName: `${boardStation}站`,
    boardSeq: 1,
    alightStopId: `mtr-${alightStation}`,
    alightStopName: `${alightStation}站`,
    alightSeq: approxStations + 1,
    numStops: approxStations,
    walkInMeters,
    walkOutMeters,
    destination: `${alightStation}站`,
    fare: estFare,
    score: rideMinutes + (walkInMeters + walkOutMeters) / 80,
    rideMinutes,
    mtrLegs: journey.legs,
    mtrTransferSteps: journey.transferSteps,
    stationCode: boardMapping?.code,
    mtrLine: boardMapping?.line,
  };
}

// ============================================================
// 主入口
// ============================================================

export interface PlanResult {
  candidates: TransitCandidate[];
  indexError?: string;
  noNearbyStops?: boolean;
  /** 日间查询且只找到通宵线：上层应提示「白天无此线路」 */
  overnightOnly?: boolean;
}

export async function planPublicTransit(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<PlanResult> {
  const index = buildIndex();

  // 直接坐标匹配找直达路线（跨公司/跨 mode，日间已剔除通宵线）
  const candidates = findDirectRoutes(index, originLat, originLng, destLat, destLng);

  // 额外推 MTR（作为高优先级选项）
  const mtrRec = recommendMTR(index, originLat, originLng, destLat, destLng);
  if (mtrRec) {
    candidates.unshift(mtrRec);
  }

  if (candidates.length === 0) {
    // 退一步检查：起终点附近 1500m 内是否有任何公交站
    const hasNearby =
      index.routeStopPoints.some(p => haversineDistanceM(originLat, originLng, p.lat, p.lng) <= 1500) &&
      index.routeStopPoints.some(p => haversineDistanceM(destLat, destLng, p.lat, p.lng) <= 1500);

    // 白天无候选时，判断是否只有通宵线覆盖（用于给出更准确的无方案说明）
    let overnightOnly = false;
    if (hasNearby && isHongKongDaytime()) {
      const nightCandidates = findDirectRoutesForOvernightOnly(index, originLat, originLng, destLat, destLng);
      overnightOnly = nightCandidates.length > 0;
    }

    return { candidates: [], noNearbyStops: !hasNearby, overnightOnly };
  }

  // 统一重新排序
  candidates.sort((a, b) => a.score - b.score);
  return { candidates: candidates.slice(0, MAX_CANDIDATES) };
}

/** 仅供「日间只剩通宵线」的判定使用：临时关闭日间过滤，看是否有通宵线覆盖 */
function findDirectRoutesForOvernightOnly(
  index: TransitIndex,
  originLat: number, originLng: number,
  destLat: number, destLng: number
): TransitCandidate[] {
  return findDirectRoutes(index, originLat, originLng, destLat, destLng, NEARBY_RADIUS_M, true)
    .filter(c => c.isOvernight);
}

// 为外部诊断保留
export function getLastIndexError(): string | undefined { return undefined; }
