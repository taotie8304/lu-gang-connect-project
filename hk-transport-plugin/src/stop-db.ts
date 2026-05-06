// 鲁港通 - 站点名称数据库模块
// 从 transit.ts 中自动提取所有公交/港铁/小巴/电车/渡轮站点名称
// 构建地理编码索引，解决"词典太小"的根本问题
//
// 原理：transit.ts 已包含 data.gov.hk 的全部站点数据（数千个站点）
//       每个站点有繁体中文名称 + 经纬度坐标
//       本模块在首次调用时自动构建索引，提供站名→坐标的查询能力

import { TRANSIT_DATA } from './data/transit';
import type { GeoLocation } from './types';

// ============================================================
// 繁→简 字符映射（香港地名中高频出现的系统性差异字符）
// 作用：使用户输入"湾仔"(简) 能匹配数据库中"灣仔"(繁)
// 覆盖范围：不追求完整，只覆盖香港公交站名中实际出现的字符
// ============================================================

const TRAD_TO_SIMP: Record<string, string> = {
  // 高频地名用字
  '灣': '湾', '門': '门', '龍': '龙', '鐵': '铁', '電': '电',
  '環': '环', '東': '东', '島': '岛', '線': '线', '頭': '头',
  '馬': '马', '廣': '广', '車': '车', '雲': '云', '園': '园',
  '碼': '码', '會': '会', '場': '场', '樂': '乐', '蘭': '兰',
  '廟': '庙', '觀': '观', '黃': '黄', '紅': '红', '體': '体',
  '區': '区', '樓': '楼', '醫': '医', '學': '学', '長': '长',
  '飛': '飞', '萬': '万', '華': '华', '國': '国', '處': '处',
  '點': '点', '時': '时', '機': '机', '運': '运', '動': '动',
  '務': '务', '號': '号', '業': '业', '發': '发', '來': '来',
  '說': '说', '開': '开', '間': '间', '關': '关', '裏': '里',
  '過': '过', '邊': '边', '還': '还', '進': '进', '連': '连',
  '聯': '联', '鄉': '乡', '農': '农', '總': '总', '舊': '旧',
  '橋': '桥', '嶺': '岭', '嶼': '屿', '廈': '厦', '寶': '宝',
  '達': '达', '榮': '荣', '豐': '丰', '興': '兴', '設': '设',
  '舖': '铺', '鋪': '铺', '歷': '历', '慶': '庆', '節': '节',
  '藍': '蓝', '綠': '绿', '錦': '锦', '銀': '银', '銅': '铜',
  '鑽': '钻', '鐘': '钟', '鑼': '锣', '鵝': '鹅', '鳳': '凤',
  '鶴': '鹤', '雞': '鸡', '魚': '鱼', '蝦': '虾', '貓': '猫',
  '窩': '窝', '鰂': '鲗',
};

/**
 * 将繁体中文转为简体（仅限已映射字符，未映射的保留原字）
 */
function toSimplified(text: string): string {
  let result = '';
  for (const ch of text) {
    result += TRAD_TO_SIMP[ch] ?? ch;
  }
  return result;
}

// ============================================================
// 站名归一化：统一格式用于模糊匹配
// ============================================================

/**
 * 归一化站名用于索引匹配
 * 例：
 *   "尖沙咀（廣東道）"  →  "尖沙咀"
 *   "油麻地站"         →  "油麻地"
 *   "中環 (遮打道)"    →  "中环"（繁→简后）
 */
export function normalizeForMatch(name: string): string {
  // 去除全角/半角括号及括号内容（括号内通常是道路补充信息）
  let s = name.replace(/[（(][^)）]*[)）]/g, '');
  // 去除逗号、顿号、句号、空格等分隔符
  s = s.replace(/[，,、\s。·・「」『』""''《》【】]/g, '');
  // 去除常见后缀
  s = s.replace(/(?:總站|終點站|巴士站|小巴站|地鐵站|地铁站|港鐵站|港铁站|站)$/, '');
  return s.toLowerCase().trim();
}

// ============================================================
// 索引数据结构
// ============================================================

interface StopEntry {
  name: string;    // 原始站名（繁体中文，来自政府数据）
  lat: number;
  lng: number;
  mode: string;    // bus / gmb / mtr / tram / ferry / ptram
  priority: number; // 越小越优先（MTR=0, 渡轮=1, 巴士=2, 小巴=3, 其他=4）
}

const MODE_PRIORITY: Record<string, number> = {
  mtr: 0,
  ferry: 1,
  bus: 2,
  tram: 2,
  ptram: 2,
  gmb: 3,
};

// 懒加载索引（首次 geocodeByStopName 调用时构建）
let _stopIndex: Map<string, StopEntry[]> | null = null;

/**
 * 从 TRANSIT_DATA 构建完整站点名称索引
 * 同时为繁体键和简体键建立索引
 */
function buildStopIndex(): Map<string, StopEntry[]> {
  if (_stopIndex) return _stopIndex;

  const index = new Map<string, StopEntry[]>();

  for (const [mode, modeData] of Object.entries(TRANSIT_DATA)) {
    if (!modeData?.stops) continue;
    const priority = MODE_PRIORITY[mode] ?? 4;

    for (const stop of modeData.stops) {
      if (!stop.name || !stop.lat || !stop.lng) continue;

      const entry: StopEntry = {
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        mode,
        priority,
      };

      // 繁体键
      const tradKey = normalizeForMatch(stop.name);
      if (tradKey) addToIndex(index, tradKey, entry);

      // 简体键（字符转换后如与繁体不同，额外建立索引）
      const simpName = toSimplified(stop.name);
      if (simpName !== stop.name) {
        const simpKey = normalizeForMatch(simpName);
        if (simpKey && simpKey !== tradKey) {
          addToIndex(index, simpKey, entry);
        }
      }
    }
  }

  // 对每个键的条目按 priority 升序排列（优先返回 MTR/大站）
  for (const entries of index.values()) {
    entries.sort((a, b) => a.priority - b.priority);
  }

  _stopIndex = index;
  return index;
}

function addToIndex(
  index: Map<string, StopEntry[]>,
  key: string,
  entry: StopEntry
): void {
  if (!index.has(key)) {
    index.set(key, []);
  }
  const arr = index.get(key)!;
  // 去重：同坐标不重复存储
  if (!arr.some(e => Math.abs(e.lat - entry.lat) < 0.00001 && Math.abs(e.lng - entry.lng) < 0.00001)) {
    arr.push(entry);
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 通过站点名称（或地名）在全部 transit 数据中查询坐标
 * 支持简体/繁体/混合输入
 *
 * 匹配策略（按优先级）：
 * 1. 精确匹配归一化键
 * 2. 包含匹配：站名包含用户输入（如"油麻地(窩打老道)"包含"油麻地"）
 * 3. 包含匹配反向：用户输入包含站名（如用户输"尖沙咀码头"，站名是"尖沙咀"）
 *
 * @param input 用户输入的地名（简/繁均可）
 * @returns GeoLocation 或 undefined
 */
export function geocodeByStopName(input: string): GeoLocation | undefined {
  if (!input?.trim()) return undefined;

  const index = buildStopIndex();

  // 归一化输入（繁→简处理后再归一化）
  const simpInput = toSimplified(input);
  const queryKey = normalizeForMatch(simpInput);
  const queryKeyTrad = normalizeForMatch(input);

  if (!queryKey && !queryKeyTrad) return undefined;

  // 1. 精确匹配（尝试简体键和繁体键）
  for (const key of [queryKey, queryKeyTrad]) {
    if (key && index.has(key)) {
      const entries = index.get(key)!;
      return toGeoLocation(entries[0]);
    }
  }

  // 2. 包含匹配：找出所有站名 key 中包含查询词的条目
  //    优先选 priority 最小的（MTR 优先）
  let bestMatch: StopEntry | undefined;
  let bestMatchLen = Infinity; // 越短越精确

  for (const [stopKey, entries] of index.entries()) {
    const matched =
      (queryKey && stopKey.includes(queryKey)) ||
      (queryKeyTrad && stopKey.includes(queryKeyTrad)) ||
      (queryKey && queryKey.includes(stopKey)) ||
      (queryKeyTrad && queryKeyTrad.includes(stopKey));

    if (matched && entries.length > 0) {
      const candidate = entries[0];
      // 优先级更高（数字更小），或同等优先级时选名字更短（更精确匹配）的
      if (
        !bestMatch ||
        candidate.priority < bestMatch.priority ||
        (candidate.priority === bestMatch.priority && stopKey.length < bestMatchLen)
      ) {
        bestMatch = candidate;
        bestMatchLen = stopKey.length;
      }
    }
  }

  if (bestMatch) return toGeoLocation(bestMatch);
  return undefined;
}

function toGeoLocation(entry: StopEntry): GeoLocation {
  return { lat: entry.lat, lng: entry.lng, name: entry.name };
}

/**
 * 获取已索引的唯一站点数量（调试用）
 */
export function getIndexedStopCount(): number {
  const index = buildStopIndex();
  // 统计不重复坐标数
  const seen = new Set<string>();
  for (const entries of index.values()) {
    for (const e of entries) {
      seen.add(`${e.lat},${e.lng}`);
    }
  }
  return seen.size;
}

// ============================================================
// 反向架构：在文本中扫描所有已知站点
// 用于让 parser 能从 LLM 生成的复杂自然语言中正确提取地名
// ============================================================

/**
 * 在自由文本中扫描所有出现的已知站点
 * @returns 命中列表，每条包含原文位置、匹配文本、坐标、优先级
 *          按文本中出现位置升序排列
 */
export interface FoundLocation {
  /** 原文中匹配到的子串起始位置 */
  position: number;
  /** 原文中匹配到的具体子串 */
  matchedText: string;
  /** 标准化后的站点名（来自 transit.ts，繁体） */
  canonicalName: string;
  /** 站点坐标 */
  lat: number;
  lng: number;
  /** 模式优先级（越小越优先：mtr=0, ferry=1, bus/tram/ptram=2, gmb=3） */
  priority: number;
  /** 匹配文本长度（用于偏好更精确的长名称） */
  matchLen: number;
}

export function findKnownLocationsInText(text: string): FoundLocation[] {
  if (!text?.trim()) return [];

  const index = buildStopIndex();
  const simpText = toSimplified(text);
  const lowerSimp = simpText.toLowerCase();
  const lowerOrig = text.toLowerCase();

  // 收集所有命中（同一坐标可能被多个键命中，后面去重）
  const hits: FoundLocation[] = [];
  const seenCoords = new Set<string>();

  // 按键长度降序遍历，优先长名匹配（更精确）
  const sortedKeys = Array.from(index.keys()).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (key.length < 2) continue; // 跳过单字键，太容易误匹配

    // 在简体文本和原文中分别尝试匹配
    let pos = lowerSimp.indexOf(key);
    let matchedInSimp = true;
    if (pos < 0) {
      pos = lowerOrig.indexOf(key);
      matchedInSimp = false;
    }
    if (pos < 0) continue;

    const entries = index.get(key)!;
    if (entries.length === 0) continue;
    const entry = entries[0];

    const coordKey = `${entry.lat.toFixed(4)},${entry.lng.toFixed(4)}`;
    if (seenCoords.has(coordKey)) continue;

    // ★ 关键改进：检查是否与已有命中重叠（避免"沙咀"覆盖"尖沙咀"）
    const endPos = pos + key.length;
    const overlaps = hits.some(h => {
      const hEnd = h.position + h.matchLen;
      return (pos >= h.position && pos < hEnd) || (endPos > h.position && endPos <= hEnd);
    });
    if (overlaps) continue; // 跳过重叠的短匹配

    seenCoords.add(coordKey);

    // 从原文中提取匹配文本（保留原始大小写和繁简体）
    const matchedText = text.substr(pos, key.length);

    hits.push({
      position: pos,
      matchedText,
      canonicalName: entry.name,
      lat: entry.lat,
      lng: entry.lng,
      priority: entry.priority,
      matchLen: key.length,
    });
  }

  // 按位置升序，位置相同时优先级高的在前
  hits.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.matchLen - a.matchLen;
  });

  return hits;
}

