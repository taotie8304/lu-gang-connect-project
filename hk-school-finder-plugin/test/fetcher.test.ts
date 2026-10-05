// 鲁港通 - 缓存 fetcher 测试（TDD）：命中直读 / 过期重下 / 失败降级 / 无缓存错误 / 并发合流
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFetcher } from '../src/fetcher';
import { TTL_MS, type DataSource } from '../src/config';

const source: DataSource = {
  id: 'test_src',
  url: 'https://example.com/test.csv',
  refresh: 'weekly',
  format: 'csv',
  delimiter: ',',
  note: '测试数据源',
};

const enc = new TextEncoder();
const dec = new TextDecoder();

let cacheDir: string;
let nowMs: number;
const now = () => nowMs;

/** 预置一次成功下载（V1），返回其 fetchedAt */
async function seedV1(): Promise<number> {
  const seededAt = nowMs;
  const f = createFetcher({ cacheDir, fetchBytes: async () => enc.encode('V1'), now });
  await f.get(source);
  return seededAt;
}

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'lugang-sf-test-'));
  nowMs = 1_700_000_000_000;
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

describe('缓存 fetcher', () => {
  it('无缓存 → 下载并写入缓存与 meta', async () => {
    const fetcher = createFetcher({ cacheDir, fetchBytes: async () => enc.encode('V1'), now });
    const r = await fetcher.get(source);

    expect(dec.decode(r.data)).toBe('V1');
    expect(r.fromCache).toBe(false);
    expect(r.stale).toBe(false);
    expect(r.fetchedAt).toBe(nowMs);
    expect(dec.decode(readFileSync(join(cacheDir, 'test_src.raw')))).toBe('V1');
    const meta = JSON.parse(readFileSync(join(cacheDir, 'test_src.meta.json'), 'utf8'));
    expect(meta.fetchedAt).toBe(nowMs);
  });

  it('缓存新鲜 → 直读，不再下载', async () => {
    let calls = 0;
    await seedV1();
    const failFetch = async () => {
      calls++;
      throw new Error('不应被调用');
    };
    const f = createFetcher({ cacheDir, fetchBytes: failFetch, now });
    const r = await f.get(source);

    expect(dec.decode(r.data)).toBe('V1');
    expect(r.fromCache).toBe(true);
    expect(r.stale).toBe(false);
    expect(calls).toBe(0);
  });

  it('过期 → 重新下载并覆写缓存', async () => {
    await seedV1();
    nowMs += (TTL_MS.weekly ?? 0) + 1;
    const f = createFetcher({ cacheDir, fetchBytes: async () => enc.encode('V2'), now });
    const r = await f.get(source);

    expect(dec.decode(r.data)).toBe('V2');
    expect(r.fromCache).toBe(false);
    expect(r.stale).toBe(false);
    expect(dec.decode(readFileSync(join(cacheDir, 'test_src.raw')))).toBe('V2');
  });

  it('过期 + 下载失败 → 降级旧缓存并标记 stale', async () => {
    const seededAt = await seedV1();
    nowMs += (TTL_MS.weekly ?? 0) + 1;
    const f = createFetcher({
      cacheDir,
      fetchBytes: async () => {
        throw new Error('网络断开');
      },
      now,
    });
    const r = await f.get(source);

    expect(dec.decode(r.data)).toBe('V1');
    expect(r.fromCache).toBe(true);
    expect(r.stale).toBe(true);
    expect(r.fetchedAt).toBe(seededAt);
  });

  it('无缓存 + 下载失败 → 可操作中文错误', async () => {
    const f = createFetcher({
      cacheDir,
      fetchBytes: async () => {
        throw new Error('网络断开');
      },
      now,
    });
    await expect(f.get(source)).rejects.toThrow(/暂时无法下载/);
    await expect(f.get(source)).rejects.toThrow(/请稍后重试/);
  });

  it('realtime 源不读写缓存，每次实时下载', async () => {
    const rt = { ...source, id: 'rt_src', refresh: 'realtime' as const };
    let calls = 0;
    const f = createFetcher({
      cacheDir,
      fetchBytes: async () => {
        calls++;
        return enc.encode('R');
      },
      now,
    });
    await f.get(rt);
    await f.get(rt);

    expect(calls).toBe(2);
    expect(existsSync(join(cacheDir, 'rt_src.raw'))).toBe(false);
    expect(existsSync(join(cacheDir, 'rt_src.meta.json'))).toBe(false);
  });

  it('同一源并发请求合流为一次下载', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = createFetcher({
      cacheDir,
      fetchBytes: async () => {
        calls++;
        await gate;
        return enc.encode('V1');
      },
      now,
    });
    const p1 = f.get(source);
    const p2 = f.get(source);
    release();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(calls).toBe(1);
    expect(dec.decode(r1.data)).toBe('V1');
    expect(dec.decode(r2.data)).toBe('V1');
  });
});
