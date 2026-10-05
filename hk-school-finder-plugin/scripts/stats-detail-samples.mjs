// 鲁港通 - Task 8 样本值调研：KGP/PSP/SSP/vacancy 关键字段真实值（测试断言依据）
import { readFileSync } from 'node:fs';

const ascii = (s) => String(s ?? '').replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

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

const load = (path, delim) => {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return text.replace(/\r/g, '').split('\n').filter((l) => l.length > 0).map((l) => parseLine(l, delim));
};

const dumpCols = (rows, cols, limit = 1, title = '') => {
  const h = rows[0];
  console.log(`\n----- ${title} -----`);
  let shown = 0;
  for (const row of rows.slice(1)) {
    const get = (name) => row[h.indexOf(name)] ?? '';
    if (shown >= limit) break;
    console.log('row:');
    for (const c of cols) console.log(`  ${ascii(c)} = ${ascii(get(c))}`);
    shown++;
  }
};

// === KGP ===
{
  const rows = load('fixtures/KGP_2025_tc.utf8.csv', '^');
  console.log(`KGP rows: ${rows.length - 1}`);
  const cols = ['學校編號', '學校名稱', '地區', '參加幼稚園教育計劃', '開始申請日期', '結束申請日期', '課程類別', '已使用課室的總容額', '上午時段師生比例', '下午時段師生比例', '收費水平_全年_半日', '收費水平_全年_全日', '學生人數幼兒班_上午班', '校長及教學人員總人數', '質素評核_中文', '學校網址'];
  dumpCols(rows, cols, 2, 'KGP 前两行关键字段');
  // 找「迦南幼稚園（中環堅道）」
  const h = rows[0];
  const idx = h.indexOf('學校名稱');
  const cand = rows.slice(1).filter((r) => (r[idx] ?? '').includes('迦南') && (r[idx] ?? '').includes('中環'));
  console.log(`\n迦南中环匹配 ${cand.length} 行:`);
  for (const r of cand) {
    const get = (name) => r[h.indexOf(name)] ?? '';
    console.log(`  ${ascii(get('學校名稱'))} | ${ascii(get('參加幼稚園教育計劃'))} | 課程=${ascii(get('課程類別'))} | 半日費=${ascii(get('收費水平_全年_半日'))} | 全日費=${ascii(get('收費水平_全年_全日'))}`);
  }
}

// === vacancy ===
{
  const rows = load('fixtures/k1k3-vacancy-202627-tc.csv', ',');
  console.log(`\nvacancy rows: ${rows.length - 1}`);
  const h = rows[0];
  console.log('header:', h.map(ascii).join(' | '));
  for (const r of rows.slice(1, 4)) console.log('row:', r.map(ascii).join(' | '));
  const cand = rows.slice(1).find((r) => (r[3] ?? '').includes('迦南') && (r[3] ?? '').includes('中環'));
  if (cand) console.log('迦南中环:', cand.map(ascii).join(' | '));
}

// === PSP ===
{
  const rows = load('fixtures/PSP_2025_tc.utf8.csv', ',');
  console.log(`\nPSP rows: ${rows.length - 1}`);
  const cols = ['區域', '學校名稱', '小一學校網', '教學語言', '一條龍中學', '直屬中學', '聯繫中學', '學費', '堂費', '學生性別', '宗教', '校訓', '辦學團體', '創校年份', '學校類別1', '本學年小一班數', '班級教學模式', '學校電話', '學校網址'];
  dumpCols(rows, cols, 1, 'PSP 第一行关键字段');
  // 找一所一条龙小学
  const h = rows[0];
  const iLung = h.indexOf('一條龍中學');
  const withLung = rows.slice(1).find((r) => (r[iLung] ?? '').trim() !== '');
  if (withLung) {
    const get = (name) => withLung[h.indexOf(name)] ?? '';
    console.log(`\n有一條龍的小學: ${ascii(get('學校名稱'))} -> ${ascii(get('一條龍中學'))} | 校網=${ascii(get('小一學校網'))}`);
  }
}

// === SSP ===
{
  const rows = load('fixtures/SSP_2025_2026_tc.utf8.csv', ',');
  console.log(`\nSSP rows: ${rows.length - 1}`);
  const cols = ['區域', '學校名稱', '辦學宗旨', '教師總人數', '核准編制教師職位數目', '本學年中一班數', '本學年中六班數', '2025_2026學年學費S1', '宗教', '校訓', '創校年份', '學校類別', '學生性別', '學校設施-課室數目'];
  dumpCols(rows, cols, 1, 'SSP 第一行关键字段（办学宗旨截断到120字）');
}
