// 鲁港通 - CSV 解析器测试（TDD）：引号/内嵌换行/多分隔符/表头 trim
import { describe, it, expect } from 'vitest';
import { parseCsv, parseCsvToObjects } from '../src/csv';
import { decodeBytes } from '../src/decode';
import { fixture, fixtureText } from './fixture';

describe('parseCsv - 基础', () => {
  it('逗号分隔 + 简单行', () => {
    const rows = parseCsv('a,b,c\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3']
    ]);
  });

  it('CRLF 行尾与引号字段（含逗号）', () => {
    const rows = parseCsv('name,addr\r\n"CHAN, SUI",Kowloon\r\n');
    expect(rows[1]).toEqual(['CHAN, SUI', 'Kowloon']);
  });

  it('引号转义（连续双引号 → 单个引号）', () => {
    const rows = parseCsv('a\n"say ""hi"""');
    expect(rows[1][0]).toBe('say "hi"');
  });

  it('跳过尾部空行', () => {
    const rows = parseCsv('a,b\n1,2\n\n');
    expect(rows.length).toBe(2);
  });

  it('空输入返回空数组', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseCsv - 引号内嵌换行（KG_SCHEME 真实用例）', () => {
  it('跨物理行的表头解出 5 列', () => {
    const text = fixtureText('KG_SCHEME_202526.utf8.csv');
    const rows = parseCsv(text, { delimiter: '\t' });
    const header = rows[0];
    expect(header.length).toBe(5);
    expect(header[0]).toContain('編號');
    expect(header[0]).toContain('No.');
    expect(header[1]).toContain('學校名稱(中文)');
    expect(header[1]).toContain('School Name (Chinese)');
    // 首条数据行
    expect(rows[1][0]).toBe('1');
    expect(rows[1][1]).toBe('迦南幼稚園（中環堅道）');
    expect(rows[1][4]).toBe('Central & Western');
  });
});

describe('parseCsv - Tab 分隔（SCH_LOC 原始字节链路）', () => {
  it('UTF-16 解码 + Tab 解析：表头正确且引号地址字段完整', () => {
    const text = decodeBytes(fixture('SCH_LOC_EDB.raw.csv'));
    const rows = parseCsv(text, { delimiter: '\t' });
    expect(rows[0][0]).toBe('ENGLISH CATEGORY');
    expect(rows[0][1]).toBe('中文類別');
    expect(rows[0][2]).toBe('ENGLISH NAME');
    // 玛利曼小学：地址被引号包裹且内含逗号
    const marymount = rows.find((r) => r[2] === 'MARYMOUNT PRIMARY SCHOOL');
    expect(marymount).toBeDefined();
    expect(marymount![4]).toBe(
      'LG 1/F, G/F, 1/F, 2/F, 3/F & 4/F 336 TAI HANG ROAD WANCHAI HONG KONG'
    );
    expect(marymount![3]).toBe('瑪利曼小學');
  });
});

describe('parseCsv - 脱字符 ^ 分隔（KGP）', () => {
  it('表头与前两列识别，数据行字段数与表头一致', () => {
    const text = fixtureText('KGP_2025_tc.utf8.csv');
    const rows = parseCsv(text, { delimiter: '^' });
    expect(rows[0][0]).toBe('學校編號');
    expect(rows[0][1]).toBe('校址編號');
    expect(rows[0][2]).toBe('學校名稱');
    expect(rows[1][2]).toContain('幼稚園');
    expect(rows[1].length).toBe(rows[0].length);
  });
});

describe('parseCsvToObjects', () => {
  it('首行作表头 → 对象数组，表头自动 trim（tab0407 的「 中二」用例）', () => {
    const objs = parseCsvToObjects('分區, 中二,中三\n中西區,2046,2004');
    expect(objs.length).toBe(1);
    expect(objs[0]['分區']).toBe('中西區');
    expect(objs[0]['中二']).toBe('2046');
    expect(objs[0]['中三']).toBe('2004');
  });

  it('字段数少于表头的行：缺失字段为 undefined，不抛错', () => {
    const objs = parseCsvToObjects('a,b,c\n1,2');
    expect(objs[0]['a']).toBe('1');
    expect(objs[0]['c']).toBeUndefined();
  });
});
