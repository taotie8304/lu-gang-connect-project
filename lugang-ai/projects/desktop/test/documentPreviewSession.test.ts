// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow } from 'docx';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditedDocumentCopy } from '../src/main/ai/document/editTypes';
import type { ParsedDocument } from '../src/main/ai/document/types';
import {
  DEFAULT_CLAIM_TIMEOUT_MS,
  DocumentPreviewManager,
  type LocalPreviewInput,
  type PreviewEditor,
  type PreviewPdfWriter
} from '../src/main/ai/documentPreview';
import type { DocumentEditOperation } from '../src/main/ai/protocol';
import type { DesktopDocumentSummary } from '../src/shared/ipc';

const tempDirs: string[] = [];

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-doc-session-'));
  tempDirs.push(dir);
  return run(dir);
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

const buildDocx = async (dir: string): Promise<string> => {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: '一、申请资格', heading: HeadingLevel.HEADING_1 }),
          new Paragraph('申请人须年满十八岁。'),
          new Paragraph('预算：100 万元。'),
          new Table({
            rows: [
              new TableRow({
                children: [new TableCell({ children: [new Paragraph('姓名')] })]
              })
            ]
          })
        ]
      }
    ]
  });
  const path = join(dir, '申请说明.docx');
  await writeFile(path, await Packer.toBuffer(doc));
  return path;
};

const buildXlsx = async (dir: string): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('预算表');
  sheet.addRow(['项目', '金额']);
  sheet.addRow(['预算', '100']);
  const path = join(dir, '预算表.xlsx');
  await workbook.xlsx.writeFile(path);
  return path;
};

const xlsxDocument = (path: string): ParsedDocument => ({
  format: 'xlsx',
  name: '预算表.xlsx',
  path,
  warnings: []
});

const operations: DocumentEditOperation[] = [
  { op: 'replace_text', paragraph: 2, find: '100 万元', replace: '120 万元' },
  { op: 'set_paragraph', paragraph: 1, text: '申请人须年满二十岁。' }
];

const createEditor = (): PreviewEditor =>
  vi.fn(async ({ operations: applied }) => ({
    name: '申请说明-已修改.docx',
    format: 'docx' as const,
    folder: '鲁港通生成文件',
    path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请说明-已修改.docx',
    applied: applied.length,
    skipped: [],
    warnings: []
  }));

const createManager = async (
  dir: string,
  options: {
    editor?: PreviewEditor;
    writePdf?: PreviewPdfWriter;
    openLocal?: () => Promise<LocalPreviewInput | null>;
    openCopy?: (path: string) => void | Promise<void>;
    timeoutMs?: number;
    claimTimeoutMs?: number;
    maxSessions?: number;
    maxReadBytes?: number;
  } = {}
) => {
  const path = await buildDocx(dir);
  const document: ParsedDocument = {
    format: 'docx',
    name: '申请说明.docx',
    path,
    warnings: []
  };
  const emitted: DesktopDocumentSummary[][] = [];
  const manager = new DocumentPreviewManager({
    editDocument: options.editor ?? createEditor(),
    ...(options.writePdf ? { writePdf: options.writePdf } : {}),
    ...(options.openLocal ? { openLocal: options.openLocal } : {}),
    ...(options.openCopy ? { openCopy: options.openCopy } : {}),
    emit: (list) => emitted.push(list),
    timeoutMs: options.timeoutMs ?? 2000,
    ...(options.claimTimeoutMs !== undefined ? { claimTimeoutMs: options.claimTimeoutMs } : {}),
    ...(options.maxSessions !== undefined ? { maxSessions: options.maxSessions } : {}),
    ...(options.maxReadBytes !== undefined ? { maxReadBytes: options.maxReadBytes } : {})
  });
  return { manager, document, emitted };
};

const waitForChanges = async (manager: DocumentPreviewManager, token: string, count: number) => {
  await vi.waitFor(() => {
    expect(manager.get(token)?.changes).toHaveLength(count);
  });
};

describe('预览会话：认领与逐条处理', () => {
  it('认领窗口默认给右栏 15 秒，不再按 2 秒仓促放弃', () => {
    expect(DEFAULT_CLAIM_TIMEOUT_MS).toBe(15000);
  });

  it('未在认领时限内认领时返回 unavailable 且不生成副本', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor, claimTimeoutMs: 20 });

      const outcome = await manager.preview({ document, operations });

      expect(outcome).toEqual({ status: 'unavailable' });
      expect(editor).not.toHaveBeenCalled();
      expect(manager.list()).toHaveLength(0);
    });
  });

  it('认领后逐条跳过与采用会即时更新预览块', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir);
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token;
      expect(token).toBeTruthy();

      await waitForChanges(manager, token as string, 2);
      expect(manager.claim(token as string)).toMatchObject({ state: 'reviewing' });

      const skipped = manager.decide(token as string, 0, 'skip');
      expect(skipped?.changes[0].status).toBe('skipped');
      expect(skipped?.blocks[2]).toMatchObject({ text: '预算：100 万元。' });
      expect(skipped?.changes[1].status).toBe('pending');

      const applied = manager.decide(token as string, 1, 'apply');
      expect(applied?.changes[1].status).toBe('applied');
      expect(applied?.blocks[1]).toMatchObject({
        text: '申请人须年满二十岁。',
        mark: 'applied'
      });

      await expect(promise).resolves.toMatchObject({ status: 'done' });
    });
  });

  it('只允许按顺序处理当前条目', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir);
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      const rejected = manager.decide(token, 1, 'apply');
      expect(rejected?.changes[1].status).toBe('pending');
      expect(rejected?.changes[0].status).toBe('pending');

      manager.decide(token, 0, 'skip');
      manager.decide(token, 1, 'skip');
      await expect(promise).resolves.toEqual({ status: 'no_change' });
    });
  });

  it('全部采用后只把已采用项交给编辑器并返回副本信息', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.decide(token, 0, 'apply');
      const snapshot = manager.decide(token, 1, 'apply');
      expect(snapshot).toMatchObject({ state: 'finalizing' });

      const outcome = await promise;
      expect(outcome).toMatchObject({
        status: 'done',
        copy: { name: '申请说明-已修改.docx', folder: '鲁港通生成文件' }
      });
      expect(editor).toHaveBeenCalledTimes(1);
      const input = (editor as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        operations: DocumentEditOperation[];
      };
      expect(input.operations).toEqual(operations);
      expect(manager.get(token)).toMatchObject({
        state: 'done',
        copy: { name: '申请说明-已修改.docx', folder: '鲁港通生成文件' }
      });
      expect(JSON.stringify(manager.get(token))).not.toContain('C:\\\\Users');
    });
  });

  it('部分采用时编辑器只收到采用的条目', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.decide(token, 0, 'skip');
      manager.decide(token, 1, 'apply');
      await expect(promise).resolves.toMatchObject({ status: 'done' });

      const input = (editor as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        operations: DocumentEditOperation[];
      };
      expect(input.operations).toEqual([operations[1]]);
    });
  });

  it('全部跳过时不生成副本', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.decide(token, 0, 'skip');
      manager.decide(token, 1, 'skip');
      await expect(promise).resolves.toEqual({ status: 'no_change' });
      expect(editor).not.toHaveBeenCalled();
    });
  });
});

describe('预览会话：全部应用、取消与超时', () => {
  it('全部应用把剩余条目一次采用并收尾', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      const snapshot = manager.applyAll(token);
      expect(snapshot?.changes.map((change) => change.status)).toEqual(['applied', 'applied']);

      await expect(promise).resolves.toMatchObject({ status: 'done' });
      expect(editor).toHaveBeenCalledTimes(1);
    });
  });

  it('关闭标签视为放弃，不生成副本', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.close(token);

      await expect(promise).resolves.toEqual({ status: 'declined' });
      expect(editor).not.toHaveBeenCalled();
      expect(manager.list()).toHaveLength(0);
    });
  });

  it('AI 停止时取消未完成会话', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.cancelAll();

      await expect(promise).resolves.toEqual({ status: 'declined' });
      expect(editor).not.toHaveBeenCalled();
    });
  });

  it('审查超时后自动取消且不落盘', async () => {
    await withTempDir(async (dir) => {
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor, timeoutMs: 30 });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      await expect(promise).resolves.toEqual({ status: 'timeout' });
      expect(editor).not.toHaveBeenCalled();
    });
  });

  it('副本生成失败时返回可读说明', async () => {
    await withTempDir(async (dir) => {
      const editor = vi.fn(async () => {
        throw new Error('disk full');
      }) as PreviewEditor;
      const { manager, document } = await createManager(dir, { editor });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      manager.applyAll(token);

      await expect(promise).resolves.toMatchObject({
        status: 'failed',
        message: expect.stringContaining('原文件不受影响')
      });
    });
  });

  it('会话超过上限时淘汰最早的一个', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir, { maxSessions: 2 });
      const first = manager.preview({ document, operations });
      const second = manager.preview({ document, operations });
      const third = manager.preview({ document, operations });

      await expect(first).resolves.toEqual({ status: 'declined' });
      expect(manager.list().length).toBeLessThanOrEqual(2);
      manager.cancelAll();
      await expect(second).resolves.toEqual({ status: 'declined' });
      await expect(third).resolves.toEqual({ status: 'declined' });
    });
  });
});

describe('预览会话：手动打开本地文件', () => {
  it('打开 Word 时返回只读预览会话', async () => {
    await withTempDir(async (dir) => {
      const path = await buildDocx(dir);
      const { manager, document } = await createManager(dir, {
        openLocal: async () => ({ format: 'docx', document })
      });

      const snapshot = await manager.openLocal();

      expect(snapshot).toMatchObject({
        mode: 'view',
        format: 'docx',
        fileName: '申请说明.docx',
        state: 'viewing'
      });
      expect(snapshot?.blocks).toHaveLength(4);
      expect(snapshot?.changes).toEqual([]);
      expect(JSON.stringify(snapshot)).not.toContain(path);
      expect(manager.list()).toHaveLength(1);
    });
  });

  it('打开 Excel 时返回工作表网格预览', async () => {
    await withTempDir(async (dir) => {
      const path = await buildXlsx(dir);
      const { manager } = await createManager(dir, {
        openLocal: async () => ({ format: 'xlsx', document: xlsxDocument(path) })
      });

      const snapshot = await manager.openLocal();

      expect(snapshot).toMatchObject({ format: 'xlsx', state: 'viewing' });
      expect(snapshot?.sheets?.[0]).toMatchObject({
        name: '预算表',
        rowCount: 2,
        columnCount: 2,
        rows: [
          ['项目', '金额'],
          ['预算', '100']
        ]
      });
      expect(snapshot?.blocks).toEqual([]);
      expect(JSON.stringify(snapshot)).not.toContain(path);
    });
  });

  it('Excel 文件无法读取时给出可操作说明', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '损坏.xlsx');
      await writeFile(path, 'not an xlsx');
      const { manager } = await createManager(dir, {
        openLocal: async () => ({ format: 'xlsx', document: xlsxDocument(path) })
      });

      const snapshot = await manager.openLocal();

      expect(snapshot).toMatchObject({ format: 'xlsx', state: 'failed' });
      expect(snapshot?.message).toContain('另存为 .xlsx');
    });
  });

  it('打开 PDF 时只返回查看会话', async () => {
    await withTempDir(async (dir) => {
      const { manager } = await createManager(dir, {
        openLocal: async () => ({
          format: 'pdf',
          name: '申请须知.pdf',
          path: join(dir, '申请须知.pdf')
        })
      });

      const pdf = await manager.openLocal();
      expect(pdf).toMatchObject({ format: 'pdf', fileName: '申请须知.pdf', state: 'viewing' });
      expect(pdf?.blocks).toEqual([]);
    });
  });

  it('Excel 审阅按条目更新网格并在全部采用后生成副本', async () => {
    await withTempDir(async (dir) => {
      const path = await buildXlsx(dir);
      const editor = vi.fn(async ({ operations: applied }) => ({
        name: '预算表-已修改.xlsx',
        format: 'xlsx' as const,
        folder: '鲁港通生成文件',
        path: join(dir, '预算表-已修改.xlsx'),
        applied: applied.length,
        skipped: [],
        warnings: []
      }));
      const { manager } = await createManager(dir, { editor });
      const xlsxOperations: DocumentEditOperation[] = [
        { op: 'set_cell', sheet: '预算表', cell: 'B2', value: '120' },
        { op: 'append_row', sheet: '预算表', values: ['材料费', '30'] }
      ];
      const promise = manager.preview({
        document: xlsxDocument(path),
        operations: xlsxOperations
      });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);

      const applied = manager.decide(token, 0, 'apply');
      expect(applied?.sheets?.[0].rows?.[1]).toEqual(['预算', '120']);
      expect(applied?.sheets?.[0].cellMarks).toEqual([
        { row: 1, cell: 1, mark: 'applied', original: '100' }
      ]);
      expect(applied?.sheets?.[0].appendedRows?.[0]).toMatchObject({
        rowNumber: 3,
        values: ['材料费', '30'],
        mark: 'pending'
      });

      manager.applyAll(token);
      await expect(promise).resolves.toMatchObject({ status: 'done' });
      expect(editor).toHaveBeenCalledTimes(1);
      const input = (editor as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        operations: DocumentEditOperation[];
      };
      expect(input.operations).toEqual(xlsxOperations);
    });
  });

  it('取消选择文件时不创建会话', async () => {
    await withTempDir(async (dir) => {
      const { manager } = await createManager(dir, { openLocal: async () => null });
      expect(await manager.openLocal()).toBeNull();
      expect(manager.list()).toHaveLength(0);
    });
  });

  it('打开副本走主进程外部打开通道', async () => {
    await withTempDir(async (dir) => {
      const openCopy = vi.fn();
      const editor = createEditor();
      const { manager, document } = await createManager(dir, { editor, openCopy });
      const promise = manager.preview({ document, operations });
      const token = manager.list()[0]?.token as string;
      await waitForChanges(manager, token, 2);
      manager.claim(token);
      manager.applyAll(token);
      await promise;

      expect(manager.openCopy(token)).toBe(true);
      expect(openCopy).toHaveBeenCalledWith(
        'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请说明-已修改.docx'
      );
    });
  });
});

describe('预览会话：右栏活动文件', () => {
  it('活动 Word 文件返回可继续修改的文档内容', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir, {
        openLocal: async () => ({ format: 'docx', document })
      });
      const snapshot = await manager.openLocal();
      manager.setActive(snapshot?.token as string);

      const active = manager.readActiveDocument();

      expect(active).toMatchObject({ format: 'docx', fileName: '申请说明.docx' });
      expect(active && 'document' in active ? active.document.name : '').toBe('申请说明.docx');
    });
  });

  it('活动 Excel 文件返回工作簿结构', async () => {
    await withTempDir(async (dir) => {
      const path = await buildXlsx(dir);
      const { manager } = await createManager(dir, {
        openLocal: async () => ({ format: 'xlsx', document: xlsxDocument(path) })
      });
      const snapshot = await manager.openLocal();
      manager.setActive(snapshot?.token as string);

      const active = manager.readActiveDocument();

      expect(active).toMatchObject({ format: 'xlsx', fileName: '预算表.xlsx' });
      expect(active && 'document' in active ? active.document.format : '').toBe('xlsx');
    });
  });

  it('活动 PDF 返回名称、只读格式与主进程内部路径，渲染层快照不含路径', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请须知.pdf');
      await writeFile(path, 'PDF-BYTES');
      const { manager } = await createManager(dir, {
        openLocal: async () => ({ format: 'pdf', name: '申请须知.pdf', path })
      });
      const snapshot = await manager.openLocal();
      manager.setActive(snapshot?.token as string);

      const active = manager.readActiveDocument();

      // 鲁港通 - 路径只在主进程内用于「按右栏文件读取可填写表单」，不进渲染层
      expect(active).toEqual({ format: 'pdf', fileName: '申请须知.pdf', path });
      expect(JSON.stringify(snapshot)).not.toContain(dir);
      expect(JSON.stringify(manager.list())).not.toContain(dir);
    });
  });

  it('未激活或激活审阅会话时不返回文件', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir);
      expect(manager.readActiveDocument()).toBeUndefined();

      const promise = manager.preview({ document, operations });
      const reviewToken = manager.list()[0]?.token as string;
      await waitForChanges(manager, reviewToken, 2);
      manager.setActive(reviewToken);

      expect(manager.readActiveDocument()).toBeUndefined();

      manager.cancelAll();
      await promise;
    });
  });

  it('活动文件关闭或清空激活后不再返回', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir, {
        openLocal: async () => ({ format: 'docx', document })
      });
      const snapshot = await manager.openLocal();
      manager.setActive(snapshot?.token as string);
      expect(manager.readActiveDocument()).toBeTruthy();

      manager.close(snapshot?.token as string);
      expect(manager.readActiveDocument()).toBeUndefined();

      manager.setActive(snapshot?.token as string);
      manager.setActive(null);
      expect(manager.readActiveDocument()).toBeUndefined();
    });
  });
});

describe('预览会话：PDF 字节读取与系统打开', () => {
  const openPdf = (path: string, name = '申请须知.pdf') =>
    (async () => ({ format: 'pdf' as const, name, path }));

  it('PDF 查看会话按令牌返回字节且不含本机路径', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请须知.pdf');
      await writeFile(path, 'PDF-BYTES');
      const { manager } = await createManager(dir, { openLocal: openPdf(path) });

      const snapshot = await manager.openLocal();
      const bytes = await manager.readDocument(snapshot?.token as string);

      expect(bytes?.name).toBe('申请须知.pdf');
      expect(Buffer.from(bytes?.data as Uint8Array).toString()).toBe('PDF-BYTES');
      expect(Object.keys(bytes ?? {})).toEqual(['name', 'data']);
    });
  });

  it('超过读取上限的 PDF 不返回字节', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '大文件.pdf');
      await writeFile(path, 'x'.repeat(64));
      const { manager } = await createManager(dir, {
        openLocal: openPdf(path, '大文件.pdf'),
        maxReadBytes: 32
      });

      const snapshot = await manager.openLocal();

      expect(await manager.readDocument(snapshot?.token as string)).toBeNull();
    });
  });

  it('只有 PDF 查看会话可以读取字节', async () => {
    await withTempDir(async (dir) => {
      const { manager, document } = await createManager(dir, {
        openLocal: async () => ({ format: 'docx', document })
      });

      const viewing = await manager.openLocal();
      expect(await manager.readDocument(viewing?.token as string)).toBeNull();

      const promise = manager.preview({ document, operations });
      const token = manager.list().find((item) => item.mode === 'review')?.token as string;
      await waitForChanges(manager, token, 2);
      expect(await manager.readDocument(token)).toBeNull();

      manager.cancelAll();
      await promise;
    });
  });

  it('查看会话可用系统默认程序打开原文件，审阅会话不允许', async () => {
    await withTempDir(async (dir) => {
      const path = join(dir, '申请须知.pdf');
      await writeFile(path, 'PDF-BYTES');
      const openCopy = vi.fn();
      const { manager, document } = await createManager(dir, {
        openCopy,
        openLocal: openPdf(path)
      });

      const viewing = await manager.openLocal();
      expect(manager.openExternal(viewing?.token as string)).toBe(true);
      expect(openCopy).toHaveBeenCalledWith(path);

      const promise = manager.preview({ document, operations });
      const token = manager.list().find((item) => item.mode === 'review')?.token as string;
      await waitForChanges(manager, token, 2);
      expect(manager.openExternal(token)).toBe(false);

      manager.cancelAll();
      await promise;
    });
  });
});

describe('预览会话：PDF 原样副本叠加', () => {
  const buildTextPdf = async (dir: string): Promise<string> => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const page = document.addPage([595.28, 841.89]);
    page.drawText('Name:', { x: 100, y: 700, size: 12, font });
    page.drawText('Phone:', { x: 100, y: 670, size: 12, font });
    const path = join(dir, '申请表.pdf');
    await writeFile(path, await document.save());
    return path;
  };

  const buildBlankPdf = async (dir: string): Promise<string> => {
    const document = await PDFDocument.create();
    document.addPage([595.28, 841.89]);
    const path = join(dir, '扫描件.pdf');
    await writeFile(path, await document.save());
    return path;
  };

  const pdfCopy = (applied: number): EditedDocumentCopy => ({
    name: '申请表-已填写.pdf',
    format: 'pdf',
    folder: '鲁港通生成文件',
    path: 'C:\Users\tester\Downloads\鲁港通生成文件\申请表-已填写.pdf',
    applied,
    skipped: [],
    warnings: []
  });

  it('逐条确认后只把采用的内容写进副本，缺标签标为不可应用', async () => {
    await withTempDir(async (dir) => {
      const path = await buildTextPdf(dir);
      const writePdf = vi.fn(async ({ placements }: Parameters<PreviewPdfWriter>[0]) =>
        pdfCopy(placements.length)
      );
      const { manager } = await createManager(dir, { writePdf });
      const promise = manager.previewPdf({
        path,
        fileName: '申请表.pdf',
        entries: [
          { label: 'Name：', value: 'Zhang San' },
          { label: 'Phone：', value: '12345678' },
          { label: 'Email：', value: 'a@b.com' }
        ]
      });
      const token = manager.list()[0]?.token as string;
      await vi.waitFor(() => {
        expect(manager.get(token)?.changes).toHaveLength(3);
      });

      const snapshot = manager.get(token);
      expect(snapshot?.pdf).toMatchObject({ pages: 1 });
      expect(snapshot?.pdf?.items.map((item) => item.status)).toEqual([
        'pending',
        'pending',
        'unavailable'
      ]);
      expect(snapshot?.pdf?.items[0].labelRect).toBeTruthy();
      expect(snapshot?.pdf?.items[0].valueRect).toBeTruthy();
      expect(snapshot?.warnings?.[0]).toContain('1 条');

      // 鲁港通 - 审阅中的 PDF 也要能读字节，右栏才能画出黄色叠加
      expect(await manager.readDocument(token)).not.toBeNull();

      manager.claim(token);
      manager.decide(token, 0, 'apply');
      manager.decide(token, 1, 'skip');

      const outcome = await promise;
      expect(outcome).toMatchObject({ status: 'done' });
      expect(writePdf).toHaveBeenCalledTimes(1);
      const input = writePdf.mock.calls[0][0];
      expect(input.placements).toHaveLength(1);
      expect(input.placements[0]).toMatchObject({ label: 'Name：', value: 'Zhang San' });
      expect(input.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(
        outcome.status === 'done' ? outcome.copy.skipped : []
      ).toContain('Email：');
    });
  });

  it('扫描件没有文字层时直接失败并给出可操作原因', async () => {
    await withTempDir(async (dir) => {
      const path = await buildBlankPdf(dir);
      const writePdf = vi.fn(async () => pdfCopy(0));
      const { manager } = await createManager(dir, { writePdf });

      const outcome = await manager.previewPdf({
        path,
        fileName: '扫描件.pdf',
        entries: [{ label: 'Name：', value: 'Zhang San' }]
      });

      expect(outcome).toMatchObject({ status: 'failed', code: 'pdf_no_text_layer' });
      expect(outcome.status === 'failed' ? outcome.message : '').toContain('扫描件');
      expect(writePdf).not.toHaveBeenCalled();
    });
  });

  it('副本写入失败时不产生副本记录并提示原文件不受影响', async () => {
    await withTempDir(async (dir) => {
      const path = await buildTextPdf(dir);
      const { manager } = await createManager(dir, {
        writePdf: async () => {
          throw new Error('disk full');
        }
      });
      const promise = manager.previewPdf({
        path,
        fileName: '申请表.pdf',
        entries: [{ label: 'Name：', value: 'Zhang San' }]
      });
      const token = manager.list()[0]?.token as string;
      await vi.waitFor(() => {
        expect(manager.get(token)?.changes).toHaveLength(1);
      });
      manager.claim(token);
      manager.decide(token, 0, 'apply');

      const outcome = await promise;
      expect(outcome).toMatchObject({ status: 'failed', code: 'document_edit_failed' });
      expect(outcome.status === 'failed' ? outcome.message : '').toContain('原文件不受影响');
      expect(manager.get(token)).toMatchObject({ state: 'failed' });
      expect(manager.get(token)?.copy).toBeUndefined();
    });
  });
});
