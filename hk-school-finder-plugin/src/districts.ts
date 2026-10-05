// 鲁港通 - 香港 18 区定义与解析：英文（与 SCH_LOC DISTRICT 列一致）/ 简体 / 繁体容错
import { normalizeCjk } from './cjk';

export interface DistrictInfo {
  /** 英文名（与 SCH_LOC DISTRICT 列一致） */
  en: string;
  /** 简体中文名 */
  zh: string;
}

export const DISTRICTS: readonly DistrictInfo[] = [
  { en: 'CENTRAL AND WESTERN', zh: '中西区' },
  { en: 'WAN CHAI', zh: '湾仔区' },
  { en: 'EASTERN', zh: '东区' },
  { en: 'SOUTHERN', zh: '南区' },
  { en: 'YAU TSIM MONG', zh: '油尖旺区' },
  { en: 'SHAM SHUI PO', zh: '深水埗区' },
  { en: 'KOWLOON CITY', zh: '九龙城区' },
  { en: 'WONG TAI SIN', zh: '黄大仙区' },
  { en: 'KWUN TONG', zh: '观塘区' },
  { en: 'KWAI TSING', zh: '葵青区' },
  { en: 'TSUEN WAN', zh: '荃湾区' },
  { en: 'TUEN MUN', zh: '屯门区' },
  { en: 'YUEN LONG', zh: '元朗区' },
  { en: 'NORTH', zh: '北区' },
  { en: 'TAI PO', zh: '大埔区' },
  { en: 'SHA TIN', zh: '沙田区' },
  { en: 'SAI KUNG', zh: '西贡区' },
  { en: 'ISLANDS', zh: '离岛区' },
];

/**
 * 解析区域名：
 * - 英文大小写不敏感；繁体自动转简；可省略「区」字
 * - 无法识别返回 undefined
 */
export function resolveDistrict(input: string): DistrictInfo | undefined {
  const s = normalizeCjk((input ?? '').trim());
  if (!s) return undefined;
  const upper = s.toUpperCase();
  return (
    DISTRICTS.find((d) => d.en === upper) ??
    DISTRICTS.find((d) => d.zh === s || d.zh === `${s}区`)
  );
}
