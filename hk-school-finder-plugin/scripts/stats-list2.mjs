// 鲁港通 - KG_SCHEME 精确行数排查 + ccckg 引号检查
import { readFileSync, writeFileSync } from 'fs';

const out = [];
const text = readFileSync('fixtures/KG_SCHEME_202526.utf8.csv', 'utf8').replace(/^\uFEFF/, '');
const lines = text.split(/\r?\n/);
out.push('total split lines: ' + lines.length);
// 尾部 8 行
out.push('--- tail 8 ---');
for (let i = Math.max(0, lines.length - 8); i < lines.length; i++) {
  out.push(`[${i}] len=${lines[i].length} ${JSON.stringify(lines[i].slice(0, 80))}`);
}
// 非空行中不以 数字+tab 开头的（除表头 6 行）
out.push('--- non-matching non-empty lines ---');
let n = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.trim().length === 0) continue;
  if (/^\d+\t/.test(l)) continue;
  n++;
  if (n <= 20) out.push(`[${i}] len=${l.length} ${JSON.stringify(l.slice(0, 100))}`);
}
out.push('non-matching count: ' + n);

// ccckg 引号检查
const buf = readFileSync('fixtures/ccckg-non-aided-tc.csv');
const isBom = buf[0] === 0xff && buf[1] === 0xfe;
const ctext = new TextDecoder('utf-16le').decode(buf.subarray(isBom ? 2 : 0));
out.push('');
out.push('ccckg quote count: ' + (ctext.match(/"/g) || []).length);
const clines = ctext.split(/\r?\n/).filter((l) => l.trim().length > 0);
out.push('ccckg lines: ' + clines.length);
// 每行字段数分布（简单 split）
const widths = {};
for (let i = 1; i < clines.length; i++) {
  const w = clines[i].split(',').length;
  widths[w] = (widths[w] || 0) + 1;
}
out.push('ccckg width dist: ' + JSON.stringify(widths));

writeFileSync('stats-list2.out.txt', out.join('\n'), 'utf8');
console.log('done');
