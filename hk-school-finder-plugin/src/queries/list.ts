// 鲁港通 - 名单查询（5 类）：一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心
// 全部按列索引访问（避免中文表头字符差异导致的匹配风险）；名字匹配走 name-match 共享模块
import { parseCsv } from '../csv';
import { normalizeCjk } from '../cjk';
import { matchAllByName, matchByName } from '../name-match';
import type { NamedRecord } from '../name-match';

// ============================================================
// 通用助手
// ============================================================

/** 文本字段清洗：跨行引号字段内的换行归一为空格（KG_SCHEME 美雅英文名实测）+ trim */
function cleanText(raw: string | undefined): string {
  return (raw ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

/** 数值清洗：去包裹引号、$、千分位逗号与空白；非法值 → 0 */
function toNumber(raw: string | undefined): number {
  const s = (raw ?? '').replace(/[",$\s]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Y/N 标志解析（官方表格以 Y 表示是） */
function isYes(raw: string | undefined): boolean {
  return (raw ?? '').trim().toUpperCase() === 'Y';
}

/**
 * 区域匹配（query 简繁均可）：
 * - 「区」字可省略（「沙田」⇄「沙田區/沙田区」）
 * - 兼容斜杠分隔的合并地区（如「荃灣/葵青」「元朗/天水圍」）
 */
function matchDistrict(recordDistrict: string, query: string): boolean {
  const q = normalizeCjk((query ?? '').trim());
  if (!q) return false;
  const qq = q.endsWith('区') ? q.slice(0, -1) : q;
  if (!qq) return false;
  const parts = normalizeCjk(recordDistrict ?? '')
    .split('/')
    .map((p) => p.trim())
    .map((p) => (p.endsWith('区') ? p.slice(0, -1) : p))
    .filter((p) => p !== '');
  return parts.some((p) => p === qq || (qq.length >= 2 && p.includes(qq)));
}

// ============================================================
// ① 一条龙学校名单（2026/27）
// ============================================================

/** 一条龙名单记录（同组 = 结龙小学 + 中学，可直升） */
export interface ThroughTrainRecord extends NamedRecord {
  /** 组别编号（同组学校为一条龙关系） */
  groupNo: string;
  /** 区域（来源为简称，如「元朗」「中西區」） */
  district: string;
}

export function parseThroughTrain(text: string): ThroughTrainRecord[] {
  const rows = parseCsv(text, { delimiter: ',' });
  const out: ThroughTrainRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      groupNo: cleanText(rows[i][0]),
      district: cleanText(rows[i][2]),
    });
  }
  return out;
}

/** 按校名查一条龙：命中返回整组（小学 + 中学）；未命中的空数组由调用层给明确回答 */
export function findThroughTrain(list: ThroughTrainRecord[], name: string): ThroughTrainRecord[] {
  const hit = matchByName(list, normalizeCjk((name ?? '').trim()));
  if (!hit) return [];
  return list.filter((r) => r.groupNo === hit.groupNo);
}

/** 按区域过滤（「元朗」「元朗区」均可） */
export function filterThroughTrainByDistrict(list: ThroughTrainRecord[], district: string): ThroughTrainRecord[] {
  return list.filter((r) => matchDistrict(r.district, district));
}

// ============================================================
// ② 直资学校学费表（2025/26）
// ============================================================

/** 直资学费记录（一校多行：按班级/宿费分行） */
export interface DssFeeRecord extends NamedRecord {
  /** 编号（同一学校多行共用） */
  no: string;
  /** 学校级别：中學 / 小學 */
  level: string;
  /** 班级（如 S1-S6 / 宿費） */
  classRange: string;
  /** 学费类别：固定 / 範圍 */
  feeType: string;
  /** 每名学生全年学费下限（元；非法值 0） */
  feeMin: number;
  /** 每名学生全年学费上限（元；非法值 0） */
  feeMax: number;
}

export function parseDssFee(text: string): DssFeeRecord[] {
  const rows = parseCsv(text, { delimiter: ',' });
  const out: DssFeeRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      no: cleanText(rows[i][0]),
      level: cleanText(rows[i][2]),
      classRange: cleanText(rows[i][3]),
      feeType: cleanText(rows[i][4]),
      feeMin: toNumber(rows[i][5]),
      feeMax: toNumber(rows[i][6]),
    });
  }
  return out;
}

/** 按校名查直资学费（全部匹配：初小/中学同名一校多行全返回） */
export function findDssFee(list: DssFeeRecord[], name: string): DssFeeRecord[] {
  return matchAllByName(list, normalizeCjk((name ?? '').trim()));
}

// ============================================================
// ③ 幼稚园教育计划名单（2025/26，722 所）
// ============================================================

/** 幼教计划名单记录（表头跨 6 物理行，解析后为 5 列） */
export interface KgSchemeRecord extends NamedRecord {
  /** 编号（1-722） */
  no: string;
  /** 英文校名 */
  nameEn: string;
  /** 区域（中文，如「中西區」） */
  district: string;
  /** 区域（英文，如「Central & Western」） */
  districtEn: string;
}

export function parseKgScheme(text: string): KgSchemeRecord[] {
  const rows = parseCsv(text, { delimiter: '\t' });
  const out: KgSchemeRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      no: cleanText(rows[i][0]),
      nameEn: cleanText(rows[i][2]),
      district: cleanText(rows[i][3]),
      districtEn: cleanText(rows[i][4]),
    });
  }
  return out;
}

/** 按校名查幼教计划名单（全部匹配） */
export function findKgScheme(list: KgSchemeRecord[], name: string): KgSchemeRecord[] {
  return matchAllByName(list, normalizeCjk((name ?? '').trim()));
}

/** 按区域过滤（「沙田」「沙田區」均可） */
export function filterKgSchemeByDistrict(list: KgSchemeRecord[], district: string): KgSchemeRecord[] {
  return list.filter((r) => matchDistrict(r.district, district));
}

// ============================================================
// ④ 参加 K1 收生安排而非幼教计划的幼稚园名单（2026/27）
// ============================================================

/** K1 非计划名单记录 */
export interface K1NotJoiningRecord extends NamedRecord {
  /** 行号 */
  no: string;
  /** 学校地址 */
  address: string;
  /** 网上／不设限额派表（Y=是） */
  onlineApplication: boolean;
  /** 「一人不佔多位」措施（Y=是） */
  oneVacancyOnly: boolean;
  /** 经教育局发放 K1-K3 学位空缺信息（Y=是） */
  shareVacancyInfo: boolean;
}

export function parseK1NotJoining(text: string): K1NotJoiningRecord[] {
  const rows = parseCsv(text, { delimiter: ',' });
  const out: K1NotJoiningRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      no: cleanText(rows[i][0]),
      address: cleanText(rows[i][2]),
      onlineApplication: isYes(rows[i][3]),
      oneVacancyOnly: isYes(rows[i][4]),
      shareVacancyInfo: isYes(rows[i][5]),
    });
  }
  return out;
}

/** 按校名查 K1 非计划名单（全部匹配） */
export function findK1NotJoining(list: K1NotJoiningRecord[], name: string): K1NotJoiningRecord[] {
  return matchAllByName(list, normalizeCjk((name ?? '').trim()));
}

// ============================================================
// ⑤ 附设于幼稚园的非资助幼儿中心名单（18 列）
// ============================================================

/** 附设幼儿中心记录（月费/容额 0 表示不提供该服务） */
export interface NonAidedCccRecord extends NamedRecord {
  /** 机构名称 */
  orgName: string;
  /** 地址 */
  address: string;
  /** 电话 */
  phone: string;
  /** 传真 */
  fax: string;
  /** 服务类别 */
  serviceType: string;
  /** 儿童年龄 */
  ageRange: string;
  /** 全日育婴园核准月费（元） */
  fullDayNurseryFee: number;
  /** 全日幼儿园核准月费（元） */
  fullDayKgFee: number;
  /** 半日幼儿园核准月费（元） */
  halfDayKgFee: number;
  /** 上午组核准月费（元） */
  amFee: number;
  /** 下午组核准月费（元） */
  pmFee: number;
  /** 半日幼儿园类别 */
  halfDayType: string;
  /** 备注 */
  remarks: string;
  /** 全日育婴园容额 */
  nurseryCapacity: number;
  /** 全日幼儿园容额 */
  kgCapacity: number;
  /** 半日幼儿园容额 */
  halfDayCapacity: number;
  /** 地区（斜杠分隔，如「荃灣/葵青」） */
  district: string;
}

export function parseNonAidedCcc(text: string): NonAidedCccRecord[] {
  const rows = parseCsv(text, { delimiter: ',' });
  const out: NonAidedCccRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      orgName: cleanText(rows[i][0]),
      address: cleanText(rows[i][2]),
      phone: cleanText(rows[i][3]),
      fax: cleanText(rows[i][4]),
      serviceType: cleanText(rows[i][5]),
      ageRange: cleanText(rows[i][6]),
      fullDayNurseryFee: toNumber(rows[i][7]),
      fullDayKgFee: toNumber(rows[i][8]),
      halfDayKgFee: toNumber(rows[i][9]),
      amFee: toNumber(rows[i][10]),
      pmFee: toNumber(rows[i][11]),
      halfDayType: cleanText(rows[i][12]),
      remarks: cleanText(rows[i][13]),
      nurseryCapacity: toNumber(rows[i][14]),
      kgCapacity: toNumber(rows[i][15]),
      halfDayCapacity: toNumber(rows[i][16]),
      district: cleanText(rows[i][17]),
    });
  }
  return out;
}

/** 按中心名查附设幼儿中心（全部匹配） */
export function findNonAidedCcc(list: NonAidedCccRecord[], name: string): NonAidedCccRecord[] {
  return matchAllByName(list, normalizeCjk((name ?? '').trim()));
}

/**
 * 按地区过滤：
 * - 地区列匹配（「荃灣」命中「荃灣/葵青」；「區」字可省略）
 * - 地区列为粗分桶（如「元朗」含天水圍），地区列无命中时回退地址包含（支持新市镇地名）
 */
export function filterNonAidedCccByDistrict(list: NonAidedCccRecord[], district: string): NonAidedCccRecord[] {
  const byDistrict = list.filter((r) => matchDistrict(r.district, district));
  if (byDistrict.length > 0) return byDistrict;
  const q = normalizeCjk((district ?? '').trim());
  if (q.length < 2) return [];
  return list.filter((r) => normalizeCjk(r.address).includes(q));
}
