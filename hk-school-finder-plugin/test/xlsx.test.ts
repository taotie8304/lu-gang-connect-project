// 鲁港通 - 极简 XLSX 读取器测试（TDD）：以官方统计文件真实字节驱动（ZIP/共享字符串/单元格矩阵）
import { describe, it, expect } from 'vitest';
import { fixture } from './fixture';
import { readXlsx } from '../src/xlsx';

const sheets = readXlsx(fixture('statistics-by-district-tc.xlsx'));
const sheet3b = sheets[5];

describe('readXlsx（Statistics_by_district_C.xlsx）', () => {
  it('解析 6 张工作表，名称与顺序正确', () => {
    expect(sheets.map((s) => s.name)).toEqual(['表1(a)', '表1(b)', '表2(a)', '表2(b)', '表3(a)', '表3(b)']);
  });

  it('表3(b) 标题行：表号与学年（共享字符串解码）', () => {
    expect(sheet3b.rows[0][0]).toContain('表3(b)');
    expect(sheet3b.rows[0][0]).toContain('2025/26學年');
  });

  it('表头定位：分區（col0）/ 級別（col2）/ 總計·學生人數（col11）', () => {
    expect(sheet3b.rows[3][0]).toBe('分區');
    expect(sheet3b.rows[3][2]).toBe('級別');
    expect(sheet3b.rows[5][11]).toBe('學生人數');
  });

  it('块首行完整读取：中西區·中一·總計 2046；稀疏列补空串', () => {
    expect(sheet3b.rows[6][0]).toBe('中西區');
    expect(sheet3b.rows[6][2]).toBe('中一');
    expect(sheet3b.rows[6][11]).toBe('2046');
    expect(sheet3b.rows[6][1]).toBe('');
  });

  it('块内次行：分区列为空（仅块首有值），级别与数值正常', () => {
    expect(sheet3b.rows[7][0]).toBe('');
    expect(sheet3b.rows[7][2]).toBe('中二');
    expect(sheet3b.rows[7][11]).toBe('2004');
  });

  it('沙田块（第 119 行）与全港合计块（第 151/158 行）', () => {
    expect(sheet3b.rows[118][0]).toBe('沙田');
    expect(sheet3b.rows[118][11]).toBe('6061');
    expect(sheet3b.rows[150][0]).toBe('所有分區');
    expect(sheet3b.rows[157][2]).toBe('所有級別');
    expect(sheet3b.rows[157][11]).toBe('347820');
  });

  it('行覆盖全表：网格高度 169（r167/168 缺失补空；尾部注释行可读）', () => {
    expect(sheet3b.rows.length).toBe(169);
    // r167/r168 在官方文件中省略，按网格语义补空行
    expect(sheet3b.rows[166].every((c) => c === '')).toBe(true);
    expect(sheet3b.rows[167].every((c) => c === '')).toBe(true);
    // 尾部注释行（r160 起）：註釋：(1) 數字反映2025年9月中的情況。
    expect(sheet3b.rows[159][0]).toBe('註釋：');
    expect(sheet3b.rows[159][2]).toBe('數字反映2025年9月中的情況。');
  });

  it('非 XLSX 字节 → 抛可操作中文错误', () => {
    expect(() => readXlsx(new Uint8Array([1, 2, 3, 4]))).toThrow(/XLSX/);
  });
});
