// 鲁港通 - SCH_LOC 重复记录排查：同校多行模式（影响统计口径与列表去重决策）
import { readFileSync, writeFileSync } from 'node:fs';

const out = [];
const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8').replace(/^\uFEFF/, '');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
const headers = lines[0].split('\t').map((s) => s.trim());
const idx = (name) => headers.indexOf(name);
const iName = idx('中文名稱');
const iNameEn = idx('ENGLISH NAME');
const iCat = idx('ENGLISH CATEGORY');
const iFin = idx('FINANCE TYPE');
const iLevel = idx('SCHOOL LEVEL');
const iDist = idx('DISTRICT');
const iAddr = idx('中文地址');
const iSession = idx('SESSION');

const rows = lines.slice(1).map((l) => l.split('\t').map((s) => s.trim()));

// 1) 九龍三育中學全部行
out.push('=== 九龍三育中學 全部行 ===');
for (const r of rows.filter((x) => x[iName].includes('三育'))) {
  out.push(`[${r[iName]}] ${r[iNameEn]} | ${r[iCat]} | ${r[iFin]} | ${r[iLevel]} | ${r[iDist]} | ${r[iSession]} | ${r[iAddr]}`);
}

// 2) 全表重名统计（中文名+district 相同视为重复）
const seen = new Map();
for (const r of rows) {
  const key = r[iName] + '||' + r[iDist];
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key).push(r);
}
const dups = [...seen.entries()].filter(([, list]) => list.length > 1);
out.push('');
out.push('=== 重名（校名+区域）组合数: ' + dups.length + ' ===');
out.push('重复行总数: ' + dups.reduce((acc, [, l]) => acc + l.length, 0));
out.push('涉及记录数（去重后）: ' + (rows.length - dups.reduce((acc, [, l]) => acc + l.length - 1, 0)));
out.push('');
out.push('--- 重复明细（前 30 组）---');
for (const [key, list] of dups.slice(0, 30)) {
  out.push(`【${key}】${list.length} 行`);
  for (const r of list) out.push(`   ${r[iLevel]} | ${r[iCat]} | ${r[iSession]} | ${r[iAddr].slice(0, 40)}`);
}

// 3) 油尖旺区中学列表（25 行全列出，检查重复分布）
out.push('');
out.push('=== 油尖旺区中学 25 行 ===');
for (const r of rows.filter((x) => x[iDist] === 'YAU TSIM MONG' && x[iLevel] === 'SECONDARY')) {
  out.push(`${r[iName]} | ${r[iFin]} | ${r[iCat]} | ${r[iSession]}`);
}

// 4) 直资中学 62 行中的重复情况
out.push('');
out.push('=== 直资中学（62 行）去重前后 ===');
const dssSec = rows.filter((x) => x[iFin] === 'DIRECT SUBSIDY SCHEME' && x[iLevel] === 'SECONDARY');
out.push('记录数: ' + dssSec.length + ' / 去重校名数: ' + new Set(dssSec.map((r) => r[iName])).size);
const dssSecDups = {};
for (const r of dssSec) dssSecDups[r[iName]] = (dssSecDups[r[iName]] || 0) + 1;
const multi = Object.entries(dssSecDups).filter(([, n]) => n > 1);
out.push('多行学校数: ' + multi.length + ' -> ' + JSON.stringify(multi));

writeFileSync('scripts/schloc-dup.out.txt', out.join('\n'), 'utf8');
console.log('done, lines=' + out.length);
