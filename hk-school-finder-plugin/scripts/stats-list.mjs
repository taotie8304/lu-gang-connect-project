// 鲁港通 - Task 10 调研：5 类名单结构统计（输出到 stats-list.out.txt）
import { readFileSync, writeFileSync } from 'fs';

const out = [];
const read = (f) => readFileSync('fixtures/' + f, 'utf8').replace(/^\uFEFF/, '');

// ---------- 一条龙 ----------
{
  const lines = read('through-train-tc.csv').split(/\r?\n/).filter((l) => l.trim().length > 0);
  out.push('=== through-train ===');
  out.push('lines: ' + lines.length + ' (data ' + (lines.length - 1) + ')');
  const groups = new Set();
  const dists = {};
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    groups.add(c[0]);
    dists[c[2]] = (dists[c[2]] || 0) + 1;
  }
  out.push('groups: ' + groups.size + ' -> ' + [...groups].join(','));
  out.push('district dist: ' + JSON.stringify(dists));
  const g13 = lines.slice(1).filter((l) => l.startsWith('13,'));
  out.push('group 13: ' + JSON.stringify(g13));
}

// ---------- 直资学费 ----------
{
  const lines = read('dss-fee-tc.csv').split(/\r?\n/).filter((l) => l.trim().length > 0);
  out.push('');
  out.push('=== dss-fee ===');
  out.push('lines: ' + lines.length + ' (data ' + (lines.length - 1) + ')');
  const names = new Set();
  const levels = {};
  let trailingSpace = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    names.add(c[1]);
    levels[c[2]] = (levels[c[2]] || 0) + 1;
    if (c[1] !== c[1].trim()) trailingSpace++;
  }
  out.push('unique schools: ' + names.size);
  out.push('level dist: ' + JSON.stringify(levels));
  out.push('names with trailing space: ' + trailingSpace);
  const dbs = lines.slice(1).filter((l) => l.includes('拔萃男書院'));
  out.push('dbs rows: ' + JSON.stringify(dbs));
  // 尾部空列
  out.push('last col check: ' + JSON.stringify(lines[1]));
}

// ---------- 幼教计划 ----------
{
  const text = read('KG_SCHEME_202526.utf8.csv');
  // 引号解析统计：直接数非空行
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  out.push('');
  out.push('=== KG_SCHEME ===');
  out.push('raw lines: ' + rawLines.length);
  // 数据行特征：以数字+Tab 开头
  const dataLines = rawLines.filter((l) => /^\d+\t/.test(l));
  out.push('data lines (starts with num+tab): ' + dataLines.length);
  out.push('first data: ' + JSON.stringify(dataLines[0]));
  out.push('last data: ' + JSON.stringify(dataLines[dataLines.length - 1]));
  const stt = dataLines.filter((l) => l.includes('聖士提反堂'));
  out.push('ststephen: ' + JSON.stringify(stt));
}

// ---------- K1 非计划 ----------
{
  const lines = read('k1-not-joining-2026-tc.csv').split(/\r?\n/).filter((l) => l.trim().length > 0);
  out.push('');
  out.push('=== k1-not-joining ===');
  out.push('lines: ' + lines.length + ' (data ' + (lines.length - 1) + ')');
  out.push('header: ' + lines[0]);
  // 标志分布
  const f1 = [0, 0];
  const f3 = [0, 0];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    f1[c[3] === 'Y' ? 0 : 1]++;
    f3[c[5] === 'Y' ? 0 : 1]++;
  }
  out.push('col4 (online) Y/N: ' + f1.join('/'));
  out.push('col6 (share) Y/N: ' + f3.join('/'));
  // 行号列尾部空格样本
  out.push('row1 raw: ' + JSON.stringify(lines[1].slice(0, 40)));
}

// ---------- 附设幼儿中心 ----------
{
  const buf = readFileSync('fixtures/ccckg-non-aided-tc.csv');
  const isBom = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  const text = new TextDecoder('utf-16le').decode(buf.subarray(isBom ? 2 : 0));
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  out.push('');
  out.push('=== ccckg ===');
  out.push('utf16 bom: ' + isBom + ', lines: ' + lines.length + ' (data ' + (lines.length - 1) + ')');
  out.push('header: ' + lines[0]);
  out.push('row1: ' + lines[1]);
  // 地区分布
  const dists = {};
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const d = c[c.length - 1];
    dists[d] = (dists[d] || 0) + 1;
  }
  out.push('district dist: ' + JSON.stringify(dists));
  const first = lines.slice(1, 3).map((l) => l.split(',')[1]);
  out.push('center names sample: ' + JSON.stringify(first));
}

writeFileSync('stats-list.out.txt', out.join('\n'), 'utf8');
console.log('done');
