// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
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
import { describe, expect, it } from 'vitest';
import { editDocxCopy } from '../src/main/ai/document/docxEdit';
import { parseDocumentFile } from '../src/main/ai/document/parse';
import type { DocumentEditOperation } from '../src/main/ai/protocol';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-docx-edit-'));
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
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('一、申请条件')] }),
          new Paragraph({
            children: [
              new TextRun({ text: '2023年', bold: true }),
              new TextRun('申请须知')
            ]
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
  await writeFile(path, await Packer.toBuffer(doc));
};

const readXml = (path: string): string => {
  const zip = new AdmZip(path);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('missing document.xml');
  return zip.readAsText(entry, 'utf8');
};

const readPlainText = (path: string): string => readXml(path).replace(/<[^>]+>/g, '');

const sha256 = async (path: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

const createOptions = async (sourcePath: string, dir: string, operations: DocumentEditOperation[]) => ({
  document: await parseDocumentFile(sourcePath),
  operations,
  outputDir: join(dir, 'out')
});

describe('Word 副本编辑', () => {
  it('全文替换保留原有加粗格式，并生成已修改副本', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);
      const before = await sha256(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [{ op: 'replace_text', find: '2023', replace: '2024' }])
      );

      expect(result.name).toBe('申请须知-已修改.docx');
      expect(result.applied).toBe(1);
      const xml = readXml(result.path);
      expect(xml).toContain('2024');
      expect(xml).not.toContain('2023年');
      expect(xml).toContain('<w:b/>');
      expect(await sha256(source)).toBe(before);
    });
  });

  it('整段改写保留段落样式与首段字体设置', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [
          { op: 'set_paragraph', paragraph: 0, text: '二、新的申请条件' }
        ])
      );

      const xml = readXml(result.path);
      expect(xml).toContain('二、新的申请条件');
      expect(xml).toContain('w:pStyle w:val="Heading1"');
      expect(readPlainText(result.path)).not.toContain('一、申请条件');
    });
  });

  it('指定段落后插入与文末追加不改变原段落编号', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [
          { op: 'insert_paragraph', after: 1, text: '插入的补充说明' },
          { op: 'append_paragraph', text: '文末补充' },
          { op: 'set_paragraph', paragraph: 0, text: '修改后的标题' }
        ])
      );

      const parsed = await parseDocumentFile(result.path);
      expect(parsed.paragraphs?.map((item) => item.text)).toEqual([
        '修改后的标题',
        '2023年申请须知',
        '插入的补充说明',
        '文末补充'
      ]);
      expect(result.applied).toBe(3);
    });
  });

  it('修改表格单元格文字', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [
          { op: 'set_table_cell', table: 0, row: 1, cell: 1, text: '二十岁以上' }
        ])
      );

      expect(readPlainText(result.path)).toContain('二十岁以上');
      expect(readPlainText(result.path)).not.toContain('18 岁');
      expect(result.applied).toBe(1);
    });
  });

  it('全文替换覆盖表格内文字', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [{ op: 'replace_text', find: '年龄', replace: '年岁' }])
      );

      expect(readPlainText(result.path)).toContain('年岁');
      expect(readPlainText(result.path)).not.toContain('年龄');
    });
  });

  it('找不到替换内容时不生成副本', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const error = await editDocxCopy(
        await createOptions(source, dir, [{ op: 'replace_text', find: '不存在的文字', replace: 'x' }])
      ).catch((reason) => reason);

      expect(error).toMatchObject({ code: 'document_no_change' });
      expect(error.message).toContain('未生成副本');
    });
  });

  it('不适用的 Excel 操作会被跳过并给出提示', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      await writeDocx(source);

      const result = await editDocxCopy(
        await createOptions(source, dir, [
          { op: 'set_cell', sheet: '名单', cell: 'B2', value: '90' },
          { op: 'append_paragraph', text: '仍会执行的补充' }
        ])
      );

      expect(result.applied).toBe(1);
      expect(result.skipped.join('')).toContain('Excel');
    });
  });

  it('带段落编号的替换只改目标段落', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
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
      await writeFile(source, await Packer.toBuffer(doc));

      const result = await editDocxCopy(
        await createOptions(source, dir, [
          { op: 'replace_text', find: '2023', replace: '2024', paragraph: 1 }
        ])
      );

      const text = readPlainText(result.path);
      expect(text).toContain('2023 年说明');
      expect(text).toContain('2024 年补充');
      expect(result.applied).toBe(1);
    });
  });
});