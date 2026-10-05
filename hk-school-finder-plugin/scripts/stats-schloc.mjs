// 鲁港通 - SCH_LOC 数据画像（Task 6 前置调研）：列值分布与行数（ASCII 安全输出）
import { readFileSync } from 'node:fs';

const ascii = (s) => s.replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
console.log('physical lines:', lines.length);

const header = lines[0].split('\t');
console.log('header cols:', header.length);
header.forEach((h, i) => console.log(`  [${i}] ${ascii(h)}`));

const idx = { cat: 0, zhCat: 1, name: 2, zhName: 3, level: 22, zhLevel: 23, district: 18, zhDistrict: 19, finance: 20, zhFinance: 21 };
const tally = (key) => ({});
const counts = { level: {}, district: {}, finance: {}, cat: {} };
let bad = 0;
for (const line of lines.slice(1)) {
  const cols = line.split('\t');
  if (cols.length < 24) { bad++; continue; }
  for (const [k, i] of Object.entries(idx)) {
    if (!(k in counts)) continue;
    const v = (cols[i] ?? '').trim();
    counts[k][v] = (counts[k][v] ?? 0) + 1;
  }
}
console.log('malformed rows:', bad);
for (const [k, obj] of Object.entries(counts)) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  console.log(`\n== ${k} (${entries.length} distinct) ==`);
  for (const [v, n] of entries) console.log(`  ${ascii(v)}  x${n}`);
}

// 抽一行幼稚园看看
const kg = lines.slice(1).find((l) => l.split('\t')[22]?.trim() === 'KINDERGARTEN');
if (kg) {
  const cols = kg.split('\t');
  console.log('\n== sample KINDERGARTEN row ==');
  cols.forEach((c, i) => console.log(`  [${i}] ${ascii(c)}`));
}
