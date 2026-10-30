// 鲁港通 - 港铁线网与换乘寻路
//
// 政府数据只提供 87 个港铁站坐标，没有「哪条线经过哪些站」的拓扑。
// 旧实现按直线距离估算站数并直接宣称「起终点可直达」，导致
// 「中环→迪士尼 无需转线」「屯马线 15 站到中环」这类不存在的线路。
// 本模块维护一份静态线网（站序 + 线路 + 站内换乘/步行连通），
// 用 Dijkstra 求真实乘车方案，逐段给出线路、站数与耗时。

import { TRANSIT_DATA } from './transit';
import { haversineDistanceM } from '../fetcher';
import type { MtrLeg, MtrTransferStep } from '../types';

export interface MtrLine {
  id: string;
  name: string;
  /** 列车平均运行速度（公里/小时，含区间加减速） */
  speedKmh: number;
  /** 站序（按实际相邻关系排列） */
  stations: string[];
}

// 站序来自港铁官方线路图；只保留相邻关系有意义的车站。
// 部分车站不在政府坐标数据内（如香港站、尖东站），坐标在下方手工补齐。
export const MTR_LINES: MtrLine[] = [
  {
    id: 'ISL', name: '港岛线', speedKmh: 32,
    stations: ['坚尼地城', '香港大学', '西营盘', '上环', '中环', '金钟', '湾仔', '铜锣湾', '天后', '炮台山', '北角', '鲗鱼涌', '太古', '西湾河', '筲箕湾', '杏花邨', '柴湾'],
  },
  {
    id: 'TWL', name: '荃湾线', speedKmh: 32,
    stations: ['荃湾', '大窝口', '葵兴', '葵芳', '荔景', '美孚', '荔枝角', '长沙湾', '深水埗', '太子', '旺角', '油麻地', '佐敦', '尖沙咀', '金钟', '中环'],
  },
  {
    id: 'KTL', name: '观塘线', speedKmh: 32,
    stations: ['黄埔', '何文田', '旺角', '太子', '石硖尾', '九龙塘', '乐富', '黄大仙', '钻石山', '彩虹', '九龙湾', '牛头角', '观塘', '蓝田', '油塘', '调景岭'],
  },
  {
    id: 'TKL', name: '将军澳线', speedKmh: 34,
    stations: ['北角', '鲗鱼涌', '油塘', '调景岭', '将军澳', '坑口', '宝琳', '康城'],
  },
  {
    id: 'TCL', name: '东涌线', speedKmh: 52,
    stations: ['香港', '九龙', '奥运', '南昌', '荔景', '青衣', '欣澳', '东涌'],
  },
  {
    id: 'AEL', name: '机场快线', speedKmh: 70,
    stations: ['香港', '九龙', '青衣', '香港机场', '博览馆'],
  },
  {
    id: 'EAL', name: '东铁线', speedKmh: 44,
    stations: ['金钟', '会展', '红磡', '旺角东', '九龙塘', '大围', '沙田', '马场', '火炭', '大学', '大埔墟', '太和', '粉岭', '上水', '罗湖'],
  },
  {
    id: 'EAL_LMC', name: '东铁线（落马洲支线）', speedKmh: 44,
    stations: ['上水', '落马洲'],
  },
  {
    id: 'TML', name: '屯马线', speedKmh: 42,
    stations: ['屯门', '兆康', '天水围', '朗屏', '元朗', '锦上路', '荃湾西', '美孚', '南昌', '柯士甸', '尖东', '红磡', '何文田', '土瓜湾', '宋皇臺', '钻石山', '启德', '大围', '车公庙', '沙田围', '第一城', '石门', '大水坑', '恒安', '马鞍山', '乌溪沙'],
  },
  {
    id: 'SIL', name: '南港岛线', speedKmh: 33,
    stations: ['金钟', '海洋公园', '黄竹坑', '利东', '海怡半岛'],
  },
  {
    id: 'DRL', name: '迪士尼线', speedKmh: 40,
    stations: ['欣澳', '迪士尼'],
  },
];

// 政府坐标数据缺失的车站（用于线网连通与耗时计算，不参与起终点最近站选择）
const EXTRA_STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  '香港': { lat: 22.2850, lng: 114.1580 },
  '尖东': { lat: 22.2958, lng: 114.1750 },
  '会展': { lat: 22.2812, lng: 114.1751 },
  '荃湾西': { lat: 22.3683, lng: 114.1092 },
  '启德': { lat: 22.3271, lng: 114.1993 },
  '康城': { lat: 22.2930, lng: 114.2680 },
  '车公庙': { lat: 22.3736, lng: 114.1806 },
  '沙田围': { lat: 22.3797, lng: 114.1911 },
  '第一城': { lat: 22.3838, lng: 114.2034 },
  '石门': { lat: 22.3881, lng: 114.2094 },
  '大水坑': { lat: 22.3947, lng: 114.2240 },
  '恒安': { lat: 22.4012, lng: 114.2275 },
  '马鞍山': { lat: 22.4063, lng: 114.2310 },
  '乌溪沙': { lat: 22.4118, lng: 114.2420 },
};

// 站外/站内步行连通（非列车区间）
export interface MtrWalkLink {
  from: string;
  to: string;
  minutes: number;
  label: string;
}

export const MTR_WALK_LINKS: MtrWalkLink[] = [
  { from: '中环', to: '香港', minutes: 6, label: '中环站经行人通道步行至香港站' },
  { from: '尖沙咀', to: '尖东', minutes: 6, label: '尖沙咀站经地下通道步行至尖东站' },
  { from: '旺角', to: '旺角东', minutes: 9, label: '旺角站步行至旺角东站' },
];

/** 同站换乘平均耗时（下车走到另一线站台 + 候车） */
const TRANSFER_MINUTES = 4;
/** 首班车候车时间（发车间隔的一半） */
const INITIAL_WAIT_MINUTES = 2;
/**
 * 机场快线票价远高于其他线路，非机场行程不应被指到该线。
 * 只影响寻路权重，展示耗时仍用真实分钟。
 */
const AEL_ROUTE_WEIGHT = 2.0;

const stationCoords = new Map<string, { lat: number; lng: number }>();

function ensureCoords(): Map<string, { lat: number; lng: number }> {
  if (stationCoords.size > 0) return stationCoords;
  for (const s of TRANSIT_DATA.mtr?.stops || []) {
    stationCoords.set(s.name, { lat: s.lat, lng: s.lng });
  }
  for (const [name, coord] of Object.entries(EXTRA_STATION_COORDS)) {
    if (!stationCoords.has(name)) stationCoords.set(name, coord);
  }
  return stationCoords;
}

function edgeMinutes(a: string, b: string, speedKmh: number): number {
  const coords = ensureCoords();
  const pa = coords.get(a);
  const pb = coords.get(b);
  if (!pa || !pb) return 2;
  const km = haversineDistanceM(pa.lat, pa.lng, pb.lat, pb.lng) / 1000;
  return Math.max(1, Math.round((km / speedKmh) * 60 + 0.6));
}

export interface MtrJourney {
  legs: MtrLeg[];
  /** 换乘（同站换线）或步行连通的中间动作 */
  transferSteps: MtrTransferStep[];
  rideMinutes: number;
  transferMinutes: number;
  totalMinutes: number;
}

interface Edge {
  to: string;          // 节点键 `${lineId}::${station}`
  minutes: number;
  /** 寻路权重：默认等于 minutes，机场快线按票价加权以避开非机场行程 */
  weight: number;
  kind: 'ride' | 'transfer' | 'walk';
  lineId?: string;
  fromStation: string;
  toStation: string;
}

const nodeKey = (lineId: string, station: string) => `${lineId}::${station}`;
const splitKey = (key: string): { lineId: string; station: string } => {
  const idx = key.indexOf('::');
  return { lineId: key.slice(0, idx), station: key.slice(idx + 2) };
};

let graphCache: { adjacency: Map<string, Edge[]>; linesAt: Map<string, string[]> } | null = null;

function buildGraph() {
  if (graphCache) return graphCache;

  const adjacency = new Map<string, Edge[]>();
  const linesAt = new Map<string, string[]>();

  const addEdge = (from: string, edge: Edge) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(edge);
  };

  for (const line of MTR_LINES) {
    for (const station of line.stations) {
      if (!linesAt.has(station)) linesAt.set(station, []);
      linesAt.get(station)!.push(line.id);
    }

    for (let i = 0; i < line.stations.length - 1; i++) {
      const a = line.stations[i];
      const b = line.stations[i + 1];
      const minutes = edgeMinutes(a, b, line.speedKmh);
      const weight = minutes * (line.id === 'AEL' ? AEL_ROUTE_WEIGHT : 1);
      addEdge(nodeKey(line.id, a), { to: nodeKey(line.id, b), minutes, weight, kind: 'ride', lineId: line.id, fromStation: a, toStation: b });
      addEdge(nodeKey(line.id, b), { to: nodeKey(line.id, a), minutes, weight, kind: 'ride', lineId: line.id, fromStation: b, toStation: a });
    }
  }

  // 同站换乘
  for (const [station, lineIds] of linesAt.entries()) {
    for (const from of lineIds) {
      for (const to of lineIds) {
        if (from === to) continue;
        addEdge(nodeKey(from, station), {
          to: nodeKey(to, station),
          minutes: TRANSFER_MINUTES,
          weight: TRANSFER_MINUTES,
          kind: 'transfer',
          fromStation: station,
          toStation: station,
        });
      }
    }
  }

  // 步行连通
  for (const link of MTR_WALK_LINKS) {
    const fromLines = linesAt.get(link.from) || [];
    const toLines = linesAt.get(link.to) || [];
    for (const from of fromLines) {
      for (const to of toLines) {
        addEdge(nodeKey(from, link.from), {
          to: nodeKey(to, link.to),
          minutes: link.minutes,
          weight: link.minutes,
          kind: 'walk',
          fromStation: link.from,
          toStation: link.to,
        });
        addEdge(nodeKey(to, link.to), {
          to: nodeKey(from, link.from),
          minutes: link.minutes,
          weight: link.minutes,
          kind: 'walk',
          fromStation: link.to,
          toStation: link.from,
        });
      }
    }
  }

  graphCache = { adjacency, linesAt };
  return graphCache;
}

/** 车站是否存在于此线网（用于判断能否给出港铁方案） */
export function isMtrStation(name: string): boolean {
  return buildGraph().linesAt.has(name);
}

export function getMtrLinesAt(station: string): MtrLine[] {
  const ids = buildGraph().linesAt.get(station) || [];
  return MTR_LINES.filter(l => ids.includes(l.id));
}

/**
 * 规划两站之间的港铁行程（可跨线换乘）。
 * 同一车站、或不连通时返回 null —— 不允许上层自行推断「可直达」。
 */
export function planMtrJourney(fromStation: string, toStation: string): MtrJourney | null {
  if (!fromStation || !toStation || fromStation === toStation) return null;

  const { adjacency, linesAt } = buildGraph();
  const fromLines = linesAt.get(fromStation);
  const toLines = linesAt.get(toStation);
  if (!fromLines || !toLines) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, { key: string; edge: Edge }>();

  // 节点数很少（约 220 个），用简单的取最小法即可，避免引入额外依赖
  const queue = new Set<string>();
  for (const lineId of fromLines) {
    const key = nodeKey(lineId, fromStation);
    dist.set(key, 0);
    queue.add(key);
  }

  while (queue.size > 0) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const key of queue) {
      const d = dist.get(key) ?? Infinity;
      if (d < currentDist) {
        current = key;
        currentDist = d;
      }
    }
    if (current === null) break;
    queue.delete(current);

    for (const edge of adjacency.get(current) || []) {
      const nextDist = currentDist + edge.weight;
      if (nextDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nextDist);
        prev.set(edge.to, { key: current, edge });
        queue.add(edge.to);
      }
    }
  }

  let bestEnd: string | null = null;
  let bestDist = Infinity;
  for (const lineId of toLines) {
    const key = nodeKey(lineId, toStation);
    const d = dist.get(key);
    if (d !== undefined && d < bestDist) {
      bestDist = d;
      bestEnd = key;
    }
  }
  if (!bestEnd) return null;

  // 回溯
  const path: Edge[] = [];
  let cursor = bestEnd;
  while (prev.has(cursor)) {
    const step = prev.get(cursor)!;
    path.unshift(step.edge);
    cursor = step.key;
  }

  const legs: MtrLeg[] = [];
  const transferSteps: MtrJourney['transferSteps'] = [];
  let rideMinutes = 0;
  let transferMinutes = 0;

  for (const edge of path) {
    if (edge.kind === 'ride' && edge.lineId) {
      const last = legs[legs.length - 1];
      if (last && last.lineId === edge.lineId && last.to === edge.fromStation) {
        last.to = edge.toStation;
        last.stops += 1;
        last.minutes += edge.minutes;
      } else {
        const line = MTR_LINES.find(l => l.id === edge.lineId);
        legs.push({
          lineId: edge.lineId,
          lineName: line?.name || '港铁',
          from: edge.fromStation,
          to: edge.toStation,
          stops: 1,
          minutes: edge.minutes,
        });
      }
      rideMinutes += edge.minutes;
    } else if (edge.kind === 'transfer') {
      transferSteps.push({ type: 'transfer', station: edge.fromStation, minutes: edge.minutes, label: `${edge.fromStation}站内换乘（约${edge.minutes}分钟）` });
      transferMinutes += edge.minutes;
    } else {
      transferSteps.push({ type: 'walk', station: edge.fromStation, toStation: edge.toStation, minutes: edge.minutes, label: `从${edge.fromStation}站步行至${edge.toStation}站（约${edge.minutes}分钟）` });
      transferMinutes += edge.minutes;
    }
  }

  if (legs.length === 0) return null;

  return {
    legs,
    transferSteps,
    rideMinutes,
    transferMinutes,
    totalMinutes: rideMinutes + transferMinutes + INITIAL_WAIT_MINUTES,
  };
}

export const MTR_INITIAL_WAIT_MINUTES = INITIAL_WAIT_MINUTES;
