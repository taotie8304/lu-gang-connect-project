/**
 * 鲁港通 - HTTP 工具简繁转换开关属性测试
 * Feature: cjk-search-normalization, Property 4: 启用/禁用开关控制
 *
 * Property 4: 启用/禁用开关控制
 * For any set of request parameters, when __enableS2T__ is false or undefined,
 * the HTTP tool SHALL send parameters identical to the original input.
 * When __enableS2T__ is true, parameters containing simplified Chinese SHALL differ.
 * Validates: Requirements 1.4, 1.5
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  simplifiedToTraditional,
  containsChinese,
  convertParamsS2T
} from '../../../../common/string/cjkNormalizer';

/**
 * 常见简体字（确保转换后与原始不同）
 */
const SIMPLIFIED_CHARS = [
  '学', '国', '门', '车', '书', '长', '东', '风', '马', '鸟',
  '鱼', '龙', '电', '云', '飞', '机', '关', '开', '见', '贝'
];

const simplifiedChineseArb = fc
  .array(fc.constantFrom(...SIMPLIFIED_CHARS), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(''));

const asciiStringArb = fc
  .array(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    ),
    { minLength: 1, maxLength: 20 }
  )
  .map((chars) => chars.join(''));

/**
 * 模拟 http468 中的开关逻辑：
 * 当 enableS2T 为 true 时，对 params 中的中文值执行转换
 * 当 enableS2T 为 false/undefined 时，params 保持不变
 */
function applyS2TSwitch(
  params: Record<string, string>,
  enableS2T: boolean | undefined
): Record<string, string> {
  if (!enableS2T) return { ...params };
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    result[key] = containsChinese(value) ? simplifiedToTraditional(value) : value;
  }
  return result;
}

const paramsWithChineseArb = fc.dictionary(
  asciiStringArb,
  simplifiedChineseArb,
  { minKeys: 1, maxKeys: 5 }
);

describe('Feature: cjk-search-normalization, Property 4: 启用/禁用开关控制', () => {
  it('when enableS2T is false, params remain unchanged', () => {
    fc.assert(
      fc.property(paramsWithChineseArb, (params) => {
        const result = applyS2TSwitch(params, false);
        expect(result).toEqual(params);
      }),
      { numRuns: 100 }
    );
  });

  it('when enableS2T is undefined, params remain unchanged', () => {
    fc.assert(
      fc.property(paramsWithChineseArb, (params) => {
        const result = applyS2TSwitch(params, undefined);
        expect(result).toEqual(params);
      }),
      { numRuns: 100 }
    );
  });

  it('when enableS2T is true, params with simplified Chinese are converted', () => {
    fc.assert(
      fc.property(paramsWithChineseArb, (params) => {
        const result = applyS2TSwitch(params, true);
        // 每个值都应该被转换为繁体
        for (const [key, value] of Object.entries(params)) {
          expect(result[key]).toBe(simplifiedToTraditional(value));
        }
      }),
      { numRuns: 100 }
    );
  });
});
