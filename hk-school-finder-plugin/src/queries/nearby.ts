// 鲁港通 - 附近学校：nearest-schools API URL 构造 + 响应解析（同校多班次去重合并 + 距离计算）
import { normalizeCjk } from '../cjk';
import { NEAREST_SCHOOLS_API } from '../config';
import { normalizeLevel, type SchoolLevel } from './search';

/** 附近学校条目（同一学校多个班次已合并为一条） */
export interface NearbySchool {
  /** 校名（简体；中文缺失时用英文名） */
  name: string;
  /** 英文校名 */
  nameEn: string;
  /** 归一化级别 */
  level: SchoolLevel;
  /** 类别（简体，如「幼稚园」） */
  category: string;
  /** 区域（简体，如「油尖旺区」） */
  district: string;
  /** 地址（简体） */
  address: string;
  /** 电话 */
  telephone: string;
  /** 网站 */
  website: string;
  /** 班次（简体，如「上午」「下午」「全日」，已合并去重） */
  sessions: string[];
  /** 与锚点的距离（米，四舍五入） */
  distanceMeters: number;
}

export interface NearbyParseOptions {
  /** 按级别过滤 */
  level?: SchoolLevel;
}

export interface NearbyQueryOptions {
  /** 坐标锚点（GeoAnchor 兼容；本模块只用 lat/lng） */
  anchor: { lat: number; lng: number };
  /** 返回条数上限（API 上限 20，默认 10） */
  max?: number;
  level?: SchoolLevel;
  /** 注入的 JSON 获取函数（测试桩；缺省走全局 fetch，实时接口不缓存） */
  fetchJson?: (url: string) => Promise<unknown>;
}

/** nearest-schools API 返回条数上限（官方限制） */
export const NEARBY_MAX_LIMIT = 20;
const DEFAULT_NEARBY_MAX = 10;

/** nearest-schools API 记录（24 字段，data.gov.hk） */
interface NearestRaw {
  'lat-long'?: unknown;
  'name-zh'?: unknown;
  'name-en'?: unknown;
  'address-zh'?: unknown;
  'address-en'?: unknown;
  'category-zh'?: unknown;
  'category-en'?: unknown;
  'district-zh'?: unknown;
  'district-en'?: unknown;
  'session-zh'?: unknown;
  'session-en'?: unknown;
  'level-en'?: unknown;
  telephone?: unknown;
  website?: unknown;
}

/** 构造 nearest-schools 查询 URL（max 夹取到 1–20） */
export function buildNearbyUrl(lat: number, lng: number, max = DEFAULT_NEARBY_MAX): string {
  const clamped = Math.min(NEARBY_MAX_LIMIT, Math.max(1, Math.floor(max)));
  return `${NEAREST_SCHOOLS_API}?lat=${lat}&long=${lng}&max=${clamped}`;
}

/** 两坐标点球面距离（米，haversine） */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * 解析 nearest-schools 响应：按（校名 + 地址）去重合并同校多班次记录，
 * 计算与锚点的距离；坏记录（缺坐标/缺名）跳过。
 */
export function parseNearestResponse(
  json: unknown,
  anchor: { lat: number; lng: number },
  options: NearbyParseOptions = {}
): NearbySchool[] {
  const results = (json as { results?: unknown } | null | undefined)?.results;
  if (!Array.isArray(results)) return [];

  const merged = new Map<string, { school: NearbySchool; sessions: Set<string> }>();
  for (const item of results) {
    if (item === null || typeof item !== 'object') continue;
    const raw = item as NearestRaw;
    const coord = parseLatLong(raw['lat-long']);
    if (!coord) continue;
    const level = normalizeLevel(str(raw['level-en']));
    if (options.level !== undefined && level !== options.level) continue;

    const name = normalizeCjk(str(raw['name-zh'])) || str(raw['name-en']);
    if (!name) continue;
    const address = normalizeCjk(str(raw['address-zh'])) || str(raw['address-en']);
    const key = `${name}|${address}`;

    let entry = merged.get(key);
    if (!entry) {
      entry = {
        school: {
          name,
          nameEn: str(raw['name-en']),
          level,
          category: normalizeCjk(str(raw['category-zh'])) || str(raw['category-en']),
          district: normalizeCjk(str(raw['district-zh'])) || str(raw['district-en']),
          address,
          telephone: str(raw.telephone),
          website: str(raw.website),
          sessions: [],
          distanceMeters: Math.round(haversineMeters(anchor.lat, anchor.lng, coord[0], coord[1])),
        },
        sessions: new Set<string>(),
      };
      merged.set(key, entry);
    }
    const session = normalizeCjk(str(raw['session-zh'])) || str(raw['session-en']);
    if (session) entry.sessions.add(session);
  }

  return [...merged.values()].map((e) => ({ ...e.school, sessions: [...e.sessions] }));
}

/**
 * 查询附近学校（实时接口，不缓存）。
 * 数据服务失败时抛出可操作中文错误。
 */
export async function queryNearbySchools(options: NearbyQueryOptions): Promise<NearbySchool[]> {
  const { anchor, max, level, fetchJson = defaultFetchJson } = options;
  const url = buildNearbyUrl(anchor.lat, anchor.lng, max);
  let json: unknown;
  try {
    json = await fetchJson(url);
  } catch (cause) {
    throw new Error(
      '附近学校查询失败：香港教育局数据服务暂时无法访问，请稍后重试，或改按「区域 + 学校类型」搜索。',
      { cause }
    );
  }
  return parseNearestResponse(json, anchor, { level });
}

/** 默认 JSON 获取（30 秒超时；HTTP 非 2xx 抛错） */
const defaultFetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/** 字段收窄：非字符串或空串 → '' */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** `lat-long` 数组 [lat, lng] 解析（缺值/越界 → undefined） */
function parseLatLong(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || v.length < 2) return undefined;
  const lat = Number(v[0]);
  const lng = Number(v[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return [lat, lng];
}
