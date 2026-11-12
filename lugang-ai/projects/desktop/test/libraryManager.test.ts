import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLibraryManager, type LibraryManagerOptions } from '../src/main/library/manager';
import { createLibraryStore } from '../src/main/library/store';
import type { DesktopDocumentSnapshot } from '../src/shared/ipc';

const dirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-library-manager-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

type FileInfo = { size: number; mtimeMs: number };

const snapshot = () => ({ token: 'doc-token', mode: 'view', format: 'docx' }) as DesktopDocumentSnapshot;

const setup = async (
  input: {
    dir?: string;
    files?: Record<string, FileInfo>;
    folderFiles?: Array<{ name: string; isFile: boolean }>;
    readdirFails?: boolean;
    pick?: string | null;
    trashFails?: boolean;
    imageBytes?: number;
    now?: number;
    existingRecords?: Parameters<ReturnType<typeof createLibraryStore>['save']>[0];
  } = {}
) => {
  const dir = input.dir ?? (await makeDir());
  const filePath = join(dir, 'library.json');
  const store = createLibraryStore({ filePath });
  if (input.existingRecords) await store.save(input.existingRecords);

  const files = input.files ?? {};
  const calls = {
    trash: vi.fn(),
    show: vi.fn(),
    open: vi.fn(async () => ''),
    openDocument: vi.fn(async () => snapshot()),
    readFile: vi.fn(async (_path: string) => new Uint8Array(input.imageBytes ?? 4)),
    pickFile: vi.fn(async () => input.pick ?? null),
    emit: vi.fn(),
    readdir: vi.fn(async () => {
      if (input.readdirFails) throw new Error('EPERM');
      return input.folderFiles ?? [];
    })
  };

  const options: LibraryManagerOptions = {
    filePath,
    generatedFolder: join(dir, 'downloads', '鲁港通生成文件'),
    exists: (path) => path in files,
    stat: async (path) => {
      const info = files[path];
      if (!info) throw new Error('ENOENT');
      return info;
    },
    readdir: calls.readdir,
    trashItem: async (path) => {
      calls.trash(path);
      if (input.trashFails) throw new Error('EBUSY');
    },
    showItemInFolder: (path) => calls.show(path),
    openPath: calls.open,
    pickFile: calls.pickFile,
    openDocument: calls.openDocument,
    readFile: calls.readFile,
    emit: calls.emit,
    now: () => input.now ?? 9000,
    idFactory: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    maxImageBytes: 10
  };

  const manager = createLibraryManager(options);
  return { dir, filePath, manager, options, calls, files };
};

describe('资料库管理器', () => {
  it('首次运行回填生成文件夹里的现有文件', async () => {
    const dir = await makeDir();
    const generated = join(dir, 'downloads', '鲁港通生成文件');
    const files = {
      [join(generated, '材料.docx')]: { size: 100, mtimeMs: 1111 },
      [join(generated, '清单.pdf')]: { size: 200, mtimeMs: 2222 }
    };
    const ctx = await setup({
      dir,
      files,
      folderFiles: [
        { name: '材料.docx', isFile: true },
        { name: '子目录', isFile: false }
      ]
    });

    await ctx.manager.init();

    const items = await ctx.manager.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: '材料.docx',
      kind: 'docx',
      source: 'ai',
      size: 100,
      missing: false
    });
    expect(ctx.calls.emit).toHaveBeenCalled();
  });

  it('已有索引时不重复回填', async () => {
    const dir = await makeDir();
    const generated = join(dir, 'downloads', '鲁港通生成文件');
    const existingPath = join(generated, '旧文件.docx');
    const ctx = await setup({
      dir,
      files: {
        [existingPath]: { size: 10, mtimeMs: 100 },
        [join(generated, '新文件.pdf')]: { size: 20, mtimeMs: 200 }
      },
      folderFiles: [{ name: '新文件.pdf', isFile: true }],
      existingRecords: [
        {
          id: 'keep',
          path: existingPath,
          name: '旧文件.docx',
          kind: 'docx',
          source: 'ai',
          size: 10,
          addedAt: 100,
          usedAt: 100,
          starred: false
        }
      ]
    });

    await ctx.manager.init();

    const items = await ctx.manager.list();
    expect(items.map((item) => item.id)).toEqual(['keep']);
    expect(ctx.calls.readdir).not.toHaveBeenCalled();
  });

  it('读取生成文件夹失败不影响启动', async () => {
    const ctx = await setup({ readdirFails: true });
    await expect(ctx.manager.init()).resolves.toBeUndefined();
    await expect(ctx.manager.list()).resolves.toEqual([]);
  });

  it('登记同一路径只保留一条并持久化', async () => {
    const ctx = await setup({ now: 5000 });
    const path = join(ctx.dir, 'downloaded.pdf');
    ctx.files[path] = { size: 300, mtimeMs: 100 };

    await ctx.manager.init();
    const first = await ctx.manager.register({ path, source: 'download', origin: 'www.gov.hk' });
    const second = await ctx.manager.register({ path, source: 'download', origin: 'www.gov.hk' });

    expect(first?.id).toBe(second?.id);
    expect(await ctx.manager.list()).toHaveLength(1);

    const reloaded = createLibraryManager({ ...ctx.options, emit: undefined });
    await reloaded.init();
    expect(await reloaded.list()).toHaveLength(1);
  });

  it('登记失败只返回 null，不向上抛错', async () => {
    const ctx = await setup();
    await ctx.manager.init();
    await expect(
      ctx.manager.register({ path: join(ctx.dir, 'missing.docx'), source: 'ai' })
    ).resolves.toBeNull();
    await expect(ctx.manager.list()).resolves.toEqual([]);
  });

  it('收藏状态写回索引', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });

    const starred = await ctx.manager.star(item!.id, true);
    expect(starred?.starred).toBe(true);

    const reloaded = createLibraryManager({ ...ctx.options, emit: undefined });
    await reloaded.init();
    expect((await reloaded.list())[0].starred).toBe(true);
  });

  it('从资料库移除只删记录不动文件', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });

    await expect(ctx.manager.remove(item!.id)).resolves.toBe(true);
    expect(await ctx.manager.list()).toEqual([]);
    expect(path in ctx.files).toBe(true);
    expect(ctx.calls.trash).not.toHaveBeenCalled();
  });

  it('删除到回收站成功后移除记录', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });

    await expect(ctx.manager.trash(item!.id)).resolves.toBe(true);
    expect(ctx.calls.trash).toHaveBeenCalledWith(path);
    expect(await ctx.manager.list()).toEqual([]);
  });

  it('删除到回收站失败时保留记录', async () => {
    const ctx = await setup({ trashFails: true });
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });

    await expect(ctx.manager.trash(item!.id)).resolves.toBe(false);
    expect(await ctx.manager.list()).toHaveLength(1);
  });

  it('文件已缺失时删除只清记录，不再调用回收站', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });
    delete ctx.files[path];

    await expect(ctx.manager.trash(item!.id)).resolves.toBe(true);
    expect(ctx.calls.trash).not.toHaveBeenCalled();
    expect(await ctx.manager.list()).toEqual([]);
  });

  it('打开缺失文件返回 missing，不进入文档解析', async () => {
    const ctx = await setup();
    await ctx.manager.init();
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    const item = await ctx.manager.register({ path, source: 'ai' });
    delete ctx.files[path];

    await expect(ctx.manager.open(item!.id)).resolves.toEqual({ type: 'missing' });
    expect(ctx.calls.openDocument).not.toHaveBeenCalled();
  });

  it('打开 Word 复用文档会话并刷新最近使用时间', async () => {
    const ctx = await setup({ now: 7777 });
    const path = join(ctx.dir, '材料.docx');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'ai' });

    const result = await ctx.manager.open(item!.id);
    expect(result).toMatchObject({ type: 'document' });
    expect(ctx.calls.openDocument).toHaveBeenCalledWith(path);
    expect((await ctx.manager.list())[0].usedAt).toBe(7777);
  });

  it('打开图片返回本机字节', async () => {
    const ctx = await setup({ imageBytes: 4 });
    const path = join(ctx.dir, '票据.png');
    ctx.files[path] = { size: 4, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'import' });

    const result = await ctx.manager.open(item!.id);
    expect(result).toMatchObject({ type: 'image', name: '票据.png' });
    expect(ctx.calls.readFile).toHaveBeenCalledWith(path);
  });

  it('图片超过体积上限时不读入内存', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '大图.jpg');
    ctx.files[path] = { size: 11, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'import' });

    await expect(ctx.manager.open(item!.id)).resolves.toEqual({
      type: 'unsupported',
      reason: 'image_too_large'
    });
    expect(ctx.calls.readFile).not.toHaveBeenCalled();
  });

  it('压缩包不支持预览', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '打包.zip');
    ctx.files[path] = { size: 11, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'import' });

    await expect(ctx.manager.open(item!.id)).resolves.toEqual({ type: 'unsupported' });
  });

  it('重新定位后按新路径打开', async () => {
    const ctx = await setup();
    const oldPath = join(ctx.dir, '旧位置.docx');
    const newPath = join(ctx.dir, '新位置.docx');
    ctx.files[oldPath] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path: oldPath, source: 'ai' });
    delete ctx.files[oldPath];
    ctx.files[newPath] = { size: 22, mtimeMs: 2 };
    ctx.calls.pickFile.mockResolvedValueOnce(newPath);

    const relocated = await ctx.manager.relocate(item!.id);
    expect(relocated).toMatchObject({ name: '新位置.docx', size: 22, missing: false });

    await ctx.manager.open(item!.id);
    expect(ctx.calls.openDocument).toHaveBeenCalledWith(newPath);
  });

  it('重新定位到已索引文件时合并为一条', async () => {
    const ctx = await setup();
    const firstPath = join(ctx.dir, 'a.docx');
    const secondPath = join(ctx.dir, 'b.docx');
    ctx.files[firstPath] = { size: 10, mtimeMs: 1 };
    ctx.files[secondPath] = { size: 20, mtimeMs: 2 };
    await ctx.manager.init();
    const first = await ctx.manager.register({ path: firstPath, source: 'ai' });
    await ctx.manager.register({ path: secondPath, source: 'import' });
    delete ctx.files[firstPath];
    ctx.calls.pickFile.mockResolvedValueOnce(secondPath);

    await ctx.manager.relocate(first!.id);
    const items = await ctx.manager.list();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(first!.id);
  });

  it('导入取消时静默返回 null', async () => {
    const ctx = await setup({ pick: null });
    await ctx.manager.init();
    await expect(ctx.manager.importLocal()).resolves.toBeNull();
    await expect(ctx.manager.list()).resolves.toEqual([]);
  });

  it('导入本机文件登记为 import 且不复制', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '机上的材料.pdf');
    ctx.files[path] = { size: 99, mtimeMs: 3 };
    ctx.calls.pickFile.mockResolvedValueOnce(path);
    await ctx.manager.init();

    const item = await ctx.manager.importLocal();
    expect(item).toMatchObject({ name: '机上的材料.pdf', source: 'import', size: 99 });
    expect(ctx.calls.readFile).not.toHaveBeenCalled();
  });

  it('在文件夹中显示与系统打开按记录路径执行', async () => {
    const ctx = await setup();
    const path = join(ctx.dir, '材料.pdf');
    ctx.files[path] = { size: 10, mtimeMs: 1 };
    await ctx.manager.init();
    const item = await ctx.manager.register({ path, source: 'download' });

    await expect(ctx.manager.reveal(item!.id)).resolves.toBe(true);
    expect(ctx.calls.show).toHaveBeenCalledWith(path);
    await expect(ctx.manager.openExternal(item!.id)).resolves.toBe(true);
    expect(ctx.calls.open).toHaveBeenCalledWith(path);
  });
});
