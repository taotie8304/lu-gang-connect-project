// 鲁港通 - 数据源注册表：香港学校资料 16 个官方文件源（12 CSV + 3 XML + 1 XLSX）
// 学年切换时只需更新本文件 URL 与 note，重新打包即可（需求 10.4）

export type RefreshPolicy = 'realtime' | 'weekly' | 'termly' | 'yearly';
export type DataFormat = 'csv' | 'xml' | 'xlsx';

/** 数据源声明（URL 集中管理，查询层按 id 引用） */
export interface DataSource {
  /** 稳定标识：缓存文件名与查询层引用键（不含学年，勿随学年改名） */
  id: string;
  /** 官方下载地址 */
  url: string;
  /** 更新节奏：决定缓存 TTL；realtime 不缓存 */
  refresh: RefreshPolicy;
  /** 数据格式 */
  format: DataFormat;
  /** CSV 字段分隔符（format=csv 时有效）：',' / '\t' / '^' */
  delimiter: string;
  /** 人类可读说明（含学年标注与实测编码） */
  note: string;
}

/** 缓存有效期（毫秒）；null = 不缓存（实时接口） */
export const TTL_MS: Record<RefreshPolicy, number | null> = {
  realtime: null,
  weekly: 12 * 60 * 60 * 1000, // 12 小时
  termly: 7 * 24 * 60 * 60 * 1000, // 7 天
  yearly: 30 * 24 * 60 * 60 * 1000, // 30 天
};

/**
 * 判断缓存年龄是否仍在有效期内。
 * realtime 策略永不判为新鲜（调用方不缓存）。
 */
export function isFresh(refresh: RefreshPolicy, ageMs: number): boolean {
  const ttl = TTL_MS[refresh];
  if (ttl === null) return false;
  return ageMs < ttl;
}

/** 附近学校实时接口（不缓存，每次实时调用；参数 lat/long/max） */
export const NEAREST_SCHOOLS_API = 'https://api.data.gov.hk/v1/nearest-schools';

// 学校注册资料 XML 三件套：2026-09-17 服务器实测三文件 HTTPS 均可下载（200；共约 147MB；CRLF 行尾）
const EDB_XML = 'https://applications.edb.gov.hk/datagovhk/data/';

/** 全部可缓存文件源（16 个）：12 CSV + 3 XML + 1 XLSX；实时接口见 NEAREST_SCHOOLS_API */
export const SOURCES: readonly DataSource[] = [
  {
    id: 'sch_loc',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/SCH_LOC_EDB.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: '\t',
    note: '学校位置总表（约 3,461 所；UTF-16 LE/Tab；坐标 DMS 度-分-秒）',
  },
  {
    id: 'kgp',
    url: 'http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/free-quality-kg-edu/KGP_2025_tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: '^',
    note: '幼稚园概览 2025（962 所；UTF-8 BOM/^分隔）',
  },
  {
    id: 'psp',
    url: 'https://www.chsc.hk/datagovhk/psp_2025_tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '小学概览 2025（521 所；UTF-8 BOM）',
  },
  {
    id: 'ssp',
    url: 'https://www.chsc.hk/datagovhk/ssp_2025_2026_tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '中学概览 2025/26（UTF-8 BOM）',
  },
  {
    id: 'through_train',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/Through-train-schools-tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '一条龙学校名单 2026/27',
  },
  {
    id: 'poa',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/POA_SchoolNet_TC.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '小一入学学校网范围（全港校网）',
  },
  {
    id: 'sspa',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/SSPA_SchServingNet_tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '中学学位分配校网（UTF-8 BOM；18 个校网列 Y/N）',
  },
  {
    id: 'k1_not_joining',
    url: 'http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/kindergartens_not_joining_scheme_tc_2026.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '不参加免费幼教计划的幼稚园名单 2026/27',
  },
  {
    id: 'k1k3_vacancy',
    url: 'http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/K1-K3_vacancy_information_tc_202627.csv',
    refresh: 'weekly',
    format: 'csv',
    delimiter: ',',
    note: 'K1–K3 学位空缺（每周更新；按 18 区）',
  },
  {
    id: 'kg_scheme',
    url: 'http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/free-quality-kg-edu/scheme_kg_list_202526_tc-en.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: '\t',
    note: '免费优质幼稚园教育计划名单 2025/26（UTF-16 LE/Tab；表头引号内嵌换行）',
  },
  {
    id: 'dss_fee',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/DSS_School_Fee_TC.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '直资学校学费 2025/26',
  },
  {
    id: 'non_aided_ccc',
    url: 'https://www.edb.gov.hk/attachment/datagovhk/Non-aided_CCCs_attached_to_KGs_tc.csv',
    refresh: 'yearly',
    format: 'csv',
    delimiter: ',',
    note: '附设于幼稚园的非资助幼儿中心（UTF-16 LE）',
  },
  {
    id: 'reg_basic',
    url: `${EDB_XML}SchoolBasicInfo.xml`,
    refresh: 'termly',
    format: 'xml',
    delimiter: '',
    note: '学校注册资料·基本信息（12,159 条；注册编号/状况/类别；约 20MB）',
  },
  {
    id: 'reg_premises',
    url: `${EDB_XML}SchoolPremises.xml`,
    refresh: 'termly',
    format: 'xml',
    delimiter: '',
    note: '学校注册资料·校舍（5,837 条；校舍地址；约 12MB）',
  },
  {
    id: 'reg_accommodation',
    url: `${EDB_XML}SchoolAccommodation.xml`,
    refresh: 'termly',
    format: 'xml',
    delimiter: '',
    note: '学校注册资料·批准容额（43,273 间课室；约 115MB）',
  },
  {
    id: 'tab0407',
    url: 'https://www.edb.gov.hk/attachment/tc/about-edb/publications-stat/figures/Statistics_by_district_C.xlsx',
    refresh: 'yearly',
    format: 'xlsx',
    delimiter: '',
    note: '中学日校分区学生人数（官方 XLSX「表3(b)」總計·學生人數列；2026-09-17 实测，随学年覆盖更新）',
  },
];

/** 按 id 取数据源；未注册时抛内部错误（开发期暴露拼写问题） */
export function getSource(id: string): DataSource {
  const found = SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`内部错误：未注册的数据源「${id}」`);
  return found;
}
