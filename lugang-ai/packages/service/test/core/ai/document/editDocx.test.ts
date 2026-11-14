// @vitest-environment node
// 鲁港通 - Word 编辑：跨 run 替换保留样式、段落与表格可定位、非目标部件不被改写
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun
} from 'docx';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import { describe, expect, it } from 'vitest';

import { editDocx } from '@fastgpt/service/core/ai/document/edit/docx';
import { DocumentEditError } from '@fastgpt/service/core/ai/document/types';
import type { DocumentEditOperation } from '@fastgpt/service/core/ai/llm/agentLoop/domain/systemTool/document/schema';

const buildSource = async (): Promise<Buffer> => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun('一、申请条件')]
          }),
          new Paragraph({
            children: [new TextRun({ text: '2023年', bold: true }), new TextRun('申请须知')]
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('项目')] }),
                  new TableCell({ children: [new Paragraph('要求')] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('年龄')] }),
                  new TableCell({ children: [new Paragraph('18 岁')] })
                ]
              })
            ]
          })
        ]
      }
    ]
  });
  const base = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(base);
  zip.file('custom/marker.bin', Buffer.from([0, 1, 2, 3, 250]));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const readEntry = async (buffer: Buffer, name: string): Promise<Buffer> => {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file(name);
  if (!entry) throw new Error(`missing ${name}`);
  return entry.async('nodebuffer');
};

const readDocumentXml = async (buffer: Buffer): Promise<string> =>
  (await readEntry(buffer, 'word/document.xml')).toString('utf8');

const readRawText = async (buffer: Buffer): Promise<string> =>
  (await mammoth.extractRawText({ buffer })).value;

const runEdit = async (operations: DocumentEditOperation[]) =>
  editDocx({ buffer: await buildSource(), operations });

const replaceText: DocumentEditOperation = {
  op: 'replace_text',
  find: '2023年申请须知',
  replace: '2024年办事须知'
};

const buildTwoParagraphSource = async (): Promise<Buffer> => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun('2023 年说明')] }),
          new Paragraph({ children: [new TextRun('2023 年补充')] })
        ]
      }
    ]
  });
  return Packer.toBuffer(doc);
};

describe('editDocx', () => {
  it('跨 run 全文替换只写入首个命中 run，其余清空且保留加粗样式', async () => {
    const result = await runEdit([replaceText]);

    expect(result.applied).toBe(1);
    const xml = await readDocumentXml(result.buffer);
    expect(xml).toContain('2024年办事须知');
    expect(xml).not.toContain('2023年');
    expect(xml).toMatch(/<w:b[ />]/);
    expect(await readRawText(result.buffer)).toContain('2024年办事须知');
  });

  it('带段落编号的替换只改目标段落', async () => {
    const source = await buildTwoParagraphSource();
    const result = await editDocx({
      buffer: source,
      operations: [{ op: 'replace_text', find: '2023', replace: '2024', paragraph: 1 }]
    });

    const text = await readRawText(result.buffer);
    expect(text).toContain('2023 年说明');
    expect(text).toContain('2024 年补充');
    expect(result.applied).toBe(1);
  });

  it('整段改写保留段落样式', async () => {
    const result = await runEdit([{ op: 'set_paragraph', paragraph: 0, text: '二、新的申请条件' }]);

    const xml = await readDocumentXml(result.buffer);
    expect(xml).toContain('二、新的申请条件');
    expect(xml).toMatch(/w:pStyle w:val="Heading1"/);
    const text = await readRawText(result.buffer);
    expect(text).not.toContain('一、申请条件');
    expect(result.applied).toBe(1);
  });

  it('指定段落后插入与文末追加不改变原段落编号', async () => {
    const result = await runEdit([
      { op: 'insert_paragraph', after: 1, text: '插入的补充说明' },
      { op: 'append_paragraph', text: '文末补充' },
      { op: 'set_paragraph', paragraph: 0, text: '修改后的标题' }
    ]);

    const text = await readRawText(result.buffer);
    expect(text.indexOf('修改后的标题')).toBeLessThan(text.indexOf('2023年申请须知'));
    expect(text.indexOf('2023年申请须知')).toBeLessThan(text.indexOf('插入的补充说明'));
    expect(text.indexOf('插入的补充说明')).toBeLessThan(text.indexOf('文末补充'));
    expect(result.applied).toBe(3);
  });

  it('表格单元格按表格、行、列定位改写', async () => {
    const result = await runEdit([
      { op: 'set_table_cell', table: 0, row: 1, cell: 1, text: '二十岁以上' }
    ]);

    const text = await readRawText(result.buffer);
    expect(text).toContain('二十岁以上');
    expect(text).not.toContain('18 岁');
    expect(result.applied).toBe(1);
  });

  it('全文替换覆盖表格内的文字', async () => {
    const result = await runEdit([{ op: 'replace_text', find: '年龄', replace: '年岁' }]);

    const text = await readRawText(result.buffer);
    expect(text).toContain('年岁');
    expect(text).not.toContain('年龄');
  });

  it('其它 zip 部件内容保持不变，只改 word/document.xml', async () => {
    const source = await buildSource();
    const result = await editDocx({ buffer: source, operations: [replaceText] });

    const sourceZip = await JSZip.loadAsync(source);
    const resultZip = await JSZip.loadAsync(result.buffer);
    for (const name of Object.keys(sourceZip.files)) {
      if (name === 'word/document.xml' || sourceZip.files[name].dir) continue;
      const before = await sourceZip.files[name].async('nodebuffer');
      const after = resultZip.file(name);
      expect(after, name).toBeTruthy();
      expect(Buffer.compare(before, await after!.async('nodebuffer'))).toBe(0);
    }
  });

  it('未命中任何内容时不生成新文件并说明原因', async () => {
    const error = await runEdit([
      { op: 'replace_text', find: '不存在的文字', replace: 'x' }
    ]).catch((reason) => reason);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect(error.message).toContain('没有找到');
    expect(error.message).toContain('未生成新文件');
    expect(error.message).toContain('不存在的文字');
  });

  it('Excel 与 PDF 专属操作被跳过并说明', async () => {
    const result = await runEdit([
      { op: 'set_cell', sheet: '名单', cell: 'B2', value: '90' },
      { op: 'add_text', label: '申请人：', value: '张三' },
      { op: 'append_paragraph', text: '仍会执行的补充' }
    ]);

    expect(result.applied).toBe(1);
    const skipped = result.skipped.join('');
    expect(skipped).toContain('Excel');
    expect(skipped).toContain('PDF');
  });
});
