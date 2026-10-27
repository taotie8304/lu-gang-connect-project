// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: class {
    isDestroyed() {
      return true;
    }
  }
}));

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip') as new (path: string) => {
  getEntry(name: string): { getData(): Buffer } | null;
  getEntries(): { entryName: string }[];
};
const ExcelJS = require('exceljs') as typeof import('exceljs');

const { buildPdfHtml, createFileGenerator } = await import('../src/main/ai/fileGenerator');

let folder = '';

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'lugang-file-generator-'));
});

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

const generate = (input: Parameters<ReturnType<typeof createFileGenerator>>[0]) =>
  createFileGenerator({ downloadsDir: folder })(input);

const xmlOf = async (path: string, entry: string): Promise<string> => {
  const buffer = await readFile(path);
  const archive = new AdmZip(buffer as unknown as string);
  const file = archive.getEntry(entry);
  if (!file) throw new Error(`缺少 ${entry}`);
  return file.getData().toString('utf8');
};

describe('本地生成 Word 文档', () => {
  it('按块结构写出标题、多级标题、列表、表格与分页', async () => {
    const file = await generate({
      format: 'docx',
      fileName: '慈善组织申请说明',
      title: '慈善组织申请说明',
      blocks: [
        { type: 'heading', level: 1, text: '一、申请条件' },
        { type: 'heading', level: 2, text: '（一）主体资格' },
        { type: 'paragraph', text: '申请人须为在香港注册的慈善团体。' },
        { type: 'list', ordered: true, items: ['身份证明', '住址证明'] },
        { type: 'list', items: ['复印件', '原件核对'] },
        { type: 'table', header: ['项目', '要求'], rows: [['年龄', '18 岁以上']] },
        { type: 'divider' },
        { type: 'pageBreak' }
      ]
    });

    expect(file.name).toBe('慈善组织申请说明.docx');
    const document = await xmlOf(file.path, 'word/document.xml');

    expect(document).toContain('一、申请条件');
    expect(document).toContain('（一）主体资格');
    expect(document).toContain('w:val="Heading1"');
    expect(document).toContain('w:val="Heading2"');
    expect(document).toContain('w:numPr');
    expect(document).toContain('<w:tbl>');
    expect(document).toContain('18 岁以上');
    expect(document).toContain('w:pageBreakBefore');
    expect(document).toContain('宋体');
    expect(document).toContain('黑体');
    expect(document).toContain('w:firstLine="420"');
  });

  it('A4 页面、文档标题页眉与「第X页/共Y页」页脚', async () => {
    const file = await generate({
      format: 'docx',
      fileName: '政策说明',
      title: '香港慈善组织申请说明',
      content: '第一段\n第二段'
    });

    const document = await xmlOf(file.path, 'word/document.xml');
    expect(document).toContain('w:w="11906"');
    expect(document).toContain('w:h="16838"');

    const header = await xmlOf(file.path, 'word/header1.xml');
    expect(header).toContain('香港慈善组织申请说明');

    const footer = await xmlOf(file.path, 'word/footer1.xml');
    expect(footer).toContain('PAGE');
    expect(footer).toContain('NUMPAGES');
    expect(footer).toContain('第');
  });

  it('没有标题时不生成页眉，正文按行分段', async () => {
    const file = await generate({
      format: 'docx',
      fileName: '纯文本',
      content: '甲\n乙'
    });

    const document = await xmlOf(file.path, 'word/document.xml');
    expect(document).toContain('甲');
    expect(document).toContain('乙');
    const entries = new AdmZip(await readFile(file.path) as unknown as string)
      .getEntries()
      .map((entry) => entry.entryName);
    expect(entries).not.toContain('word/header1.xml');
  });
});

describe('本地生成 Excel 表格', () => {
  it('写出多工作表：表头加粗冻结、合并单元格、公式与列宽', async () => {
    const file = await generate({
      format: 'xlsx',
      fileName: '成绩汇总',
      sheets: [
        {
          name: '人员名单',
          header: ['姓名', '分数'],
          rows: [
            ['张三', '90'],
            ['李四', '=SUM(B2:B2)']
          ],
          merges: ['A4:B4'],
          widths: [16, 10],
          freeze: true
        },
        { name: '说明', rows: [['本表由助手生成']] }
      ]
    });

    expect(file.name).toBe('成绩汇总.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['人员名单', '说明']);

    const sheet = workbook.getWorksheet('人员名单');
    expect(sheet?.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet?.getCell('A1').font).toMatchObject({ bold: true });
    expect(sheet?.getCell('A1').fill).toMatchObject({ fgColor: { argb: 'FFF2F2F2' } });
    expect(sheet?.getCell('B3').value).toEqual({ formula: 'SUM(B2:B2)' });
    expect(sheet?.getCell('A4').isMerged).toBe(true);
    expect(sheet?.getCell('B4').isMerged).toBe(true);
    expect(sheet?.getColumn(1).width).toBe(16);
    expect(sheet?.getColumn(2).width).toBe(10);

    expect(workbook.getWorksheet('说明')?.getCell('A1').value).toBe('本表由助手生成');
  });

  it('危险公式退化为文本，重名工作表自动加序号', async () => {
    const file = await generate({
      format: 'xlsx',
      fileName: '安全核对',
      sheets: [
        {
          name: '名单',
          header: ['姓名', '备注'],
          rows: [
            ['甲', '=WEBSERVICE("http://evil.example")'],
            ['乙', '=B2&"人"']
          ]
        },
        { name: '名单', rows: [['重复名']] }
      ]
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['名单', '名单(2)']);

    const sheet = workbook.getWorksheet('名单');
    expect(sheet?.getCell('B2').value).toBe('=WEBSERVICE("http://evil.example")');
    expect(sheet?.getCell('B3').value).toEqual({ formula: 'B2&"人"' });
  });

  it('旧版内容仍可写成单表：标题行加粗并自动列宽', async () => {
    const file = await generate({
      format: 'xlsx',
      fileName: '旧版表格',
      title: '人员名单',
      rows: [
        ['姓名', '分数'],
        ['张三', '90']
      ]
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('人员名单');
    expect(sheet.getCell('A1').value).toBe('人员名单');
    expect(sheet.getCell('A1').font).toMatchObject({ bold: true, size: 14 });
    expect(sheet.getCell('A3').value).toBe('姓名');
    expect(sheet.getColumn(1).width).toBeGreaterThanOrEqual(10);
  });
});

describe('本地生成 PDF', () => {
  it('把块结构渲染为带样式的 HTML', () => {
    const html = buildPdfHtml({
      format: 'pdf',
      fileName: '说明',
      title: '申请说明',
      blocks: [
        { type: 'heading', level: 1, text: '一、条件' },
        { type: 'paragraph', text: '须年满十八岁' },
        { type: 'list', ordered: true, items: ['身份证', '住址证明'] },
        { type: 'table', header: ['项目', '要求'], rows: [['年龄', '18 岁以上']] },
        { type: 'divider' },
        { type: 'pageBreak' }
      ]
    });

    expect(html).toContain('<h1 class="doc-title">申请说明</h1>');
    expect(html).toContain('<h2>一、条件</h2>');
    expect(html).toContain('<p>须年满十八岁</p>');
    expect(html).toContain('<ol><li>身份证</li><li>住址证明</li></ol>');
    expect(html).toContain('<thead><tr><th>项目</th><th>要求</th></tr></thead>');
    expect(html).toContain('<td>18 岁以上</td>');
    expect(html).toContain('<hr>');
    expect(html).toContain('class="page-break"');
    expect(html).toContain('SimSun');
  });

  it('转义网页内容，避免 HTML 注入', () => {
    const html = buildPdfHtml({
      format: 'pdf',
      fileName: '转义',
      content: '<script>alert(1)</script> & "引号"'
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp;');
  });

  it('旧版内容按行渲染，表格追加在正文之后', () => {
    const html = buildPdfHtml({
      format: 'pdf',
      fileName: '旧版',
      content: '第一行\n第二行',
      rows: [['姓名', '分数']]
    });

    expect(html).toContain('<p>第一行</p>');
    expect(html).toContain('<p>第二行</p>');
    expect(html).toContain('<td>姓名</td>');
  });
});
