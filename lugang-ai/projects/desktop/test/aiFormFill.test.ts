// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fillFormCopy } from '../src/main/ai/form/fill';
import { parseFormFile } from '../src/main/ai/form/parse';

const HAS_CJK_FONT = existsSync(join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', 'simhei.ttf'));

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-fill-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeDocxForm = async (path: string) => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('慈善组织申请表')] }),
          new Paragraph({ children: [new TextRun('申请人姓名：________')] }),
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
                  new TableCell({ children: [new Paragraph('联系电话')] }),
                  new TableCell({ children: [new Paragraph('________')] })
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

const readDocxText = (path: string): string => {
  const zip = new AdmZip(path);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('missing document.xml');
  return zip.readAsText(entry, 'utf8').replace(/<[^>]+>/g, '');
};

const writeXlsxVertical = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('申请表');
  sheet.addRow(['姓名', '']);
  sheet.addRow(['证件号码', '']);
  sheet.addRow(['联系电话', '']);
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

describe('本地表单回填', () => {
  it('按字段清单写入 Word 副本，原文件保持不变', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '慈善组织申请表.docx');
      await writeDocxForm(source);
      const form = await parseFormFile(source);
      const byLabel = new Map(form.fields.map((field) => [field.label, field.id]));

      const result = await fillFormCopy({
        form,
        outputDir: dir,
        values: [
          { id: byLabel.get('申请人姓名')!, value: '张三' },
          { id: byLabel.get('姓名')!, value: '张三' },
          { id: byLabel.get('联系电话')!, value: '13800000000' }
        ]
      });

      expect(result.name).toBe('慈善组织申请表-已填写.docx');
      expect(result.folder).toBe(join(dir, '鲁港通生成文件'));
      expect(result.filled).toBe(3);
      expect(result.skipped).toEqual([]);

      const text = readDocxText(result.path);
      expect(text).toContain('申请人姓名：张三');
      expect(text).toContain('姓名张三');
      expect(text).toContain('联系电话13800000000');

      const original = await parseFormFile(source);
      expect(original.fields).toHaveLength(3);
      expect(readDocxText(source)).not.toContain('张三');
    });
  });

  it('按字段清单写入 Excel 副本，原文件保持不变', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请表.xlsx');
      await writeXlsxVertical(source);
      const form = await parseFormFile(source);
      const [nameField, idField, phoneField] = form.fields;

      const result = await fillFormCopy({
        form,
        outputDir: dir,
        values: [
          { id: nameField.id, value: '李四' },
          { id: idField.id, value: 'A1234567' },
          { id: phoneField.id, value: '13900000000' }
        ]
      });

      expect(result.name).toBe('申请表-已填写.xlsx');
      expect(result.filled).toBe(3);

      const filled = new ExcelJS.Workbook();
      await filled.xlsx.readFile(result.path);
      const sheet = filled.getWorksheet('申请表')!;
      expect(sheet.getCell('B1').value).toBe('李四');
      expect(sheet.getCell('B2').value).toBe('A1234567');
      expect(sheet.getCell('B3').value).toBe('13900000000');

      const original = new ExcelJS.Workbook();
      await original.xlsx.readFile(source);
      expect(original.getWorksheet('申请表')!.getCell('B1').value).toBeFalsy();
    });
  });

  it.skipIf(!HAS_CJK_FONT)('写入可填写 PDF 的文本域、下拉与复选框', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请表.pdf');
      await writeFillablePdf(source);
      const form = await parseFormFile(source);
      const byLabel = new Map(form.fields.map((field) => [field.label, field.id]));

      const result = await fillFormCopy({
        form,
        outputDir: dir,
        values: [
          { id: byLabel.get('applicant_name')!, value: '张三' },
          { id: byLabel.get('gender')!, value: '女' },
          { id: byLabel.get('agree')!, value: '是' }
        ]
      });

      expect(result.filled).toBe(3);

      const doc = await PDFDocument.load(new Uint8Array(await readFile(result.path)));
      const filled = doc.getForm();
      expect(filled.getTextField('applicant_name').getText()).toBe('张三');
      expect(filled.getDropdown('gender').getSelected()).toEqual(['女']);
      expect(filled.getCheckBox('agree').isChecked()).toBe(true);

      const original = await PDFDocument.load(new Uint8Array(await readFile(source)));
      expect(original.getForm().getTextField('applicant_name').getText()).toBeUndefined();
    });
  });

  it('重名时追加时间后缀，未知字段与空值提示跳过', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请表.xlsx');
      await writeXlsxVertical(source);
      const form = await parseFormFile(source);
      const first = form.fields[0];

      const one = await fillFormCopy({
        form,
        outputDir: dir,
        now: new Date(2026, 9, 26, 9, 8, 7),
        values: [{ id: first.id, value: '王五' }]
      });
      const two = await fillFormCopy({
        form,
        outputDir: dir,
        now: new Date(2026, 9, 26, 9, 8, 7),
        values: [{ id: first.id, value: '赵六' }]
      });

      expect(one.name).toBe('申请表-已填写.xlsx');
      expect(two.name).toBe('申请表-已填写-20261026-090807.xlsx');

      const skipped = await fillFormCopy({
        form,
        outputDir: dir,
        values: [
          { id: 'f999', value: '不存在' },
          { id: form.fields[1].id, value: '   ' }
        ]
      });
      expect(skipped.filled).toBe(0);
      expect(skipped.skipped).toHaveLength(2);
      expect(skipped.skipped[0]).toMatch(/不存在|无法识别/);
      expect(skipped.skipped[1]).toMatch(/空白|跳过/);
    });
  });
});
