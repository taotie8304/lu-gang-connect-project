// 鲁港通 - 数据下载与缓存：新鲜直读 / 过期重下 / 失败降级旧缓存 / 并发合流
// 缓存目录约定（设计文档）：<cacheDir>/<id>.raw + <id>.meta.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isFresh, type DataSource } from './config';

/** 下载实现签名（生产为 Node fetch；测试注入桩） */
export type FetchBytes = (url: string) => Promise<Uint8Array>;

export interface FetcherOptions {
  /** 缓存目录（生产：/tmp/lugang-school-finder；测试注入临时目录） */
  cacheDir: string;
  /** 下载实现（默认 Node fetch，120s 超时） */
  fetchBytes?: FetchBytes;
  /** 当前时间函数（测试注入时钟） */
  now?: () => number;
}

export interface FetchResult {
  /** 原始字节（含 BOM，交由 decode.ts 处理） */
  data: Uint8Array;
  /** 是否来自本地缓存（未发生下载） */
  fromCache: boolean;
  /** 是否为过期降级（下载失败 → 用旧缓存，数据可能不是最新） */
  stale: boolean;
  /** 数据抓取时间（毫秒时间戳；meta 缺失的降级为 0） */
  fetchedAt: number;
}

export interface Fetcher {
  /** 获取数据源内容：缓存新鲜直读，否则下载（失败降级/报错） */
  get(source: DataSource): Promise<FetchResult>;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** 默认下载实现：Node 原生 fetch + 超时保护（大文件 3–20MB） */
async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function createFetcher(options: FetcherOptions): Fetcher {
  const { cacheDir } = options;
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  const now = options.now ?? Date.now;
  /** 并发合流：同一源进行中的请求仅保留一个 */
  const inFlight = new Map<string, Promise<FetchResult>>();

  const rawPath = (id: string) => join(cacheDir, `${id}.raw`);
  const metaPath = (id: string) => join(cacheDir, `${id}.meta.json`);

  /** 读缓存：.raw 存在即有效；meta 缺失/损坏视为很旧（fetchedAt=0） */
  function readCache(source: DataSource): { data: Buffer; fetchedAt: number } | undefined {
    try {
      const p = rawPath(source.id);
      if (!existsSync(p)) return undefined;
      let fetchedAt = 0;
      try {
        const meta = JSON.parse(readFileSync(metaPath(source.id), 'utf8')) as { fetchedAt?: unknown };
        if (typeof meta.fetchedAt === 'number') fetchedAt = meta.fetchedAt;
      } catch {
        // meta 缺失或损坏：视为过期；下载失败时仍可降级使用
      }
      return { data: readFileSync(p), fetchedAt };
    } catch {
      return undefined;
    }
  }

  /** 写缓存（失败不阻塞本次查询，仅影响下次缓存命中） */
  function writeCache(source: DataSource, data: Uint8Array, fetchedAt: number): void {
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(rawPath(source.id), data);
      writeFileSync(metaPath(source.id), JSON.stringify({ id: source.id, url: source.url, fetchedAt }));
    } catch {
      // 磁盘满/权限问题：本次仍返回新下载的数据
    }
  }

  async function doGet(source: DataSource): Promise<FetchResult> {
    const cached = source.refresh === 'realtime' ? undefined : readCache(source);

    // 1) 缓存新鲜 → 直读
    if (cached && cached.fetchedAt > 0 && isFresh(source.refresh, now() - cached.fetchedAt)) {
      return { data: cached.data, fromCache: true, stale: false, fetchedAt: cached.fetchedAt };
    }

    // 2) 无缓存 / 过期 / 实时 → 下载
    try {
      const data = await fetchBytes(source.url);
      const fetchedAt = now();
      if (source.refresh !== 'realtime') writeCache(source, data, fetchedAt);
      return { data, fromCache: false, stale: false, fetchedAt };
    } catch (err) {
      // 3) 下载失败 → 有旧缓存则降级（标注 stale，上层提示「数据可能不是最新」）
      if (cached) {
        return { data: cached.data, fromCache: true, stale: true, fetchedAt: cached.fetchedAt };
      }
      throw new Error(
        `香港学校数据（${source.note}）暂时无法下载，且本地暂无缓存。请稍后重试，或访问教育局官网查询。`,
        { cause: err }
      );
    }
  }

  return {
    get(source: DataSource): Promise<FetchResult> {
      const existing = inFlight.get(source.id);
      if (existing) return existing;
      const p = doGet(source);
      inFlight.set(source.id, p);
      const cleanup = () => {
        if (inFlight.get(source.id) === p) inFlight.delete(source.id);
      };
      p.then(cleanup, cleanup);
      return p;
    },
  };
}
