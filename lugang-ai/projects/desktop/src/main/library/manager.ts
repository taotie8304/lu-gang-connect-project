// 鲁港通 - 资料库管理器：只维护本机索引，文件始终留在原位；所有动作按条目 id 执行
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import type {
  DesktopDocumentSnapshot,
  DesktopLibraryItem,
  DesktopLibraryOpenResult,
  DesktopLibrarySource
} from '../../shared/ipc';
import {
  MAX_LIBRARY_ITEMS,
  classifyLibraryKind,
  mergeLibraryRecord,
  normalizeLibraryPath,
  pruneLibraryRecords,
  toDesktopLibraryItem,
  type LibraryRecord
} from './items';
import { createLibraryStore } from './store';

const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_BACKFILL_FILES = 200;

export type LibraryDirectoryEntry = { name: string; isFile: boolean };

export type LibraryManagerOptions = {
  filePath: string;
  generatedFolder: string;
  exists: (path: string) => boolean;
  stat: (path: string) => Promise<{ size: number; mtimeMs: number }>;
  readdir: (path: string) => Promise<LibraryDirectoryEntry[]>;
  trashItem: (path: string) => Promise<void>;
  showItemInFolder: (path: string) => void;
  openPath: (path: string) => Promise<string>;
  pickFile: (options: { title: string; buttonLabel: string }) => Promise<string | null>;
  openDocument: (path: string) => Promise<DesktopDocumentSnapshot | null>;
  readFile: (path: string) => Promise<Uint8Array>;
  emit?: (items: DesktopLibraryItem[]) => void;
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
  idFactory?: () => string;
  maxImageBytes?: number;
  maxItems?: number;
};

export type LibraryManager = {
  init(): Promise<void>;
  list(): Promise<DesktopLibraryItem[]>;
  register(input: {
    path: string;
    source: DesktopLibrarySource;
    origin?: string;
    parentName?: string;
  }): Promise<DesktopLibraryItem | null>;
  importLocal(): Promise<DesktopLibraryItem | null>;
  open(id: string): Promise<DesktopLibraryOpenResult | null>;
  star(id: string, starred: boolean): Promise<DesktopLibraryItem | null>;
  reveal(id: string): Promise<boolean>;
  openExternal(id: string): Promise<boolean>;
  trash(id: string): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  relocate(id: string): Promise<DesktopLibraryItem | null>;
};

export const createLibraryManager = (options: LibraryManagerOptions): LibraryManager => {
  const store = createLibraryStore({
    filePath: options.filePath,
    ...(options.log ? { log: options.log } : {})
  });
  const now = () => options.now?.() ?? Date.now();
  const nextId = options.idFactory ?? (() => randomUUID());
  const maxItems = options.maxItems ?? MAX_LIBRARY_ITEMS;
  const maxImageBytes = options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES;

  let records: LibraryRecord[] = [];
  let queue: Promise<unknown> = Promise.resolve();

  // 鲁港通 - 下载可能同时完成多个：索引变更串行执行，避免临时文件写冲突
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const items = (): DesktopLibraryItem[] =>
    records.map((record) => toDesktopLibraryItem(record, !options.exists(record.path)));

  const itemOf = (record: LibraryRecord): DesktopLibraryItem =>
    toDesktopLibraryItem(record, !options.exists(record.path));

  const notify = () => {
    try {
      options.emit?.(items());
    } catch (error) {
      options.log?.('资料库状态推送失败', error);
    }
  };

  const persist = async () => {
    try {
      await store.save(records);
    } catch (error) {
      options.log?.('资料库索引写入失败', error);
    }
  };

  const buildRecord = async (input: {
    path: string;
    source: DesktopLibrarySource;
    origin?: string;
    parentName?: string;
  }): Promise<LibraryRecord | null> => {
    let info: { size: number; mtimeMs: number };
    try {
      info = await options.stat(input.path);
    } catch (error) {
      options.log?.('资料库登记跳过：文件不可读', error);
      return null;
    }
    const at = Math.round(now());
    return {
      id: '',
      path: input.path,
      name: basename(input.path),
      kind: classifyLibraryKind(input.path),
      source: input.source,
      size: info.size,
      addedAt: at,
      usedAt: at,
      starred: false,
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.parentName ? { parentName: input.parentName } : {})
    };
  };

  const backfill = async (): Promise<void> => {
    let entries: LibraryDirectoryEntry[];
    try {
      entries = await options.readdir(options.generatedFolder);
    } catch (error) {
      options.log?.('生成文件夹读取失败，跳过首次回填', error);
      return;
    }

    const files = entries
      .filter((entry) => entry.isFile)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .slice(0, MAX_BACKFILL_FILES);

    for (const entry of files) {
      const record = await buildRecord({
        path: join(options.generatedFolder, entry.name),
        source: 'ai'
      });
      if (!record) continue;
      const merged = mergeLibraryRecord(records, record, nextId);
      records = merged.records;
    }
    records = pruneLibraryRecords(records, maxItems);
    await persist();
  };

  const touch = async (record: LibraryRecord): Promise<void> => {
    records = records.map((item) => (item.id === record.id ? record : item));
    await persist();
    notify();
  };

  const removeRecord = async (id: string): Promise<boolean> => {
    if (!records.some((record) => record.id === id)) return false;
    records = records.filter((record) => record.id !== id);
    await persist();
    notify();
    return true;
  };

  const init = (): Promise<void> =>
    exclusive(async () => {
      const loaded = await store.load();
      records = loaded.records;
      if (!loaded.existed) await backfill();
      notify();
    });

  const list = async (): Promise<DesktopLibraryItem[]> => items();

  const register: LibraryManager['register'] = (input) =>
    exclusive(async () => {
      const record = await buildRecord(input);
      if (!record) return null;
      const merged = mergeLibraryRecord(records, record, nextId);
      records = pruneLibraryRecords(merged.records, maxItems);
      await persist();
      notify();
      return itemOf(merged.record);
    });

  const importLocal = (): Promise<DesktopLibraryItem | null> =>
    exclusive(async () => {
      const path = await options.pickFile({ title: '导入本机文件', buttonLabel: '导入' });
      if (!path) return null;
      const record = await buildRecord({ path, source: 'import' });
      if (!record) return null;
      const merged = mergeLibraryRecord(records, record, nextId);
      records = pruneLibraryRecords(merged.records, maxItems);
      await persist();
      notify();
      return itemOf(merged.record);
    });

  const open = async (id: string): Promise<DesktopLibraryOpenResult | null> => {
    const record = records.find((item) => item.id === id);
    if (!record) return null;
    if (!options.exists(record.path)) return { type: 'missing' };

    let result: DesktopLibraryOpenResult;
    let used = false;

    if (record.kind === 'docx' || record.kind === 'xlsx' || record.kind === 'pdf') {
      let snapshot: DesktopDocumentSnapshot | null = null;
      try {
        snapshot = await options.openDocument(record.path);
      } catch (error) {
        options.log?.('资料库打开文档失败', error);
      }
      result = snapshot ? { type: 'document', snapshot } : { type: 'unsupported' };
      used = Boolean(snapshot);
    } else if (record.kind === 'image') {
      let info: { size: number; mtimeMs: number };
      try {
        info = await options.stat(record.path);
      } catch (error) {
        options.log?.('资料库读取图片信息失败', error);
        return { type: 'missing' };
      }
      if (info.size > maxImageBytes) {
        result = { type: 'unsupported', reason: 'image_too_large' };
      } else {
        try {
          result = { type: 'image', name: record.name, data: await options.readFile(record.path) };
          used = true;
        } catch (error) {
          options.log?.('资料库读取图片失败', error);
          result = { type: 'unsupported' };
        }
      }
    } else {
      result = { type: 'unsupported' };
    }

    if (used) {
      await exclusive(async () => {
        const current = records.find((item) => item.id === id);
        if (!current) return;
        await touch({ ...current, usedAt: Math.round(now()) });
      });
    }
    return result;
  };

  const star: LibraryManager['star'] = (id, starred) =>
    exclusive(async () => {
      const record = records.find((item) => item.id === id);
      if (!record) return null;
      const next = { ...record, starred };
      records = records.map((item) => (item.id === id ? next : item));
      await persist();
      notify();
      return itemOf(next);
    });

  const reveal: LibraryManager['reveal'] = async (id) => {
    const record = records.find((item) => item.id === id);
    if (!record || !options.exists(record.path)) return false;
    try {
      options.showItemInFolder(record.path);
      return true;
    } catch (error) {
      options.log?.('资料库定位文件失败', error);
      return false;
    }
  };

  const openExternal: LibraryManager['openExternal'] = (id) =>
    exclusive(async () => {
      const record = records.find((item) => item.id === id);
      if (!record || !options.exists(record.path)) return false;
      try {
        const error = await options.openPath(record.path);
        if (error) return false;
      } catch (error) {
        options.log?.('资料库系统打开失败', error);
        return false;
      }
      await touch({ ...record, usedAt: Math.round(now()) });
      return true;
    });

  const trash: LibraryManager['trash'] = (id) =>
    exclusive(async () => {
      const record = records.find((item) => item.id === id);
      if (!record) return false;
      if (options.exists(record.path)) {
        try {
          await options.trashItem(record.path);
        } catch (error) {
          options.log?.('资料库删除到回收站失败', error);
          return false;
        }
      }
      records = records.filter((item) => item.id !== id);
      await persist();
      notify();
      return true;
    });

  const remove: LibraryManager['remove'] = (id) => exclusive(() => removeRecord(id));

  const relocate: LibraryManager['relocate'] = (id) =>
    exclusive(async () => {
      const record = records.find((item) => item.id === id);
      if (!record) return null;
      const path = await options.pickFile({ title: '重新定位文件', buttonLabel: '选择文件' });
      if (!path) return null;
      let info: { size: number; mtimeMs: number };
      try {
        info = await options.stat(path);
      } catch (error) {
        options.log?.('资料库重新定位失败：文件不可读', error);
        return null;
      }
      const target = normalizeLibraryPath(path);
      const updated: LibraryRecord = {
        ...record,
        path,
        name: basename(path),
        kind: classifyLibraryKind(path),
        size: info.size,
        usedAt: Math.round(now())
      };
      records = records
        .map((item) => (item.id === id ? updated : item))
        .filter((item) => item.id === id || normalizeLibraryPath(item.path) !== target);
      await persist();
      notify();
      return itemOf(updated);
    });

  return {
    init,
    list,
    register,
    importLocal,
    open,
    star,
    reveal,
    openExternal,
    trash,
    remove,
    relocate
  };
};
