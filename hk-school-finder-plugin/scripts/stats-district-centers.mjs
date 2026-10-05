// 鲁港通 - 18 区中心坐标计算（Task 7 前置调研）：从 SCH_LOC 全量学校坐标算区域均值
// 输出：每区（英文名 / 中文名 / 学校数 / 中心经纬度），供 geocode.ts 区域锚点固化
import { readFileSync } from 'node:fs';

const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
const header = lines[0].split('\t');

const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`column not found: ${name}`);
  return i;
};
const iDistrict = col('DISTRICT');
const iDistrictZh = col('分區');
const iLat = col('LATITUDE');
const iLng = col('LONGITUDE');

// DMS `22-19-8` → 十进制度
const dms = (s) => {
  const m = /^(\d+)-(\d+)-(\d+(?:\.\d+)?)$/.exec((s ?? '').trim());
  if (!m) return undefined;
  const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return Number.isFinite(v) ? v : undefined;
};

const groups = new Map(); // district_en -> { zh, n, sumLat, sumLng }
let bad = 0;
for (const line of lines.slice(1)) {
  const cols = line.split('\t');
  const en = (cols[iDistrict] ?? '').trim();
  const lat = dms(cols[iLat]);
  const lng = dms(cols[iLng]);
  if (!en || lat === undefined || lng === undefined) {
    bad++;
    continue;
  }
  let g = groups.get(en);
  if (!g) {
    g = { zh: (cols[iDistrictZh] ?? '').trim(), n: 0, sumLat: 0, sumLng: 0 };
    groups.set(en, g);
  }
  g.n++;
  g.sumLat += lat;
  g.sumLng += lng;
}

console.log('rows without district/coord:', bad, '| groups:', groups.size);
const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [en, g] of sorted) {
  const lat = g.sumLat / g.n;
  const lng = g.sumLng / g.n;
  console.log(`  { en: '${en}', zh: '${g.zh}', n: ${g.n}, lat: ${lat.toFixed(4)}, lng: ${lng.toFixed(4)} },`);
}
