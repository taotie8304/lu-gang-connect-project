// 鲁港通 - 学校档案聚合：KGP / K1-K3 空缺 / PSP / SSP 解析 + 按级别挂载（字段缺失不编造）
import { parseCsvToObjects } from '../csv';
import { normalizeCjk } from '../cjk';
import { matchByName } from '../name-match';
import type { NamedRecord } from '../name-match';
import type { SchoolRecord } from './search';

// ============================================================
// 清洗工具
// ============================================================

/** 单元格清洗：剥离包裹引号（官方导出噪音）→ 空白与「-」归一为空串（未提供不编造）→ 剥离 HTML 标签并归一空白 */
function clean(v: string | undefined): string {
  let s = (v ?? '').trim();
  // 官方数据导出噪音：学费等字段残留包裹引号（"""$63330""" 解析为 "$63330"），剥离一层
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
  if (s === '' || s === '-') return '';
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// KGP：幼稚园概览（962 所，^ 分隔 104 列）
// ============================================================

/** 幼稚园概览记录 */
export interface KgRecord extends NamedRecord {
  schoolNo: string;
  district: string;
  /** 参加幼稚园教育计划（有參加/沒有參加） */
  joinsScheme: string;
  /** 课程类别（本地/非本地） */
  curriculum: string;
  applicationStart: string;
  applicationEnd: string;
  /** 已使用课室的总容额（学额） */
  capacity: string;
  teacherRatioAm: string;
  teacherRatioPm: string;
  /** 全年收费水平（半日班，空 = 未提供/不适用） */
  feeHalfDay: string;
  /** 全年收费水平（全日班） */
  feeWholeDay: string;
  website: string;
  totalTeachers: string;
}

export function parseKgp(text: string): KgRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: '^' });
  const out: KgRecord[] = [];
  for (const row of rows) {
    const name = (row['學校名稱'] ?? '').trim();
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      schoolNo: clean(row['學校編號']),
      district: clean(row['地區']),
      joinsScheme: clean(row['參加幼稚園教育計劃']),
      curriculum: clean(row['課程類別']),
      applicationStart: clean(row['開始申請日期']),
      applicationEnd: clean(row['結束申請日期']),
      capacity: clean(row['已使用課室的總容額']),
      teacherRatioAm: clean(row['上午時段師生比例']),
      teacherRatioPm: clean(row['下午時段師生比例']),
      feeHalfDay: clean(row['收費水平_全年_半日']),
      feeWholeDay: clean(row['收費水平_全年_全日']),
      website: clean(row['學校網址']),
      totalTeachers: clean(row['校長及教學人員總人數']),
    });
  }
  return out;
}

// ============================================================
// K1-K3 学位空缺（708 所，每周更新，含数据截至日期）
// ============================================================

/** K1-K3 学位空缺记录（状态值 Y/N/P 原文保真） */
export interface VacancyRecord extends NamedRecord {
  district: string;
  scrn: string;
  nameEn: string;
  k1: string;
  k2: string;
  k3: string;
  /** 数据截至日期（原文 DD/MM/YYYY） */
  asAtDate: string;
}

export function parseVacancy(text: string): VacancyRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: ',' });
  const out: VacancyRecord[] = [];
  for (const row of rows) {
    const name = (row['School Chinese Name'] ?? '').trim();
    const nameEn = (row['School English Name'] ?? '').trim();
    if (!name && !nameEn) continue;
    out.push({
      name: name || nameEn,
      nameSimp: normalizeCjk(name),
      nameEn,
      district: (row['District'] ?? '').trim(),
      scrn: (row['SCRN'] ?? '').trim(),
      k1: (row['K1 Vacancy Status'] ?? '').trim(),
      k2: (row['K2 Vacancy Status'] ?? '').trim(),
      k3: (row['K3 Vacancy Status'] ?? '').trim(),
      asAtDate: (row['As At Date'] ?? '').trim(),
    });
  }
  return out;
}

// ============================================================
// PSP：小学概览（520 所）
// ============================================================

/** 小学班级结构（本学年小一至小六班数） */
export interface PrimaryClassStructure {
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  p5: string;
  p6: string;
}

/** 小学概览记录 */
export interface PspRecord extends NamedRecord {
  district: string;
  /** 小一学校网编号 */
  schoolNet: string;
  teachingLanguage: string;
  /** 一条龙中学 */
  throughTrain: string;
  /** 直属中学 */
  feeder: string;
  /** 联系中学 */
  nominated: string;
  fee: string;
  tongFee: string;
  gender: string;
  religion: string;
  motto: string;
  sponsor: string;
  foundedYear: string;
  /** 学校类别1（資助/官立/直資/私立…） */
  category: string;
  classStructure: PrimaryClassStructure;
  address: string;
  telephone: string;
  website: string;
}

export function parsePsp(text: string): PspRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: ',' });
  const out: PspRecord[] = [];
  for (const row of rows) {
    const name = (row['學校名稱'] ?? '').trim();
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      district: clean(row['區域']),
      schoolNet: clean(row['小一學校網']),
      teachingLanguage: clean(row['教學語言']),
      throughTrain: clean(row['一條龍中學']),
      feeder: clean(row['直屬中學']),
      nominated: clean(row['聯繫中學']),
      fee: clean(row['學費']),
      tongFee: clean(row['堂費']),
      gender: clean(row['學生性別']),
      religion: clean(row['宗教']),
      motto: clean(row['校訓']),
      sponsor: clean(row['辦學團體']),
      foundedYear: clean(row['創校年份']),
      category: clean(row['學校類別1']),
      classStructure: {
        p1: clean(row['本學年小一班數']),
        p2: clean(row['本學年小二班數']),
        p3: clean(row['本學年小三班數']),
        p4: clean(row['本學年小四班數']),
        p5: clean(row['本學年小五班數']),
        p6: clean(row['本學年小六班數']),
      },
      address: clean(row['學校地址']),
      telephone: clean(row['學校電話']),
      website: clean(row['學校網址']),
    });
  }
  return out;
}

// ============================================================
// SSP：中学概览（444 所）
// ============================================================

/** 中学班级结构（本学年中一至中六班数） */
export interface SecondaryClassStructure {
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  s6: string;
}

/** 中学按级学费（中一至中六） */
export interface SecondaryFees {
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  s5: string;
  s6: string;
}

/** 中学概览记录 */
export interface SspRecord extends NamedRecord {
  district: string;
  /** 办学宗旨（已清洗 HTML） */
  mission: string;
  /** 教师总人数 */
  teacherCount: string;
  /** 核准编制教师职位数目 */
  approvedPosts: string;
  classStructure: SecondaryClassStructure;
  fees: SecondaryFees;
  religion: string;
  motto: string;
  foundedYear: string;
  category: string;
  gender: string;
  /** 学校设施 */
  facilities: string;
  classroomCount: string;
  address: string;
  telephone: string;
  website: string;
}

export function parseSsp(text: string): SspRecord[] {
  const rows = parseCsvToObjects(text, { delimiter: ',' });
  const out: SspRecord[] = [];
  for (const row of rows) {
    const name = (row['學校名稱'] ?? '').trim();
    if (!name) continue;
    out.push({
      name,
      nameSimp: normalizeCjk(name),
      district: clean(row['區域']),
      mission: clean(row['辦學宗旨']),
      teacherCount: clean(row['教師總人數']),
      approvedPosts: clean(row['核准編制教師職位數目']),
      classStructure: {
        s1: clean(row['本學年中一班數']),
        s2: clean(row['本學年中二班數']),
        s3: clean(row['本學年中三班數']),
        s4: clean(row['本學年中四班數']),
        s5: clean(row['本學年中五班數']),
        s6: clean(row['本學年中六班數']),
      },
      fees: {
        s1: clean(row['2025_2026學年學費S1']),
        s2: clean(row['2025_2026學年學費S2']),
        s3: clean(row['2025_2026學年學費S3']),
        s4: clean(row['2025_2026學年學費S4']),
        s5: clean(row['2025_2026學年學費S5']),
        s6: clean(row['2025_2026學年學費S6']),
      },
      religion: clean(row['宗教']),
      motto: clean(row['校訓']),
      foundedYear: clean(row['創校年份']),
      category: clean(row['學校類別']),
      gender: clean(row['學生性別']),
      facilities: clean(row['學校設施']),
      classroomCount: clean(row['學校設施-課室數目']),
      address: clean(row['學校地址']),
      telephone: clean(row['學校電話']),
      website: clean(row['學校網址']),
    });
  }
  return out;
}

// ============================================================
// 档案聚合：按学校级别挂载概览数据
// ============================================================

/** 聚合数据源（各源均可选，未提供则不挂载并在 missing 标注） */
export interface DetailSources {
  kgp?: KgRecord[];
  vacancy?: VacancyRecord[];
  psp?: PspRecord[];
  ssp?: SspRecord[];
}

/** K1-K3 空缺精简（输出用） */
export interface KgVacancy {
  k1: string;
  k2: string;
  k3: string;
  asAtDate: string;
}

/** 学校档案（SCH_LOC 主记录 + 按级别挂载 + 缺失标注） */
export interface SchoolDetail {
  record: SchoolRecord;
  kg?: KgRecord;
  vacancy?: KgVacancy;
  primary?: PspRecord;
  secondary?: SspRecord;
  /** 官方数据未提供的字段说明（挂载未命中时生成，不编造） */
  missing: string[];
}

/**
 * 聚合学校档案：以校名匹配概览数据按级别挂载。
 * - kg → KGP + K1-K3 空缺
 * - primary → PSP
 * - secondary → SSP
 * - other（特殊学校）→ 无挂载
 */
export function buildDetail(record: SchoolRecord, sources: DetailSources = {}): SchoolDetail {
  const detail: SchoolDetail = { record, missing: [] };
  const query = record.nameSimp || normalizeCjk(record.nameZh);

  if (record.level === 'kg') {
    const kg = matchByName(sources.kgp, query);
    if (kg) detail.kg = kg;
    else detail.missing.push('幼稚园概览（参加计划情况、课程类别、学费、师生比例、学额、申请日期）官方数据未提供');

    const vac = matchByName(sources.vacancy, query);
    if (vac) detail.vacancy = { k1: vac.k1, k2: vac.k2, k3: vac.k3, asAtDate: vac.asAtDate };
    else detail.missing.push('K1-K3 学位空缺官方数据未提供');
  } else if (record.level === 'primary') {
    const psp = matchByName(sources.psp, query);
    if (psp) detail.primary = psp;
    else detail.missing.push('小学概览（小一校网、教学语言、一条龙/直属/联系中学、班级结构、学费）官方数据未提供');
  } else if (record.level === 'secondary') {
    const ssp = matchByName(sources.ssp, query);
    if (ssp) detail.secondary = ssp;
    else detail.missing.push('中学概览（班级结构、教师人数、办学宗旨、设施）官方数据未提供');
  }

  return detail;
}
