// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseDocumentFile, toDocumentSummary } from '../src/main/ai/document/parse';
import { DocumentParseError } from '../src/main/ai/document/types';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-document-'));
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
          new Paragraph({ children: [new TextRun('申请人须年满十八岁。')] }),
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
                  new TableCell({ children: [new Paragraph('18 岁以上')] })
                ]
              })
            ]
          }),
          new Paragraph({ children: [new TextRun('最后一段。')] })
        ]
      }
    ]
  });
  await writeFile(path, await Packer.toBuffer(doc));
};

const writeLongDocx = async (path: string, count: number) => {
  const doc = new Document({
    sections: [
      {
        children: Array.from(
          { length: count },
          (_, index) => new Paragraph({ children: [new TextRun(`第 ${index} 段`)] })
        )
      }
    ]
  });
  await writeFile(path, await Packer.toBuffer(doc));
};

const writeXlsx = async (path: string) => {
  const workbook = new ExcelJS.Workbook();
  const list = workbook.addWorksheet('名单');
  list.addRow(['姓名', '分数']);
  list.addRow(['张三', '90']);
  list.addRow(['李四', '85']);
  const notes = workbook.addWorksheet('说明');
  notes.getCell('A1').value = '本表由助手维护';
  await workbook.xlsx.writeFile(path);
};

const patchZipEntry = async (path: string, entryName: string, content: string) => {
  const zip = new AdmZip(path);
  zip.addFile(entryName, Buffer.from(content, 'utf8'));
  zip.writeZip(path);
};

describe('本机文档提纲解析', () => {
  it('解析 Word 段落编号、标题样式与表格位置', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请须知.docx');
      await writeDocx(path);

      const parsed = await parseDocumentFile(path);

      expect(parsed.format).toBe('docx');
      expect(parsed.name).toBe('申请须知.docx');
      expect(parsed.paragraphs?.map((item) => item.text)).toEqual([
        '一、申请条件',
        '申请人须年满十八岁。',
        '最后一段。'
      ]);
      expect(parsed.paragraphs?.map((item) => item.index)).toEqual([0, 1, 2]);
      expect(parsed.paragraphs?.[0].style).toContain('Heading');
      expect(parsed.tables).toEqual([
        { index: 0, rows: 2, cells: 2, header: ['项目', '要求'] }
      ]);
    });
  });

  it('段落过多时截断提纲并标记', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '长文档.docx');
      await writeLongDocx(path, 305);

      const parsed = await parseDocumentFile(path);

      expect(parsed.paragraphs).toHaveLength(300);
      expect(parsed.paragraphsTruncated).toBe(true);
    });
  });

  it('Word 含批注或修订时给出提醒', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '修订稿.docx');
      await writeDocx(path);
      await patchZipEntry(path, 'word/comments.xml', '<w:comments/>');

      const parsed = await parseDocumentFile(path);

      expect(parsed.warnings?.join('')).toContain('批注');
    });
  });

  it('解析 Excel 工作表、表头与样例行', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '成绩表.xlsx');
      await writeXlsx(path);

      const parsed = await parseDocumentFile(path);

      expect(parsed.format).toBe('xlsx');
      expect(parsed.name).toBe('成绩表.xlsx');
      expect(parsed.sheets).toHaveLength(2);
      expect(parsed.sheets?.[0]).toMatchObject({
        name: '名单',
        rowCount: 3,
        columnCount: 2,
        header: ['姓名', '分数'],
        sampleRows: [
          ['张三', '90'],
          ['李四', '85']
        ]
      });
      expect(parsed.sheets?.[1]).toMatchObject({ name: '说明', rowCount: 1 });
    });
  });

  it('Excel 含图表或数据透视表时给出副本丢失提醒', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '带图表.xlsx');
      await writeXlsx(path);
      await patchZipEntry(path, 'xl/charts/chart1.xml', '<c:chartSpace/>');

      const parsed = await parseDocumentFile(path);

      expect(parsed.warnings?.join('')).toContain('图表');
    });
  });

  it('提纲不携带本机路径', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请须知.docx');
      await writeDocx(path);

      const summary = toDocumentSummary(await parseDocumentFile(path));

      expect(JSON.stringify(summary)).not.toContain(dir);
      expect((summary as { path?: string }).path).toBeUndefined();
      expect(summary.name).toBe(basename(path));
    });
  });

  it('拒绝不支持的格式并给出中文说明', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '旧版.doc');
      await writeFile(path, 'legacy');

      await expect(parseDocumentFile(path)).rejects.toMatchObject({
        code: 'unsupported_format',
        message: expect.stringContaining('.docx')
      });
    });
  });

  it('损坏文件返回可操作的中文错误', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '损坏.docx');
      await writeFile(path, 'not a zip');

      const error = await parseDocumentFile(path).catch((reason) => reason);

      expect(error).toBeInstanceOf(DocumentParseError);
      expect(error.code).toBe('document_parse_failed');
      expect(error.message).toContain('无法读取');
    });
  });
});