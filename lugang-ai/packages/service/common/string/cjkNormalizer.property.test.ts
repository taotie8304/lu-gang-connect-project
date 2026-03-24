/**
 * 鲁港通 - CJK Normalizer 属性测试
 * Feature: cjk-search-normalization
 *
 * 使用 fast-check 进行属性测试，验证简繁转换核心逻辑
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  simplifiedToTraditional,
  traditionalToSimplified,
  containsChinese,
  convertParamsS2T
} from './cjkNormalizer';

/**
 * 常见简体字集合（round-trip 安全的字符）
 * 排除一对多映射字符（如 "发" → "發"/"髮"），只使用确定性映射
 */
const ROUND_TRIP_SAFE_SIMPLIFIED = [
  '学', '国', '门', '车', '书', '长', '东', '风', '马', '鸟',
  '鱼', '龙', '电', '云', '飞', '机', '关', '开', '见', '贝',
  '页', '语', '话', '认', '识', '读', '写', '听', '说', '买',
  '卖', '银', '钱', '铁', '铜', '锁', '钟', '镜', '针', '线',
  '纸', '红', '绿', '蓝', '黄', '黑', '白', '灰', '紫', '橙',
  '猫', '狗', '鸡', '鸭', '牛', '羊', '猪', '虎', '兔', '蛇',
  '树', '花', '草', '叶', '果', '种', '园', '场', '桥', '楼',
  '医', '药', '病', '痛', '热', '冷', '饭', '饮', '饼', '糖'
];

/**
 * 生成由 round-trip 安全的简体字组成的字符串
 */
const simplifiedChineseArb = fc
  .array(fc.constantFrom(...ROUND_TRIP_SAFE_SIMPLIFIED), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

/**
 * 生成纯 ASCII 字符串（不含中文）
 */
const asciiStringArb = fc
  .array(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?-_=+[]{}()'
    ),
    { minLength: 1, maxLength: 50 }
  )
  .map((chars) => chars.join(''));

describe('Feature: cjk-search-normalization, Property 1: 简繁转换 round-trip', () => {
  /**
   * Property 1: 简繁转换 round-trip
   * For any valid simplified Chinese string, converting to traditional then back
   * to simplified SHALL produce a string equivalent to the original input.
   * Validates: Requirements 2.4
   */
  it('S→T→S round-trip produces equivalent output for safe simplified characters', () => {
    fc.assert(
      fc.property(simplifiedChineseArb, (simplified) => {
        const traditional = simplifiedToTraditional(simplified);
        const backToSimplified = traditionalToSimplified(traditional);
        expect(backToSimplified).toBe(simplified);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: cjk-search-normalization, Property 2: 非中文字符保留', () => {
  /**
   * Property 2: 非中文字符保留
   * For any string composed entirely of non-Chinese characters,
   * applying S2T conversion SHALL produce an identical string.
   * Validates: Requirements 2.3
   */
  it('S2T conversion is identity on non-Chinese strings', () => {
    fc.assert(
      fc.property(asciiStringArb, (ascii) => {
        const result = simplifiedToTraditional(ascii);
        expect(result).toBe(ascii);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * 生成随机嵌套对象，包含中文和非中文字符串值
 */
const keyArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 8 })
  .map((chars) => chars.join(''));

const shortKeyArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 5 })
  .map((chars) => chars.join(''));

const nestedParamsArb: fc.Arbitrary<Record<string, any>> = fc.dictionary(
  keyArb,
  fc.oneof(
    // 中文字符串值
    simplifiedChineseArb,
    // 非中文字符串值
    asciiStringArb,
    // 数字
    fc.integer(),
    // 布尔值
    fc.boolean(),
    // 嵌套对象（一层深）
    fc.dictionary(
      shortKeyArb,
      fc.oneof(simplifiedChineseArb, asciiStringArb, fc.integer(), fc.boolean())
    )
  )
);

describe('Feature: cjk-search-normalization, Property 3: 递归参数转换完整性', () => {
  /**
   * Property 3: 递归参数转换完整性
   * For any nested object containing string values with Chinese characters,
   * applying convertParamsS2T SHALL convert all Chinese string values while
   * preserving the object structure (same keys, same nesting depth, same non-string values).
   * Validates: Requirements 1.1, 1.3
   */
  it('convertParamsS2T preserves structure and converts all Chinese strings', () => {
    fc.assert(
      fc.property(nestedParamsArb, (params) => {
        const converted = convertParamsS2T(params);

        // Same keys
        expect(Object.keys(converted).sort()).toEqual(Object.keys(params).sort());

        for (const [key, value] of Object.entries(params)) {
          if (typeof value === 'string') {
            if (containsChinese(value)) {
              // Chinese strings should be converted (different from original for simplified chars)
              expect(converted[key]).toBe(simplifiedToTraditional(value));
            } else {
              // Non-Chinese strings should be unchanged
              expect(converted[key]).toBe(value);
            }
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            // Non-string values should be unchanged
            expect(converted[key]).toBe(value);
          } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Nested objects should have same keys
            expect(Object.keys(converted[key]).sort()).toEqual(Object.keys(value).sort());
            // And each value should follow the same rules
            for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, any>)) {
              if (typeof nestedValue === 'string' && containsChinese(nestedValue)) {
                expect(converted[key][nestedKey]).toBe(simplifiedToTraditional(nestedValue));
              } else {
                expect(converted[key][nestedKey]).toBe(nestedValue);
              }
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: cjk-search-normalization, Property 5: 知识库查询扩展', () => {
  /**
   * Property 5: 知识库查询扩展
   * For any simplified Chinese query string, when enableCjkNormalization is true,
   * the expanded query set SHALL contain at least the original query and its
   * traditional Chinese equivalent. The expanded set size SHALL be greater than
   * or equal to the original set size.
   * Validates: Requirements 3.1, 3.2, 3.4
   */

  /**
   * 鲁港通 - 模拟 searchDatasetData 中的查询扩展逻辑
   * 与 controller.ts 中的实现保持一致
   */
  function expandQueries(
    queries: string[],
    enableCjkNormalization: boolean
  ): string[] {
    if (!enableCjkNormalization) return queries;
    const expandedQueries = queries.flatMap((q) => {
      const traditional = simplifiedToTraditional(q);
      const simplified = traditionalToSimplified(q);
      return [q, traditional, simplified];
    });
    return [...new Set(expandedQueries)];
  }

  it('expanded query set contains original queries and traditional equivalents', () => {
    const queriesArb = fc.array(simplifiedChineseArb, { minLength: 1, maxLength: 5 });

    fc.assert(
      fc.property(queriesArb, (queries) => {
        const expanded = expandQueries(queries, true);

        // 扩展后的集合应包含所有原始查询
        for (const q of queries) {
          expect(expanded).toContain(q);
        }

        // 扩展后的集合应包含每个查询的繁体版本
        for (const q of queries) {
          expect(expanded).toContain(simplifiedToTraditional(q));
        }

        // 扩展后的集合大小 >= 原始集合大小
        expect(expanded.length).toBeGreaterThanOrEqual(new Set(queries).size);
      }),
      { numRuns: 100 }
    );
  });

  it('disabling CJK normalization returns queries unchanged', () => {
    const queriesArb = fc.array(simplifiedChineseArb, { minLength: 1, maxLength: 5 });

    fc.assert(
      fc.property(queriesArb, (queries) => {
        const result = expandQueries(queries, false);
        expect(result).toEqual(queries);
      }),
      { numRuns: 100 }
    );
  });
});
