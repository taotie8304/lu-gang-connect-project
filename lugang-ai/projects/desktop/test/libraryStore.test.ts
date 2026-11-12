import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLibraryStore } from '../src/main/library/store';
import type { LibraryRecord } from '../src/main/library/items';

const dirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-library-'));
  dirs.push(dir);
  return dir;
};

const record = (patch: Partial<LibraryRecord> = {}): LibraryRecord => ({
  id: 'r1',
  path: 'C:\\Users\\A\\鲁港通生成文件\\材料.docx',
  name: '材料.docx',
  kind: 'docx',
  source: 'ai',
  size: 1024,
  addedAt: 1000,
  usedAt: 2000,
  starred: false,
  ...patch
});

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('资料库索引存储', () => {
  it('索引不存在时返回空列表并标记首次运行', async () => {
    const dir = await makeDir();
    const store = createLibraryStore({ filePath: join(dir, 'library.json') });
    await expect(store.load()).resolves.toEqual({ records: [], existed: false });
  });

  it('写入后可原样读回，且不残留临时文件', async () => {
    const dir = await makeDir();
    const filePath = join(dir, 'library.json');
    const store = createLibraryStore({ filePath });
    const records = [record(), record({ id: 'r2', name: '清单.xlsx', kind: 'xlsx', starred: true })];

    await store.save(records);
    await expect(store.load()).resolves.toEqual({ records, existed: true });

    const files = await readdir(dir);
    expect(files).toEqual(['library.json']);
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    expect(raw.version).toBe(1);
    expect(raw.items).toHaveLength(2);
  });

  it('索引损坏时备份坏文件并从空索引启动', async () => {
    const dir = await makeDir();
    const filePath = join(dir, 'library.json');
    await writeFile(filePath, '{ broken json', 'utf8');

    const store = createLibraryStore({ filePath });
    const loaded = await store.load();
    expect(loaded).toEqual({ records: [], existed: true });

    const files = await readdir(dir);
    expect(files.some((name) => name.startsWith('library.broken-'))).toBe(true);
    await expect(store.save([record()])).resolves.toBeUndefined();
  });

  it('结构不对的索引按损坏处理，不阻塞启动', async () => {
    const dir = await makeDir();
    const filePath = join(dir, 'library.json');
    await writeFile(filePath, JSON.stringify({ version: 1, items: 'oops' }), 'utf8');

    const store = createLibraryStore({ filePath });
    await expect(store.load()).resolves.toEqual({ records: [], existed: true });
  });
});
