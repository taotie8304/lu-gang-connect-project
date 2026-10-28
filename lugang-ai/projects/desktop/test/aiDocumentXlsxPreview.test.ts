// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  buildXlsxPreviewChanges,
  computeXlsxPreviewSheets,
  extractXlsxPreview,
  MAX_XLSX_PREVIEW_COLUMNS,
  MAX_XLSX_PREVIEW_ROWS
} from '../src/main/ai/document/xlsxPreview';
import type { DocumentEditOperation } from '../src/main/ai/protocol';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-xlsx-preview-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeBudget = async (dir: string): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  const budget = workbook.addWorksheet('预算表');
  budget.addRow(['项目', '金额', '备注']);
  budget.addRow(['申请费', 100, '固定']);
  budget.addRow(['合计', 100, '']);
  budget.getCell('C3').value = { formula: 'SUM(B2:B3)', result: 100 };
  budget.getCell('A4').value = '合并说明';
  budget.mergeCells('A4:B4');

  const notes = workbook.addWorksheet('说明');
  notes.addRow(['备注']);
  notes.addRow(['申请费包含材料费']);
  notes.addRow(['申请费不退']);

  const path = join(dir, '预算表.xlsx');
  await workbook.xlsx.writeFile(path);
  return path;
};

const op = (value: DocumentEditOperation): DocumentEditOperation => value;

const statuses = (changes: ReturnType<typeof buildXlsxPreviewChanges>) =>
  changes.map((change) => change.status);

describe('Excel 预览网格提取', () => {
  it('按工作表输出单元格文本与行列规模', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));

      expect(model.sheets.map((sheet) => sheet.name)).toEqual(['预算表', '说明']);
      const budget = model.sheets[0];
      expect(budget.rowCount).toBe(4);
      expect(budget.columnCount).toBe(3);
      expect(budget.truncatedRows).toBe(false);
      expect(budget.truncatedColumns).toBe(false);
      expect(budget.rows[0]).toEqual(['项目', '金额', '备注']);
      expect(budget.rows[1]).toEqual(['申请费', '100', '固定']);
      expect(budget.rows[2][2]).toBe('100');
      expect(model.sheets[1].rows[2]).toEqual(['申请费不退']);
      expect(JSON.stringify(model.sheets)).not.toContain(dir);
    });
  });

  it('超大的工作表只截取预览窗口并给出截断标记', async () => {
    await withTempDir(async (dir) => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('大表');
      sheet.addRow(['表头']);
      for (let row = 2; row <= MAX_XLSX_PREVIEW_ROWS + 20; row += 1) {
        sheet.addRow([`第 ${row} 行`]);
      }
      const merged = workbook.addWorksheet('宽表');
      merged.addRow(Array.from({ length: MAX_XLSX_PREVIEW_COLUMNS + 5 }, (_, index) => `列${index + 1}`));
      const path = join(dir, '大表.xlsx');
      await workbook.xlsx.writeFile(path);

      const model = await extractXlsxPreview(path);

      expect(model.sheets[0].truncatedRows).toBe(true);
      expect(model.sheets[0].rows).toHaveLength(MAX_XLSX_PREVIEW_ROWS);
      expect(model.sheets[1].truncatedColumns).toBe(true);
      expect(model.sheets[1].rows[0]).toHaveLength(MAX_XLSX_PREVIEW_COLUMNS);
    });
  });
});

describe('Excel 改动模拟', () => {
  it('改单元格时给出工作表地址与原文', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const changes = buildXlsxPreviewChanges(model, [
        op({ op: 'set_cell', sheet: '预算表', cell: 'B2', value: '120' })
      ]);

      expect(changes[0]).toMatchObject({
        target: '工作表「预算表」B2',
        before: '100',
        after: '120',
        status: 'pending'
      });
    });
  });

  it('合并单元格写到主格，公式格会提示被替换', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const [merged, formula] = buildXlsxPreviewChanges(model, [
        op({ op: 'set_cell', sheet: '预算表', cell: 'B4', value: '合并说明（补充）' }),
        op({ op: 'set_cell', sheet: '预算表', cell: 'C3', value: '120' })
      ]);

      expect(merged).toMatchObject({
        target: '工作表「预算表」A4',
        before: '合并说明',
        status: 'pending'
      });
      expect(merged.note).toContain('合并单元格');
      expect(formula).toMatchObject({ before: '100', status: 'pending' });
      expect(formula.note).toContain('公式');
    });
  });

  it('工作表或单元格不存在时不可用并说明原因', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const changes = buildXlsxPreviewChanges(model, [
        op({ op: 'set_cell', sheet: '不存在', cell: 'A1', value: 'x' }),
        op({ op: 'set_cell', sheet: '预算表', cell: '1A', value: 'x' }),
        op({ op: 'replace_text', sheet: '不存在', find: '申请费', replace: '报名费' }),
        op({ op: 'replace_text', paragraph: 0, find: '申请费', replace: '报名费' }),
        op({ op: 'set_paragraph', paragraph: 0, text: 'x' })
      ]);

      expect(statuses(changes)).toEqual([
        'unavailable',
        'unavailable',
        'unavailable',
        'unavailable',
        'unavailable'
      ]);
      expect(changes[0].note).toContain('不存在');
      expect(changes[1].note).toContain('格式不正确');
      expect(changes[3].note).toContain('Word');
    });
  });

  it('追加行给出新增行号与写入内容', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const [change] = buildXlsxPreviewChanges(model, [
        op({ op: 'append_row', sheet: '预算表', values: ['材料费', '30', '新增'] })
      ]);

      expect(change).toMatchObject({
        target: '工作表「预算表」新增第 5 行',
        before: '',
        after: '材料费 · 30 · 新增',
        status: 'pending'
      });
    });
  });

  it('批量替换按工作表统计命中处数', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const changes = buildXlsxPreviewChanges(model, [
        op({ op: 'replace_text', sheet: '说明', find: '申请费', replace: '报名费' }),
        op({ op: 'replace_text', find: '不存在的词', replace: 'x' })
      ]);

      expect(changes[0]).toMatchObject({
        target: '工作表「说明」共 2 处',
        before: '申请费',
        after: '报名费',
        status: 'pending'
      });
      expect(changes[1]).toMatchObject({ status: 'unavailable' });
      expect(changes[1].note).toContain('没有找到');
    });
  });
});

describe('Excel 预览最终状态', () => {
  it('待确认改动只标黄对应单元格，跳过与不可用不计入', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const operations = [
        op({ op: 'set_cell', sheet: '预算表', cell: 'B2', value: '120' }),
        op({ op: 'set_cell', sheet: '预算表', cell: 'B3', value: '90' }),
        op({ op: 'set_cell', sheet: '不存在', cell: 'A1', value: 'x' })
      ];
      const changes = buildXlsxPreviewChanges(model, operations);
      changes[1].status = 'skipped';

      const sheets = computeXlsxPreviewSheets(model, operations, changes);
      const budget = sheets[0];

      expect(budget.rows[1][1]).toBe('120');
      expect(budget.rows[2][1]).toBe('100');
      expect(budget.cellMarks).toEqual([
        { row: 1, cell: 1, mark: 'pending', original: '100' }
      ]);
      expect(budget.header).toEqual(['项目', '金额', '备注']);
      expect(budget.sampleRows[0]).toEqual(['申请费', '120', '固定']);
    });
  });

  it('批量替换把命中单元格全部标记并保留原文', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const operations = [
        op({ op: 'replace_text', sheet: '说明', find: '申请费', replace: '报名费' })
      ];
      const changes = buildXlsxPreviewChanges(model, operations);
      changes[0].status = 'applied';

      const sheets = computeXlsxPreviewSheets(model, operations, changes);
      const notes = sheets[1];

      expect(notes.rows[1]).toEqual(['报名费包含材料费']);
      expect(notes.rows[2]).toEqual(['报名费不退']);
      expect(notes.cellMarks).toEqual([
        { row: 1, cell: 0, mark: 'applied', original: '申请费包含材料费' },
        { row: 2, cell: 0, mark: 'applied', original: '申请费不退' }
      ]);
    });
  });

  it('追加行以新增行形式附在工作表末尾', async () => {
    await withTempDir(async (dir) => {
      const model = await extractXlsxPreview(await writeBudget(dir));
      const operations = [
        op({ op: 'append_row', sheet: '说明', values: ['补充说明'] })
      ];
      const changes = buildXlsxPreviewChanges(model, operations);

      const notes = computeXlsxPreviewSheets(model, operations, changes)[1];

      expect(notes.appendedRows).toEqual([
        { rowNumber: 4, values: ['补充说明'], mark: 'pending' }
      ]);
      expect(notes.rows).toHaveLength(3);
    });
  });
});
