// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseDocumentFile } from '../src/main/ai/document/parse';
import { editXlsxCopy } from '../src/main/ai/document/xlsxEdit';
import { assertCopyPathDistinct } from '../src/main/ai/document/editTypes';
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

const writeBudgetXlsx = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('預算');
  sheet.getCell('B12').value = '支出項目';
  sheet.mergeCells('B12:D12');
  sheet.getCell('E12').value = '單價(元)';
  sheet.getCell('F12').value = '數量';
  sheet.getCell('G12').value = '數額(元)';
  sheet.getCell('B16').value = '1. 往返交通費';
  sheet.mergeCells('B16:D16');
  sheet.getCell('E16').value = 30;
  sheet.getCell('E16').numFmt = '#,##0.00';
  sheet.getCell('E16').font = { name: '新細明體', size: 12 };
  sheet.getCell('F16').value = 2;
  sheet.getCell('G16').value = { formula: 'E16*F16', result: 60 };
  sheet.getCell('B23').value = '總額 (A):';
  sheet.getCell('E23').numFmt = '#,##0.00';
  sheet.getCell('G23').value = { formula: 'SUM(G16:G22)', result: 60 };
  sheet.getRow(23).height = 28;
  await workbook.xlsx.writeFile(path);
};

// 鲁港通 - 模拟民青局表格里被 ExcelJS 重写会丢掉的部件：图片、打印设置、计算链
const injectExtraParts = async (path: string) => {
  const zip = new AdmZip(path);
  zip.addFile(
    'xl/drawings/drawing1.xml',
    Buffer.from(
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>',
      'utf8'
    )
  );
  zip.addFile('xl/printerSettings/printerSettings1.bin', Buffer.from([0x00, 0x01, 0x02, 0x03]));
  zip.addFile(
    'xl/calcChain.xml',
    Buffer.from(
      '<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="G16" i="1"/></calcChain>',
      'utf8'
    )
  );

  const types = zip.readAsText('[Content_Types].xml').replace(
    '</Types>',
    [
      '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>',
      '<Override PartName="/xl/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>',
      '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>',
      '</Types>'
    ].join('')
  );
  zip.updateFile('[Content_Types].xml', Buffer.from(types, 'utf8'));

  const rels = zip
    .readAsText('xl/_rels/workbook.xml.rels')
    .replace(
      '</Relationships>',
      '<Relationship Id="rIdCalcChain" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>'
    );
  zip.updateFile('xl/_rels/workbook.xml.rels', Buffer.from(rels, 'utf8'));

  await writeFile(path, zip.toBuffer());
};

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
  it('副本路径与源文件相同时拒绝写入', () => {
    const source = 'C:\\Users\\tester\\Desktop\\预算表.xlsx';
    expect(() => assertCopyPathDistinct(source, source)).toThrowError(/原文件/);
    expect(() =>
      assertCopyPathDistinct(source, 'C:\\Users\\tester\\Desktop\\预算表-已修改.xlsx')
    ).not.toThrow();
  });

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

describe('Excel 副本编辑 · 保持原文件格式', () => {
  it('只改目标单元格，图片、打印设置与样式部件逐字节保留', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '預算表.xlsx');
      await writeBudgetXlsx(source);
      await injectExtraParts(source);

      const before = new AdmZip(source);
      const drawing = before.getEntry('xl/drawings/drawing1.xml')?.getData();
      const printer = before.getEntry('xl/printerSettings/printerSettings1.bin')?.getData();
      const styles = before.getEntry('xl/styles.xml')?.getData();
      const theme = before.getEntry('xl/theme/theme1.xml')?.getData();

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '預算', cell: 'F16', value: '3' }
        ])
      );

      const after = new AdmZip(result.path);
      expect(after.getEntry('xl/drawings/drawing1.xml')?.getData().equals(drawing!)).toBe(true);
      expect(after.getEntry('xl/printerSettings/printerSettings1.bin')?.getData().equals(printer!)).toBe(
        true
      );
      expect(after.getEntry('xl/styles.xml')?.getData().equals(styles!)).toBe(true);
      expect(after.getEntry('xl/theme/theme1.xml')?.getData().equals(theme!)).toBe(true);

      expect(after.getEntry('xl/calcChain.xml')).toBeNull();
      expect(after.readAsText('[Content_Types].xml')).not.toContain('calcChain');
      expect(after.readAsText('xl/_rels/workbook.xml.rels')).not.toContain('calcChain');
      expect(after.readAsText('xl/workbook.xml')).toContain('fullCalcOnLoad="1"');

      const sheetXml = after.readAsText('xl/worksheets/sheet1.xml');
      expect(sheetXml).toContain('<mergeCell ref="B16:D16"/>');
      expect(sheetXml).toContain('ht="28"');
      expect(await readCell(result.path, '預算', 'F16')).toBe(3);
    });
  });

  it('公式单元格不会被普通内容覆盖', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '預算表.xlsx');
      await writeBudgetXlsx(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '預算', cell: 'G16', value: '999' },
          { op: 'set_cell', sheet: '預算', cell: 'F16', value: '3' }
        ])
      );

      expect(result.applied).toBe(1);
      expect(result.skipped.join('')).toContain('公式');
      expect(await readCell(result.path, '預算', 'G16')).toMatchObject({ formula: 'E16*F16' });
      expect(await readCell(result.path, '預算', 'F16')).toBe(3);
    });
  });

  it('改写单元格保留数字格式与字体，合并区域保持不变', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '預算表.xlsx');
      await writeBudgetXlsx(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '預算', cell: 'E16', value: '45.5' },
          { op: 'set_cell', sheet: '預算', cell: 'C16', value: '改成合并写入' }
        ])
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(result.path);
      const sheet = workbook.getWorksheet('預算');
      expect(sheet?.getCell('E16').value).toBe(45.5);
      expect(sheet?.getCell('E16').numFmt).toBe('#,##0.00');
      expect(sheet?.getCell('E16').font.name).toBe('新細明體');
      expect(sheet?.getCell('B16').value).toBe('改成合并写入');
      expect(sheet?.getCell('C16').isMerged).toBe(true);
    });
  });

  it('追加行沿用上一行的数字格式', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '預算表.xlsx');
      await writeBudgetXlsx(source);

      const result = await editXlsxCopy(
        await createOptions(source, dir, [
          { op: 'append_row', sheet: '預算', values: ['2. 住宿費', '', '', '', '20', '2'] }
        ])
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(result.path);
      const row = workbook.getWorksheet('預算')?.getRow(24);
      expect(row?.getCell(1).value).toBe('2. 住宿費');
      expect(row?.getCell(5).value).toBe(20);
      expect(row?.getCell(5).numFmt).toBe('#,##0.00');
    });
  });
});