// 鲁港通 - 资料库索引落盘：临时文件 + 重命名保证原子性，坏文件备份后从空索引启动
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { LibraryRecord } from './items';

type LibraryFile = { version: 1; items: LibraryRecord[] };

export type LibraryStore = {
  load(): Promise<{ records: LibraryRecord[]; existed: boolean }>;
  save(records: LibraryRecord[]): Promise<void>;
};

export type LibraryStoreOptions = {
  filePath: string;
  log?: (message: string, error?: unknown) => void;
};

const KINDS = new Set(['docx', 'xlsx', 'pdf', 'image', 'archive', 'other']);
const SOURCES = new Set(['ai', 'download', 'edit', 'import']);

const isLibraryRecord = (value: unknown): value is LibraryRecord => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.path === 'string' &&
    typeof item.name === 'string' &&
    typeof item.kind === 'string' &&
    KINDS.has(item.kind) &&
    typeof item.source === 'string' &&
    SOURCES.has(item.source) &&
    typeof item.size === 'number' &&
    typeof item.addedAt === 'number' &&
    typeof item.usedAt === 'number' &&
    typeof item.starred === 'boolean'
  );
};

const backupPathFor = (filePath: string): string => {
  const name = basename(filePath);
  const stem = name.toLowerCase().endsWith('.json') ? name.slice(0, -5) : name;
  return join(dirname(filePath), `${stem}.broken-${Date.now()}.json`);
};

export const createLibraryStore = (options: LibraryStoreOptions): LibraryStore => {
  const { filePath, log } = options;

  return {
    load: async () => {
      let raw: string;
      try {
        raw = await readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { records: [], existed: false };
        }
        log?.('资料库索引读取失败，按空索引启动', error);
        return { records: [], existed: true };
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        const items = (parsed as LibraryFile | undefined)?.items;
        if (!Array.isArray(items)) throw new Error('资料库索引结构无效');
        return { records: items.filter(isLibraryRecord), existed: true };
      } catch (error) {
        log?.('资料库索引损坏，已备份并从空索引启动', error);
        try {
          await rename(filePath, backupPathFor(filePath));
        } catch (backupError) {
          log?.('资料库坏索引备份失败', backupError);
        }
        return { records: [], existed: true };
      }
    },

    save: async (records) => {
      await mkdir(dirname(filePath), { recursive: true });
      const tmpPath = `${filePath}.tmp`;
      const content = JSON.stringify({ version: 1, items: records } satisfies LibraryFile);
      await writeFile(tmpPath, content, 'utf8');
      await rename(tmpPath, filePath);
    }
  };
};
