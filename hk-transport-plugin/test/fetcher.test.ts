// 鲁港通 - API 调用器测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  fetchWithTimeout,
  cache,
  fetchKMBStopETA,
  fetchKMBRouteETA,
  fetchKMBRoutes,
  fetchCTBStopETA,
  fetchCTBRoutes,
  fetchGMBStopETA,
  fetchMTRSchedule,
  fetchNLBStopETA,
  fetchTDASRoute,
  fetchBusFares,
  executeBatchFetch,
} from '../src/fetcher';
import type { KMBETAItem, CTBETAItem } from '../src/types';

// ============================================================
// 单元测试：通用 HTTP 调用函数
// ============================================================

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  it('成功的 GET 请求应该返回 success: true', async () => {
    const mockData = { data: [{ route: '12' }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await fetchWithTimeout<typeof mockData>('https://example.com/api');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
  });

  it('HTTP 错误应该返回 success: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    );

    const result = await fetchWithTimeout('https://example.com/api');
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');
  });

  it('网络错误应该返回 success: false', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchWithTimeout('https://example.com/api');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('超时应该返回超时错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      () => new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('The operation was aborted', 'AbortError')), 50);
      })
    );

    const result = await fetchWithTimeout('https://example.com/api', 10);
    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');
  });
});

// ============================================================
// 单元测试：内存缓存
// ============================================================

describe('MemoryCache', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('应该存储和读取数据', () => {
    cache.set('test', { value: 42 }, 60000);
    expect(cache.get('test')).toEqual({ value: 42 });
  });

  it('过期数据应该返回 undefined', () => {
    cache.set('test', { value: 42 }, 0); // TTL = 0，立即过期
    expect(cache.get('test')).toBeUndefined();
  });

  it('不存在的 key 应该返回 undefined', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('clear 应该清空所有缓存', () => {
    cache.set('a', 1, 60000);
    cache.set('b', 2, 60000);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

// ============================================================
// 单元测试：KMB API 调用
// ============================================================

describe('KMB API', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  it('fetchKMBStopETA 应该解包 data 字段', async () => {
    const mockItems: KMBETAItem[] = [{
      co: 'KMB', route: '12', dir: 'O', service_type: '1', seq: 1,
      dest_tc: '尖沙咀碼頭', dest_sc: '尖沙咀码头', dest_en: 'Tsim Sha Tsui Ferry',
      eta: '2025-01-01T12:00:00+08:00', rmk_tc: '', rmk_sc: '', rmk_en: '',
      eta_seq: 1, data_timestamp: '2025-01-01T12:00:00+08:00',
    }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'ETA', version: '1.0', generated_timestamp: '', data: mockItems }))
    );

    const result = await fetchKMBStopETA('YT205');
    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockItems);
    expect(result.data![0].route).toBe('12');
  });

  it('fetchKMBRoutes 应该使用缓存', async () => {
    const mockRoutes = [{ route: '12', bound: 'O', service_type: '1', orig_tc: '深水埗', orig_sc: '深水埗', orig_en: 'Sham Shui Po', dest_tc: '尖沙咀', dest_sc: '尖沙咀', dest_en: 'Tsim Sha Tsui' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'Route', version: '1.0', generated_timestamp: '', data: mockRoutes }))
    );

    // 第一次调用应该 fetch
    const result1 = await fetchKMBRoutes();
    expect(result1.success).toBe(true);

    // 第二次调用应该用缓存，不再 fetch
    const result2 = await fetchKMBRoutes();
    expect(result2.success).toBe(true);
    expect(result2.data).toEqual(mockRoutes);

    // fetch 只被调用了一次
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// 单元测试：CTB API 调用
// ============================================================

describe('CTB API', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  it('fetchCTBStopETA 应该解包 data 字段', async () => {
    const mockItems: CTBETAItem[] = [{
      co: 'CTB', route: '962', dir: 'O', seq: 1,
      dest_tc: '銅鑼灣', dest_sc: '铜锣湾', dest_en: 'Causeway Bay',
      eta: '2025-01-01T12:00:00+08:00', rmk_tc: '', rmk_sc: '', rmk_en: '',
      eta_seq: 1, data_timestamp: '2025-01-01T12:00:00+08:00',
    }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'ETA', version: '1.0', generated_timestamp: '', data: mockItems }))
    );

    const result = await fetchCTBStopETA('001234', '962');
    expect(result.success).toBe(true);
    expect(result.data![0].co).toBe('CTB');
  });
});

// ============================================================
// 单元测试：批量并发调用
// ============================================================

describe('executeBatchFetch', () => {
  beforeEach(() => {
    cache.clear();
    vi.restoreAllMocks();
  });

  it('无 TDAS 无 ETA 查询时应该全部标记为 skipped', async () => {
    const result = await executeBatchFetch({
      useTDAS: false,
      etaQueries: [],
    });
    expect(result.apiStatus['tdas']).toBe('skipped');
  });

  it('部分 API 失败不应该影响其他 API', async () => {
    // 第一个 fetch 成功（KMB），第二个失败（MTR）
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          type: 'ETA', version: '1.0', generated_timestamp: '',
          data: [{ co: 'KMB', route: '12', dir: 'O', service_type: '1', seq: 1, dest_tc: '尖沙咀', dest_sc: '尖沙咀', dest_en: 'TST', eta: null, rmk_tc: '', rmk_sc: '', rmk_en: '', eta_seq: 1, data_timestamp: '' }],
        }))
      )
      .mockRejectedValueOnce(new Error('MTR API down'));

    const result = await executeBatchFetch({
      useTDAS: false,
      etaQueries: [
        { type: 'kmb', stopId: 'YT205' },
        { type: 'mtr' },
      ],
    });

    expect(result.apiStatus['kmb']).toBe('success');
    expect(result.apiStatus['mtr']).toBe('failed');
  });
});


// ============================================================
// 属性测试：Property 5 - ETA 数据完整性
// Feature: hk-smart-transport-assistant, Property 5: ETA 数据完整性
// **Validates: Requirements 3.2, 5.3, 6.2**
//
// 对于任意成功的 ETA API 响应，返回的数据应该包含所有必需字段
// （路线号、目的地、预计时间）
// ============================================================

describe('Property 5: ETA 数据完整性', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 生成随机 KMB ETA 数据
  const kmbETAItemArb = fc.record({
    co: fc.constant('KMB'),
    route: fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','A','B','C','X','N','P'), { minLength: 1, maxLength: 5 }),
    dir: fc.constantFrom('O', 'I'),
    service_type: fc.constantFrom('1', '2'),
    seq: fc.integer({ min: 1, max: 100 }),
    dest_tc: fc.string({ minLength: 1, maxLength: 20 }),
    dest_sc: fc.string({ minLength: 1, maxLength: 20 }),
    dest_en: fc.string({ minLength: 1, maxLength: 40 }),
    eta: fc.oneof(
      fc.constant(null),
      fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
    ),
    rmk_tc: fc.string({ maxLength: 20 }),
    rmk_sc: fc.string({ maxLength: 20 }),
    rmk_en: fc.string({ maxLength: 40 }),
    eta_seq: fc.integer({ min: 1, max: 3 }),
    data_timestamp: fc.date().map(d => d.toISOString()),
  });

  // 生成随机 CTB ETA 数据
  const ctbETAItemArb = fc.record({
    co: fc.constant('CTB'),
    route: fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','A','B','C','X','N','P'), { minLength: 1, maxLength: 5 }),
    dir: fc.constantFrom('O', 'I'),
    seq: fc.integer({ min: 1, max: 100 }),
    dest_tc: fc.string({ minLength: 1, maxLength: 20 }),
    dest_sc: fc.string({ minLength: 1, maxLength: 20 }),
    dest_en: fc.string({ minLength: 1, maxLength: 40 }),
    eta: fc.oneof(
      fc.constant(null),
      fc.date({ min: new Date('2024-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
    ),
    rmk_tc: fc.string({ maxLength: 20 }),
    rmk_sc: fc.string({ maxLength: 20 }),
    rmk_en: fc.string({ maxLength: 40 }),
    eta_seq: fc.integer({ min: 1, max: 3 }),
    data_timestamp: fc.date().map(d => d.toISOString()),
  });

  it('对于任意成功的 KMB ETA 响应，每条数据应该包含路线号、目的地和预计时间字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(kmbETAItemArb, { minLength: 1, maxLength: 10 }),
        async (items) => {
          // 模拟 KMB API 返回
          vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
              type: 'ETA', version: '1.0', generated_timestamp: '',
              data: items,
            }))
          );

          const result = await fetchKMBStopETA('TEST_STOP');

          // 验证成功
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          // 验证每条数据都包含必需字段
          for (const item of result.data!) {
            // 路线号：非空字符串
            expect(typeof item.route).toBe('string');
            expect(item.route.length).toBeGreaterThan(0);

            // 目的地：繁体中文非空
            expect(typeof item.dest_tc).toBe('string');
            expect(item.dest_tc.length).toBeGreaterThan(0);

            // 预计时间：null 或 ISO 8601 字符串
            expect(item.eta === null || typeof item.eta === 'string').toBe(true);

            // eta_seq 应该是正整数
            expect(item.eta_seq).toBeGreaterThanOrEqual(1);
          }

          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意成功的 CTB ETA 响应，每条数据应该包含路线号、目的地和预计时间字段', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(ctbETAItemArb, { minLength: 1, maxLength: 10 }),
        async (items) => {
          // 模拟 CTB API 返回
          vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
              type: 'ETA', version: '1.0', generated_timestamp: '',
              data: items,
            }))
          );

          const result = await fetchCTBStopETA('TEST_STOP', 'TEST_ROUTE');

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          for (const item of result.data!) {
            expect(typeof item.route).toBe('string');
            expect(item.route.length).toBeGreaterThan(0);

            expect(typeof item.dest_tc).toBe('string');
            expect(item.dest_tc.length).toBeGreaterThan(0);

            expect(item.eta === null || typeof item.eta === 'string').toBe(true);

            expect(item.eta_seq).toBeGreaterThanOrEqual(1);
          }

          vi.restoreAllMocks();
        }
      ),
      { numRuns: 100 }
    );
  });
});
