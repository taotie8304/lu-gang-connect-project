// 鲁港通 - AI 审计写入：按天追加 JSONL，首次写入时清理 90 天前的旧文件
import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  aiAuditFileName,
  isAiAuditFileExpired,
  type AiAuditRecord
} from './audit';

export type AiAuditStore = {
  append(record: AiAuditRecord): Promise<void>;
};

export const createAiAuditStore = (
  dir: string,
  now: () => Date = () => new Date()
): AiAuditStore => {
  let initialized: Promise<void> | null = null;

  const init = async () => {
    await mkdir(dir, { recursive: true });
    const files = await readdir(dir).catch(() => [] as string[]);
    const current = now();
    await Promise.all(
      files
        .filter((file) => isAiAuditFileExpired(file, current))
        .map((file) => unlink(join(dir, file)).catch(() => undefined))
    );
  };

  return {
    async append(record: AiAuditRecord): Promise<void> {
      if (!initialized) initialized = init();
      await initialized;
      await appendFile(
        join(dir, aiAuditFileName(new Date(record.time))),
        `${JSON.stringify(record)}\n`,
        'utf8'
      );
    }
  };
};
