import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { generateDocx } from '@fastgpt/service/core/ai/document/generate/docx';
import { generateXlsx } from '@fastgpt/service/core/ai/document/generate/xlsx';
import { generateMarkdown } from '@fastgpt/service/core/ai/document/generate/markdown';
import { DocumentGenerationError } from '@fastgpt/service/core/ai/document/types';

describe('Word 生成器', () => {
  it('生成可解析的 docx，包含标题、段落、列表与表格', async () => {
    const buffer = await generateDocx({
      format: 'docx',
      fileName: '年度工作计划',
      title: '年度工作计划',
      blocks: [
        { type: 'heading', level: 2, text: '总体目标' },
        { type: 'paragraph', text: '提升办事效率。' },
        { type: 'list', ordered: true, items: ['完成调研', '形成方案'] },
        { type: 'list', items: ['甲项', '乙项'] },
        { type: 'table', header: ['事项', '负责人'], rows: [['调研', '张三']] },
        { type: 'divider' },
        { type: 'pageBreak' }
      ]
    });

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('年度工作计划');
    expect(documentXml).toContain('总体目标');
    expect(documentXml).toContain('提升办事效率。');
    expect(documentXml).toContain('完成调研');
    expect(documentXml).toContain('甲项');
    expect(documentXml).toContain('张三');
    expect(documentXml).toContain('11906');
    expect(documentXml).toContain('pageBreakBefore');

    const fileNames = Object.keys(zip.files);
    expect(fileNames.some((name) => /^word\/header\d+\.xml$/.test(name))).toBe(true);
    expect(fileNames.some((name) => /^word\/footer\d+\.xml$/.test(name))).toBe(true);
  });

  it('没有 blocks 时按行渲染 content', async () => {
    const buffer = await generateDocx({
      format: 'docx',
      fileName: '说明',
      content: '第一行\n第二行'
    });
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    expect(documentXml).toContain('第一行');
    expect(documentXml).toContain('第二行');
  });

  it('超限或空内容返回可操作错误', async () => {
    await expect(
      generateDocx({
        format: 'docx',
        fileName: 'x',
        blocks: Array.from({ length: 121 }, () => ({ type: 'paragraph', text: 'x' }))
      })
    ).rejects.toBeInstanceOf(DocumentGenerationError);
    await expect(
      generateDocx({
        format: 'docx',
        fileName: 'x',
        blocks: Array.from({ length: 121 }, () => ({ type: 'paragraph', text: 'x' }))
      })
    ).rejects.toThrow('120');
    await expect(
      generateDocx({ format: 'docx', fileName: 'x', content: 'a'.repeat(12001) })
    ).rejects.toThrow('12000');
    await expect(generateDocx({ format: 'docx', fileName: 'x' })).rejects.toThrow(
      DocumentGenerationError
    );
  });
});

describe('Excel 生成器', () => {
  const buildWorkbook = async () => {
    const buffer = await generateXlsx({
      format: 'xlsx',
      fileName: '人员名单',
      sheets: [
        {
          name: '人员名单',
          header: ['姓名', '分数', '备注'],
          rows: [
            ['张三', '90', ''],
            ['李四', '=SUM(B2:B2)', '=WEBSERVICE("http://x")'],
            ['合计', '', '']
          ],
          merges: ['A4:B4'],
          widths: [12, 10],
          freeze: true
        },
        { name: '人员名单', rows: [['重复表名']] }
      ]
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  };

  it('工作表数、表头、合并、冻结与列宽正确', async () => {
    const workbook = await buildWorkbook();
    expect(workbook.worksheets).toHaveLength(2);
    const sheet = workbook.worksheets[0];
    expect(sheet.name).toBe('人员名单');
    expect(sheet.getCell('A1').value).toBe('姓名');
    expect(sheet.getCell('B1').value).toBe('分数');
    expect(sheet.model.merges).toContain('A4:B4');
    expect(sheet.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.getColumn(1).width).toBe(12);
    expect(sheet.getColumn(2).width).toBe(10);
    expect(workbook.worksheets[1].name).toBe('人员名单(2)');
  });

  it('安全公式保留为公式，危险公式按文本写入', async () => {
    const workbook = await buildWorkbook();
    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('B3').formula).toBe('SUM(B2:B2)');
    expect(sheet.getCell('C3').formula).toBeUndefined();
    expect(sheet.getCell('C3').value).toBe('=WEBSERVICE("http://x")');
  });

  it('清洗非法工作表名并截断到 31 字', async () => {
    const buffer = await generateXlsx({
      format: 'xlsx',
      fileName: '清洗',
      sheets: [
        { name: 'a/b:c*?[]', header: ['x'], rows: [['1']] },
        { name: '名'.repeat(40), rows: [['2']] },
        { rows: [['3']] }
      ]
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets[0].name).toBe('a b c');
    expect(workbook.worksheets[1].name).toHaveLength(31);
    expect(workbook.worksheets[2].name).toBe('Sheet3');
  });

  it('超出工作表上限返回可操作错误', async () => {
    await expect(
      generateXlsx({
        format: 'xlsx',
        fileName: 'x',
        sheets: Array.from({ length: 6 }, (_, index) => ({
          name: `表${index + 1}`,
          rows: [['x']]
        }))
      })
    ).rejects.toThrow('5');
  });
});

describe('Markdown 生成器', () => {
  it('按块序列化为 GFM 文本', () => {
    const markdown = generateMarkdown({
      format: 'md',
      fileName: '项目说明',
      title: '项目说明',
      blocks: [
        { type: 'heading', level: 1, text: '总览' },
        { type: 'heading', level: 2, text: '目标' },
        { type: 'paragraph', text: '第一段。' },
        { type: 'list', items: ['甲', '乙'] },
        { type: 'list', ordered: true, items: ['一', '二'] },
        { type: 'table', header: ['列1', '列2'], rows: [['a', 'b']] },
        { type: 'divider' },
        { type: 'pageBreak' }
      ]
    }).toString('utf8');

    expect(markdown).toBe(
      [
        '# 项目说明',
        '',
        '# 总览',
        '',
        '## 目标',
        '',
        '第一段。',
        '',
        '- 甲',
        '- 乙',
        '',
        '1. 一',
        '2. 二',
        '',
        '| 列1 | 列2 |',
        '| --- | --- |',
        '| a | b |',
        '',
        '---',
        '',
        '<!-- pagebreak -->',
        ''
      ].join('\n')
    );
  });

  it('只有 content 时原样输出', () => {
    const markdown = generateMarkdown({
      format: 'md',
      fileName: '原文',
      content: '# 原文\n\n保留内容'
    }).toString('utf8');
    expect(markdown).toBe('# 原文\n\n保留内容\n');
  });

  it('超限或空内容返回可操作错误', () => {
    expect(() =>
      generateMarkdown({ format: 'md', fileName: 'x', content: 'a'.repeat(12001) })
    ).toThrow(DocumentGenerationError);
    expect(() => generateMarkdown({ format: 'md', fileName: 'x' })).toThrow(
      DocumentGenerationError
    );
  });
});
