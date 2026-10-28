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

  it('Excel 表头不在第一行时按数据区识别，并给出每行的真实行号', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '收支預算表.xlsx');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('收支預算');
      sheet.getCell('A1').value = '附件三　收支預算表';
      sheet.mergeCells('A1:E1');
      sheet.getCell('A2').value = '團體名稱：';
      sheet.getCell('B2').value = 'xxxx';
      sheet.getRow(10).values = ['項目', '預算金額', '實際金額', '備註'];
      sheet.getRow(11).values = ['場地租金', '10000', '', '按實際'];
      sheet.getRow(12).values = ['宣傳費用', '5000', '', ''];
      sheet.getRow(20).values = ['合計', '15000', '', ''];
      await workbook.xlsx.writeFile(path);

      const parsed = await parseDocumentFile(path);
      const first = parsed.sheets?.[0];

      expect(first?.headerRow).toBe(10);
      expect(first?.header).toEqual(['項目', '預算金額', '實際金額', '備註']);
      expect(first?.sampleRowNumbers).toEqual([1, 2, 11, 12, 20]);
      expect(first?.sampleRows?.[0]).toEqual(['附件三　收支預算表']);
      expect(first?.sampleRows?.[2]).toEqual(['場地租金', '10000', '', '按實際']);
    });
  });

  it('Excel 提纲给出真实列字母、并入列与公式列', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '附表.xlsx');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Form');
      sheet.getCell('B12').value = '支出項目';
      sheet.mergeCells('B12:D12');
      sheet.getCell('E12').value = '單價(元)';
      // 鲁港通 - 表头跨行合并（真实範本即如此）不能被误判成并入其他列
      sheet.mergeCells('E12:E14');
      sheet.getCell('F12').value = '數量';
      sheet.getCell('G12').value = '數額(元)';
      sheet.getCell('B16').value = '1. 往返交通費';
      sheet.mergeCells('B16:D16');
      sheet.getCell('E16').value = 30;
      sheet.getCell('F16').value = 2;
      sheet.getCell('G16').value = { formula: 'E16*F16', result: 60 };
      await workbook.xlsx.writeFile(path);

      const parsed = await parseDocumentFile(path);
      const columns = parsed.sheets?.[0]?.columns ?? [];

      expect(parsed.sheets?.[0]?.headerRow).toBe(12);
      expect(columns[1]).toMatchObject({ col: 'B', header: '支出項目' });
      expect(columns[2]).toMatchObject({ col: 'C', mergedTo: 'B' });
      expect(columns[3]).toMatchObject({ col: 'D', mergedTo: 'B' });
      expect(columns[4]).toMatchObject({ col: 'E', header: '單價(元)' });
      expect(columns[4]?.mergedTo).toBeUndefined();
      expect(columns[5]).toMatchObject({ col: 'F', header: '數量' });
      expect(columns[6]).toMatchObject({ col: 'G', header: '數額(元)', formula: true });
      expect(columns[6]?.mergedTo).toBeUndefined();
    });
  });

  it('Excel 表单类工作表补充首列行标签，供模型按行填写', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申請表.xlsx');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Form');
      for (let row = 1; row <= 60; row += 1) {
        sheet.getCell(`A${row}`).value = `欄位${row}`;
        sheet.getCell(`B${row}`).value = row;
      }
      await workbook.xlsx.writeFile(path);

      const parsed = await parseDocumentFile(path);
      const first = parsed.sheets?.[0];

      expect(first?.rowLabels?.[0]).toEqual({ row: 9, text: '欄位9' });
      expect(first?.rowLabels).toHaveLength(40);
      expect(first?.rowLabelsTruncated).toBe(true);
    });
  });

  it('Excel 行数不多时不需要行标签', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '成绩表.xlsx');
      await writeXlsx(path);

      const parsed = await parseDocumentFile(path);

      expect(parsed.sheets?.[0]?.rowLabels).toBeUndefined();
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