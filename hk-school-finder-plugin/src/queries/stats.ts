// 鲁港通 - 统计查询：tab0407 分区学生人数（18 区 × 中一至中七，数值直引不计算）
import { parseCsv } from '../csv';
import { normalizeCjk } from '../cjk';
import { resolveDistrict } from '../districts';
import { readXlsx } from '../xlsx';

/** 统计行：分区 × 学生人数（所有級別 + 中一至中七） */
export interface StudentCountRow {
  /** 分区/区域组（来源原文，如「沙田」「九龍」「所有分區」） */
  zone: string;
  /** 分区简体归一（匹配/展示用） */
  zoneSimp: string;
  /** 所有級別合计 */
  total: number;
  /** 中一 */
  s1: number;
  /** 中二 */
  s2: number;
  /** 中三 */
  s3: number;
  /** 中四 */
  s4: number;
  /** 中五 */
  s5: number;
  /** 中六 */
  s6: number;
  /** 中七（部分区无 → 0） */
  s7: number;
}

/** tab0407 统计结构 */
export interface StudentStats {
  /** 全港合计（所有分區） */
  grandTotal?: StudentCountRow;
  /** 区域组：香港島 / 九龍 / 新界 */
  regions: StudentCountRow[];
  /** 18 区（来源顺序） */
  districts: StudentCountRow[];
}

/** 区域组名称（简体归一后） */
const REGION_ZONES = ['香港岛', '九龙', '新界'];
/** 全港合计行名称（简体归一后） */
const GRAND_ZONE = '所有分区';

/** 数值清洗：'-'（不适用）与非法值 → 0 */
function toNumber(raw: string | undefined): number {
  const s = (raw ?? '').replace(/[",$\s]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 区域名折叠：英文名（Sha Tin）与简繁/「区」字差异统一。
 * 可解析为 18 区时用标准简体名（含「区」），否则返回归一化原文（区域组/合计行）。
 */
function foldZone(raw: string): string {
  const s = (raw ?? '').trim();
  const d = resolveDistrict(s);
  return normalizeCjk(d ? d.zh : s);
}

function parseRow(cols: string[]): StudentCountRow {
  const zone = (cols[0] ?? '').trim();
  return {
    zone,
    zoneSimp: normalizeCjk(zone),
    total: toNumber(cols[1]),
    s1: toNumber(cols[2]),
    s2: toNumber(cols[3]),
    s3: toNumber(cols[4]),
    s4: toNumber(cols[5]),
    s5: toNumber(cols[6]),
    s6: toNumber(cols[7]),
    s7: toNumber(cols[8]),
  };
}

export function parseStudentStats(text: string): StudentStats {
  const rows = parseCsv(text, { delimiter: ',' });
  const all: StudentCountRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (!(rows[i][0] ?? '').trim()) continue;
    all.push(parseRow(rows[i]));
  }
  const grandTotal = all.find((r) => r.zoneSimp === GRAND_ZONE);
  const regions = all.filter((r) => REGION_ZONES.includes(r.zoneSimp));
  const districts = all.filter((r) => r !== grandTotal && !regions.includes(r));
  return { grandTotal, regions, districts };
}

// ------------------------------------------------------------
// 官方 XLSX 数据源（2026-09-17 起：官方已无 tab0407 CSV，改为解析 Statistics_by_district_C.xlsx「表3(b)」）
// ------------------------------------------------------------

/** 数字字段名（区域组求和用） */
type StatNumberField = 'total' | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';

/** 数字字段列表 */
const STAT_NUMBER_FIELDS: readonly StatNumberField[] = ['total', 's1', 's2', 's3', 's4', 's5', 's6', 's7'];

/** 官方 XLSX 目标工作表：「表3(b)」 */
const SHEET_3B = /表\s*3\s*\(b\)/;

/** 级别标签 → 字段（官方表「級別」列取值：中一至中七 + 所有級別） */
const LEVEL_FIELDS: ReadonlyArray<{ label: string; field: StatNumberField }> = [
  { label: '中一', field: 's1' },
  { label: '中二', field: 's2' },
  { label: '中三', field: 's3' },
  { label: '中四', field: 's4' },
  { label: '中五', field: 's5' },
  { label: '中六', field: 's6' },
  { label: '中七', field: 's7' },
  { label: '所有級別', field: 'total' },
];

/** 「總計·學生人數」所在列（表3(b) 0 基第 11 列） */
const TOTAL_STUDENTS_COL = 11;

/** 区域组口径：官方表无区域组行 → 按区议会分区归属（4/5/9 区）求和生成 */
const REGION_GROUPS: ReadonlyArray<{ zone: string; members: readonly string[] }> = [
  { zone: '香港島', members: ['中西區', '灣仔', '東區', '南區'] },
  { zone: '九龍', members: ['深水埗', '油尖旺', '九龍城', '黃大仙', '觀塘'] },
  { zone: '新界', members: ['荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島', '葵青'] },
];

/** 空统计行（字段待填） */
function emptyRow(zone: string): StudentCountRow {
  return { zone, zoneSimp: normalizeCjk(zone), total: 0, s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, s6: 0, s7: 0 };
}

/**
 * 从「表3(b)」矩阵提取统计行：
 * 分区名仅出现在每块首行（向下填充）；「所有級別」行即合计；「-」/缺省按 0。
 */
function extractStudentStats(rows: string[][]): StudentCountRow[] {
  const acc = new Map<string, StudentCountRow>();
  let zone = '';
  for (const row of rows) {
    const head = (row[0] ?? '').trim();
    if (head) zone = head;
    const level = (row[2] ?? '').trim();
    const field = LEVEL_FIELDS.find((l) => l.label === level)?.field;
    if (!field || !zone) continue;
    let rec = acc.get(zone);
    if (!rec) {
      rec = emptyRow(zone);
      acc.set(zone, rec);
    }
    rec[field] = toNumber(row[TOTAL_STUDENTS_COL]);
  }
  return [...acc.values()];
}

/** 区域组行：按成员求和；成员缺失（官方口径变化）则该组跳过 */
function sumRegions(districts: StudentCountRow[]): StudentCountRow[] {
  const out: StudentCountRow[] = [];
  for (const group of REGION_GROUPS) {
    const members: StudentCountRow[] = [];
    for (const name of group.members) {
      const hit = districts.find((r) => foldZone(r.zone) === foldZone(name));
      if (!hit) break;
      members.push(hit);
    }
    if (members.length !== group.members.length) continue;
    const rec = emptyRow(group.zone);
    for (const m of members) {
      for (const f of STAT_NUMBER_FIELDS) rec[f] += m[f];
    }
    out.push(rec);
  }
  return out;
}

/**
 * 解析官方统计 XLSX（《按分區及級別劃分的學校數目及學生人數》「表3(b)」）：
 * 取「總計·學生人數」列生成 18 区 + 全港合计，区域组按官方归属求和生成。
 */
export function parseStudentStatsFromXlsx(bytes: Uint8Array): StudentStats {
  const sheets = readXlsx(bytes);
  const sheet = sheets.find((s) => SHEET_3B.test(s.name));
  if (!sheet) throw new Error('统计文件中未找到「表3(b)」工作表：官方文件结构可能已变更，请稍后重试。');
  const rows = extractStudentStats(sheet.rows);
  const grandTotal = rows.find((r) => r.zoneSimp === GRAND_ZONE);
  const districts = rows.filter((r) => r !== grandTotal && resolveDistrict(r.zone) !== undefined);
  return { grandTotal, regions: sumRegions(districts), districts };
}

/**
 * 按区名查统计（单区明细）：
 * 支持简体/繁体/「区」字省略/英文名；「全港/所有分區/全部」返回合计行；未命中 undefined。
 */
export function findStudentStats(stats: StudentStats, zone: string): StudentCountRow | undefined {
  const q = foldZone(zone);
  if (!q) return undefined;
  if (q === '全港' || q === GRAND_ZONE || q === '全部') return stats.grandTotal;
  const pool = [...stats.districts, ...stats.regions];
  for (const r of pool) if (foldZone(r.zone) === q) return r;
  if (q.length >= 2) {
    for (const r of pool) {
      const f = foldZone(r.zone);
      if (f.includes(q) || q.includes(f)) return r;
    }
  }
  return undefined;
}

/** 全港 18 区对比：按所有級别人数降序（纯函数，不修改原数组） */
export function rankDistrictsByTotal(stats: StudentStats): StudentCountRow[] {
  return [...stats.districts].sort((a, b) => b.total - a.total);
}
