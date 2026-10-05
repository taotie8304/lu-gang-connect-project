// 鲁港通 - 类别构成口径预演（与 src/queries/search.ts 的 categoryLabelOf / 过滤逻辑一致）
// 输出 5 条验收样例的精确数量与构成（供测试断言与上线实测基线）
import { readFileSync, writeFileSync } from 'node:fs';

const out = [];
const text = readFileSync('fixtures/SCH_LOC_EDB.utf8.csv', 'utf8').replace(/^\uFEFF/, '');
const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
const headers = lines[0].split('\t').map((s) => s.trim());
const idx = (name) => headers.indexOf(name);
const iName = idx('中文名稱');
const iNameEn = idx('ENGLISH NAME');
const iCat = idx('ENGLISH CATEGORY');
const iLevel = idx('SCHOOL LEVEL');
const iDist = idx('DISTRICT');

const LEVEL_MAP = {
  KINDERGARTEN: 'kg',
  'KINDERGARTEN-CUM-CHILD CARE CENTRES': 'kg',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
};

const rows = [];
for (const l of lines.slice(1)) {
  const c = l.split('\t').map((s) => s.trim());
  if (!c[iName] && !c[iNameEn]) continue;
  rows.push({
    name: c[iName],
    category: c[iCat] || '',
    level: LEVEL_MAP[(c[iLevel] || '').trim().toUpperCase()] ?? 'other',
    district: c[iDist] || '',
  });
}
out.push('parsed rows: ' + rows.length);

const labelOf = (cat) => {
  if (cat.includes('International Schools')) return '国际学校';
  if (cat.includes('Direct Subsidy Scheme')) return '直资';
  if (cat.includes('English Schools Foundation')) return '英基';
  if (cat.includes('Government')) return '官立';
  if (cat.includes('Aided')) return '资助';
  if (cat.includes('Private')) return '私立';
  if (cat.includes('Caput')) return '按额津贴';
  if (cat.includes('Kindergarten-cum-child')) return '幼稚园暨幼儿中心';
  if (cat.includes('Kindergartens')) return '幼稚园';
  return '其他';
};

const countBy = (list, fn) => {
  const m = new Map();
  for (const r of list) m.set(fn(r), (m.get(fn(r)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const show = (label, list) => {
  out.push(`\n=== ${label}: total=${list.length} ===`);
  out.push('级别: ' + JSON.stringify(countBy(list, (r) => r.level)));
  out.push('类别: ' + JSON.stringify(countBy(list, (r) => labelOf(r.category))));
};

// 验收样例 ①：沙田区小学
show('① 沙田区 primary', rows.filter((r) => r.district === 'SHA TIN' && r.level === 'primary'));
// 验收样例 ②：国际学校
show('② international（category 含 International Schools）', rows.filter((r) => r.category.includes('International Schools')));
// 验收样例 ③：油尖旺区直资中学
show(
  '③ 油尖旺区 secondary + direct_subsidy',
  rows.filter((r) => r.district === 'YAU TSIM MONG' && r.level === 'secondary' && r.category.includes('Direct Subsidy Scheme'))
);
// 样例 ③ 的上一级：油尖旺区中学（构成展示用）
show('③b 油尖旺区 secondary（全部）', rows.filter((r) => r.district === 'YAU TSIM MONG' && r.level === 'secondary'));
// 验收样例 ④：全港直资中学
show(
  '④ direct_subsidy + secondary（全港）',
  rows.filter((r) => r.level === 'secondary' && r.category.includes('Direct Subsidy Scheme'))
);
// 参考：全港（无过滤，数量问法兜底场景）
show('参考 全港全部', rows);

writeFileSync('scripts/cat-counts.out.txt', out.join('\n'), 'utf8');
console.log('done, lines=' + out.length);
