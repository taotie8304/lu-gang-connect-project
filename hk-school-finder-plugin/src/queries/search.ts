// 鲁港通 - 学校搜索：SCH_LOC 解析 + 简繁包含匹配 + 区域/级别过滤 + 相近候选
import { parseCsvToObjects } from '../csv';
import { parseDms } from '../dms';
import { normalizeCjk } from '../cjk';
import { resolveDistrict } from '../districts';

export type SchoolLevel = 'kg' | 'primary' | 'secondary' | 'other';

/** 办学类型（官方类别口径；供类别过滤与数量构成统计；government = 官立+资助合并口径） */
export type SchoolCategory =
  | 'international'
  | 'direct_subsidy'
  | 'government'
  | 'aided'
  | 'private'
  | 'esf';

/** 学校记录（SCH_LOC 学校位置总表，一行一所） */
export interface SchoolRecord {
  /** 中文校名（原文，繁体） */
  nameZh: string;
  /** 英文校名 */
  nameEn: string;
  /** 简体归一化校名（搜索支撑字段，运行时派生） */
  nameSimp: string;
  /** 中文类别（如「資助小學」） */
  categoryZh: string;
  /** 类别（英文，如 'Aided Primary Schools'） */
  category: string;
  /** 中文地址 */
  addressZh: string;
  /** 英文地址 */
  addressEn: string;
  /** 区域（英文，18 区） */
  district: string;
  /** 区域（中文，如「九龍城區」） */
  districtZh: string;
  /** 归一化级别：kg / primary / secondary / other（特殊学校） */
  level: SchoolLevel;
  /** 财务类型（AIDED / GOVERNMENT / DIRECT SUBSIDY SCHEME / ...） */
  financeType: string;
  /** 授课时间（WHOLE DAY / A.M. / P.M.） */
  session: string;
  /** 电话 */
  telephone: string;
  /** 传真 */
  fax: string;
  /** 网站（可为空） */
  website: string;
  /** 宗教（英文，如 'CATHOLICISM'；'NOT APPLICABLE' 表示不适用） */
  religion: string;
  /** 纬度（十进制度；数据缺失为 undefined） */
  latitude: number | undefined;
  /** 经度（十进制度；数据缺失为 undefined） */
  longitude: number | undefined;
}

export interface SchoolSearchOptions {
  /** 名称关键词（简繁皆可；同时匹配中英文名） */
  name?: string;
  /** 区域（英文/繁体/简体均可） */
  district?: string;
  /** 级别过滤 */
  level?: SchoolLevel;
  /** 办学类型过滤（官方类别口径，如国际学校 / 直资；government 为官立+资助合并口径） */
  category?: SchoolCategory;
  /** 结果上限，默认 50 */
  limit?: number;
}

export interface SchoolSearchResult {
  items: SchoolRecord[];
  /** 命中总数（截断前） */
  total: number;
  /** 是否因上限被截断 */
  truncated: boolean;
  /** 无命中时的相近名称候选（简体，编辑距离 top 3） */
  suggestions: string[];
  /** 命中结果的级别分布（全量、截断前；数量摘要用） */
  levelCounts: Partial<Record<SchoolLevel, number>>;
  /** 命中结果的办学类型构成（全量、截断前；按数量降序，数量摘要用） */
  categoryCounts: Array<{ label: string; count: number }>;
}

const DEFAULT_LIMIT = 50;
const SUGGESTION_LIMIT = 3;

/** SCHOOL LEVEL 列原值 → 归一化级别（LEVEL 为空 = 特殊学校 → other） */
const LEVEL_MAP: Record<string, SchoolLevel> = {
  KINDERGARTEN: 'kg',
  'KINDERGARTEN-CUM-CHILD CARE CENTRES': 'kg',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
};

/** 级别原值 → 归一化级别（大小写/前后空格容错；未知或空 → other） */
export function normalizeLevel(raw: string): SchoolLevel {
  return LEVEL_MAP[raw.trim().toUpperCase()] ?? 'other';
}

// ------------------------------------------------------------
// 鲁港通 - 办学类型：官方类别口径映射 + 文本识别（原话解析/参数归一化共用）
// ------------------------------------------------------------

/** 类别枚举 → 官方 ENGLISH CATEGORY 子串匹配（数组=合并口径，任一命中即算） */
const CATEGORY_MATCH: Record<SchoolCategory, readonly string[]> = {
  international: ['International Schools'],
  direct_subsidy: ['Direct Subsidy Scheme'],
  // 鲁港通 - 政府学校=官立+资助（用户说「政府学校」时含资助学校的直觉口径）
  government: ['Government', 'Aided'],
  aided: ['Aided'],
  private: ['Private'],
  esf: ['English Schools Foundation'],
};

/** 类别触发词（长词优先；文本先经简繁归一） */
const CATEGORY_TRIGGERS: ReadonlyArray<readonly [RegExp, SchoolCategory]> = [
  [/国际学校|国际小学|国际中学|international/i, 'international'],
  [/直接资助|直资|direct subsidy/i, 'direct_subsidy'],
  [/英基|english schools foundation/i, 'esf'],
  [/官立|政府|公立|government/i, 'government'],
  [/资助|津贴|aided|subsid/i, 'aided'],
  [/私立|民办|private/i, 'private'],
];

/** 文本 → 办学类型（含匹配词原文，供原话解析剥离用；未识别 undefined） */
export function matchCategoryWord(
  text: string
): { category: SchoolCategory; word: string } | undefined {
  const s = normalizeCjk((text ?? '').trim());
  for (const [re, category] of CATEGORY_TRIGGERS) {
    const m = re.exec(s);
    if (m) return { category, word: m[0] };
  }
  return undefined;
}

/** 类别枚举值列表（参数直传枚举时直通） */
const CATEGORY_VALUES: readonly SchoolCategory[] = [
  'international',
  'direct_subsidy',
  'government',
  'aided',
  'private',
  'esf',
];

/** 文本 → 办学类型枚举（参数归一化：枚举值直通，中文类别词经触发词识别） */
export function normalizeCategory(text: string): SchoolCategory | undefined {
  const s = (text ?? '').trim();
  if ((CATEGORY_VALUES as readonly string[]).includes(s)) return s as SchoolCategory;
  return matchCategoryWord(s)?.category;
}

/** 记录 → 办学类型标签（数量构成展示用；类别表外的记录归「其他」） */
export function categoryLabelOf(r: SchoolRecord): string {
  const c = r.category;
  if (c.includes('International Schools')) return '国际学校';
  if (c.includes('Direct Subsidy Scheme')) return '直资';
  if (c.includes('English Schools Foundation')) return '英基';
  if (c.includes('Government')) return '官立';
  if (c.includes('Aided')) return '资助';
  if (c.includes('Private')) return '私立';
  if (c.includes('Caput')) return '按额津贴';
  if (c.includes('Kindergarten-cum-child')) return '幼稚园暨幼儿中心';
  if (c.includes('Kindergartens')) return '幼稚园';
  return '其他';
}

/** SCH_LOC（Tab 分隔，36 列）→ 学校记录数组 */
export function parseSchLoc(text: string): SchoolRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: '\t' });
  const records: SchoolRecord[] = [];
  for (const row of rows) {
    const nameZh = (row['中文名稱'] ?? '').trim();
    const nameEn = (row['ENGLISH NAME'] ?? '').trim();
    if (!nameZh && !nameEn) continue;
    const levelRaw = (row['SCHOOL LEVEL'] ?? '').trim();
    records.push({
      nameZh,
      nameEn,
      nameSimp: normalizeCjk(nameZh),
      category: (row['ENGLISH CATEGORY'] ?? '').trim(),
      categoryZh: (row['中文類別'] ?? '').trim(),
      addressEn: (row['ENGLISH ADDRESS'] ?? '').trim(),
      addressZh: (row['中文地址'] ?? '').trim(),
      district: (row['DISTRICT'] ?? '').trim(),
      districtZh: (row['分區'] ?? '').trim(),
      level: normalizeLevel(levelRaw),
      financeType: (row['FINANCE TYPE'] ?? '').trim(),
      session: (row['SESSION'] ?? '').trim(),
      telephone: (row['TELEPHONE'] ?? '').trim(),
      fax: (row['FAX NUMBER'] ?? '').trim(),
      website: (row['WEBSITE'] ?? '').trim(),
      religion: (row['RELIGION'] ?? '').trim(),
      latitude: parseDms(row['LATITUDE'] ?? ''),
      longitude: parseDms(row['LONGITUDE'] ?? ''),
    });
  }
  return records;
}

/**
 * 学校搜索：按名称（简繁/中英文包含匹配）+ 区域 + 级别过滤。
 * - 名称无命中时返回相近名称候选（编辑距离 ≤ 关键词长度一半，最多 3 条）
 * - 结果上限默认 50，超出标记 truncated
 */
export function searchSchools(
  records: SchoolRecord[],
  options: SchoolSearchOptions = {}
): SchoolSearchResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const kwName = (options.name ?? '').trim();
  const kwSimp = normalizeCjk(kwName).toLowerCase();
  const kwEn = kwName.toLowerCase();
  const districtInput = (options.district ?? '').trim();
  const district = districtInput ? resolveDistrict(districtInput) : undefined;

  let filtered = records;
  if (districtInput) {
    filtered = district ? filtered.filter((r) => r.district === district.en) : [];
  }
  if (options.level) {
    filtered = filtered.filter((r) => r.level === options.level);
  }
  if (options.category) {
    const pats = CATEGORY_MATCH[options.category];
    filtered = filtered.filter((r) => pats.some((p) => r.category.includes(p)));
  }
  if (kwSimp) {
    filtered = filtered.filter(
      (r) => r.nameSimp.toLowerCase().includes(kwSimp) || r.nameEn.toLowerCase().includes(kwEn)
    );
  }

  // 鲁港通 - 数量构成统计（全量、截断前）：级别分布 + 办学类型构成（降序）
  const levelCounts: Partial<Record<SchoolLevel, number>> = {};
  const catMap = new Map<string, number>();
  for (const r of filtered) {
    levelCounts[r.level] = (levelCounts[r.level] ?? 0) + 1;
    const label = categoryLabelOf(r);
    catMap.set(label, (catMap.get(label) ?? 0) + 1);
  }
  const categoryCounts = [...catMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const total = filtered.length;
  return {
    items: filtered.slice(0, limit),
    total,
    truncated: total > limit,
    suggestions: total === 0 && kwSimp ? nearestNames(records, kwSimp) : [],
    levelCounts,
    categoryCounts,
  };
}

/** 相近名称候选：编辑距离最近、且距离 ≤ clamp(关键词长度/2, 1, 3) */
function nearestNames(records: SchoolRecord[], kwSimp: string): string[] {
  const maxDist = Math.max(1, Math.min(3, Math.floor(kwSimp.length / 2)));
  const scored: { name: string; d: number }[] = [];
  for (const r of records) {
    if (!r.nameSimp) continue;
    if (Math.abs(r.nameSimp.length - kwSimp.length) > maxDist) continue;
    const d = levenshtein(kwSimp, r.nameSimp);
    if (d <= maxDist) scored.push({ name: r.nameSimp, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, SUGGESTION_LIMIT).map((s) => s.name);
}

/** 编辑距离（Levenshtein，滚动数组实现） */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}
