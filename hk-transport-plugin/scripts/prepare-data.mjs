// 鲁港通 - 交通数据预处理脚本（build 时运行）
//
// 下载香港政府官方 GeoJSON（巴士/小巴/渡轮/电车/山顶缆车），
// 按紧凑结构重组后写入 src/data/transit.ts（作为 TypeScript 模块）。
// 插件打包时 esbuild 会把这个模块 bundle 成字面量常量，运行时零网络依赖。
//
// 紧凑格式设计：
//   routes: [{rid,co,name,origin,dest,fare,time}]
//   stops:  [{sid,name,lat,lng}]（去重）
//   routeStops: [{rid,seq,sseq,sid}] rid=routeId, seq=方向(1/2), sseq=站序, sid=站ID

import { join, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'src', 'data');

const DATA_SOURCES = [
  { key: 'bus',   url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json' },
  { key: 'gmb',   url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json' },
  { key: 'tram',  url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json' },
  { key: 'ferry', url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json' },
  { key: 'ptram', url: 'https://static.data.gov.hk/td/routes-fares-geojson/JSON_PTRAM.json' },
];

/** 下载 GeoJSON 并返回 features 数组 */
async function downloadGeoJson(src) {
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`Download ${src.key} failed: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.features || !Array.isArray(json.features)) {
    throw new Error(`${src.key} has no features array`);
  }
  return json.features;
}

/**
 * 把一组 features 紧凑化为 { routes, stops, routeStops }
 * 适用于：JSON_BUS / JSON_GMB / JSON_TRAM / JSON_FERRY / JSON_PTRAM
 *
 * routeId 字段在各种 GeoJSON 中可能叫 routeId 或 routeId（统一），
 * 站序 stopSeq，方向 routeSeq。
 */
function compactFeatures(features, mode) {
  const routeMap = new Map();     // rid → route object
  const stopMap = new Map();      // sid → stop object
  const routeStops = [];

  for (const f of features) {
    const p = f.properties || {};
    const geom = f.geometry || {};
    const coords = geom.coordinates || [];
    const [lng, lat] = coords;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;

    const rid = p.routeId;
    const sid = p.stopId;
    if (rid == null || sid == null) continue;

    // 路线元信息（同一路线多次出现，只保留一次）
    if (!routeMap.has(rid)) {
      routeMap.set(rid, {
        rid,
        co: p.companyCode || mode.toUpperCase(),
        mode,   // 'bus' | 'gmb' | 'tram' | 'ferry' | 'ptram'
        name: p.routeNameC || p.routeNameE || String(rid),
        origin: p.locStartNameC || p.locStartNameE || '',
        dest: p.locEndNameC || p.locEndNameE || '',
        fare: typeof p.fullFare === 'number' ? p.fullFare : null,
        time: typeof p.journeyTime === 'number' ? p.journeyTime : null,
      });
    }

    // 站点（同一站可能被多条路线共享，只存一次）
    if (!stopMap.has(sid)) {
      stopMap.set(sid, {
        sid,
        name: p.stopNameC || p.stopNameE || '',
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
      });
    }

    routeStops.push({
      rid,
      seq: p.routeSeq || 1,
      sseq: p.stopSeq || 1,
      sid,
    });
  }

  return {
    routes: Array.from(routeMap.values()),
    stops: Array.from(stopMap.values()),
    routeStops,
  };
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log('[prepare-data] 开始下载和紧凑化交通数据...\n');

  const aggregated = {};
  for (const src of DATA_SOURCES) {
    process.stdout.write(`  [${src.key}] downloading... `);
    try {
      const features = await downloadGeoJson(src);
      process.stdout.write(`${features.length} features, compacting...\n`);
      const compact = compactFeatures(features, src.key);
      aggregated[src.key] = compact;
      const sizeKB = (JSON.stringify(compact).length / 1024).toFixed(0);
      console.log(`    → routes: ${compact.routes.length}, stops: ${compact.stops.length}, routeStops: ${compact.routeStops.length} (${sizeKB} KB)\n`);
    } catch (err) {
      console.warn(`    ✗ ${src.key} 失败: ${err.message}（跳过）\n`);
      aggregated[src.key] = { routes: [], stops: [], routeStops: [] };
    }
  }

  // 预置 MTR 港铁站坐标（官方没有类似 GeoJSON，硬编码主要站点）
  // 仅收录核心 90+ 个站，足以覆盖绝大多数跨境/市区场景
  aggregated.mtr = buildMTRStations();
  console.log(`  [mtr] 预置 ${aggregated.mtr.stops.length} 站\n`);

  // 组装最终 TypeScript 模块
  const tsOut = `// 自动生成 - 请勿手动编辑
// 生成时间: ${new Date().toISOString()}
// 来源: https://data.gov.hk 公共交通路线及收费资料
//
// 各 mode 数据结构:
//   routes: { rid, co, mode, name, origin, dest, fare, time }[]
//   stops:  { sid, name, lat, lng }[]
//   routeStops: { rid, seq, sseq, sid }[]

export interface TransitRoute {
  rid: number;
  co: string;
  mode: string;
  name: string;
  origin: string;
  dest: string;
  fare: number | null;
  time: number | null;
}
export interface TransitStop {
  sid: number;
  name: string;
  lat: number;
  lng: number;
}
export interface TransitRouteStop {
  rid: number;
  seq: number;   // 方向 1 / 2
  sseq: number;  // 站序
  sid: number;
}
export interface TransitModeData {
  routes: TransitRoute[];
  stops: TransitStop[];
  routeStops: TransitRouteStop[];
}

export const TRANSIT_DATA: Record<string, TransitModeData> = ${JSON.stringify(aggregated)};
`;

  const outPath = join(OUT_DIR, 'transit.ts');
  writeFileSync(outPath, tsOut, 'utf-8');

  const finalSizeKB = (Buffer.byteLength(tsOut) / 1024).toFixed(0);
  console.log(`[prepare-data] 写入 ${outPath} (${finalSizeKB} KB)`);
  console.log('[prepare-data] 完成');
}

/**
 * 港铁核心站点（官方无 GeoJSON 静态接口，硬编码常用站）
 * 坐标来自 Google Maps 大致位置，用于路径规划时的"就近港铁站"推荐
 */
function buildMTRStations() {
  const MTR_STATIONS = [
    // 港岛线
    { name: '坚尼地城', lat: 22.2814, lng: 114.1289 },
    { name: '香港大学', lat: 22.2842, lng: 114.1353 },
    { name: '西营盘', lat: 22.2846, lng: 114.1429 },
    { name: '上环', lat: 22.2867, lng: 114.1517 },
    { name: '中环', lat: 22.2819, lng: 114.1583 },
    { name: '金钟', lat: 22.2793, lng: 114.1655 },
    { name: '湾仔', lat: 22.2774, lng: 114.1729 },
    { name: '铜锣湾', lat: 22.2802, lng: 114.1852 },
    { name: '天后', lat: 22.2824, lng: 114.1917 },
    { name: '炮台山', lat: 22.2882, lng: 114.1922 },
    { name: '北角', lat: 22.2914, lng: 114.2004 },
    { name: '鲗鱼涌', lat: 22.2864, lng: 114.2098 },
    { name: '太古', lat: 22.2846, lng: 114.2165 },
    { name: '西湾河', lat: 22.2817, lng: 114.2222 },
    { name: '筲箕湾', lat: 22.2791, lng: 114.2289 },
    { name: '杏花邨', lat: 22.2755, lng: 114.2398 },
    { name: '柴湾', lat: 22.2644, lng: 114.2371 },
    // 荃湾线
    { name: '尖沙咀', lat: 22.2975, lng: 114.1722 },
    { name: '佐敦', lat: 22.3048, lng: 114.1716 },
    { name: '油麻地', lat: 22.3128, lng: 114.1706 },
    { name: '旺角', lat: 22.3193, lng: 114.1694 },
    { name: '太子', lat: 22.3243, lng: 114.1684 },
    { name: '深水埗', lat: 22.3307, lng: 114.1626 },
    { name: '长沙湾', lat: 22.3362, lng: 114.1562 },
    { name: '荔枝角', lat: 22.3379, lng: 114.1479 },
    { name: '美孚', lat: 22.3375, lng: 114.1382 },
    { name: '荔景', lat: 22.3480, lng: 114.1263 },
    { name: '葵芳', lat: 22.3569, lng: 114.1282 },
    { name: '葵兴', lat: 22.3628, lng: 114.1314 },
    { name: '大窝口', lat: 22.3704, lng: 114.1220 },
    { name: '荃湾', lat: 22.3738, lng: 114.1175 },
    // 观塘线
    { name: '油塘', lat: 22.2953, lng: 114.2372 },
    { name: '调景岭', lat: 22.3068, lng: 114.2522 },
    { name: '九龙塘', lat: 22.3367, lng: 114.1758 },
    { name: '乐富', lat: 22.3381, lng: 114.1874 },
    { name: '黄大仙', lat: 22.3416, lng: 114.1941 },
    { name: '钻石山', lat: 22.3416, lng: 114.2019 },
    { name: '彩虹', lat: 22.3492, lng: 114.2094 },
    { name: '九龙湾', lat: 22.3237, lng: 114.2143 },
    { name: '牛头角', lat: 22.3153, lng: 114.2194 },
    { name: '观塘', lat: 22.3122, lng: 114.2263 },
    { name: '蓝田', lat: 22.3068, lng: 114.2360 },
    { name: '何文田', lat: 22.3099, lng: 114.1825 },
    { name: '黄埔', lat: 22.3049, lng: 114.1888 },
    // 将军澳线
    { name: '将军澳', lat: 22.3075, lng: 114.2602 },
    { name: '坑口', lat: 22.3172, lng: 114.2635 },
    { name: '宝琳', lat: 22.3219, lng: 114.2574 },
    // 东涌线 + 机场快线
    { name: '东涌', lat: 22.2891, lng: 113.9410 },
    { name: '欣澳', lat: 22.3166, lng: 114.0101 },
    { name: '青衣', lat: 22.3586, lng: 114.1075 },
    { name: '南昌', lat: 22.3264, lng: 114.1530 },
    { name: '奥运', lat: 22.3181, lng: 114.1602 },
    { name: '九龙', lat: 22.3049, lng: 114.1616 },
    { name: '香港机场', lat: 22.3160, lng: 113.9365 },
    { name: '博览馆', lat: 22.3214, lng: 113.9411 },
    // 东铁线
    { name: '红磡', lat: 22.3032, lng: 114.1819 },
    { name: '旺角东', lat: 22.3215, lng: 114.1731 },
    { name: '大围', lat: 22.3728, lng: 114.1789 },
    { name: '沙田', lat: 22.3815, lng: 114.1871 },
    { name: '火炭', lat: 22.3969, lng: 114.1985 },
    { name: '马场', lat: 22.4017, lng: 114.2036 },
    { name: '大学', lat: 22.4133, lng: 114.2099 },
    { name: '大埔墟', lat: 22.4447, lng: 114.1702 },
    { name: '太和', lat: 22.4510, lng: 114.1611 },
    { name: '粉岭', lat: 22.4920, lng: 114.1383 },
    { name: '上水', lat: 22.5018, lng: 114.1277 },
    { name: '罗湖', lat: 22.5282, lng: 114.1129 },
    { name: '落马洲', lat: 22.5144, lng: 114.0683 },
    // 屯马线
    { name: '屯门', lat: 22.3946, lng: 113.9734 },
    { name: '兆康', lat: 22.4130, lng: 113.9781 },
    { name: '天水围', lat: 22.4469, lng: 114.0044 },
    { name: '朗屏', lat: 22.4418, lng: 114.0226 },
    { name: '元朗', lat: 22.4447, lng: 114.0348 },
    { name: '锦上路', lat: 22.4346, lng: 114.0640 },
    { name: '八乡维修中心', lat: 22.4312, lng: 114.0698 },
    { name: '钻石山', lat: 22.3416, lng: 114.2019 },
    { name: '石硖尾', lat: 22.3320, lng: 114.1688 },
    { name: '南昌', lat: 22.3264, lng: 114.1530 },
    { name: '柯士甸', lat: 22.3041, lng: 114.1663 },
    { name: '宋皇臺', lat: 22.3268, lng: 114.1909 },
    { name: '土瓜湾', lat: 22.3166, lng: 114.1873 },
    // 南港岛线
    { name: '海洋公园', lat: 22.2496, lng: 114.1745 },
    { name: '黄竹坑', lat: 22.2483, lng: 114.1682 },
    { name: '利东', lat: 22.2420, lng: 114.1602 },
    { name: '海怡半岛', lat: 22.2424, lng: 114.1495 },
    // 机场快线站（尖东/港岛等已有）
    // 高铁
    { name: '西九龙站', lat: 22.3048, lng: 114.1660 },
    // 迪士尼线
    { name: '迪士尼', lat: 22.3150, lng: 114.0455 },
  ];
  return {
    routes: [],  // MTR 线路通过站点网络和地铁图推断，这里不存具体线
    stops: MTR_STATIONS.map((s, i) => ({
      sid: 90000 + i,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    })),
    routeStops: [],
  };
}

main().catch(err => {
  console.error('[prepare-data] 出错:', err);
  process.exit(1);
});
