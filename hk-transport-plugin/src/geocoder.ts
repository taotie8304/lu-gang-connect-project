// 鲁港通 - 地理编码模块
// 将地点标准名称转换为经纬度坐标，供 TDAS API 使用
// 查询层次：1. 硬编码地标词典 → 2. 模糊匹配词典 → 3. transit.ts 全量站点索引（数千个站点）

import { GeoLocation } from './types';
import { geocodeByStopName } from './stop-db';

// ============================================================
// 地点坐标词典（口岸、地标、车站、商圈）
// 坐标数据来源：Google Maps / 香港政府地理资讯地图
// ============================================================

const LOCATION_COORDS: Record<string, GeoLocation> = {
  // === 口岸 ===
  '落马洲口岸': { lat: 22.5144, lng: 114.0683, name: '落马洲口岸' },
  '福田口岸': { lat: 22.5283, lng: 114.0714, name: '福田口岸' },
  '罗湖口岸': { lat: 22.5284, lng: 114.1131, name: '罗湖口岸' },
  '深圳湾口岸': { lat: 22.4928, lng: 113.9446, name: '深圳湾口岸' },
  '港珠澳大桥口岸': { lat: 22.3200, lng: 113.9410, name: '港珠澳大桥口岸' },
  '西九龙站': { lat: 22.3048, lng: 114.1618, name: '西九龙站' },
  '莲塘口岸': { lat: 22.5530, lng: 114.1310, name: '莲塘口岸' },

  // === 商圈 / 景点 ===
  '海港城': { lat: 22.2970, lng: 114.1687, name: '海港城' },
  '时代广场': { lat: 22.2782, lng: 114.1822, name: '时代广场' },
  '太古广场': { lat: 22.2774, lng: 114.1655, name: '太古广场' },
  '朗豪坊': { lat: 22.3182, lng: 114.1688, name: '朗豪坊' },
  '又一城': { lat: 22.3369, lng: 114.1738, name: '又一城' },
  '兰桂坊': { lat: 22.2807, lng: 114.1559, name: '兰桂坊' },
  '庙街': { lat: 22.3088, lng: 114.1700, name: '庙街' },
  '女人街': { lat: 22.3188, lng: 114.1697, name: '女人街' },
  '香港大学': { lat: 22.2840, lng: 114.1363, name: '香港大学' },

  // === 港岛区地标 ===
  '中环': { lat: 22.2819, lng: 114.1585, name: '中环' },
  '金钟': { lat: 22.2793, lng: 114.1655, name: '金钟' },
  '湾仔': { lat: 22.2783, lng: 114.1747, name: '湾仔' },
  '铜锣湾': { lat: 22.2801, lng: 114.1840, name: '铜锣湾' },
  '北角': { lat: 22.2910, lng: 114.2009, name: '北角' },
  '太平山顶': { lat: 22.2759, lng: 114.1455, name: '太平山顶' },
  '香港立法会': { lat: 22.2802, lng: 114.1662, name: '香港立法会' },
  '维多利亚港': { lat: 22.2930, lng: 114.1690, name: '维多利亚港' },
  '海洋公园': { lat: 22.2468, lng: 114.1748, name: '海洋公园' },
  '星光大道': { lat: 22.2935, lng: 114.1748, name: '星光大道' },

  // === 九龙区地标 ===
  '尖沙咀': { lat: 22.2988, lng: 114.1722, name: '尖沙咀' },
  '旺角': { lat: 22.3193, lng: 114.1694, name: '旺角' },
  '红磡': { lat: 22.3033, lng: 114.1818, name: '红磡' },
  '九龙塘': { lat: 22.3372, lng: 114.1760, name: '九龙塘' },
  '油麻地': { lat: 22.3128, lng: 114.1705, name: '油麻地' },
  '佐敦': { lat: 22.3048, lng: 114.1713, name: '佐敦' },
  '深水埗': { lat: 22.3309, lng: 114.1624, name: '深水埗' },
  '太子': { lat: 22.3254, lng: 114.1680, name: '太子' },
  '观塘': { lat: 22.3132, lng: 114.2252, name: '观塘' },
  '黄大仙': { lat: 22.3407, lng: 114.1934, name: '黄大仙' },

  // === 新界区地标 ===
  '沙田': { lat: 22.3813, lng: 114.1886, name: '沙田' },
  '大埔': { lat: 22.4513, lng: 114.1644, name: '大埔' },
  '元朗': { lat: 22.4445, lng: 114.0222, name: '元朗' },
  '屯门': { lat: 22.3908, lng: 113.9731, name: '屯门' },
  '荃湾': { lat: 22.3707, lng: 114.1138, name: '荃湾' },
  '将军澳': { lat: 22.3073, lng: 114.2592, name: '将军澳' },
  '上水': { lat: 22.5010, lng: 114.1281, name: '上水' },
  '粉岭': { lat: 22.4920, lng: 114.1387, name: '粉岭' },
  '西贡': { lat: 22.3813, lng: 114.2709, name: '西贡' },

  // === 离岛 / 南区 ===
  '东涌': { lat: 22.2890, lng: 113.9413, name: '东涌' },
  '香港机场': { lat: 22.3080, lng: 113.9185, name: '香港机场' },
  '迪士尼乐园': { lat: 22.3130, lng: 114.0413, name: '迪士尼乐园' },
  '赤柱': { lat: 22.2191, lng: 114.2121, name: '赤柱' },
  '浅水湾': { lat: 22.2344, lng: 114.1971, name: '浅水湾' },
  '大屿山': { lat: 22.2630, lng: 113.9400, name: '大屿山' },
  '梅窝': { lat: 22.2642, lng: 114.0004, name: '梅窝' },
  '坪洲': { lat: 22.2845, lng: 114.0376, name: '坪洲' },
  '长洲': { lat: 22.2057, lng: 114.0319, name: '长洲' },
  '南丫岛': { lat: 22.2200, lng: 114.1100, name: '南丫岛' },

  // === 新界东 / 沙田区 ===
  '石门': { lat: 22.3890, lng: 114.2045, name: '石门' },
  '硕门邨': { lat: 22.3880, lng: 114.2055, name: '硕门邨' },
  '马鞍山': { lat: 22.4167, lng: 114.2333, name: '马鞍山' },
  '大围': { lat: 22.3728, lng: 114.1789, name: '大围' },
  '火炭': { lat: 22.3969, lng: 114.1985, name: '火炭' },
  '第一城': { lat: 22.3860, lng: 114.2030, name: '第一城' },
  '科学园': { lat: 22.4020, lng: 114.2100, name: '科学园' },
  '白石角': { lat: 22.4050, lng: 114.2080, name: '白石角' },

  // === 屯门 / 元朗区 ===
  '屯门码头': { lat: 22.3722, lng: 113.9678, name: '屯门码头' },
  '天水围': { lat: 22.4469, lng: 114.0044, name: '天水围' },
  '洪水桥': { lat: 22.4330, lng: 113.9950, name: '洪水桥' },
  '锦田': { lat: 22.4390, lng: 114.0620, name: '锦田' },
  '流浮山': { lat: 22.4670, lng: 113.9810, name: '流浮山' },

  // === 葵青 / 荃湾区 ===
  '青衣': { lat: 22.3580, lng: 114.1070, name: '青衣' },
  '葵涌': { lat: 22.3650, lng: 114.1300, name: '葵涌' },
  '葵芳': { lat: 22.3569, lng: 114.1282, name: '葵芳' },
  '荔景': { lat: 22.3480, lng: 114.1263, name: '荔景' },
  '深井': { lat: 22.3670, lng: 114.0600, name: '深井' },

  // === 离岛 / 东涌 ===
  '逸东邨': { lat: 22.2830, lng: 113.9350, name: '逸东邨' },
  '东荟城': { lat: 22.2890, lng: 113.9400, name: '东荟城' },
  '博览馆': { lat: 22.3214, lng: 113.9411, name: '博览馆' },
  '欣澳': { lat: 22.3166, lng: 114.0101, name: '欣澳' },

  // === 九龙东 ===
  '九龙湾': { lat: 22.3237, lng: 114.2143, name: '九龙湾' },
  '牛头角': { lat: 22.3153, lng: 114.2194, name: '牛头角' },
  '蓝田': { lat: 22.3068, lng: 114.2360, name: '蓝田' },
  '油塘': { lat: 22.2953, lng: 114.2372, name: '油塘' },
  '调景岭': { lat: 22.3068, lng: 114.2522, name: '调景岭' },
  '坑口': { lat: 22.3172, lng: 114.2635, name: '坑口' },
  '宝琳': { lat: 22.3219, lng: 114.2574, name: '宝琳' },
  '康城': { lat: 22.2960, lng: 114.2700, name: '康城' },
  '启德': { lat: 22.3300, lng: 114.2000, name: '启德' },
  '彩虹': { lat: 22.3492, lng: 114.2094, name: '彩虹' },

  // === 九龙西补充 ===
  '九龙城': { lat: 22.3280, lng: 114.1910, name: '九龙城' },
  '土瓜湾': { lat: 22.3166, lng: 114.1873, name: '土瓜湾' },
  '黄埔': { lat: 22.3049, lng: 114.1888, name: '黄埔' },
  '柯士甸': { lat: 22.3041, lng: 114.1663, name: '柯士甸' },
  '奥运': { lat: 22.3181, lng: 114.1602, name: '奥运' },
  '南昌': { lat: 22.3264, lng: 114.1530, name: '南昌' },
  '石硖尾': { lat: 22.3320, lng: 114.1688, name: '石硖尾' },

  // === 港岛补充 ===
  '柴湾': { lat: 22.2644, lng: 114.2371, name: '柴湾' },
  '筲箕湾': { lat: 22.2791, lng: 114.2289, name: '筲箕湾' },
  '鲗鱼涌': { lat: 22.2864, lng: 114.2098, name: '鲗鱼涌' },
  '跑马地': { lat: 22.2700, lng: 114.1840, name: '跑马地' },
  '坚尼地城': { lat: 22.2814, lng: 114.1289, name: '坚尼地城' },
  '西营盘': { lat: 22.2846, lng: 114.1429, name: '西营盘' },
  '上环': { lat: 22.2867, lng: 114.1517, name: '上环' },
  '天后': { lat: 22.2824, lng: 114.1917, name: '天后' },
  '炮台山': { lat: 22.2882, lng: 114.1922, name: '炮台山' },

  // === 新界北 ===
  '古洞': { lat: 22.5030, lng: 114.1040, name: '古洞' },
  '打鼓岭': { lat: 22.5530, lng: 114.1310, name: '打鼓岭' },

  // === 交通枢纽 ===
  '九龙站': { lat: 22.3049, lng: 114.1616, name: '九龙站' },
  '青衣站': { lat: 22.3586, lng: 114.1075, name: '青衣站' },
  '香港站': { lat: 22.2848, lng: 114.1582, name: '香港站' },

  // === 特殊地点 ===
  '麼地道': { lat: 22.2970, lng: 114.1745, name: '麼地道' },

  // === 地标/商场补充（2026-05-08 新增） ===
  '崇光百货': { lat: 22.2802, lng: 114.1843, name: '崇光百货' },
  '希慎广场': { lat: 22.2794, lng: 114.1838, name: '希慎广场' },
  '利园': { lat: 22.2785, lng: 114.1840, name: '利园' },
  '置地广场': { lat: 22.2816, lng: 114.1582, name: '置地广场' },
  'IFC': { lat: 22.2848, lng: 114.1582, name: 'IFC' },
  'ICC': { lat: 22.3039, lng: 114.1606, name: 'ICC' },
  'Elements': { lat: 22.3047, lng: 114.1618, name: 'Elements' },
  'K11': { lat: 22.2975, lng: 114.1740, name: 'K11' },
  'MegaBox': { lat: 22.3197, lng: 114.2093, name: 'MegaBox' },
  'APM': { lat: 22.3123, lng: 114.2256, name: 'APM' },
  '新城市广场': { lat: 22.3815, lng: 114.1891, name: '新城市广场' },
  '奥海城': { lat: 22.3174, lng: 114.1602, name: '奥海城' },
  '德福广场': { lat: 22.3230, lng: 114.2140, name: '德福广场' },
  '荷里活广场': { lat: 22.3409, lng: 114.2020, name: '荷里活广场' },
  'MOKO': { lat: 22.3222, lng: 114.1717, name: 'MOKO' },
  'PopCorn': { lat: 22.3078, lng: 114.2595, name: 'PopCorn' },
  'ELEMENTS圆方': { lat: 22.3047, lng: 114.1618, name: 'ELEMENTS圆方' },
  '美孚': { lat: 22.3378, lng: 114.1370, name: '美孚' },
};

// ============================================================
// 地理编码函数
// ============================================================

/**
 * 将地点标准名称转换为经纬度坐标
 * @param locationName - parser 输出的地点名称（可能是标准名或原始输入）
 * @returns GeoLocation 或 undefined（未知地点）
 */
export function geocode(locationName: string): GeoLocation | undefined {
  // 空字符串直接返回
  if (!locationName) return undefined;

  // === 第 1 层：精确匹配硬编码地标词典 ===
  if (LOCATION_COORDS[locationName]) {
    return LOCATION_COORDS[locationName];
  }

  // === 第 2 层：模糊匹配硬编码词典（不区分大小写的包含匹配）===
  const lower = locationName.toLowerCase();
  for (const [key, coord] of Object.entries(LOCATION_COORDS)) {
    if (
      key.toLowerCase() === lower ||
      key.toLowerCase().includes(lower) ||
      lower.includes(key.toLowerCase())
    ) {
      return coord;
    }
  }

  // === 第 3 层：在 transit.ts 全量站点索引中搜索（数千个站点）===
  // 覆盖所有巴士站、小巴站、MTR站、电车站、渡轮码头
  // 支持简体/繁体混合输入
  return geocodeByStopName(locationName);
}

/**
 * 批量地理编码：将起点和终点转换为坐标
 * @returns 包含起点和终点坐标的对象，未知地点对应字段为 undefined
 */
export function geocodeRoute(
  origin?: string,
  destination?: string
): { originCoord?: GeoLocation; destCoord?: GeoLocation } {
  return {
    originCoord: origin ? geocode(origin) : undefined,
    destCoord: destination ? geocode(destination) : undefined,
  };
}

/**
 * 获取所有已知地点名称列表
 */
export function getKnownLocations(): string[] {
  return Object.keys(LOCATION_COORDS);
}

/**
 * 检查地点是否在坐标词典中
 */
export function isKnownLocation(locationName: string): boolean {
  return locationName in LOCATION_COORDS;
}

// ============================================================
// Nominatim 外网回退：对未知地点进行联网地理编码
// ============================================================

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_UA = 'LugangConnect-HK-Transport/1.0 (service@airscend.com)';
let lastNominatimCall = 0;
const NOMINATIM_RATE_LIMIT = 1100;

// 需要联网搜索的组织/建筑名关键词
const ORG_KEYWORDS = [
  '联合会', '聯合會', '协会', '協會', '商会', '商會', '总会', '總會',
  '联谊会', '聯誼會', '同乡会', '同鄉會', '宗亲会', '宗親會',
  '有限公司', '集团', '集團', '公司', '银行', '銀行', '保险', '保險',
  '基金会', '基金會', '促进会', '促進會', '联盟', '聯盟',
  '工会', '工會', '学会', '學會', '校友会', '校友會',
  '会馆', '會館', '办事处', '辦事處', '代表处', '代表處',
  '领事馆', '領事館', '政府', '合署', '大楼', '大樓',
  '教堂', '寺', '庙', '廟', '观', '觀', '庵',
  '书院', '書院', '学院', '學院', '学校', '學校',
  '大学', '大學', '中学', '中學', '小学', '小學',
  '医院', '醫院', '诊所', '診所', '医务', '醫務',
];

/**
 * 检测地点名称是否像组织/建筑名（非通用地名），需要联网搜索
 */
export function isOrganizationName(name: string): boolean {
  for (const keyword of ORG_KEYWORDS) {
    if (name.includes(keyword)) return true;
  }
  return false;
}

/**
 * 通过 Nominatim（OpenStreetMap）联网搜索香港地点坐标
 */
export async function geocodeWithNominatim(locationName: string): Promise<GeoLocation | undefined> {
  if (!locationName) return undefined;

  const now = Date.now();
  const waitTime = NOMINATIM_RATE_LIMIT - (now - lastNominatimCall);
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastNominatimCall = Date.now();

  try {
    const params = new URLSearchParams({
      q: locationName,
      format: 'json',
      limit: '1',
      countrycodes: 'hk',
      'accept-language': 'zh',
    });

    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': NOMINATIM_UA },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return undefined;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return undefined;

    const place = data[0];
    return {
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      name: locationName,
    };
  } catch {
    return undefined;
  }
}

/**
 * 带外网回退的地理编码：先查本地词典，非知名组织名失败时尝试 Nominatim
 */
export async function geocodeWithFallback(
  locationName: string | undefined
): Promise<GeoLocation | undefined> {
  if (!locationName) return undefined;

  const local = geocode(locationName);
  if (local) return local;

  if (isOrganizationName(locationName)) {
    return geocodeWithNominatim(locationName);
  }

  return undefined;
}

/**
 * 带外网回退的批量地理编码（顺序执行以遵守 Nominatim 速率限制）
 */
export async function geocodeRouteWithFallback(
  origin?: string,
  destination?: string
): Promise<{ originCoord?: GeoLocation; destCoord?: GeoLocation }> {
  const originCoord = await geocodeWithFallback(origin);
  const destCoord = await geocodeWithFallback(destination);
  return { originCoord, destCoord };
}
