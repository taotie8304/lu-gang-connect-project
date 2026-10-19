import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiAuditStore } from '../src/main/ai/auditWriter';
import type { AiAuditRecord } from '../src/main/ai/audit';

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-ai-audit-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const makeRecord = (overrides: Partial<AiAuditRecord> = {}): AiAuditRecord => ({
  time: '2026-10-19T08:00:00.000Z',
  commandId: 'cmd-1',
  action: 'type',
  outcome: 'ok',
  host: 'www.gov.hk',
  path: '/form',
  target: '姓名',
  ...overrides
});

describe('AI 审计写入', () => {
  it('按日期写入 JSONL 并自动创建目录', async () => {
    const base = await makeTempDir();
    const dir = join(base, 'ai-audit');
    const store = createAiAuditStore(dir, () => new Date('2026-10-19T12:00:00.000Z'));

    await store.append(makeRecord());

    const files = await readdir(dir);
    expect(files).toEqual(['ai-audit-2026-10-19.jsonl']);
    const content = await readFile(join(dir, 'ai-audit-2026-10-19.jsonl'), 'utf8');
    expect(JSON.parse(content.trim())).toEqual(makeRecord());
    expect(content).not.toContain('\n\n');
  });

  it('同一天追加多条记录且不覆盖旧内容', async () => {
    const dir = await makeTempDir();
    const store = createAiAuditStore(dir, () => new Date('2026-10-19T12:00:00.000Z'));

    await store.append(makeRecord({ commandId: 'cmd-1' }));
    await store.append(makeRecord({ commandId: 'cmd-2', outcome: 'failed' }));

    const lines = (await readFile(join(dir, 'ai-audit-2026-10-19.jsonl'), 'utf8'))
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).commandId).toBe('cmd-1');
    expect(JSON.parse(lines[1])).toMatchObject({ commandId: 'cmd-2', outcome: 'failed' });
  });

  it('首次写入时清理超过 90 天的审计文件', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'ai-audit-2026-01-01.jsonl'), '{}\n', 'utf8');
    await writeFile(join(dir, 'ai-audit-2026-07-21.jsonl'), '{}\n', 'utf8');
    await writeFile(join(dir, 'unrelated.txt'), 'keep', 'utf8');
    const store = createAiAuditStore(dir, () => new Date('2026-10-19T12:00:00.000Z'));

    await store.append(makeRecord());

    const files = (await readdir(dir)).sort();
    expect(files).toEqual(['ai-audit-2026-07-21.jsonl', 'ai-audit-2026-10-19.jsonl', 'unrelated.txt']);
  });
});
