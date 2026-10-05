// 鲁港通 - 注册资料查询（需求 6）：XML 三件套解析 + 按校名聚合
// 数据边界：注册名册涵盖除官立学校外的幼稚园/小学/中学/专上院校（需求 6.2；2026-09 实测 FinanceType 无「官立」分类）
import { normalizeCjk } from '../cjk';
import { matchAllByName } from '../name-match';
import { getField, scanBlocks } from '../xml';

/** 注册基本信息（一条记录 = 一个学校编号的一个级别/时段；同校可多条） */
export interface RegBasicRecord {
  name: string;
  nameEn: string;
  /** 简繁 + 全角归一（匹配用，不用于展示） */
  nameSimp: string;
  schoolNumber: string;
  locationId: string;
  level: string;
  session: string;
  gender: string;
  district: string;
  financeType: string;
  phone?: string;
  website?: string;
  address: string;
  addressEn: string;
  status: string;
  registrationNumber: string;
  provisionalDate?: string;
  registrationDate?: string;
}

/** 注册校舍（同校可多条，PremisesCode 区分） */
export interface RegPremisesRecord {
  name: string;
  nameEn: string;
  nameSimp: string;
  schoolNumber: string;
  premisesCode: string;
  desc: string;
  descEn: string;
}

/** 批准容额（房间级；房号可为数字或字母） */
export interface RegRoomRecord {
  name: string;
  nameSimp: string;
  schoolNumber: string;
  premisesCode: string;
  subPremisesCode: string;
  roomType: string;
  roomNo: string;
  /** PermittedAccommodation 批准容额（人） */
  permitted: number;
  /** PermittedAccommodationKGWD；缺失时 undefined */
  kgwd?: number;
  remarks?: string;
}

/** 查询结果：exact=false 表示仅包含匹配候选（官立学校不在册时可能命中相关记录） */
export interface RegistrationResult {
  exact: boolean;
  matches: RegBasicRecord[];
  premises: RegPremisesRecord[];
  rooms: RegRoomRecord[];
}

/** 未命中提示（需求 6.3）：官立学校不在注册名册内 */
export const REG_NOT_FOUND_TIP =
  '未找到该校的注册记录。注意：学校注册名册不包含官立学校（涵盖除官立学校外的幼稚园/小学/中学/专上院校），若您查询的是官立学校，查无记录属正常情况。';

/** 匹配用归一化：简繁 + 全角 ASCII/全角空格 → 半角（数据校名含全角数字，如「６１１教育中心」） */
function normalizeRegName(s: string): string {
  return normalizeCjk(s)
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ');
}

/** 数值字段解析：缺失/非法 → undefined */
function toOptionalNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** 解析基本信息 XML（SchoolBasicInfo，小/中/幼/其他/专上混排） */
export function parseRegBasic(xml: string): RegBasicRecord[] {
  const out: RegBasicRecord[] = [];
  scanBlocks(xml, 'SchoolBasicInfo', (b) => {
    const name = getField(b, 'SchoolNameChi') ?? '';
    out.push({
      name,
      nameEn: getField(b, 'SchoolNameEng') ?? '',
      nameSimp: normalizeRegName(name),
      schoolNumber: getField(b, 'SchoolNumber') ?? '',
      locationId: getField(b, 'LocationID') ?? '',
      level: getField(b, 'SchoolLevelChi') ?? '',
      session: getField(b, 'SchoolSessionChi') ?? '',
      gender: getField(b, 'StudentGenderChi') ?? '',
      district: getField(b, 'DistrictChi') ?? '',
      financeType: getField(b, 'FinanceTypeChi') ?? '',
      phone: getField(b, 'TelephoneNumber'),
      website: getField(b, 'SchoolWebSite'),
      address: getField(b, 'SchoolAddressChi') ?? '',
      addressEn: getField(b, 'SchoolAddressEng') ?? '',
      status: getField(b, 'RegistrationStatusChi') ?? '',
      registrationNumber: getField(b, 'SchoolRegistrationNumber') ?? '',
      provisionalDate: getField(b, 'ProvisionalRegistrationDate'),
      registrationDate: getField(b, 'RegistrationDate'),
    });
  });
  return out;
}

/** 解析校舍 XML（SchoolPremises） */
export function parseRegPremises(xml: string): RegPremisesRecord[] {
  const out: RegPremisesRecord[] = [];
  scanBlocks(xml, 'SchoolPremises', (b) => {
    const name = getField(b, 'SchoolNameChi') ?? '';
    out.push({
      name,
      nameEn: getField(b, 'SchoolNameEng') ?? '',
      nameSimp: normalizeRegName(name),
      schoolNumber: getField(b, 'SchoolNumber') ?? '',
      premisesCode: getField(b, 'PremisesCode') ?? '',
      desc: getField(b, 'PremisesDescChi') ?? '',
      descEn: getField(b, 'PremisesDescEng') ?? '',
    });
  });
  return out;
}

/** 解析批准容额 XML（SchoolAccommodation，房间级 4 万+ 条） */
export function parseRegAccommodation(xml: string): RegRoomRecord[] {
  const out: RegRoomRecord[] = [];
  scanBlocks(xml, 'SchoolAccommodation', (b) => {
    const name = getField(b, 'SchoolNameChi') ?? '';
    out.push({
      name,
      nameSimp: normalizeRegName(name),
      schoolNumber: getField(b, 'SchoolNumber') ?? '',
      premisesCode: getField(b, 'PremisesCode') ?? '',
      subPremisesCode: getField(b, 'SubPremisesCode') ?? '',
      roomType: getField(b, 'RoomType') ?? '',
      roomNo: getField(b, 'RoomNo') ?? '',
      permitted: toOptionalNumber(getField(b, 'PermittedAccommodation')) ?? 0,
      kgwd: toOptionalNumber(getField(b, 'PermittedAccommodationKGWD')),
      remarks: getField(b, 'RemarksChi'),
    });
  });
  return out;
}

/**
 * 按校名查询注册资料：精确优先 → 包含匹配候选。
 * 返回同校多级别/时段全部记录 + 关联校舍与房间容额；完全查无返回 undefined。
 */
export function findRegistration(
  basic: RegBasicRecord[],
  premises: RegPremisesRecord[],
  rooms: RegRoomRecord[],
  query: string
): RegistrationResult | undefined {
  const q = normalizeRegName((query ?? '').trim());
  if (!q) return undefined;
  const exact = basic.some((r) => r.nameSimp === q);
  const matches = matchAllByName(basic, q);
  if (matches.length === 0) return undefined;
  const numbers = new Set(matches.map((r) => r.schoolNumber));
  return {
    exact,
    matches,
    premises: premises.filter((p) => numbers.has(p.schoolNumber)),
    rooms: rooms.filter((r) => numbers.has(r.schoolNumber)),
  };
}
