// 鲁港通 - SCH_LOC 搜索用例预演（Task 6 测试基准）：命中数 / 简繁一致性 / 区域过滤
import { readFileSync } from 'node:fs';
import * as OpenCC from 'opencc-js/t2cn';

const ascii = (s) => s.replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const toSimp = OpenCC.Converter({ from: 'hk', to: 'cn' });

const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
const rows = lines.slice(1).map((l) => l.split('\t'));

// 列索引
const C = { nameEn: 2, nameZh: 3, level: 22, district: 18, lat: 8, lng: 6 };

let missingCoord = 0;
for (const c of rows) {
  if (!c[C.lat]?.trim() || !c[C.lng]?.trim()) missingCoord++;
}
console.log('rows:', rows.length, 'missingCoords:', missingCoord);

// 搜索预演
function search(pred) {
  return rows.filter(pred);
}
const zhName = (c) => c[C.nameZh] ?? '';
const enName = (c) => (c[C.nameEn] ?? '').toLowerCase();

const cases = [
  ['喇沙 (raw)', (c) => zhName(c).includes('喇沙')],
  ['聖保羅 (raw)', (c) => zhName(c).includes('聖保羅')],
  ['圣保罗 (simplified-compare)', (c) => toSimp(zhName(c)).includes('圣保罗')],
  ['la salle (en, lower)', (c) => enName(c).includes('la salle')],
];
for (const [label, pred] of cases) {
  const hits = search(pred);
  console.log(`\n== ${label}: ${hits.length} ==`);
  for (const h of hits.slice(0, 6)) console.log(`   ${ascii(h[C.nameZh])}`);
}

// 沙田区 + 小学
const shaTinPrimary = rows.filter((c) => c[C.district] === 'SHA TIN' && c[C.level] === 'PRIMARY');
console.log('\nSHA TIN + PRIMARY:', shaTinPrimary.length);
console.log('   sample:', ascii(shaTinPrimary[0][C.nameZh]));

// 中学命中（截断测试）
const secondaryAll = rows.filter((c) => toSimp(zhName(c)).includes('中学'));
console.log('\n"中学" hits (simplified):', secondaryAll.length);

// 相似候选预演：「喇沙书院」错一字「喇沙书完」
function lev(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
const kw = '喇沙书完';
const near = rows
  .map((c) => ({ name: toSimp(zhName(c)), d: lev(kw, toSimp(zhName(c))) }))
  .filter((x) => x.name)
  .sort((a, b) => a.d - b.d)
  .slice(0, 5);
console.log('\nnearest for「喇沙书完」:');
for (const n of near) console.log(`   d=${n.d}  ${ascii(n.name)}`);
