// 鲁港通 - 地理编码模块
// 将地点标准名称转换为经纬度坐标，供 TDAS API 使用

import { GeoLocation } from './types';

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

  // === 新界区地标 ===
  '沙田': { lat: 22.3813, lng: 114.1886, name: '沙田' },
  '大埔': { lat: 22.4513, lng: 114.1644, name: '大埔' },
  '元朗': { lat: 22.4445, lng: 114.0222, name: '元朗' },
  '屯门': { lat: 22.3908, lng: 113.9731, name: '屯门' },
  '荃湾': { lat: 22.3707, lng: 114.1138, name: '荃湾' },
  '将军澳': { lat: 22.3073, lng: 114.2592, name: '将军澳' },
  '上水': { lat: 22.5010, lng: 114.1281, name: '上水' },
  '粉岭': { lat: 22.4920, lng: 114.1387, name: '粉岭' },

  // === 离岛区 ===
  '东涌': { lat: 22.2890, lng: 113.9413, name: '东涌' },
  '香港机场': { lat: 22.3080, lng: 113.9185, name: '香港机场' },
  '迪士尼乐园': { lat: 22.3130, lng: 114.0413, name: '迪士尼乐园' },
};

// ============================================================
// 地理编码函数
// ============================================================

/**
 * 将地点标准名称转换为经纬度坐标
 * @param locationName - parser 输出的标准地点名称
 * @returns GeoLocation 或 undefined（未知地点）
 */
export function geocode(locationName: string): GeoLocation | undefined {
  return LOCATION_COORDS[locationName];
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
