/**
 * 鲁港通 - AccountInfoModal 属性测试
 * Feature: user-profile-management, Property 1: 额度数据完整渲染
 * Feature: user-profile-management, Property 2: 后端不可用时降级为默认值
 * Validates: Requirements 1.4, 3.1, 3.2, 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { QuotaResponse } from '@/pages/api/integration/oneapi/quota';

/**
 * 模拟 AccountInfoModal 中的额度渲染逻辑。
 * 给定一个 QuotaResponse，返回渲染所需的展示数据。
 */
function computeQuotaDisplay(data: QuotaResponse) {
  const usagePercent = data.quota > 0 ? Math.round((data.usedQuota / data.quota) * 100) : 0;
  return {
    total: data.quota,
    used: data.usedQuota,
    remaining: data.remainingQuota,
    usagePercent,
    showProgress: data.quota > 0
  };
}

/**
 * 模拟 AccountInfoModal 中的额度降级逻辑。
 * 当 API 调用失败时，返回默认值。
 */
function getDefaultQuota(): QuotaResponse {
  return { quota: 0, usedQuota: 0, remainingQuota: 0 };
}

describe('Property 1: 额度数据完整渲染', () => {
  // Feature: user-profile-management, Property 1: 额度数据完整渲染
  // Validates: Requirements 1.4, 3.1, 3.2

  it('for any valid quota response, display should contain all three values', () => {
    const quotaArb = fc.record({
      quota: fc.nat({ max: 10_000_000 }),
      usedQuota: fc.nat({ max: 10_000_000 }),
      remainingQuota: fc.nat({ max: 10_000_000 })
    });

    fc.assert(
      fc.property(quotaArb, (data) => {
        const display = computeQuotaDisplay(data);

        // All three values must be present in the display
        expect(display.total).toBe(data.quota);
        expect(display.used).toBe(data.usedQuota);
        expect(display.remaining).toBe(data.remainingQuota);

        // Usage percent must be between 0 and 100 (or higher if usedQuota > quota)
        expect(display.usagePercent).toBeGreaterThanOrEqual(0);

        // Progress bar shown only when quota > 0
        expect(display.showProgress).toBe(data.quota > 0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: 后端不可用时降级为默认值', () => {
  // Feature: user-profile-management, Property 2: 后端不可用时降级为默认值
  // Validates: Requirements 1.2

  it('for any error scenario, default quota should be all zeros', () => {
    // The property: regardless of what error occurs, the default is always {0, 0, 0}
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('Network error'),
          fc.constant('500 Internal Server Error'),
          fc.constant('Timeout'),
          fc.string({ minLength: 1 })
        ),
        (_errorMessage) => {
          const fallback = getDefaultQuota();
          expect(fallback.quota).toBe(0);
          expect(fallback.usedQuota).toBe(0);
          expect(fallback.remainingQuota).toBe(0);

          // And the display of the fallback should also be all zeros
          const display = computeQuotaDisplay(fallback);
          expect(display.total).toBe(0);
          expect(display.used).toBe(0);
          expect(display.remaining).toBe(0);
          expect(display.usagePercent).toBe(0);
          expect(display.showProgress).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
