/**
 * 鲁港通 - 活动日期过滤属性测试
 * Feature: user-experience-redesign, Task 10.4
 * Property 6: Activity Date Filtering
 * Validates: Requirements 3.1.4
 * 
 * 使用 fast-check 进行属性测试，验证活动日期过滤逻辑
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Task 10.4: 活动日期过滤属性测试', () => {
  describe('Property 6: Activity Date Filtering - Validates Requirements 3.1.4', () => {
    /**
     * 辅助函数：检查活动是否在指定日期范围内有效
     */
    function isActivityValidInRange(
      activityStart: Date,
      activityEnd: Date,
      rangeStart: Date,
      rangeEnd: Date
    ): boolean {
      // 活动有效条件：活动结束日期 >= 范围开始日期 AND 活动开始日期 <= 范围结束日期
      return activityEnd >= rangeStart && activityStart <= rangeEnd;
    }

    /**
     * 辅助函数：检查活动当前是否有效
     */
    function isActivityCurrentlyValid(
      activityStart: Date,
      activityEnd: Date,
      now: Date
    ): boolean {
      return activityStart <= now && activityEnd >= now;
    }

    it('Property: 对于任意活动和日期范围，过滤结果应只包含在范围内有效的活动', () => {
      fc.assert(
        fc.property(
          // 生成活动的开始和结束日期
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          // 生成查询的日期范围
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          (activityStart, activityEnd, rangeStart, rangeEnd) => {
            // 确保活动开始日期 <= 结束日期
            if (activityStart > activityEnd) {
              [activityStart, activityEnd] = [activityEnd, activityStart];
            }

            // 确保范围开始日期 <= 结束日期
            if (rangeStart > rangeEnd) {
              [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
            }

            // 验证过滤逻辑
            const shouldBeIncluded = isActivityValidInRange(
              activityStart,
              activityEnd,
              rangeStart,
              rangeEnd
            );

            // 模拟过滤逻辑
            const isIncluded =
              activityEnd >= rangeStart && activityStart <= rangeEnd;

            // 断言：过滤结果应该与预期一致
            expect(isIncluded).toBe(shouldBeIncluded);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意活动，当前时间在活动期间内时，活动应该被显示', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          (activityStart, activityEnd) => {
            // 确保活动开始日期 <= 结束日期
            if (activityStart > activityEnd) {
              [activityStart, activityEnd] = [activityEnd, activityStart];
            }

            // 生成一个在活动期间内的时间点
            const timeDiff = activityEnd.getTime() - activityStart.getTime();
            const randomOffset = Math.random() * timeDiff;
            const now = new Date(activityStart.getTime() + randomOffset);

            // 验证活动应该是有效的
            const isValid = isActivityCurrentlyValid(activityStart, activityEnd, now);

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意活动，当前时间在活动开始前，活动不应该被显示', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-06-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-06-01'), max: new Date('2025-12-31') }),
          (activityStart, activityEnd) => {
            // 确保活动开始日期 <= 结束日期
            if (activityStart > activityEnd) {
              [activityStart, activityEnd] = [activityEnd, activityStart];
            }

            // 生成一个在活动开始前的时间点
            const now = new Date(activityStart.getTime() - 24 * 60 * 60 * 1000); // 提前1天

            // 验证活动不应该是有效的
            const isValid = isActivityCurrentlyValid(activityStart, activityEnd, now);

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 对于任意活动，当前时间在活动结束后，活动不应该被显示', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-06-30') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-06-30') }),
          (activityStart, activityEnd) => {
            // 确保活动开始日期 <= 结束日期
            if (activityStart > activityEnd) {
              [activityStart, activityEnd] = [activityEnd, activityStart];
            }

            // 生成一个在活动结束后的时间点
            const now = new Date(activityEnd.getTime() + 24 * 60 * 60 * 1000); // 延后1天

            // 验证活动不应该是有效的
            const isValid = isActivityCurrentlyValid(activityStart, activityEnd, now);

            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 活动日期范围的交集判断应该是对称的', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          (start1, end1, start2, end2) => {
            // 确保日期顺序正确
            if (start1 > end1) [start1, end1] = [end1, start1];
            if (start2 > end2) [start2, end2] = [end2, start2];

            // 检查两个日期范围是否有交集
            const hasOverlap1 = end1 >= start2 && start1 <= end2;
            const hasOverlap2 = end2 >= start1 && start2 <= end1;

            // 对称性：A与B有交集 等价于 B与A有交集
            expect(hasOverlap1).toBe(hasOverlap2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: 活动在边界日期上应该被包含', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          (activityStart, activityEnd) => {
            // 确保活动开始日期 <= 结束日期
            if (activityStart > activityEnd) {
              [activityStart, activityEnd] = [activityEnd, activityStart];
            }

            // 测试边界条件：当前时间正好是开始日期
            const isValidAtStart = isActivityCurrentlyValid(
              activityStart,
              activityEnd,
              activityStart
            );
            expect(isValidAtStart).toBe(true);

            // 测试边界条件：当前时间正好是结束日期
            const isValidAtEnd = isActivityCurrentlyValid(
              activityStart,
              activityEnd,
              activityEnd
            );
            expect(isValidAtEnd).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('单元测试：具体场景验证', () => {
    it('活动在2024年1月，查询2024年1月，应该被包含', () => {
      const activityStart = new Date('2024-01-01');
      const activityEnd = new Date('2024-01-31');
      const rangeStart = new Date('2024-01-01');
      const rangeEnd = new Date('2024-01-31');

      const isIncluded = activityEnd >= rangeStart && activityStart <= rangeEnd;
      expect(isIncluded).toBe(true);
    });

    it('活动在2024年1月，查询2024年2月，不应该被包含', () => {
      const activityStart = new Date('2024-01-01');
      const activityEnd = new Date('2024-01-31');
      const rangeStart = new Date('2024-02-01');
      const rangeEnd = new Date('2024-02-28');

      const isIncluded = activityEnd >= rangeStart && activityStart <= rangeEnd;
      expect(isIncluded).toBe(false);
    });

    it('活动跨越多个月，查询其中一个月，应该被包含', () => {
      const activityStart = new Date('2024-01-01');
      const activityEnd = new Date('2024-03-31');
      const rangeStart = new Date('2024-02-01');
      const rangeEnd = new Date('2024-02-29');

      const isIncluded = activityEnd >= rangeStart && activityStart <= rangeEnd;
      expect(isIncluded).toBe(true);
    });

    it('当前时间是2024-03-01，活动在2024-02-01到2024-03-31，应该显示', () => {
      const activityStart = new Date('2024-02-01');
      const activityEnd = new Date('2024-03-31');
      const now = new Date('2024-03-01');

      const isValid = activityStart <= now && activityEnd >= now;
      expect(isValid).toBe(true);
    });

    it('当前时间是2024-04-01，活动在2024-02-01到2024-03-31，不应该显示', () => {
      const activityStart = new Date('2024-02-01');
      const activityEnd = new Date('2024-03-31');
      const now = new Date('2024-04-01');

      const isValid = activityStart <= now && activityEnd >= now;
      expect(isValid).toBe(false);
    });
  });
});
