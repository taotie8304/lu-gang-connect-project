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

const writeXlsxMergedNote = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Form');
  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value = '附件三：收支預算表';
  sheet.mergeCells('A2:J2');
  sheet.getCell('A2').value = '備註：請填寫以下各項';
  [
    '團體名稱',
    '交流項目名稱',
    '交流目的地',
    '交流日數',
    '預計合資格香港參加者數目',
    '預計合資格内地參加者數目'
  ].forEach((label, index) => {
    sheet.getCell(`A${index + 4}`).value = label;
  });
  await workbook.xlsx.writeFile(path);
};

const writeXlsxPlaceholders = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('申请表');
  sheet.addRow(['姓名', 'xxxx']);
  sheet.addRow(['電話', 'xx']);
  sheet.addRow(['地址', '']);
  await workbook.xlsx.writeFile(path);
};

const writeXlsxMergedLabel = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('申请表');
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = '總額 (A):';
  sheet.mergeCells('A2:B2');
  sheet.getCell('A4').value = '(12-17歲)';
  sheet.getCell('A5').value = '姓名';
  await workbook.xlsx.writeFile(path);
};

const writeXlsxBudgetLike = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const form = workbook.addWorksheet('Form');
  form.mergeCells('A1:J1');
  form.getCell('A1').value = '附件三：收支預算表';
  form.mergeCells('A2:J2');
  form.getCell('A2').value = '(如多於一個申請，請自行複製)';
  [
    ['B4', 'C4', '團體名稱：'],
    ['B5', 'C5', '交流項目名稱：'],
    ['B6', 'C6', '交流目的地：'],
    ['B7', 'C7', '交流日數：']
  ].forEach(([labelCell, blankCell, label]) => {
    form.getCell(labelCell).value = label;
    form.mergeCells(`${blankCell}:I${labelCell.slice(1)}`);
    form.getCell(blankCell).value = 'xxxx';
  });
  // 鲁港通 - 真实预算表同款：年龄组注释夹在空格之间，后续明细表还有分节标题
  form.getCell('B8').value = '預計合資格香港參加者數目：';
  form.getCell('C8').value = 'xx';
  form.getCell('D8').value = '(12-17歲)';
  form.getCell('E8').value = 'xx';
  form.getCell('F8').value = '(18-35歲)';
  form.getCell('B9').value = '預計合資格内地參加者數目：（如屬雙向交流項目的訪港交流團）';
  form.getCell('C9').value = 'xx';
  form.getCell('D9').value = '(12-17歲)';
  form.getCell('E9').value = 'xx';
  form.getCell('F9').value = '(18-35歲)';

  form.mergeCells('B11:I11');
  form.getCell('B11').value = '交流項目預算支出';
  form.mergeCells('B12:B14');
  form.getCell('B12').value = '支出項目';
  form.mergeCells('E12:E14');
  form.getCell('E12').value = '單價\n(元)';

  form.mergeCells('B61:H61');
  form.getCell('B61').value = '向參加者收取的費用';
  form.getCell('B62').value = '(';
  form.getCell('D62').value = '元';
  form.getCell('E62').value = 'x';
  form.getCell('G62').value = '名參加者';
  form.getCell('H62').value = ')';

  form.mergeCells('B64:H64');
  form.getCell('B64').value = '擬申請的資助額';
  form.getCell('B65').value = '往內地交流團';
  form.getCell('D65').value = '：';
  form.getCell('E65').value = { formula: 'H23' };
  form.mergeCells('B67:H67');
  form.getCell('B67').value = '收入項目';
  form.getCell('I67').value = '數額(元)';
  form.mergeCells('B23:F23');
  form.getCell('B23').value = '總額 (A):';
  form.getCell('G23').value = { formula: 'SUM(G16:G22)' };

  const sample = workbook.addWorksheet('Sample');
  sample.mergeCells('A1:J1');
  sample.getCell('A1').value = '附件三：收支預算表';
  sample.getCell('B4').value = '團體名稱：';
  sample.mergeCells('C4:I4');
  sample.getCell('C4').value = '某某團體';
  sample.getCell('B7').value = '交流日數：';
  sample.getCell('C7').value = '内地團5天，訪港團5天';
  sample.getCell('B65').value = '往內地交流團';
  sample.getCell('D65').value = '：';
  sample.getCell('E65').value = 1000;

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

  it('Excel 合并备注行不当作表头，顶部竖排字段完整识别', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '收支預算表.xlsx');
      await writeXlsxMergedNote(path);

      const parsed = await parseFormFile(path);
      const labels = parsed.fields.map((field) => field.label);

      expect(labels).not.toContain('備註：請填寫以下各項');
      expect(labels).toEqual([
        '團體名稱',
        '交流項目名稱',
        '交流目的地',
        '交流日數',
        '預計合資格香港參加者數目',
        '預計合資格内地參加者數目'
      ]);
    });
  });

  it('Excel 模板占位符（xxxx/xx）视为空白单元格', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请表.xlsx');
      await writeXlsxPlaceholders(path);

      const parsed = await parseFormFile(path);

      expect(parsed.fields.map((field) => field.label)).toEqual(['姓名', '電話', '地址']);
    });
  });

  it('Excel 合并区域从属单元格不生成字段，纯括号标签被忽略', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请表.xlsx');
      await writeXlsxMergedLabel(path);

      const parsed = await parseFormFile(path);

      expect(parsed.fields.map((field) => field.label)).toEqual(['姓名']);
    });
  });

  it('预算表类版式：分节标题与模板碎片不生成字段，示例工作表不参与匹配', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '收支預算表範本.xlsx');
      await writeXlsxBudgetLike(path);

      const parsed = await parseFormFile(path);

      expect(parsed.fields.map((field) => field.label)).toEqual([
        '團體名稱',
        '交流項目名稱',
        '交流目的地',
        '交流日數'
      ]);
      expect(parsed.fields.every((field) => field.locator.type === 'xlsx-cell')).toBe(true);
      expect(parsed.warnings?.join('')).toContain('明细表');
    });
  });

  it('解析可填写 PDF 的文本域、下拉与复选框', async () => {    await withTempDir(async (dir) => {
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
