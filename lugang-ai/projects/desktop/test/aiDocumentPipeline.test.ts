// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  AiExecutor,
  type AiDocumentConfirmer,
  type AiDocumentConfirmRequest,
  type AiFileInputState,
  type AiPageDriver
} from '../src/main/ai/executor';
import { editDocxCopy } from '../src/main/ai/document/docxEdit';
import { parseDocumentFile } from '../src/main/ai/document/parse';
import { editXlsxCopy } from '../src/main/ai/document/xlsxEdit';
import type { AiPageSnapshot } from '../src/main/ai/snapshot';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-doc-pipeline-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const emptySnapshot: AiPageSnapshot = {
  url: 'about:blank',
  title: '',
  text: '',
  elements: [],
  scroll: { x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, pageHeight: 720 }
};

const emptyFileState: AiFileInputState = { found: false, isFile: false };

const createDriver = (): AiPageDriver => ({
  snapshot: async () => emptySnapshot,
  resolve: async () => null,
  prepareInput: async () => ({ ok: false as const }),
  selectOption: async () => ({ ok: false as const, reason: 'not_found' as const }),
  scroll: async () => ({
    before: emptySnapshot.scroll,
    after: emptySnapshot.scroll,
    changed: false
  }),
  clickAt: async () => undefined,
  insertText: async () => undefined,
  navigate: async () => undefined,
  fileInput: async () => emptyFileState,
  setFileInputFiles: async () => false,
  settle: async () => undefined
});

// 鲁港通 - 与主进程 index.ts 的接线保持一致：真实解析 + 真实副本编辑 + 确认窗
const createPipeline = (
  sourcePath: string,
  outputDir: string,
  decision: 'allow' | 'cancel' = 'allow'
) => {
  const confirmations: AiDocumentConfirmRequest[] = [];
  const confirmer = (async (request: AiDocumentConfirmRequest) => {
    confirmations.push(request);
    return decision;
  }) as AiDocumentConfirmer;
  const executor = new AiExecutor({
    driver: createDriver(),
    openDocument: async () => parseDocumentFile(sourcePath),
    editDocument: async ({ document, operations }) =>
      document.format === 'docx'
        ? editDocxCopy({ document, operations, outputDir })
        : editXlsxCopy({ document, operations, outputDir }),
    confirmDocument: confirmer
  });
  return { executor, confirmations };
};

const writeDocx = async (path: string) => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('一、申请条件')] }),
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
  await writeFile(path, await Packer.toBuffer(doc));
};

const readDocxPlainText = (path: string): string => {
  const zip = new AdmZip(path);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('missing document.xml');
  return zip.readAsText(entry, 'utf8').replace(/<[^>]+>/g, '');
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

const readXlsxCell = async (path: string, sheetName: string, address: string) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return workbook.getWorksheet(sheetName)?.getCell(address).value;
};

const readXlsxRow = async (path: string, sheetName: string, rowIndex: number) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const row = workbook.getWorksheet(sheetName)?.getRow(rowIndex);
  if (!row) return [];
  return Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).value);
};

const listGeneratedFiles = async (outputDir: string): Promise<string[]> => {
  try {
    return await readdir(join(outputDir, '鲁港通生成文件'));
  } catch {
    return [];
  }
};

const sha256 = async (path: string): Promise<string> =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

describe('文档修改全链：真实 Word 文件', () => {
  it('打开提纲 → 确认清单 → 生成副本，原文件一个字节都不变', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      const outputDir = join(dir, 'out');
      await writeDocx(source);
      const before = await sha256(source);
      const { executor, confirmations } = createPipeline(source, outputDir);

      const opened = await executor.execute({ action: 'open_document' });
      expect(opened.ok).toBe(true);
      expect(opened.document).toMatchObject({ format: 'docx', name: '申请须知.docx' });
      expect(opened.document?.paragraphs?.map((item) => item.text)).toEqual([
        '一、申请条件',
        '2023年申请须知'
      ]);
      expect(JSON.stringify(opened)).not.toContain(dir);

      const token = opened.documentToken as string;
      const result = await executor.execute({
        action: 'edit_document',
        token,
        operations: [
          { op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 },
          { op: 'insert_paragraph', after: 1, text: '新增：申请人须年满十八岁。' },
          { op: 'append_paragraph', text: '备注：以上材料均需原件。' },
          { op: 'set_table_cell', table: 0, row: 1, cell: 1, text: '二十岁以上' }
        ]
      });

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0]).toMatchObject({ fileName: '申请须知.docx', format: 'docx', total: 4 });
      expect(confirmations[0].items.map((item) => item.target)).toEqual([
        '第 2 段',
        '第 2 段之后',
        '文末',
        '第 1 张表 第 2 行第 2 格'
      ]);
      expect(JSON.stringify(confirmations[0])).not.toContain(dir);

      expect(result).toMatchObject({
        ok: true,
        file: { name: '申请须知-已修改.docx', format: 'docx', folder: '鲁港通生成文件' },
        edit: { applied: 4 }
      });
      expect(JSON.stringify(result)).not.toContain(dir);

      const copyPath = join(outputDir, '鲁港通生成文件', '申请须知-已修改.docx');
      const reparsed = await parseDocumentFile(copyPath);
      expect(reparsed.paragraphs?.map((item) => item.text)).toEqual([
        '一、申请条件',
        '2024年申请须知',
        '新增：申请人须年满十八岁。',
        '备注：以上材料均需原件。'
      ]);
      const copyText = readDocxPlainText(copyPath);
      expect(copyText).toContain('二十岁以上');
      expect(copyText).not.toContain('18 岁');
      expect(await sha256(source)).toBe(before);
    });
  });

  it('用户取消确认时磁盘上不出现任何副本', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '申请须知.docx');
      const outputDir = join(dir, 'out');
      await writeDocx(source);
      const before = await sha256(source);
      const { executor } = createPipeline(source, outputDir, 'cancel');

      const opened = await executor.execute({ action: 'open_document' });
      const result = await executor.execute({
        action: 'edit_document',
        token: opened.documentToken as string,
        operations: [{ op: 'append_paragraph', text: '备注：以上材料均需原件。' }]
      });

      expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
      expect(await listGeneratedFiles(outputDir)).toEqual([]);
      expect(await sha256(source)).toBe(before);
    });
  });
});

describe('文档修改全链：真实 Excel 文件', () => {
  it('打开提纲 → 确认清单 → 生成副本，原文件一个字节都不变', async () => {
    await withTempDir(async (dir) => {
      const source = join(dir, '成绩表.xlsx');
      const outputDir = join(dir, 'out');
      await writeXlsx(source);
      const before = await sha256(source);
      const { executor, confirmations } = createPipeline(source, outputDir);

      const opened = await executor.execute({ action: 'open_document' });
      expect(opened.ok).toBe(true);
      expect(opened.document?.sheets?.map((sheet) => sheet.name)).toEqual(['名单', '说明']);
      expect(JSON.stringify(opened)).not.toContain(dir);

      const result = await executor.execute({
        action: 'edit_document',
        token: opened.documentToken as string,
        operations: [
          { op: 'set_cell', sheet: '名单', cell: 'B2', value: '95' },
          { op: 'append_row', sheet: '名单', values: ['王五', '88'] },
          { op: 'replace_text', find: '张三参会', replace: '李四参会', sheet: '说明' }
        ]
      });

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0]).toMatchObject({ fileName: '成绩表.xlsx', format: 'xlsx', total: 3 });
      expect(confirmations[0].items.map((item) => item.target)).toEqual([
        '工作表「名单」B2',
        '工作表「名单」末尾',
        '工作表「说明」'
      ]);

      expect(result).toMatchObject({
        ok: true,
        file: { name: '成绩表-已修改.xlsx', format: 'xlsx', folder: '鲁港通生成文件' },
        edit: { applied: 4 }
      });
      expect(JSON.stringify(result)).not.toContain(dir);

      const copyPath = join(outputDir, '鲁港通生成文件', '成绩表-已修改.xlsx');
      expect(await readXlsxCell(copyPath, '名单', 'B2')).toBe(95);
      expect(await readXlsxRow(copyPath, '名单', 4)).toEqual(['王五', 88]);
      expect(await readXlsxCell(copyPath, '说明', 'A2')).toBe('李四参会');
      const reparsed = await parseDocumentFile(copyPath);
      expect(reparsed.sheets?.map((sheet) => sheet.name)).toEqual(['名单', '说明']);
      expect(await sha256(source)).toBe(before);
    });
  });
});