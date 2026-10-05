// 鲁港通 - 校网查询：POA（小一 36 网）+ SSPA（中学派位 18 网）+ 网编号↔区域映射
import { parseCsvToObjects } from '../csv';
import { normalizeCjk } from '../cjk';
import { DISTRICTS, resolveDistrict } from '../districts';
import { matchByName } from '../name-match';
import type { NamedRecord } from '../name-match';

// ============================================================
// 网编号 ↔ 区域映射
// ============================================================

/** 中学派位 18 网 → 区域英文名（与 DISTRICTS.en 一致） */
export const NET_DISTRICT_MAP: Record<string, string> = {
  HK1: 'CENTRAL AND WESTERN',
  HK2: 'WAN CHAI',
  HK3: 'EASTERN',
  HK4: 'SOUTHERN',
  KL1: 'YAU TSIM MONG',
  KL2: 'SHAM SHUI PO',
  KL3: 'KOWLOON CITY',
  KL4: 'WONG TAI SIN',
  KL5: 'KWUN TONG',
  NT1: 'KWAI TSING',
  NT2: 'TSUEN WAN',
  NT3: 'TUEN MUN',
  NT4: 'YUEN LONG',
  NT5: 'NORTH',
  NT6: 'TAI PO',
  NT7: 'SHA TIN',
  NT8: 'SAI KUNG',
  NT9: 'ISLANDS',
};

/** 小学 36 校网 → 区域英文名（教育局小一校网划分；一区可含多个网） */
export const POA_DISTRICT_MAP: Record<string, string> = {
  '11': 'CENTRAL AND WESTERN',
  '12': 'WAN CHAI',
  '14': 'EASTERN',
  '16': 'EASTERN',
  '18': 'SOUTHERN',
  '31': 'YAU TSIM MONG',
  '32': 'YAU TSIM MONG',
  '34': 'KOWLOON CITY',
  '35': 'KOWLOON CITY',
  '40': 'SHAM SHUI PO',
  '41': 'KOWLOON CITY',
  '43': 'WONG TAI SIN',
  '45': 'WONG TAI SIN',
  '46': 'KWUN TONG',
  '48': 'KWUN TONG',
  '62': 'TSUEN WAN',
  '64': 'KWAI TSING',
  '65': 'KWAI TSING',
  '66': 'KWAI TSING',
  '70': 'TUEN MUN',
  '71': 'TUEN MUN',
  '72': 'YUEN LONG',
  '73': 'YUEN LONG',
  '74': 'YUEN LONG',
  '80': 'NORTH',
  '81': 'NORTH',
  '83': 'NORTH',
  '84': 'TAI PO',
  '88': 'SHA TIN',
  '89': 'SHA TIN',
  '91': 'SHA TIN',
  '95': 'SAI KUNG',
  '96': 'ISLANDS',
  '97': 'ISLANDS',
  '98': 'ISLANDS',
  '99': 'ISLANDS',
};

/** SSPA DIST 分区代码 → 区域英文名（注意 KwT=葵青，与 KT=观塘 区分） */
export const DIST_CODE_MAP: Record<string, string> = {
  CW: 'CENTRAL AND WESTERN',
  WCH: 'WAN CHAI',
  HKE: 'EASTERN',
  SOU: 'SOUTHERN',
  YTM: 'YAU TSIM MONG',
  SSP: 'SHAM SHUI PO',
  KC: 'KOWLOON CITY',
  WTS: 'WONG TAI SIN',
  KT: 'KWUN TONG',
  KwT: 'KWAI TSING',
  TW: 'TSUEN WAN',
  TM: 'TUEN MUN',
  YL: 'YUEN LONG',
  N: 'NORTH',
  TP: 'TAI PO',
  ST: 'SHA TIN',
  SK: 'SAI KUNG',
  I: 'ISLANDS',
};

/** 区域英文名 → 简体中文名（18 区仅在 DISTRICTS 中定义一次） */
function toZh(en: string | undefined): string | undefined {
  if (!en) return undefined;
  return DISTRICTS.find((d) => d.en === en)?.zh;
}

/**
 * 网编号 → 区域（简体中文名）。
 * 支持中学派位网（HK1–NT9）与小学网（11–99）；未知返回 undefined。
 */
export function netToDistrictZh(net: string): string | undefined {
  const key = (net ?? '').trim();
  if (!key) return undefined;
  return toZh(NET_DISTRICT_MAP[key] ?? POA_DISTRICT_MAP[key]);
}

// ============================================================
// POA：小一入学统筹办法学校网范围（36 网）
// ============================================================

/** 小一校网记录 */
export interface PoaNet {
  /** 校网编号（如 '95'） */
  net: string;
  /** 覆盖区域（繁体原文，尾部空格已清除） */
  area: string;
  /** 官方详情页链接 */
  webpage: string;
  /** 所属区域简体名（映射；未知为空串） */
  districtZh: string;
}

export function parsePoa(text: string): PoaNet[] {
  const rows = parseCsvToObjects(text, { delimiter: ',' });
  const out: PoaNet[] = [];
  for (const row of rows) {
    const net = (row['SCHOOLNET'] ?? '').trim();
    if (!net) continue;
    out.push({
      net,
      area: (row['AREA'] ?? '').trim(),
      webpage: (row['WEBPAGE'] ?? '').trim(),
      districtZh: toZh(POA_DISTRICT_MAP[net]) ?? '',
    });
  }
  return out;
}

/** 按网编号查小一校网 */
export function findPoaByNet(list: PoaNet[], net: string): PoaNet | undefined {
  const key = (net ?? '').trim();
  if (!key) return undefined;
  return list.find((p) => p.net === key);
}

/**
 * 按区域查询小一校网：
 * ① 区域名（18 区，如「沙田」「Sha Tin」）→ 返回该区全部校网（一区可含多个网）；
 * ② 地名关键词（如「將軍澳」）→ 与覆盖区域文本包含匹配（简繁容错）。
 */
export function searchPoaByArea(list: PoaNet[], input: string): PoaNet[] {
  const s = (input ?? '').trim();
  if (!s) return [];
  const district = resolveDistrict(s);
  if (district) return list.filter((p) => POA_DISTRICT_MAP[p.net] === district.en);
  const key = normalizeCjk(s).toLowerCase();
  return list.filter((p) => normalizeCjk(p.area).toLowerCase().includes(key));
}

// ============================================================
// SSPA：中学学位分配办法学校网（392 所，18 网 Y 标记）
// ============================================================

/** 18 个派位校网列（表头顺序） */
const SSPA_NET_COLS = [
  'HK1', 'HK2', 'HK3', 'HK4',
  'KL1', 'KL2', 'KL3', 'KL4', 'KL5',
  'NT1', 'NT2', 'NT3', 'NT4', 'NT5', 'NT6', 'NT7', 'NT8', 'NT9',
] as const;

/** 中学派位校网记录 */
export interface SspaRecord extends NamedRecord {
  /** 所属派位网（如 'KL3'） */
  net: string;
  /** 区域代码（如 'KC'） */
  dist: string;
  /** 学校编号 */
  schCode: string;
  /** 服务校网（Y 列名，按表头序） */
  servedNets: string[];
  /** 所属区域简体名（映射；未知为空串） */
  districtZh: string;
}

export function parseSspa(text: string): SspaRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: ',' });
  const out: SspaRecord[] = [];
  for (const row of rows) {
    const name = (row['SCH_NAME'] ?? '').trim();
    if (!name) continue;
    const dist = (row['DIST'] ?? '').trim();
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      net: (row['Net'] ?? '').trim(),
      dist,
      schCode: (row['Sch Code'] ?? '').trim(),
      servedNets: SSPA_NET_COLS.filter((col) => (row[col] ?? '').trim().toUpperCase() === 'Y'),
      districtZh: toZh(DIST_CODE_MAP[dist]) ?? '',
    });
  }
  return out;
}

/** 按校名查中学派位校网（简繁归一：精确 → 双向包含） */
export function findSspaByName(list: SspaRecord[], name: string): SspaRecord | undefined {
  return matchByName(list, normalizeCjk((name ?? '').trim()));
}

/** 按网反查：服务该网的全部中学（按表内顺序） */
export function findSspaByNet(list: SspaRecord[], net: string): SspaRecord[] {
  const key = (net ?? '').trim().toUpperCase();
  if (!key) return [];
  return list.filter((r) => r.servedNets.includes(key));
}
