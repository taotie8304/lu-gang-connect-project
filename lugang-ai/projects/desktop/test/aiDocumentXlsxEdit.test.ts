// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseDocumentFile } from '../src/main/ai/document/parse';
import { editXlsxCopy } from '../src/main/ai/document/xlsxEdit';
import type { DocumentEditOperation } from '../src/main/ai/protocol';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-xlsx-edit-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeXlsx = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const list = workbook.addWorksheet('名单');
  list.addRow(['姓名', '分数']);
  list.addRow(['张三', '90']);
  list.addRow(['李四', '85']);
  const notes = workbook.addWorksheet('说明');
  notes.addRow(['备注']);
  notes.addRow(['张三参会']);
  await workbook.xlsx.writeFile(path);
};

const readCell = async (path: string, sheetName: string, address: string) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const cell = workbook.getWorksheet(sheetName)?.getCell(address);
  return cell?.value;
};

const readRowValues = async (path: string, sheetName: string, rowIndex: number) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const row = workbook.getWorksheet(sheetName)?.getRow(rowIndex);
  if (!row) return [];
  return Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).value);
};

const sha256 = async (path: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

const createOptions = async (
  sourcePath: string,
  dir: string,
  operations: DocumentEditOperation[]
) => ({
  document: await parseDocumentFile(sourcePath),
  operations,
  outputDir: join(dir, 'out')
});

describe('Excel 副本编辑', () => {
  it('写入单元格并把数字按数值保存', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);
      const before = await sha256(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '名单', cell: 'B2', value: '95' }
        ])
      );

      expect(result.name).toBe('成绩表-已修改.xlsx');
      expect(result.applied).toBe(1);
      expect(await readCell(result.path, '名单', 'B2')).toBe(95);
      expect(await sha256(source)).toBe(before);
    });
  });

  it('允许安全公式，危险公式按文本写入并提示', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);

      const safe = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '名单', cell: 'C2', value: '=B2+B3' }
        ])
      );
      expect(await readCell(safe.path, '名单', 'C2')).toMatchObject({ formula: 'B2+B3' });

      const risky = await editXlsxCopy({
        ...(await createOptions(source, dir, [
          { op: 'set_cell', sheet: '名单', cell: 'C3', value: '=WEBSERVICE("https://x")' }
        ])),
        now: new Date('2026-10-27T10:00:00')
      });
      expect(await readCell(risky.path, '名单', 'C3')).toBe('=WEBSERVICE("https://x")');
      expect(risky.warnings.join('')).toContain('公式');
    });
  });

  it('向工作表末尾追加一行', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'append_row', sheet: '名单', values: ['王五', '88'] }
        ])
      );

      expect(result.applied).toBe(2);
      expect(await readRowValues(result.path, '名单', 4)).toEqual(['王五', 88]);
    });
  });

  it('按工作表替换只改目标表，未指定时替换全部工作表', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);

      const scoped = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'replace_text', find: '张三', replace: '陈一', sheet: '名单' }
        ])
      );
      expect(await readCell(scoped.path, '名单', 'A2')).toBe('陈一');
      expect(await readCell(scoped.path, '说明', 'A2')).toBe('张三参会');

      const global = await editXlsxCopy({
        ...(await createOptions(source, dir, [{ op: 'replace_text', find: '张三', replace: '陈一' }])),
        now: new Date('2026-10-27T11:00:00')
      });
      expect(await readCell(global.path, '名单', 'A2')).toBe('陈一');
      expect(await readCell(global.path, '说明', 'A2')).toBe('陈一参会');
      expect(global.applied).toBe(2);
    });
  });

  it('合并区域的从属单元格写入主单元格', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '合并表.xlsx');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('表');
      sheet.mergeCells('A1:B1');
      sheet.getCell('A1').value = '旧标题';
      sheet.getCell('A2').value = '内容';
      await workbook.xlsx.writeFile(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '表', cell: 'B1', value: '新标题' }
        ])
      );

      expect(await readCell(result.path, '表', 'A1')).toBe('新标题');
    });
  });

  it('工作表不存在时不生成副本', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);

      const error = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '不存在的表', cell: 'B2', value: 'x' }
        ])
      ).catch((reason) => reason);

      expect(error).toMatchObject({ code: 'document_no_change' });
      expect(error.message).toContain('未生成副本');
      expect(error.message).toContain('不存在的表');
    });
  });

  it('不适用的 Word 操作会被跳过并给出提示', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      await writeXlsx(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'append_paragraph', text: '只适用于 Word' },
          { op: 'set_cell', sheet: '名单', cell: 'B2', value: '96' }
        ])
      );

      expect(result.applied).toBe(1);
      expect(result.skipped.join('')).toContain('Word');
    });
  });
});