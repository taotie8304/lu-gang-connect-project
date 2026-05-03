// 诊断：101/104/117 这些路线的方向和站序是否完整

import { build as esbuildBuild } from 'esbuild';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'dist', '.cache');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const testFile = join(CACHE_DIR, '_diag.js');
const wrapper = `
import { TRANSIT_DATA } from '../../src/data/transit';

const bus = TRANSIT_DATA.bus;
const byRoute = new Map();
for (const rs of bus.routeStops) {
  const k = rs.rid + '|' + rs.seq;
  if (!byRoute.has(k)) byRoute.set(k, []);
  byRoute.get(k).push(rs);
}
for (const arr of byRoute.values()) arr.sort((a, b) => a.sseq - b.sseq);

// 统计每条路线有多少个方向
const byRid = new Map();
for (const [k] of byRoute.entries()) {
  const [rid, seq] = k.split('|');
  if (!byRid.has(rid)) byRid.set(rid, []);
  byRid.get(rid).push(parseInt(seq, 10));
}

let oneDir = 0, twoDir = 0, moreDir = 0;
for (const dirs of byRid.values()) {
  if (dirs.length === 1) oneDir++;
  else if (dirs.length === 2) twoDir++;
  else moreDir++;
}
console.log('路线方向统计：单向', oneDir, '双向', twoDir, '多向', moreDir);

// 看 101/104/117/182 路线的具体数据
for (const rname of ['101','104','117','182','109']) {
  const routes = bus.routes.filter(r => r.name === rname);
  console.log('\\n=== 路线 ' + rname + ' (' + routes.length + ' 条) ===');
  for (const r of routes) {
    const dirs = [];
    for (let seq = 1; seq <= 2; seq++) {
      const k = r.rid + '|' + seq;
      const stops = byRoute.get(k);
      if (!stops) continue;
      dirs.push(seq);
      console.log('  rid=' + r.rid + ' seq=' + seq + ' 站数=' + stops.length + ' 首站=' + (bus.stops.find(s=>s.sid===stops[0].sid)?.name||'?') + ' 末站=' + (bus.stops.find(s=>s.sid===stops[stops.length-1].sid)?.name||'?'));
    }
    console.log('  meta: co=' + r.co + ' origin=' + r.origin + ' dest=' + r.dest + ' 方向='+ dirs);
  }
}

// 看中环附近和尖沙咀附近分别有哪些路线覆盖（取前 5 条）
import { haversineDistanceM } from '../../src/fetcher';
const centralLat = 22.2819, centralLng = 114.1585;
const tstLat = 22.2988, tstLng = 114.1722;

function nearStops(lat, lng, radius) {
  return bus.stops.filter(s => {
    if (Math.abs(s.lat - lat) > 0.01 || Math.abs(s.lng - lng) > 0.01) return false;
    return haversineDistanceM(lat, lng, s.lat, s.lng) <= radius;
  });
}

const nearCentralIds = new Set(nearStops(centralLat, centralLng, 800).map(s => s.sid));
const nearTSTIds = new Set(nearStops(tstLat, tstLng, 800).map(s => s.sid));

const rs = bus.routeStops;
const routesAtCentral = new Set();
const routesAtTST = new Set();
for (const r of rs) {
  if (nearCentralIds.has(r.sid)) routesAtCentral.add(r.rid);
  if (nearTSTIds.has(r.sid)) routesAtTST.add(r.rid);
}
console.log('\\n中环附近有', routesAtCentral.size, '条路线；尖沙咀附近有', routesAtTST.size, '条路线');

// 两者交集
const both = new Set();
for (const rid of routesAtCentral) if (routesAtTST.has(rid)) both.add(rid);
console.log('同时经过中环和尖沙咀附近的路线:', both.size);

// 列出前 20 条，看 sseq 顺序
let listed = 0;
for (const rid of both) {
  const r = bus.routes.find(x => x.rid === rid);
  if (!r) continue;
  for (let seq = 1; seq <= 2; seq++) {
    const k = rid + '|' + seq;
    const stops = byRoute.get(k);
    if (!stops) continue;
    let cSseq = -1, tSseq = -1;
    for (const rs2 of stops) {
      if (cSseq === -1 && nearCentralIds.has(rs2.sid)) cSseq = rs2.sseq;
      if (tSseq === -1 && nearTSTIds.has(rs2.sid)) tSseq = rs2.sseq;
    }
    const direction = cSseq > 0 && tSseq > 0
      ? (cSseq < tSseq ? '中→尖 (seq=' + seq + ')' : '尖→中 (seq=' + seq + ')')
      : '不全';
    console.log('  ' + r.co + ' ' + r.name + ' seq=' + seq + ': c_sseq=' + cSseq + ' t_sseq=' + tSseq + ' [' + direction + ']');
  }
  if (++listed >= 20) break;
}
`;

writeFileSync(testFile + '.ts', wrapper);

const res = await esbuildBuild({
  entryPoints: [testFile + '.ts'],
  bundle: true,
  outfile: testFile,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
});

if (res.errors.length > 0) {
  console.error(res.errors);
  process.exit(1);
}

await import('file://' + testFile);
