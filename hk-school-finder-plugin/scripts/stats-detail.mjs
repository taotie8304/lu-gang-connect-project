// 鲁港通 - Task 8 前置调研：KGP / K1K3 空缺 / PSP / SSP 四文件列结构（ASCII 安全输出）
import { readFileSync } from 'node:fs';

const ascii = (s) => String(s).replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

// 通用 CSV 行解析（处理引号）
const parseLine = (line, delim) => {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const head = (name, path, delim, maxCols = 200, sampleRows = 1) => {
  console.log(`\n===== ${name} =====`);
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
  console.log(`physical lines: ${lines.length}`);
  const h = parseLine(lines[0], delim);
  console.log(`cols: ${h.length}`);
  h.forEach((c, i) => {
    if (i < maxCols) console.log(`  [${i}] ${ascii(c)}`);
  });
  for (let r = 0; r < sampleRows && r + 1 < lines.length; r++) {
    const row = parseLine(lines[r + 1], delim);
    console.log(`-- sample row ${r + 1} (first 8 cols):`);
    row.slice(0, 8).forEach((c, i) => console.log(`   (${i}) ${ascii(c)}`));
  }
};

head('KGP（幼稚园概览）', 'fixtures/KGP_2025_tc.utf8.csv', '^', 120, 1);

// K1K3 空缺：先看前 5 物理行（可能带说明行）
console.log('\n===== K1K3 vacancy（前 5 物理行） =====');
{
  const text = readFileSync('fixtures/k1k3-vacancy-202627-tc.csv', 'utf8').replace(/^\uFEFF/, '');
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0);
  console.log(`physical lines: ${lines.length}`);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log(`line[${i}]: ${ascii(lines[i].slice(0, 300))}`);
  }
}

head('PSP（小学概览）', 'fixtures/PSP_2025_tc.utf8.csv', ',', 140, 1);
head('SSP（中学概览）', 'fixtures/SSP_2025_2026_tc.utf8.csv', ',', 140, 1);
