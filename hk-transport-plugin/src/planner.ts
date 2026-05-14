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

const NEARBY_RADIUS_M = 1200;
const MAX_NEARBY_STOPS = 15;
const MAX_CANDIDATES = 10;

// 步行路径校正系数（城市中直线距离 vs 实际道路距离的典型比例）
const WALK_DETOUR_FACTOR = 1.4;

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

  indexCache = { stopById, routesByStop, stopsByRoute, routeMeta, mtrStops, routeStopPoints };
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

function modeScoreWeight(mode: string): number {
  switch (mode) {
    case 'mtr': return 0.5;     // 港铁最优先
    case 'bus': return 1.0;
    case 'gmb': return 1.1;
    case 'tram': return 1.2;
    case 'ferry': return 1.3;
    case 'ptram': return 1.5;
    default: return 1.0;
  }
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
  radius: number = NEARBY_RADIUS_M
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
    const modeW = modeScoreWeight(meta.mode);
    // 步行距离校正（城市直线距离 × 1.4 ≈ 实际道路距离）
    const correctedWalkIn = o.distanceM === 0 ? 0 : Math.round(o.distanceM * WALK_DETOUR_FACTOR);
    const correctedWalkOut = d.distanceM === 0 ? 0 : Math.round(d.distanceM * WALK_DETOUR_FACTOR);
    const score = modeW * numStops + (correctedWalkIn + correctedWalkOut) / 100;

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

  const distM = haversineDistanceM(nearA.stop.lat, nearA.stop.lng, nearB.stop.lat, nearB.stop.lng);
  const approxStations = Math.max(1, Math.round(distM / 1500));  // 粗略估算：MTR 站间距约 1.5km

  // 港铁票价大致估算（单程约 HK$5-30，按距离线性估）
  const estFare = Math.min(30, Math.max(5, Math.round(distM / 1000 * 2.5)));

  // MTR 站-线路映射（供实时 ETA 查询使用）
  const boardMapping = MTR_STATION_MAP[nearA.stop.name];
  const alightMapping = MTR_STATION_MAP[nearB.stop.name];

  // 步行距离校正（城市直线距离 × 1.4 ≈ 实际道路距离，起点就在站内时不校正）
  const walkInCorrected = nearA.d === 0 ? 0 : Math.round(nearA.d * WALK_DETOUR_FACTOR);
  const walkOutCorrected = nearB.d === 0 ? 0 : Math.round(nearB.d * WALK_DETOUR_FACTOR);

  return {
    company: 'MTR',
    mode: 'mtr',
    route: '港铁',
    bound: 'O',
    serviceType: '1',
    boardStopId: `mtr-${nearA.stop.sid}`,
    boardStopName: `${nearA.stop.name}站`,
    boardSeq: 1,
    alightStopId: `mtr-${nearB.stop.sid}`,
    alightStopName: `${nearB.stop.name}站`,
    alightSeq: approxStations + 1,
    numStops: approxStations,
    walkInMeters: walkInCorrected,
    walkOutMeters: walkOutCorrected,
    destination: `${nearB.stop.name}站方向`,
    fare: estFare,
    score: 0.5 * approxStations + (walkInCorrected + walkOutCorrected) / 100,
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
}

export async function planPublicTransit(
  originLat: number, originLng: number,
  destLat: number, destLng: number
): Promise<PlanResult> {
  const index = buildIndex();

  // 直接坐标匹配找直达路线（跨公司/跨 mode）
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
    return { candidates: [], noNearbyStops: !hasNearby };
  }

  // 统一重新排序
  candidates.sort((a, b) => a.score - b.score);
  return { candidates: candidates.slice(0, MAX_CANDIDATES) };
}

// 为外部诊断保留
export function getLastIndexError(): string | undefined { return undefined; }
