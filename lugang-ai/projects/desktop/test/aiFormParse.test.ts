// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseFormFile, toFormSummary } from '../src/main/ai/form/parse';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-form-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeDocx = async (path: string) => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('慈善组织申请表')] }),
          new Paragraph({ children: [new TextRun('申请人姓名：____________')] }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('姓名')] }),
                  new TableCell({ children: [new Paragraph('')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('证件号码')] }),
                  new TableCell({ children: [new Paragraph('')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('联系电话')] }),
                  new TableCell({ children: [new Paragraph('________')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('申请事项')] }),
                  new TableCell({ children: [new Paragraph('成立慈善组织')] })
                ]
              })
            ]
          })
        ]
      }
    ]
  });
  await writeFile(path, await Packer.toBuffer(doc));
};

const writeXlsxVertical = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('申请表');
  sheet.addRow(['姓名', '']);
  sheet.addRow(['证件号码', '']);
  sheet.addRow(['联系电话', '']);
  await workbook.xlsx.writeFile(path);
};

const writeXlsxHeader = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('名单');
  sheet.addRow(['姓名', '电话', '邮箱']);
  await workbook.xlsx.writeFile(path);
};

const writeFillablePdf = async (path: string) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const form = doc.getForm();

  const name = form.createTextField('applicant_name');
  name.addToPage(page, { x: 50, y: 760, width: 240, height: 24 });

  const gender = form.createDropdown('gender');
  gender.addOptions(['男', '女']);
  gender.addToPage(page, { x: 50, y: 710, width: 120, height: 24 });

  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 50, y: 670, width: 18, height: 18 });

  await writeFile(path, await doc.save());
};

const writePlainPdf = async (path: string) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Charity application form', { x: 50, y: 760, size: 14, font });
  await writeFile(path, await doc.save());
};

describe('本地表单解析', () => {
  it('解析 Word 表头、表格标签与空值单元格', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '慈善组织申请表.docx');
      await writeDocx(path);

      const parsed = await parseFormFile(path);

      expect(parsed.format).toBe('docx');
      expect(parsed.title).toBe('慈善组织申请表');
      const labels = parsed.fields.map((field) => field.label);
      expect(labels).toContain('申请人姓名');
      expect(labels).toContain('姓名');
      expect(labels).toContain('证件号码');
      expect(labels).toContain('联系电话');
      expect(labels).not.toContain('申请事项');

      const nameField = parsed.fields.find((field) => field.label === '姓名');
      expect(nameField).toMatchObject({ kind: 'text' });
      expect(nameField?.id).toMatch(/^f\d+$/);
      expect(nameField).toHaveProperty('locator');
    });
  });

  it('解析 Excel 竖排标签与横向表头两种版式', async () => {
    await withTempDir(async (dir) => {
      const verticalPath = join(dir, '申请表.xlsx');
      await writeXlsxVertical(verticalPath);
      const vertical = await parseFormFile(verticalPath);

      expect(vertical.format).toBe('xlsx');
      expect(vertical.fields.map((field) => field.label)).toEqual([
        '姓名',
        '证件号码',
        '联系电话'
      ]);

      const headerPath = join(dir, '名单.xlsx');
      await writeXlsxHeader(headerPath);
      const header = await parseFormFile(headerPath);

      expect(header.fields.map((field) => field.label)).toEqual(['姓名', '电话', '邮箱']);
      expect(header.fields.every((field) => field.kind === 'text')).toBe(true);
    });
  });

  it('解析可填写 PDF 的文本域、下拉与复选框', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请表.pdf');
      await writeFillablePdf(path);

      const parsed = await parseFormFile(path);

      expect(parsed.format).toBe('pdf');
      const byName = new Map(parsed.fields.map((field) => [field.label, field]));
      expect(byName.get('applicant_name')).toMatchObject({ kind: 'text' });
      expect(byName.get('gender')).toMatchObject({ kind: 'choice', options: ['男', '女'] });
      expect(byName.get('agree')).toMatchObject({ kind: 'checkbox' });
    });
  });

  it('拒绝不可填写的 PDF 并给出可操作的中文说明', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '扫描件.pdf');
      await writePlainPdf(path);

      await expect(parseFormFile(path)).rejects.toThrow(/可填写|扫描件/);
    });
  });

  it('拒绝不支持的格式', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '说明.txt');
      await writeFile(path, 'hello');

      await expect(parseFormFile(path)).rejects.toThrow(/Word|Excel|PDF/);
    });
  });

  it('发给服务端的摘要不含本机定位信息', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请表.docx');
      await writeDocx(path);

      const summary = toFormSummary(await parseFormFile(path));

      expect(summary.name).toBe('申请表.docx');
      expect(summary.fields.length).toBeGreaterThan(0);
      expect(summary.fields[0]).not.toHaveProperty('locator');
      expect(JSON.stringify(summary)).not.toContain(dir);
    });
  });
});
