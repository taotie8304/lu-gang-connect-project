// 鲁港通 - Task 9 调研：SSPA/POA 结构统计（输出到 stats-net.out.txt 避免终端乱码）
import { readFileSync, writeFileSync } from 'fs';

const sspa = readFileSync('fixtures/sspa-schsrvnet-tc.csv', 'utf8');
const poa = readFileSync('fixtures/poa-schoolnet-tc.csv', 'utf8');
const out = [];

// ---------- SSPA ----------
out.push('=== SSPA ===');
out.push('BOM: ' + (sspa.charCodeAt(0) === 0xfeff));
const sLines = sspa.split(/\r?\n/).filter((l) => l.length > 0);
out.push('naive lines: ' + sLines.length);
out.push('quote count: ' + (sspa.match(/"/g) || []).length);
const header = sLines[0].replace(/^\uFEFF/, '').split(',');
out.push('header: ' + header.join(' | '));
const netCols = header.slice(4);
out.push('netCols(' + netCols.length + '): ' + netCols.join(','));

const nets = {};
const dists = {};
const yDist = {};
const rows = [];
for (let i = 1; i < sLines.length; i++) {
  const c = sLines[i].split(',');
  rows.push(c);
  nets[c[0]] = (nets[c[0]] || 0) + 1;
  dists[c[1]] = (dists[c[1]] || 0) + 1;
  let y = 0;
  for (let j = 4; j < header.length; j++) if (c[j] === 'Y') y++;
  yDist[y] = (yDist[y] || 0) + 1;
}
out.push('data rows: ' + rows.length);
out.push('Net dist: ' + JSON.stringify(nets));
out.push('DIST dist: ' + JSON.stringify(dists));
out.push('Y-count dist: ' + JSON.stringify(yDist));

// 样本行：喇沙 / 拔萃 / 皇仁 / 圣保罗
for (const kw of ['喇沙', '拔萃', '皇仁', '聖保羅']) {
  for (const c of rows) {
    if (c[3].includes(kw)) {
      const ys = [];
      for (let j = 4; j < header.length; j++) if (c[j] === 'Y') ys.push(header[j]);
      out.push(`sample ${kw}: Net=${c[0]} DIST=${c[1]} code=${c[2]} name=${c[3]} serve=[${ys.join(',')}]`);
    }
  }
}
// 列宽检查
const widthSet = new Set(rows.map((c) => c.length));
out.push('row widths: ' + JSON.stringify([...widthSet]));
// 校名唯一性
const names = rows.map((c) => c[3]);
out.push('dup names: ' + JSON.stringify([...new Set(names.filter((n, i) => names.indexOf(n) !== i))]));

// 按网反查统计（serve 含该网的学校数）
const reverse = {};
for (const c of rows) {
  for (let j = 4; j < header.length; j++) {
    if (c[j] === 'Y') reverse[header[j]] = (reverse[header[j]] || 0) + 1;
  }
}
out.push('reverse count: ' + JSON.stringify(reverse));

// ---------- POA ----------
out.push('');
out.push('=== POA ===');
out.push('BOM: ' + (poa.charCodeAt(0) === 0xfeff));
const pLines = poa.split(/\r?\n/).filter((l) => l.length > 0);
out.push('lines: ' + pLines.length);
out.push('header: ' + pLines[0]);
const pNets = [];
for (let i = 1; i < pLines.length; i++) {
  const c = pLines[i].split(',');
  pNets.push(c[0]);
  if (i <= 3 || c[0] === '95' || c[0] === '11') {
    out.push(`poa row: net=${c[0]} area=${JSON.stringify(c[1])} web=${c[2]}`);
  }
}
out.push('poa nets: ' + pNets.join(','));
out.push('poa net count: ' + pNets.length);
// 检查 area 尾部空格
const trailing = pLines.slice(1).filter((l) => /[ ]+,/.test(l)).length;
out.push('area with trailing space: ' + trailing);

writeFileSync('stats-net.out.txt', out.join('\n'), 'utf8');
console.log('done');
