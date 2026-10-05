// 鲁港通 - 输出格式化：统一输出组装 + 简体中文摘要（预格式化答案草稿）+ 来源标注 + 数据日期 + 防重试提示
// 对应需求 8（数据新鲜度与引用）、9.3（防重试）、10（异常场景）；输出 schema 见 design.md「工具入口」
import { normalizeCjk } from './cjk';
import { findStudentStats, rankDistrictsByTotal } from './queries/stats';
import { REG_NOT_FOUND_TIP } from './queries/registration';
import type { NearbySchool } from './queries/nearby';
import type { SchoolCategory, SchoolLevel, SchoolRecord, SchoolSearchResult } from './queries/search';
import type { SchoolDetail } from './queries/detail';
import type { PoaNet, SspaRecord } from './queries/net';
import type {
  ThroughTrainRecord,
  DssFeeRecord,
  KgSchemeRecord,
  K1NotJoiningRecord,
  NonAidedCccRecord,
} from './queries/list';
import type { StudentStats } from './queries/stats';
import type { RegistrationResult } from './queries/registration';

// ============================================================
// 输出类型（design.md 输出 schema）
// ============================================================

/** 输出条目（宽松结构：基础字段 + extra 补充键值） */
export interface OutputItem {
  name?: string;
  nameEn?: string;
  level?: string;
  district?: string;
  address?: string;
  telephone?: string;
  website?: string;
  distanceMeters?: number;
  extra?: Record<string, string | number | string[]>;
}

/** 工具统一输出 */
export interface ToolResult {
  summary: string;
  items: OutputItem[];
  dataDate: string;
  sources: string[];
  tips: string[];
  error?: string;
}

// ============================================================
// 常量：防重试措辞 / 来源标注 / 数据日期（需求 8.1–8.3、9.3）
// ============================================================

/** 空结果防重试（需求 9.3：阻止 LLM 重复调用） */
export const TIP_NO_RETRY_EMPTY = '该结果已为最终查询结果，请直接告知用户，不要重复调用本工具。';
/** 错误防重试（需求 9.3） */
export const TIP_NO_RETRY_ERROR = '请将错误说明转达用户，不要重复调用本工具。';
/** 过期缓存降级提示（需求 8：数据新鲜度标注；下载失败回退旧缓存时追加） */
export const TIP_STALE = '部分数据来自本地缓存（下载暂时失败），数据可能不是最新。';

/** 数据源引用标注（需求 8.1：答案中标注来源） */
export const SOURCE_LABELS: Record<string, string> = {
  sch_loc: '资料来源：教育局《学校位置总表》',
  kgp: '资料来源：教育局《幼稚园概览 2025》',
  psp: '资料来源：家庭与学校合作事宜委员会《小学概览 2025》',
  ssp: '资料来源：家庭与学校合作事宜委员会《中学概览 2025/26》',
  through_train: '资料来源：教育局《「一条龙」学校名单（2026/27 学年）》',
  poa: '资料来源：教育局《小一入学统筹办法：学校网范围》',
  sspa: '资料来源：教育局《中学学位分配办法：学校网资料》',
  k1_not_joining: '资料来源：教育局《参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单（2026/27）》',
  k1k3_vacancy: '资料来源：教育局《K1–K3 学位空缺资讯》（每周更新）',
  kg_scheme: '资料来源：教育局《免费优质幼稚园教育计划名单（2025/26 学年）》',
  dss_fee: '资料来源：教育局《直资学校学费表（2025/26 学年）》',
  non_aided_ccc: '资料来源：教育局《附设于幼稚园的非资助幼儿中心名单》',
  tab0407: '资料来源：教育局《按分区及级别统计的中学日校学生人数》',
  reg: '资料来源：教育局《学校注册资料》（基本信息 / 校舍 / 批准容额）',
  nearby: '资料来源：教育局「就近入学资讯」（data.gov.hk 实时接口）',
};

/** 数据日期/学年标注（需求 8.1–8.3） */
export const DATA_DATES: Record<string, string> = {
  sch_loc: '不定期更新',
  kgp: '2025/26 学年',
  psp: '2025/26 学年',
  ssp: '2025/26 学年',
  through_train: '2026/27 学年',
  poa: '每年更新',
  sspa: '每年更新',
  k1_not_joining: '2026/27 学年',
  k1k3_vacancy: '每周更新',
  kg_scheme: '2025/26 学年',
  dss_fee: '2025/26 学年',
  non_aided_ccc: '每年更新',
  tab0407: '2025/26 学年',
  reg: '每季更新',
  nearby: '实时数据',
};

// ============================================================
// 通用工具
// ============================================================

/** 简体化（输出统一简体；数据原文为繁体时转换） */
function zh(s: string): string {
  return normalizeCjk(s ?? '');
}

/** 列表去重（保序、剔空） */
function uniq(list: string[]): string[] {
  return [...new Set(list.filter((s) => s !== ''))];
}

/** 千分位格式化（仅展示用，数值直引不变） */
function fmtNum(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 级别代码 → 中文标签 */
const LEVEL_LABELS: Record<string, string> = {
  kg: '幼稚园',
  primary: '小学',
  secondary: '中学',
  other: '特殊学校',
};

function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

/** K1-K3 空缺状态标注（原文 Y/N/P 直引 + 可读注释） */
function vacancyLabel(v: string): string {
  const s = (v ?? '').trim().toUpperCase();
  if (s === 'Y') return 'Y（有空缺）';
  if (s === 'N') return 'N（暂无空缺）';
  if (s === 'P') return 'P（待定，建议直接联系学校）';
  return v || '未提供';
}

/** 是/否（布尔 → 中文） */
function yesNo(b: boolean): string {
  return b ? '是' : '否';
}

/** 组装统一输出：缺省 items=[]、sources/tips 去重 */
export function buildToolResult(parts: {
  summary: string;
  items?: OutputItem[];
  dataDate?: string;
  sources?: string[];
  tips?: string[];
  error?: string;
}): ToolResult {
  const result: ToolResult = {
    summary: parts.summary,
    items: parts.items ?? [],
    dataDate: parts.dataDate ?? '',
    sources: uniq(parts.sources ?? []),
    tips: uniq(parts.tips ?? []),
  };
  if (parts.error !== undefined) result.error = parts.error;
  return result;
}

/** 学校位置总表记录 → 输出条目（简体展示） */
function recordToItem(r: SchoolRecord): OutputItem {
  return {
    name: r.nameSimp || zh(r.nameZh),
    nameEn: r.nameEn,
    level: r.level,
    district: zh(r.districtZh),
    address: zh(r.addressZh),
    telephone: r.telephone,
    website: r.website,
    extra: { category: zh(r.categoryZh), session: zh(r.session), financeType: zh(r.financeType) },
  };
}

// ============================================================
// 附近学校（需求 1）
// ============================================================

/** 距离展示：「约 245 米」/「1.2 公里」 */
function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `约 ${m} 米`;
}

export function formatNearby(schools: NearbySchool[], locationLabel: string): ToolResult {
  const label = zh(locationLabel);
  if (schools.length === 0) {
    return buildToolResult({
      summary: `未找到「${label}」附近的学校。请提示用户更换地点（可用区域名、地标名或直接提供「纬度,经度」坐标）。`,
      dataDate: DATA_DATES.nearby,
      sources: [SOURCE_LABELS.nearby],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  const listed = schools.slice(0, 5).map((s, i) => `${i + 1}. ${s.name}（${s.category || levelLabel(s.level)}，${fmtDistance(s.distanceMeters)}）`);
  const more = schools.length > 5 ? `\n……另有 ${schools.length - 5} 所，详见条目列表。` : '';
  const summary = `在「${label}」附近找到 ${schools.length} 所学校（按距离由近到远）：\n${listed.join('\n')}${more}`;
  return buildToolResult({
    summary,
    items: schools.map((s) => ({
      name: s.name,
      nameEn: s.nameEn,
      level: s.level,
      district: s.district,
      address: s.address,
      telephone: s.telephone,
      website: s.website,
      distanceMeters: s.distanceMeters,
      extra: { category: s.category, sessions: s.sessions },
    })),
    dataDate: DATA_DATES.nearby,
    sources: [SOURCE_LABELS.nearby],
    tips: ['距离为按学校坐标与查询点估算的直线距离，仅供参考。'],
  });
}

// ============================================================
// 学校搜索（需求 2.5 / 2.6）
// ============================================================

export interface SearchFormatContext {
  name?: string;
  district?: string;
  level?: string;
  /** 办学类型（有值时对象名词与构成展示随之调整） */
  category?: SchoolCategory;
}

/** 办学类型枚举 → 短标签（数量摘要展示用；government 为官立+资助合并口径，统称「政府」） */
const CATEGORY_SHORT: Record<SchoolCategory, string> = {
  international: '国际',
  direct_subsidy: '直资',
  // 鲁港通 - 政府含官立与资助两类，摘要用「政府」统称（构成明细会再拆分展示）
  government: '政府',
  aided: '资助',
  private: '私立',
  esf: '英基',
};

/** 级别展示固定序（数量拆分用） */
const LEVEL_ORDER: readonly SchoolLevel[] = ['kg', 'primary', 'secondary', 'other'];

/** 数量构成展示门槛：总数不超过该值时条目本身已可浏览，不附构成 */
const COUNT_DETAIL_MIN_TOTAL = 15;

/** 类别构成展示上限（超出部分合并为「其他」） */
const COUNT_DETAIL_LIMIT = 5;

/** 搜索对象名词：名称关键词 > 类别+级别（如「直资中学」）> 级别 > 「学校」 */
function searchNoun(ctx: SearchFormatContext): string {
  if (ctx.name) return `名称含「${zh(ctx.name)}」的学校`;
  const level = ctx.level ? levelLabel(ctx.level) : '';
  if (ctx.category) {
    const cat = CATEGORY_SHORT[ctx.category];
    return level ? `${cat}${level}` : `${cat}学校`;
  }
  return level || '学校';
}

/**
 * 数量构成（截断前全量口径）：级别拆分 + 办学类型构成。
 * 名称查询、少结果（≤15）不附；未指定级别且分布 ≥ 2 类时附级别拆分；
 * 类型构成 ≥ 2 类时附（含合并类别拆分，如政府=官立+资助）。
 */
function countBreakdown(result: SchoolSearchResult, ctx: SearchFormatContext): string {
  if (ctx.name || result.total <= COUNT_DETAIL_MIN_TOTAL) return '';
  const parts: string[] = [];
  if (!ctx.level) {
    const levels = LEVEL_ORDER.map((lv) => ({ label: levelLabel(lv), count: result.levelCounts[lv] ?? 0 })).filter(
      (x) => x.count > 0
    );
    if (levels.length >= 2) {
      parts.push(`其中${levels.map((x) => `${x.label} ${x.count} 所`).join('、')}`);
    }
  }
  // 鲁港通 - 合并类别（政府=官立+资助）也展示构成拆分；单一类别（构成 1 类）不重复附
  if (result.categoryCounts.length >= 2) {
    const top = result.categoryCounts.slice(0, COUNT_DETAIL_LIMIT);
    const rest = result.categoryCounts.slice(COUNT_DETAIL_LIMIT).reduce((acc, x) => acc + x.count, 0);
    const detail =
      top.map((x) => `${x.label} ${x.count} 所`).join('、') + (rest > 0 ? `、其他 ${rest} 所` : '');
    parts.push(`按办学类型：${detail}`);
  }
  return parts.join('；');
}

export function formatSearch(result: SchoolSearchResult, ctx: SearchFormatContext): ToolResult {
  const source = SOURCE_LABELS.sch_loc;
  const date = DATA_DATES.sch_loc;
  const noun = searchNoun(ctx);
  const place = ctx.district ? `（范围：${zh(ctx.district)}）` : '';

  if (result.total === 0) {
    const sug =
      result.suggestions.length > 0
        ? `您是否想找：${result.suggestions.join('、')}？`
        : '请提示用户换一个关键词，或改用「区域 + 级别」（如「沙田区小学」）查询。';
    return buildToolResult({
      summary: `未找到${ctx.name ? `名称含「${zh(ctx.name)}」的` : '符合条件的'}学校。${sug}`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }

  const breakdown = countBreakdown(result, ctx);
  const summary =
    `共查询到 ${result.total} 所${noun}${place}` +
    (breakdown ? `；${breakdown}` : '') +
    (result.truncated ? `，当前仅展示前 ${result.items.length} 所` : '') +
    '。';
  const tips = result.truncated
    ? [`结果较多，仅展示前 ${result.items.length} 所；如需更多请提示用户收窄条件（如指定区域或级别）。`]
    : [];
  return buildToolResult({
    summary,
    items: result.items.map(recordToItem),
    dataDate: date,
    sources: [source],
    tips,
  });
}

// ============================================================
// 学校档案聚合（需求 2.2–2.4 / 3.3 / 6 / 8）
// ============================================================

export function formatDetail(detail: SchoolDetail): ToolResult {
  const r = detail.record;
  const name = r.nameSimp || zh(r.nameZh);
  const lines: string[] = [];
  lines.push(`【${name}】${levelLabel(r.level)}（${zh(r.categoryZh)}）`);

  const contact: string[] = [];
  if (r.addressZh) contact.push(`地址：${zh(r.addressZh)}`);
  if (r.telephone) contact.push(`电话：${r.telephone}`);
  if (r.website) contact.push(`网站：${r.website}`);
  if (contact.length > 0) lines.push(contact.join('｜'));

  const sources: string[] = [SOURCE_LABELS.sch_loc];
  const tips: string[] = [];
  let dataDate = DATA_DATES.sch_loc;

  if (detail.kg) {
    const k = detail.kg;
    lines.push(
      `幼稚园概览：参加幼稚园教育计划：${zh(k.joinsScheme) || '未提供'}｜课程类别：${zh(k.curriculum) || '未提供'}｜` +
        `半日班全年学费：${k.feeHalfDay || '官方未提供'}｜全日班全年学费：${k.feeWholeDay || '官方未提供'}｜` +
        `师生比（上午）：${k.teacherRatioAm || '未提供'}｜总容额：${k.capacity || '未提供'}`
    );
    if (k.applicationStart || k.applicationEnd) {
      lines.push(`报名期：${k.applicationStart || '—'} 至 ${k.applicationEnd || '—'}`);
    }
    sources.push(SOURCE_LABELS.kgp);
    dataDate = DATA_DATES.kgp;
  }

  if (detail.vacancy) {
    const v = detail.vacancy;
    lines.push(
      `K1-K3 学位空缺（截至 ${v.asAtDate}）：K1：${vacancyLabel(v.k1)}｜K2：${vacancyLabel(v.k2)}｜K3：${vacancyLabel(v.k3)}`
    );
    sources.push(SOURCE_LABELS.k1k3_vacancy);
    dataDate = `截至 ${v.asAtDate}`;
    tips.push('K1-K3 学位空缺数据每周更新，请以结果中的截至日期为准。');
  }

  if (detail.primary) {
    const p = detail.primary;
    const rel: string[] = [];
    if (p.throughTrain) rel.push(`一条龙中学：${zh(p.throughTrain)}`);
    if (p.feeder) rel.push(`直属中学：${zh(p.feeder)}`);
    if (p.nominated) rel.push(`联系中学：${zh(p.nominated)}`);
    lines.push(
      `小学概览：小一校网：${p.schoolNet || '未提供'}｜教学语言：${zh(p.teachingLanguage) || '未提供'}｜` +
        `学费：${p.fee || '官方未提供'}${rel.length > 0 ? '｜' + rel.join('｜') : ''}`
    );
    sources.push(SOURCE_LABELS.psp);
    dataDate = DATA_DATES.psp;
  }

  if (detail.secondary) {
    const s = detail.secondary;
    const cls = s.classStructure;
    lines.push(
      `中学概览：教师人数：${s.teacherCount || '未提供'}｜班级结构（中一至中六）：${cls.s1}/${cls.s2}/${cls.s3}/${cls.s4}/${cls.s5}/${cls.s6}｜` +
        `中一学费：${s.fees.s1 || '官方未提供'}`
    );
    sources.push(SOURCE_LABELS.ssp);
    dataDate = DATA_DATES.ssp;
  }

  tips.push(...detail.missing);
  tips.push('详细课程内容与最新安排请查阅该校官方网站。');

  return buildToolResult({ summary: lines.join('\n'), items: [recordToItem(r)], dataDate, sources, tips });
}

// ============================================================
// 校网（需求 4）
// ============================================================

export function formatNetPoa(list: PoaNet[], area: string): ToolResult {
  const label = zh(area);
  const source = SOURCE_LABELS.poa;
  const date = DATA_DATES.poa;
  if (list.length === 0) {
    return buildToolResult({
      summary: `未找到「${label}」相关的小一学校网。请提示用户改用 18 区区域名（如「沙田区」）或地名（如「将军澳」）查询。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  const lines = list.map((p) => `· ${p.net} 网：${zh(p.area)}｜详情页：${p.webpage}`);
  return buildToolResult({
    summary: `「${label}」对应小一学校网（共 ${list.length} 个）：\n${lines.join('\n')}`,
    items: list.map((p) => ({
      name: `${p.net} 网`,
      district: p.districtZh,
      extra: { net: p.net, area: zh(p.area), webpage: p.webpage },
    })),
    dataDate: date,
    sources: [source],
  });
}

export function formatNetSspaSchool(record: SspaRecord | undefined, name: string): ToolResult {
  const label = zh(name);
  const source = SOURCE_LABELS.sspa;
  const date = DATA_DATES.sspa;
  if (!record) {
    return buildToolResult({
      summary: `未找到中学「${label}」的派位校网记录。该中学可能不在中学学位分配办法学校网名单内，或校名有误；请提示用户核对校名（可改用「区域 + 级别」搜索确认校名）。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  return buildToolResult({
    summary: `【${zh(record.name)}】中学派位校网：所属区域网：${record.net}（${record.districtZh}）｜服务校网：${record.servedNets.join('、')}。`,
    items: [
      {
        name: zh(record.name),
        level: 'secondary',
        district: record.districtZh,
        extra: { net: record.net, dist: record.dist, schCode: record.schCode, servedNets: record.servedNets },
      },
    ],
    dataDate: date,
    sources: [source],
  });
}

export function formatNetSspaNet(records: SspaRecord[], net: string): ToolResult {
  const key = (net ?? '').trim().toUpperCase();
  const source = SOURCE_LABELS.sspa;
  const date = DATA_DATES.sspa;
  if (records.length === 0) {
    return buildToolResult({
      summary: `未找到服务「${key}」校网的中学。请提示用户核对校网编号（HK1–HK4 / KL1–KL5 / NT1–NT9）。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  const names = records.slice(0, 10).map((x) => zh(x.name));
  const summary = `服务 ${key} 校网的中学共 ${records.length} 所（按官方表序）：${names.join('、')}${records.length > 10 ? ' 等' : ''}。`;
  return buildToolResult({
    summary,
    items: records.map((x) => ({
      name: zh(x.name),
      level: 'secondary',
      district: x.districtZh,
      extra: { net: x.net, dist: x.dist, schCode: x.schCode },
    })),
    dataDate: date,
    sources: [source],
  });
}

// ============================================================
// 名单（需求 5，5 类）
// ============================================================

/** 名单格式化输入（union：五类名单各带查询上下文） */
export type ListFormatCase =
  | { type: 'through_train'; queryName?: string; district?: string; records: ThroughTrainRecord[] }
  | { type: 'dss_fee'; queryName?: string; district?: string; records: DssFeeRecord[] }
  | { type: 'kg_scheme'; queryName?: string; district?: string; records: KgSchemeRecord[] }
  | { type: 'k1_not_joining'; queryName?: string; district?: string; records: K1NotJoiningRecord[] }
  | { type: 'non_aided_ccc'; queryName?: string; district?: string; records: NonAidedCccRecord[] };

export function formatList(input: ListFormatCase): ToolResult {
  switch (input.type) {
    case 'through_train':
      return formatThroughTrain(input);
    case 'dss_fee':
      return formatDssFee(input);
    case 'kg_scheme':
      return formatKgScheme(input);
    case 'k1_not_joining':
      return formatK1NotJoining(input);
    case 'non_aided_ccc':
      return formatNonAidedCcc(input);
  }
}

function formatThroughTrain(input: { queryName?: string; district?: string; records: ThroughTrainRecord[] }): ToolResult {
  const date = DATA_DATES.through_train;
  const source = SOURCE_LABELS.through_train;
  const label = zh(input.queryName ?? input.district ?? '');
  const items: OutputItem[] = input.records.map((r) => ({
    name: zh(r.name),
    district: zh(r.district),
    extra: { groupNo: r.groupNo },
  }));

  if (input.queryName && input.records.length === 0) {
    return buildToolResult({
      summary: `「${label}」不在「一条龙」学校名单中（2026/27 学年）。未命中即为最终结果，不代表该校与任何小学/中学结龙。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  if (input.queryName) {
    const group = input.records.map((r) => zh(r.name));
    return buildToolResult({
      summary: `「${label}」在「一条龙」学校名单中（2026/27 学年），结龙组别成员：${group.join('、')}（小学与中学可直升）。`,
      items,
      dataDate: date,
      sources: [source],
    });
  }
  return buildToolResult({
    summary: `「${label}」的一条龙学校共 ${input.records.length} 条（2026/27 学年）。`,
    items,
    dataDate: date,
    sources: [source],
  });
}

/** 学费展示：固定「全年 $N」；範圍「全年 $min–$max」 */
function fmtFee(r: DssFeeRecord): string {
  return r.feeMin === r.feeMax ? `全年 $${fmtNum(r.feeMin)}` : `全年 $${fmtNum(r.feeMin)}–$${fmtNum(r.feeMax)}`;
}

function formatDssFee(input: { queryName?: string; district?: string; records: DssFeeRecord[] }): ToolResult {
  const date = DATA_DATES.dss_fee;
  const source = SOURCE_LABELS.dss_fee;
  const label = zh(input.queryName ?? '');
  const items: OutputItem[] = input.records.map((r) => ({
    name: zh(r.name),
    extra: { level: r.level, classRange: r.classRange, feeType: r.feeType, feeMin: r.feeMin, feeMax: r.feeMax },
  }));

  if (input.queryName && input.records.length === 0) {
    return buildToolResult({
      summary: `「${label}」不在直资学校学费表（2025/26 学年）中。未命中即为最终结果。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  const rows = input.records.map((r) => `（${r.level}${r.classRange}）${fmtFee(r)}`).join('；');
  return buildToolResult({
    summary: `「${label}」直资学校学费（2025/26 学年）：${rows}。`,
    items,
    dataDate: date,
    sources: [source],
  });
}

function formatKgScheme(input: { queryName?: string; district?: string; records: KgSchemeRecord[] }): ToolResult {
  const date = DATA_DATES.kg_scheme;
  const source = SOURCE_LABELS.kg_scheme;
  const items: OutputItem[] = input.records.map((r) => ({
    name: zh(r.name),
    nameEn: r.nameEn,
    district: zh(r.district),
    extra: { no: r.no, districtEn: r.districtEn },
  }));

  if (input.queryName && input.records.length === 0) {
    return buildToolResult({
      summary: `「${zh(input.queryName)}」不在免费优质幼稚园教育计划名单中（2025/26 学年）。未命中即为最终结果。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  if (input.queryName) {
    return buildToolResult({
      summary: `「${zh(input.queryName)}」在免费优质幼稚园教育计划名单中（2025/26 学年）。`,
      items,
      dataDate: date,
      sources: [source],
    });
  }
  return buildToolResult({
    summary: `「${zh(input.district ?? '')}」参加免费优质幼稚园教育计划的幼稚园共 ${input.records.length} 所（2025/26 学年）。`,
    items,
    dataDate: date,
    sources: [source],
  });
}

function formatK1NotJoining(input: { queryName?: string; district?: string; records: K1NotJoiningRecord[] }): ToolResult {
  const date = DATA_DATES.k1_not_joining;
  const source = SOURCE_LABELS.k1_not_joining;
  const items: OutputItem[] = input.records.map((r) => ({
    name: zh(r.name),
    address: zh(r.address),
    extra: {
      onlineApplication: yesNo(r.onlineApplication),
      oneVacancyOnly: yesNo(r.oneVacancyOnly),
      shareVacancyInfo: yesNo(r.shareVacancyInfo),
    },
  }));

  if (input.queryName && input.records.length === 0) {
    return buildToolResult({
      summary: `「${zh(input.queryName)}」不在参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单中（2026/27 学年）。未命中即为最终结果。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  if (input.queryName) {
    const r = input.records[0];
    return buildToolResult({
      summary:
        `「${zh(r.name)}」在参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单中（2026/27 学年）：` +
        `网上派表：${yesNo(r.onlineApplication)}｜「一人不占多位」：${yesNo(r.oneVacancyOnly)}｜经教育局发放学位空缺信息：${yesNo(r.shareVacancyInfo)}。`,
      items,
      dataDate: date,
      sources: [source],
    });
  }
  return buildToolResult({
    summary: `「${zh(input.district ?? '')}」参加「K1 收生安排」而非幼稚园教育计划的幼稚园共 ${input.records.length} 所（2026/27 学年）。`,
    items,
    dataDate: date,
    sources: [source],
  });
}

function formatNonAidedCcc(input: { queryName?: string; district?: string; records: NonAidedCccRecord[] }): ToolResult {
  const date = DATA_DATES.non_aided_ccc;
  const source = SOURCE_LABELS.non_aided_ccc;
  const items: OutputItem[] = input.records.map((r) => ({
    name: zh(r.name),
    address: zh(r.address),
    telephone: r.phone,
    district: zh(r.district),
    extra: {
      serviceType: zh(r.serviceType),
      halfDayKgFee: r.halfDayKgFee,
      fullDayKgFee: r.fullDayKgFee,
      nurseryCapacity: r.nurseryCapacity,
      kgCapacity: r.kgCapacity,
    },
  }));

  if (input.queryName && input.records.length === 0) {
    return buildToolResult({
      summary: `「${zh(input.queryName)}」不在附设于幼稚园的非资助幼儿中心名单中。未命中即为最终结果。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  if (input.queryName) {
    const r = input.records[0];
    return buildToolResult({
      summary:
        `「${zh(r.name)}」在附设于幼稚园的非资助幼儿中心名单中：服务类别：${zh(r.serviceType) || '未提供'}｜` +
        `地区：${zh(r.district) || '未提供'}｜核准月费（半日幼儿园）：${r.halfDayKgFee > 0 ? `$${fmtNum(r.halfDayKgFee)}` : '不提供'}｜` +
        `容额：全日育婴园 ${r.nurseryCapacity}／全日幼儿园 ${r.kgCapacity}／半日幼儿园 ${r.halfDayCapacity}。`,
      items,
      dataDate: date,
      sources: [source],
    });
  }
  return buildToolResult({
    summary: `「${zh(input.district ?? '')}」附设于幼稚园的非资助幼儿中心共 ${input.records.length} 所。`,
    items,
    dataDate: date,
    sources: [source],
  });
}

// ============================================================
// 统计（需求 7）
// ============================================================

export function formatStats(stats: StudentStats, opts: { zone?: string; compare?: boolean }): ToolResult {
  const source = SOURCE_LABELS.tab0407;
  const date = DATA_DATES.tab0407;

  // 全港对比（显式 compare 或未指定区）
  if (opts.compare || !(opts.zone ?? '').trim()) {
    const ranked = rankDistrictsByTotal(stats);
    if (ranked.length === 0) {
      return buildToolResult({
        summary: '未获取到分区学生人数统计数据。',
        dataDate: date,
        sources: [source],
        tips: [TIP_NO_RETRY_ERROR],
      });
    }
    const first = ranked[0];
    const last = ranked[ranked.length - 1];
    return buildToolResult({
      summary: `全港 18 区中学日校学生人数（2025/26 学年，按所有级别）：${zh(first.zone)}以 ${fmtNum(first.total)} 人居首，${zh(last.zone)}以 ${fmtNum(last.total)} 人最少。`,
      items: ranked.map((r) => ({ name: zh(r.zone), extra: { total: r.total } })),
      dataDate: date,
      sources: [source],
    });
  }

  const row = findStudentStats(stats, opts.zone as string);
  if (!row) {
    return buildToolResult({
      summary: `未找到「${zh(opts.zone as string)}」的学生人数统计。请提示用户改用 18 区区域名（如「沙田」）或「全港」查询。`,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }
  return buildToolResult({
    summary:
      `「${zh(row.zone)}」中学日校学生人数（2025/26 学年）：所有级别 ${fmtNum(row.total)} 人｜中一 ${fmtNum(row.s1)}｜` +
      `中二 ${fmtNum(row.s2)}｜中三 ${fmtNum(row.s3)}｜中四 ${fmtNum(row.s4)}｜中五 ${fmtNum(row.s5)}｜中六 ${fmtNum(row.s6)}｜中七 ${fmtNum(row.s7)}。`,
    items: [
      {
        name: zh(row.zone),
        extra: { total: row.total, s1: row.s1, s2: row.s2, s3: row.s3, s4: row.s4, s5: row.s5, s6: row.s6, s7: row.s7 },
      },
    ],
    dataDate: date,
    sources: [source],
  });
}

// ============================================================
// 注册资料（需求 6）
// ============================================================

export function formatRegistration(result: RegistrationResult | undefined, name: string): ToolResult {
  const label = zh(name);
  const source = SOURCE_LABELS.reg;
  const date = DATA_DATES.reg;

  // 未命中或非精确命中（含官立学校不在册场景，需求 6.2 / 6.3）
  if (!result || !result.exact) {
    const candidates: OutputItem[] = (result?.matches ?? []).map((m) => ({
      name: zh(m.name),
      level: m.level,
      extra: { schoolNumber: m.schoolNumber, registrationNumber: m.registrationNumber, status: zh(m.status) || '未标明' },
    }));
    const candidateText =
      candidates.length > 0
        ? `相关记录（名称相近，可能为该校旧称或关联机构）：${candidates.map((c) => c.name).join('、')}。`
        : '';
    const head = result ? `「${label}」未在注册名册中精确命中。` : '';
    return buildToolResult({
      summary: `${head}${candidateText}${REG_NOT_FOUND_TIP}`,
      items: candidates,
      dataDate: date,
      sources: [source],
      tips: [TIP_NO_RETRY_EMPTY],
    });
  }

  const roomTotal = result.rooms.reduce((acc, r) => acc + r.permitted, 0);
  const first = result.matches[0];
  return buildToolResult({
    summary:
      `【${zh(first.name)}】学校注册资料：注册编号：${first.registrationNumber || '未标明'}｜注册状况：${zh(first.status) || '未标明'}｜` +
      `学校类别：${zh(first.financeType) || '未标明'}｜注册校舍：${result.premises.length} 处｜批准课室：${result.rooms.length} 间（容额合计 ${roomTotal} 人）。`,
    items: result.matches.map((m) => ({
      name: zh(m.name),
      nameEn: m.nameEn,
      level: m.level,
      district: zh(m.district),
      address: zh(m.address),
      telephone: m.phone ?? '',
      extra: {
        schoolNumber: m.schoolNumber,
        registrationNumber: m.registrationNumber,
        status: zh(m.status) || '未标明',
        financeType: zh(m.financeType),
      },
    })),
    dataDate: date,
    sources: [source],
  });
}
