// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParsedDocument } from '../src/main/ai/document/types';
import { DocumentPreviewManager, type PreviewEditor } from '../src/main/ai/documentPreview';

const tempDirs: string[] = [];

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-doc-openpath-'));
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
          new Paragraph('申请人须年满十八岁。')
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

const createManager = async (_dir: string): Promise<DocumentPreviewManager> => {
  const parseLocalPath = vi.fn(async (filePath: string) => {
    const fileName = filePath.split(/[\\/]/).pop() ?? '';
    if (fileName.includes('损坏')) throw new Error('无法读取这个文件');
    const format = filePath.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'docx';
    const document: ParsedDocument = { format, name: fileName, path: filePath, warnings: [] };
    return document;
  });
  const manager = new DocumentPreviewManager({
    editDocument: vi.fn(async () => {
      throw new Error('查看会话不应触发生成副本');
    }) as unknown as PreviewEditor,
    parseLocalPath,
    emit: () => undefined,
    timeoutMs: 200
  });
  return manager;
};

describe('资料库打开本机文件：按扩展名建立查看会话', () => {
  it('Word 文件经解析后进入查看会话并带出预览段落', async () => {
    await withTempDir(async (dir) => {
      const manager = await createManager(dir);
      const path = await buildDocx(dir);

      const snapshot = await manager.openPath(path);

      expect(snapshot).toMatchObject({
        mode: 'view',
        format: 'docx',
        fileName: '申请说明.docx',
        state: 'viewing'
      });
      expect(snapshot?.blocks[0]).toMatchObject({ text: '一、申请资格' });
      expect(manager.readActiveDocument()).toBeUndefined();
    });
  });

  it('Excel 文件经解析后带出工作表预览', async () => {
    await withTempDir(async (dir) => {
      const manager = await createManager(dir);
      const path = await buildXlsx(dir);

      const snapshot = await manager.openPath(path);

      expect(snapshot).toMatchObject({
        mode: 'view',
        format: 'xlsx',
        fileName: '预算表.xlsx',
        state: 'viewing'
      });
      expect(snapshot?.sheets?.[0]?.name).toBe('预算表');
    });
  });

  it('PDF 不经过解析器，直接按路径建立只读查看会话', async () => {
    await withTempDir(async (dir) => {
      const manager = await createManager(dir);
      const path = join(dir, '招标文件.pdf');

      const snapshot = await manager.openPath(path);

      expect(snapshot).toMatchObject({
        mode: 'view',
        format: 'pdf',
        fileName: '招标文件.pdf',
        state: 'viewing'
      });
      expect(manager.list()).toHaveLength(1);
    });
  });

  it('未知扩展名返回 null 且不留下会话', async () => {
    await withTempDir(async (dir) => {
      const manager = await createManager(dir);

      const snapshot = await manager.openPath(join(dir, '说明.txt'));

      expect(snapshot).toBeNull();
      expect(manager.list()).toHaveLength(0);
    });
  });

  it('解析失败时返回 null 且不留下会话', async () => {
    await withTempDir(async (dir) => {
      const manager = await createManager(dir);
      const path = join(dir, '损坏文件.docx');

      const snapshot = await manager.openPath(path);

      expect(snapshot).toBeNull();
      expect(manager.list()).toHaveLength(0);
    });
  });
});
