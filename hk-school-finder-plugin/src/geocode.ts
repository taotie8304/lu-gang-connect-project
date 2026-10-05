// 鲁港通 - 地理定位：地点文本 → 坐标锚点（附近学校查询用）
// 解析优先级：①「纬度,经度」文本 ②SCH_LOC 校名 ③地标词典精确 ④区域中心 ⑤地标词典包含
import { normalizeCjk } from './cjk';
import { resolveDistrict } from './districts';

/** 坐标锚点（lat/lng 十进制度；label 为命中对象的标准简体名） */
export interface GeoAnchor {
  lat: number;
  lng: number;
  label: string;
}

/** 校名地理匹配所需最小字段（SchoolRecord 结构兼容） */
export interface GeoSchoolLike {
  nameSimp: string;
  nameEn: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
}

/** 18 区中心坐标（SCH_LOC 3461 条学校坐标均值；scripts/stats-district-centers.mjs 生成） */
const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  'CENTRAL AND WESTERN': { lat: 22.2823, lng: 114.1448 },
  EASTERN: { lat: 22.279, lng: 114.2195 },
  ISLANDS: { lat: 22.2668, lng: 113.9789 },
  'KOWLOON CITY': { lat: 22.3234, lng: 114.1827 },
  'KWAI TSING': { lat: 22.3595, lng: 114.1218 },
  'KWUN TONG': { lat: 22.316, lng: 114.2268 },
  NORTH: { lat: 22.4981, lng: 114.1369 },
  'SAI KUNG': { lat: 22.3211, lng: 114.2608 },
  'SHA TIN': { lat: 22.3912, lng: 114.2023 },
  'SHAM SHUI PO': { lat: 22.3343, lng: 114.159 },
  SOUTHERN: { lat: 22.247, lng: 114.1602 },
  'TAI PO': { lat: 22.452, lng: 114.1706 },
  'TSUEN WAN': { lat: 22.3713, lng: 114.111 },
  'TUEN MUN': { lat: 22.3933, lng: 113.9726 },
  'WAN CHAI': { lat: 22.2736, lng: 114.1827 },
  'WONG TAI SIN': { lat: 22.3413, lng: 114.1991 },
  'YAU TSIM MONG': { lat: 22.3153, lng: 114.1671 },
  'YUEN LONG': { lat: 22.4522, lng: 114.0152 },
};

/**
 * 地标词典（简体键；坐标来源：Google Maps / 香港政府地理资讯地图）
 * 覆盖：口岸、主要商圈/景点、18 区代表性地点、交通枢纽
 */
const LANDMARKS: Record<string, { lat: number; lng: number }> = {
  // === 口岸 ===
  落马洲口岸: { lat: 22.5144, lng: 114.0683 },
  福田口岸: { lat: 22.5283, lng: 114.0714 },
  罗湖口岸: { lat: 22.5284, lng: 114.1131 },
  深圳湾口岸: { lat: 22.4928, lng: 113.9446 },
  港珠澳大桥口岸: { lat: 22.32, lng: 113.941 },
  西九龙站: { lat: 22.3048, lng: 114.1618 },
  莲塘口岸: { lat: 22.553, lng: 114.131 },

  // === 商圈 / 景点 ===
  海港城: { lat: 22.297, lng: 114.1687 },
  时代广场: { lat: 22.2782, lng: 114.1822 },
  太古广场: { lat: 22.2774, lng: 114.1655 },
  朗豪坊: { lat: 22.3182, lng: 114.1688 },
  又一城: { lat: 22.3369, lng: 114.1738 },
  兰桂坊: { lat: 22.2807, lng: 114.1559 },
  庙街: { lat: 22.3088, lng: 114.17 },
  女人街: { lat: 22.3188, lng: 114.1697 },
  香港大学: { lat: 22.284, lng: 114.1363 },

  // === 港岛 ===
  中环: { lat: 22.2819, lng: 114.1585 },
  金钟: { lat: 22.2793, lng: 114.1655 },
  湾仔: { lat: 22.2783, lng: 114.1747 },
  铜锣湾: { lat: 22.2801, lng: 114.184 },
  北角: { lat: 22.291, lng: 114.2009 },
  太平山顶: { lat: 22.2759, lng: 114.1455 },
  香港立法会: { lat: 22.2802, lng: 114.1662 },
  维多利亚港: { lat: 22.293, lng: 114.169 },
  海洋公园: { lat: 22.2468, lng: 114.1748 },
  星光大道: { lat: 22.2935, lng: 114.1748 },
  柴湾: { lat: 22.2644, lng: 114.2371 },
  筲箕湾: { lat: 22.2791, lng: 114.2289 },
  鲗鱼涌: { lat: 22.2864, lng: 114.2098 },
  跑马地: { lat: 22.27, lng: 114.184 },
  坚尼地城: { lat: 22.2814, lng: 114.1289 },
  西营盘: { lat: 22.2846, lng: 114.1429 },
  上环: { lat: 22.2867, lng: 114.1517 },
  天后: { lat: 22.2824, lng: 114.1917 },
  炮台山: { lat: 22.2882, lng: 114.1922 },

  // === 九龙 ===
  尖沙咀: { lat: 22.2988, lng: 114.1722 },
  旺角: { lat: 22.3193, lng: 114.1694 },
  红磡: { lat: 22.3033, lng: 114.1818 },
  九龙塘: { lat: 22.3372, lng: 114.176 },
  油麻地: { lat: 22.3128, lng: 114.1705 },
  佐敦: { lat: 22.3048, lng: 114.1713 },
  深水埗: { lat: 22.3309, lng: 114.1624 },
  太子: { lat: 22.3254, lng: 114.168 },
  观塘: { lat: 22.3132, lng: 114.2252 },
  黄大仙: { lat: 22.3407, lng: 114.1934 },
  九龙湾: { lat: 22.3237, lng: 114.2143 },
  牛头角: { lat: 22.3153, lng: 114.2194 },
  蓝田: { lat: 22.3068, lng: 114.236 },
  油塘: { lat: 22.2953, lng: 114.2372 },
  调景岭: { lat: 22.3068, lng: 114.2522 },
  坑口: { lat: 22.3172, lng: 114.2635 },
  宝琳: { lat: 22.3219, lng: 114.2574 },
  康城: { lat: 22.296, lng: 114.27 },
  启德: { lat: 22.33, lng: 114.2 },
  彩虹: { lat: 22.3492, lng: 114.2094 },
  九龙城: { lat: 22.328, lng: 114.191 },
  土瓜湾: { lat: 22.3166, lng: 114.1873 },
  黄埔: { lat: 22.3049, lng: 114.1888 },
  柯士甸: { lat: 22.3041, lng: 114.1663 },
  奥运: { lat: 22.3181, lng: 114.1602 },
  南昌: { lat: 22.3264, lng: 114.153 },
  石硖尾: { lat: 22.332, lng: 114.1688 },

  // === 新界 ===
  沙田: { lat: 22.3813, lng: 114.1886 },
  大埔: { lat: 22.4513, lng: 114.1644 },
  元朗: { lat: 22.4445, lng: 114.0222 },
  屯门: { lat: 22.3908, lng: 113.9731 },
  荃湾: { lat: 22.3707, lng: 114.1138 },
  将军澳: { lat: 22.3073, lng: 114.2592 },
  上水: { lat: 22.501, lng: 114.1281 },
  粉岭: { lat: 22.492, lng: 114.1387 },
  西贡: { lat: 22.3813, lng: 114.2709 },
  石门: { lat: 22.389, lng: 114.2045 },
  硕门邨: { lat: 22.388, lng: 114.2055 },
  马鞍山: { lat: 22.4167, lng: 114.2333 },
  大围: { lat: 22.3728, lng: 114.1789 },
  火炭: { lat: 22.3969, lng: 114.1985 },
  第一城: { lat: 22.386, lng: 114.203 },
  科学园: { lat: 22.402, lng: 114.21 },
  白石角: { lat: 22.405, lng: 114.208 },
  屯门码头: { lat: 22.3722, lng: 113.9678 },
  天水围: { lat: 22.4469, lng: 114.0044 },
  洪水桥: { lat: 22.433, lng: 113.995 },
  锦田: { lat: 22.439, lng: 114.062 },
  流浮山: { lat: 22.467, lng: 113.981 },
  青衣: { lat: 22.358, lng: 114.107 },
  葵涌: { lat: 22.365, lng: 114.13 },
  葵芳: { lat: 22.3569, lng: 114.1282 },
  荔景: { lat: 22.348, lng: 114.1263 },
  深井: { lat: 22.367, lng: 114.06 },
  古洞: { lat: 22.503, lng: 114.104 },
  打鼓岭: { lat: 22.553, lng: 114.131 },
  美孚: { lat: 22.3378, lng: 114.137 },

  // === 离岛 / 南区 ===
  东涌: { lat: 22.289, lng: 113.9413 },
  香港机场: { lat: 22.308, lng: 113.9185 },
  迪士尼乐园: { lat: 22.313, lng: 114.0413 },
  赤柱: { lat: 22.2191, lng: 114.2121 },
  浅水湾: { lat: 22.2344, lng: 114.1971 },
  大屿山: { lat: 22.263, lng: 113.94 },
  梅窝: { lat: 22.2642, lng: 114.0004 },
  坪洲: { lat: 22.2845, lng: 114.0376 },
  长洲: { lat: 22.2057, lng: 114.0319 },
  南丫岛: { lat: 22.22, lng: 114.11 },
  逸东邨: { lat: 22.283, lng: 113.935 },
  东荟城: { lat: 22.289, lng: 113.94 },
  博览馆: { lat: 22.3214, lng: 113.9411 },
  欣澳: { lat: 22.3166, lng: 114.0101 },

  // === 交通枢纽 ===
  九龙站: { lat: 22.3049, lng: 114.1616 },
  青衣站: { lat: 22.3586, lng: 114.1075 },
  香港站: { lat: 22.2848, lng: 114.1582 },
  么地道: { lat: 22.297, lng: 114.1745 },

  // === 地标 / 商场 ===
  崇光百货: { lat: 22.2802, lng: 114.1843 },
  希慎广场: { lat: 22.2794, lng: 114.1838 },
  利园: { lat: 22.2785, lng: 114.184 },
  置地广场: { lat: 22.2816, lng: 114.1582 },
  IFC: { lat: 22.2848, lng: 114.1582 },
  ICC: { lat: 22.3039, lng: 114.1606 },
  Elements: { lat: 22.3047, lng: 114.1618 },
  K11: { lat: 22.2975, lng: 114.174 },
  MegaBox: { lat: 22.3197, lng: 114.2093 },
  APM: { lat: 22.3123, lng: 114.2256 },
  新城市广场: { lat: 22.3815, lng: 114.1891 },
  奥海城: { lat: 22.3174, lng: 114.1602 },
  德福广场: { lat: 22.323, lng: 114.214 },
  荷里活广场: { lat: 22.3409, lng: 114.202 },
  MOKO: { lat: 22.3222, lng: 114.1717 },
  PopCorn: { lat: 22.3078, lng: 114.2595 },
  ELEMENTS圆方: { lat: 22.3047, lng: 114.1618 },
};

/** 归一化查找索引（键统一简体 + 小写，与输入同一口径） */
const LANDMARK_INDEX = Object.entries(LANDMARKS).map(([name, c]) => ({
  key: normalizeCjk(name).toLowerCase(),
  label: name,
  lat: c.lat,
  lng: c.lng,
}));

/** 显式坐标文本：`纬度,经度`（英文/中文逗号，容忍空格） */
const COORD_RE = /^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/;

/**
 * 地点 → 坐标锚点。records 提供时优先按校名匹配（学校本身作为锚点）。
 * 全部解析失败返回 undefined（由调用方生成可操作中文提示）。
 */
export function resolveLocation(input?: string, records?: GeoSchoolLike[]): GeoAnchor | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;

  // ① 显式「纬度,经度」
  const coord = parseCoordText(raw);
  if (coord) return coord;

  // ② SCH_LOC 校名（精确 → 包含）
  if (records && records.length > 0) {
    const school = matchSchool(raw, records);
    if (school) return school;
  }

  const key = normalizeCjk(raw).toLowerCase();

  // ③ 地标词典精确
  const exact = LANDMARK_INDEX.find((item) => item.key === key);
  if (exact) return { lat: exact.lat, lng: exact.lng, label: exact.label };

  // ④ 区域名 → 18 区中心
  const district = resolveDistrict(raw);
  if (district) {
    const center = DISTRICT_CENTERS[district.en];
    if (center) return { lat: center.lat, lng: center.lng, label: district.zh };
  }

  // ⑤ 地标词典包含（容错：如「去尖沙咀」→ 尖沙咀）
  const fuzzy = LANDMARK_INDEX.find((item) => item.key.includes(key) || key.includes(item.key));
  if (fuzzy) return { lat: fuzzy.lat, lng: fuzzy.lng, label: fuzzy.label };

  return undefined;
}

/** 解析「纬度,经度」文本（范围校验；非坐标格式返回 undefined） */
function parseCoordText(raw: string): GeoAnchor | undefined {
  const m = COORD_RE.exec(raw);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  const label = `${lat},${lng}`;
  return { lat, lng, label };
}

/** 校名匹配：优先精确（中/英文名），其次包含；跳过缺坐标的记录 */
function matchSchool(raw: string, records: GeoSchoolLike[]): GeoAnchor | undefined {
  const simp = normalizeCjk(raw);
  const lower = raw.toLowerCase();

  for (const r of records) {
    if (r.latitude === undefined || r.longitude === undefined) continue;
    if ((r.nameSimp !== '' && r.nameSimp === simp) || r.nameEn.toLowerCase() === lower) {
      return { lat: r.latitude, lng: r.longitude, label: r.nameSimp || r.nameEn };
    }
  }
  for (const r of records) {
    if (r.latitude === undefined || r.longitude === undefined) continue;
    const nameEn = r.nameEn.toLowerCase();
    if ((r.nameSimp !== '' && r.nameSimp.includes(simp)) || (nameEn !== '' && nameEn.includes(lower))) {
      return { lat: r.latitude, lng: r.longitude, label: r.nameSimp || r.nameEn };
    }
  }
  return undefined;
}
