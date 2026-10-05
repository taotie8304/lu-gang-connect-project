// 鲁港通 - 意图路由：参数组合 → 七类查询意图（design.md 推断规则；显式 intent 优先）+ 原话兜底解析
import { normalizeCjk } from './cjk';
import { DISTRICTS } from './districts';
import { matchCategoryWord, type SchoolCategory } from './queries/search';

/** 七种查询意图 */
export type Intent = 'nearby' | 'search' | 'detail' | 'net' | 'list' | 'stats' | 'registration';

/** 名单类型（与 queries/list.ts 五类名单一致） */
export type ListType = 'through_train' | 'dss_fee' | 'kg_scheme' | 'k1_not_joining' | 'non_aided_ccc';

/** 校网类型（POA 小一 / SSPA 中学派位） */
export type NetType = 'poa' | 'sspa';

/** 学校级别过滤 */
export type LevelFilter = 'kg' | 'primary' | 'secondary';

/** 工具输入参数（对应 index.ts inputSchema，全部可选） */
export interface ToolInput {
  query?: string;
  intent?: Intent;
  schoolName?: string;
  district?: string;
  level?: LevelFilter;
  /** 办学类型（枚举值或中文类别词；运行层归一化） */
  schoolCategory?: string;
  location?: string;
  listType?: ListType;
  netType?: NetType;
  language?: 'zh-CN' | 'zh-HK' | 'en';
}

/** 非空判断（忽略前后空格） */
const has = (v: string | undefined): boolean => (v ?? '').trim() !== '';

/**
 * 意图推断：显式 intent 优先；否则按参数组合推断（design.md）：
 * location → nearby；listType → list；netType → net；schoolName → detail；
 * district/schoolCategory → search；学校数量问法（有多少所 XX 学校）→ search；
 * 学生人数问法（有多少学生，含区域）→ stats；
 * query 可解析为区域/级别/类别的列举问法 → search；仅 query（校名类）→ detail（原话兜底）；
 * level → search；全空 → undefined（由入口层给出补充信息提示）。
 */
export function inferIntent(input: ToolInput): Intent | undefined {
  if (input.intent) return input.intent;
  if (has(input.location)) return 'nearby';
  if (input.listType !== undefined) return 'list';
  if (input.netType !== undefined) return 'net';
  if (has(input.schoolName)) return 'detail';
  // 鲁港通 - 原话数量/人数问法先于「有区域 → 搜索」分流（原话兜底可能已补齐区域）：
  // 「有多少所 XX 学校」→ 搜索（学校数量统计）；「有多少学生/中学生」→ 统计（人数口径回归保护）
  const raw = (input.query ?? '').trim();
  const parsed = raw ? parseQueryText(raw) : undefined;
  if (raw && isSchoolCountQuery(raw)) return 'search';
  if (raw && isStudentCountQuery(raw) && (parsed?.district !== undefined || has(input.district))) return 'stats';
  if (has(input.district)) return 'search';
  // 鲁港通 - 办学类型（国际学校/直资等）→ 搜索
  if (has(input.schoolCategory)) return 'search';
  if (parsed) {
    // 鲁港通 - 原话兜底：可解析为「区域/级别/类别」的列举问法或组合词 → 搜索；其余按校名/档案
    const resolved = Boolean(parsed.district || parsed.level || parsed.category);
    return resolved && (parsed.isListLike || parsed.rest === '') ? 'search' : 'detail';
  }
  if (input.level !== undefined) return 'search';
  return undefined;
}

// ============================================================
// 原话兜底解析（模型仅传 query 时，从文本中识别区域与学校级别）
// ============================================================

/** 列表/推荐类问法（归一化后匹配）——决定「区域+级别」按搜索还是按校名处理 */
const LIST_LIKE_RE = /有哪些|有什么|边些|边啲|名单|列表|推荐|介绍|一览|多少|几多|排名|哪间|哪些|哪家/;

/** 级别词（归一化后匹配） */
const LEVEL_PATTERNS: ReadonlyArray<readonly [RegExp, LevelFilter]> = [
  [/幼稚园|幼儿园|kindergarten/i, 'kg'],
  [/小学|primary/i, 'primary'],
  [/中学|secondary/i, 'secondary'],
];

/** 原话解析结果 */
export interface ParsedQuery {
  /** 识别到的区域（简体规范名，如「沙田区」） */
  district?: string;
  /** 识别到的学校级别 */
  level?: LevelFilter;
  /** 识别到的办学类型（官方类别口径） */
  category?: SchoolCategory;
  /** 是否列表/推荐类问法（「有哪些」「名单」等） */
  isListLike: boolean;
  /** 剥离区域与级别词后的剩余文本（trim） */
  rest: string;
}

/**
 * 从用户原话中识别区域与学校级别（简繁归一后匹配）。
 * 区域优先完整名（含「区」），再匹配去「区」短名（≥2 字，防「东/南/北」单字误判）。
 */
export function parseQueryText(text: string): ParsedQuery {
  const s = normalizeCjk((text ?? '').trim());
  if (!s) return { isListLike: false, rest: '' };

  let district: string | undefined;
  let districtWord = '';
  for (const d of DISTRICTS) {
    if (s.includes(d.zh)) {
      district = d.zh;
      districtWord = d.zh;
      break;
    }
  }
  if (!district) {
    for (const d of DISTRICTS) {
      const short = d.zh.slice(0, -1);
      if (short.length >= 2 && s.includes(short)) {
        district = d.zh;
        districtWord = short;
        break;
      }
    }
  }

  let level: LevelFilter | undefined;
  let levelWord = '';
  for (const [re, lv] of LEVEL_PATTERNS) {
    const m = re.exec(s);
    if (m) {
      level = lv;
      levelWord = m[0];
      break;
    }
  }

  // 鲁港通 - 办学类型识别：列表问法、或整句以类别词开头时参与剥离
  // （「沙田官立小学」的「官立」夹在校名中间，不剥离；「直资中学」等整词问法剥离）
  const isListLike = LIST_LIKE_RE.test(s);
  const catMatch = matchCategoryWord(s);
  const catAtStart = catMatch !== undefined && s.indexOf(catMatch.word) === 0;

  let rest = s;
  if (districtWord) rest = rest.replace(districtWord, '');
  if (levelWord) rest = rest.replace(levelWord, '');
  if (catMatch !== undefined && (isListLike || catAtStart)) rest = rest.replace(catMatch.word, '');

  return { district, level, category: catMatch?.category, isListLike, rest: rest.trim() };
}

/**
 * 原话兜底补齐：仅当 query 是「区域/级别/类别」组合查询（列表问法，或剥离后无剩余文本）时，
 * 把识别到的区域/级别/办学类型补为结构化参数；显式参数优先、不覆盖。
 * 校名类原话（如「沙田官立小学」剩余「官立」）不补齐，交由 detail 精确匹配。
 */
export function enrichInput(input: ToolInput): ToolInput {
  const q = (input.query ?? '').trim();
  if (!q) return input;
  const parsed = parseQueryText(q);
  if (!parsed.district && !parsed.level && !parsed.category) return input;
  if (!(parsed.isListLike || parsed.rest === '')) return input;

  const next: ToolInput = { ...input };
  if (!has(input.district) && parsed.district) next.district = parsed.district;
  if (input.level === undefined && parsed.level) next.level = parsed.level;
  // 鲁港通 - 办学类型补齐（列表问法/组合词场景；显式参数优先）
  if (!has(input.schoolCategory) && parsed.category) next.schoolCategory = parsed.category;
  return next;
}

// ============================================================
// 鲁港通 - 学校数量问法识别（供 stats 意图分流：避免「有多少所XX学校」被答成学生人数）
// ============================================================

/** 人数/学位类信号词（含此类词则不视为学校数量问法） */
const PEOPLE_SIGNAL_RE = /学生|學生|人数|人數|学位|學位|学额|學額|教师|教師|班数|班數|空缺|学费|學費/;

/** 数量单位问法（多少所 / 几间 / 多少个） */
const COUNT_UNIT_RE = /(多少|幾多|几多|几|有幾|有几)\s*(所|間|间|个|個)/;

/** 数量 + 学校类名词问法（多少国际学校 / 多少小学） */
const COUNT_NOUN_RE =
  /(多少|幾多|几多)\s*(国际|國際|直资|直資|官立|政府|公立|私立|资助|資助|津贴|津貼|英基|学校|學校|小学|小學|中学|中學|幼稚园|幼稚園|幼儿园|幼兒園)/;

/**
 * 学校数量问法识别：命中「多少所/几间/多少 XX 学校」且不含人数/学位类词时返回 true。
 * 区分「沙田区有多少所小学」（学校数量）与「沙田区有多少中学生」（学生人数）。
 */
export function isSchoolCountQuery(text: string): boolean {
  const s = normalizeCjk((text ?? '').trim());
  if (!s) return false;
  if (PEOPLE_SIGNAL_RE.test(s)) return false;
  return COUNT_UNIT_RE.test(s) || COUNT_NOUN_RE.test(s);
}

/** 学生人数信号（供统计意图保护；不含学费/学位等非人数词） */
const STUDENT_COUNT_RE = /学生|學生|人数|人數/;

/**
 * 学生人数问法识别（如「沙田区有多少中学生」「有多少学生」）。
 * 与 isSchoolCountQuery 互斥：人数问法走 stats，学校数量问法走 search。
 */
export function isStudentCountQuery(text: string): boolean {
  const s = normalizeCjk((text ?? '').trim());
  return s !== '' && STUDENT_COUNT_RE.test(s);
}
