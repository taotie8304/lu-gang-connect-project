// 鲁港通 - SCH_LOC（学校位置总表）字段分布分析：验证「国际学校」「直资」判定键与油尖旺样本数字
import { readFileSync, writeFileSync } from 'node:fs';

const out = [];
const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8').replace(/^\uFEFF/, '');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
const headers = lines[0].split('\t').map((s) => s.trim());
out.push('headers(' + headers.length + '): ' + JSON.stringify(headers));
out.push('data lines: ' + (lines.length - 1));

const idx = (name) => headers.indexOf(name);
const iName = idx('中文名稱');
const iCat = idx('ENGLISH CATEGORY');
const iCatZh = idx('中文類別');
const iFin = idx('FINANCE TYPE');
const iLevel = idx('SCHOOL LEVEL');
const iDist = idx('DISTRICT');
const iDistZh = idx('分區');

const rows = lines.slice(1).map((l) => l.split('\t').map((s) => s.trim()));

const count = (arr) => {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

out.push('\n=== ENGLISH CATEGORY 分布 ===');
for (const [v, n] of count(rows.map((r) => r[iCat]))) out.push(`${n}\t${v}`);

out.push('\n=== 中文類別 分布 ===');
for (const [v, n] of count(rows.map((r) => r[iCatZh]))) out.push(`${n}\t${v}`);

out.push('\n=== FINANCE TYPE 分布 ===');
for (const [v, n] of count(rows.map((r) => r[iFin]))) out.push(`${n}\t${v}`);

out.push('\n=== SCHOOL LEVEL 分布 ===');
for (const [v, n] of count(rows.map((r) => r[iLevel]))) out.push(`${n}\t${v}`);

// 国际学校：category 含 INTERNATIONAL
const intl = rows.filter((r) => (r[iCat] || '').toUpperCase().includes('INTERNATIONAL'));
out.push('\n=== 国际学校（category 含 INTERNATIONAL）===');
out.push('total: ' + intl.length);
for (const [v, n] of count(intl.map((r) => r[iLevel]))) out.push(`${n}\t${v}`);
out.push('category 取值: ' + JSON.stringify(count(intl.map((r) => r[iCat]))));
out.push('样本 8 条:');
for (const r of intl.slice(0, 8)) out.push(`  ${r[iName]} | ${r[iCat]} | ${r[iCatZh]} | ${r[iLevel]} | ${r[iDist]}`);

// 直资：financeType 含 DIRECT SUBSIDY
const dss = rows.filter((r) => (r[iFin] || '').toUpperCase().includes('DIRECT SUBSIDY'));
out.push('\n=== 直资（financeType 含 DIRECT SUBSIDY）===');
out.push('total: ' + dss.length);
for (const [v, n] of count(dss.map((r) => r[iLevel]))) out.push(`${n}\t${v}`);

// 油尖旺区
const ytm = rows.filter((r) => (r[iDist] || '').toUpperCase().includes('YAU TSIM MONG'));
out.push('\n=== 油尖旺区 ===');
out.push('total: ' + ytm.length);
for (const [v, n] of count(ytm.map((r) => r[iLevel]))) out.push(`${n}\t${v}`);
const ytmSec = ytm.filter((r) => (r[iLevel] || '').toUpperCase() === 'SECONDARY');
out.push('油尖旺中学: ' + ytmSec.length);
out.push('油尖旺中学 financeType 分布:');
for (const [v, n] of count(ytmSec.map((r) => r[iFin]))) out.push(`${n}\t${v}`);
out.push('油尖旺直资中学记录:');
for (const r of ytmSec.filter((r) => (r[iFin] || '').toUpperCase().includes('DIRECT SUBSIDY'))) {
  out.push(`  ${r[iName]} | ${r[iFin]}`);
}

// 其他区名检查：DISTRICT 全量取值
out.push('\n=== DISTRICT 取值 ===');
for (const [v, n] of count(rows.map((r) => r[iDist]))) out.push(`${n}\t${v}`);

// ============================================================
// 类别口径交叉验证（category vs financeType）
// ============================================================
out.push('\n=== 口径交叉验证 ===');
const intl2 = rows.filter((r) => (r[iCat] || '').toUpperCase().includes('INTERNATIONAL'));
out.push('国际学校 financeType 分布: ' + JSON.stringify(count(intl2.map((r) => r[iFin]))));
const dss2 = rows.filter((r) => (r[iFin] || '').toUpperCase().includes('DIRECT SUBSIDY'));
out.push('直资 category 分布: ' + JSON.stringify(count(dss2.map((r) => r[iCat]))));
out.push('financeType=PRIVATE 数: ' + rows.filter((r) => r[iFin] === 'PRIVATE').length);
out.push('category含Private 数: ' + rows.filter((r) => (r[iCat] || '').includes('Private')).length);
out.push('category含Private 分布: ' + JSON.stringify(count(rows.filter((r) => (r[iCat] || '').includes('Private')).map((r) => r[iCat]))));
out.push('financeType=GOVERNMENT 数: ' + rows.filter((r) => r[iFin] === 'GOVERNMENT').length + ' / category含Government: ' + rows.filter((r) => (r[iCat] || '').includes('Government')).length);
out.push('financeType=AIDED 数: ' + rows.filter((r) => r[iFin] === 'AIDED').length + ' / category含Aided: ' + rows.filter((r) => (r[iCat] || '').includes('Aided')).length);
out.push('financeType=ENGLISH SCHOOLS FOUNDATION 数: ' + rows.filter((r) => r[iFin] === 'ENGLISH SCHOOLS FOUNDATION').length + ' / category含EnglishSchoolsFoundation: ' + rows.filter((r) => (r[iCat] || '').includes('English Schools Foundation')).length);
out.push('蘇浙公學:');
for (const r of rows.filter((x) => x[iName].includes('蘇浙公學'))) out.push('  ' + r[iName] + ' | ' + r[iCat] + ' | ' + r[iFin] + ' | ' + r[iLevel] + ' | ' + r[iDist]);
const split = (filterFn, label) => {
  const list = rows.filter(filterFn);
  const byLevel = count(list.map((r) => r[iLevel] || 'other'));
  out.push(`${label}: total=${list.length} -> ${JSON.stringify(byLevel)}`);
};
split((r) => (r[iCat] || '').includes('International Schools'), '国际学校(category含InternationalSchools)');
split((r) => r[iFin] === 'DIRECT SUBSIDY SCHEME', '直资(financeType=DSS)');
split((r) => r[iFin] === 'GOVERNMENT', '官立(financeType=GOVERNMENT)');
split((r) => r[iFin] === 'AIDED', '资助(financeType=AIDED)');
split((r) => r[iFin] === 'PRIVATE' && (r[iLevel] === 'PRIMARY' || r[iLevel] === 'SECONDARY'), '私立中小学(financeType=PRIVATE)');
split((r) => r[iFin] === 'ENGLISH SCHOOLS FOUNDATION', '英基(financeType=ESF)');

writeFileSync('scripts/schloc-dist.out.txt', out.join('\n'), 'utf8');
console.log('done, lines=' + out.length);
