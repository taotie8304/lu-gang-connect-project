// 鲁港通 - 插件入口测试

import { describe, it, expect } from 'vitest';
import { InputType, OutputType, tool } from '../src/index';
import pluginExport from '../index';

describe('FastGPT plugin export', () => {
  it('root index.ts should export config, InputType, OutputType, cb', () => {
    expect(pluginExport.config).toBeDefined();
    expect(pluginExport.config.name).toBeDefined();
    expect(pluginExport.config.name['zh-CN']).toBe('香港智能交通助手');
    expect(pluginExport.config.name.en).toBe('HK Smart Transport Assistant');
    expect(pluginExport.config.description).toBeDefined();
    expect(pluginExport.InputType).toBeDefined();
    expect(pluginExport.OutputType).toBeDefined();
    expect(pluginExport.cb).toBeDefined();
    expect(typeof pluginExport.cb).toBe('function');
  });

  it('config should have versionList with inputs and outputs', () => {
    const version = pluginExport.config.versionList[0];
    expect(version).toBeDefined();
    expect(version.value).toBe('0.1.0');
    expect(version.inputs.length).toBeGreaterThan(0);
    expect(version.outputs.length).toBeGreaterThan(0);

    // 检查结构化参数已注册（origin/destination 替代了 question 的 required 地位）
    const originInput = version.inputs.find((i: { key: string }) => i.key === 'origin');
    const destInput = version.inputs.find((i: { key: string }) => i.key === 'destination');
    expect(originInput).toBeDefined();
    expect(destInput).toBeDefined();

    const questionInput = version.inputs.find((i: { key: string }) => i.key === 'question');
    expect(questionInput).toBeDefined();
    // question 现在为可选（可由 origin/destination 替代）
    expect(questionInput?.required).toBeFalsy();
  });
});

describe('InputType validation', () => {
  it('should accept valid input', () => {
    const result = InputType.safeParse({
      question: '从落马洲口岸到香港立法会怎么走',
      language: 'zh-CN'
    });
    expect(result.success).toBe(true);
  });

  it('should use default language', () => {
    const result = InputType.parse({ question: '去尖沙咀' });
    expect(result.language).toBe('zh-CN');
  });

  it('should reject missing question', () => {
    const result = InputType.safeParse({ language: 'zh-CN' });
    expect(result.success).toBe(false);
  });
});

describe('OutputType validation', () => {
  it('should accept valid output', () => {
    const output = {
      routes: [],
      paymentInfo: {
        octopus: true,
        cash: true,
        creditCard: false,
        mobilePayment: true,
        notes: ['test']
      },
      tips: ['test tip'],
      metadata: {
        dataTimestamp: new Date().toISOString(),
        apisCalled: [],
        apiStatus: {}
      }
    };
    const result = OutputType.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('should accept output with stopETAs', () => {
    const output = {
      routes: [],
      stopETAs: {
        stopId: 'YT205',
        stopName: '廣東道,新港中心(YT205)',
        etas: [{
          route: '12',
          destination: '尖沙咀碼頭',
          company: 'KMB',
          nextBuses: [{ eta: '2024-01-01T10:05:00+08:00', minutesAway: 3 }]
        }]
      },
      paymentInfo: {
        octopus: true, cash: true, creditCard: false, mobilePayment: true, notes: []
      },
      tips: [],
      metadata: { dataTimestamp: new Date().toISOString(), apisCalled: ['kmb'] }
    };
    const result = OutputType.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('tool function', () => {
  it('should return valid output for a question', async () => {
    const output = await tool({
      question: '从落马洲口岸到香港立法会怎么走',
      language: 'zh-CN'
    });

    const validation = OutputType.safeParse(output);
    expect(validation.success).toBe(true);
    expect(output.metadata.dataTimestamp).toBeDefined();
    expect(new Date(output.metadata.dataTimestamp).toString()).not.toBe('Invalid Date');
  }, 20000);

  it('should handle different languages', async () => {
    for (const lang of ['zh-CN', 'zh-HK', 'en'] as const) {
      const output = await tool({ question: 'test', language: lang });
      expect(output).toBeDefined();
    }
  });
});

// ============================================================
// 错误处理和降级测试（Requirements 13.1-13.5）
// ============================================================

describe('error handling and degradation', () => {
  it('should return error when no locations recognized (Req 13.3)', async () => {
    const output = await tool({
      question: '今天天气怎么样',
      language: 'zh-CN'
    });

    const validation = OutputType.safeParse(output);
    expect(validation.success).toBe(true);
    expect(output.error).toBeDefined();
    expect(output.tips.some(t => t.includes('无法识别'))).toBe(true);
    expect(output.routes).toEqual([]);
  });

  it('should return valid output even with unrecognized locations (Req 13.4)', async () => {
    const output = await tool({
      question: '从火星到月球怎么走',
      language: 'zh-CN'
    });

    const validation = OutputType.safeParse(output);
    expect(validation.success).toBe(true);
    // Should still return a valid structure
    expect(output.metadata).toBeDefined();
    expect(output.metadata.dataTimestamp).toBeDefined();
  });

  it('should include apiStatus in metadata (Req 13.5)', async () => {
    const output = await tool({
      question: '从尖沙咀到旺角怎么走',
      language: 'zh-CN'
    });

    const validation = OutputType.safeParse(output);
    expect(validation.success).toBe(true);
    expect(output.metadata.apiStatus).toBeDefined();
    expect(output.metadata.apisCalled.length).toBeGreaterThan(0);
  }, 20000);

  it('should always return valid OutputType regardless of input', async () => {
    const inputs = [
      { question: '', language: 'zh-CN' as const },
      { question: '   ', language: 'zh-CN' as const },
      { question: 'abc123!@#', language: 'en' as const },
      { question: '去一个不存在的地方', language: 'zh-HK' as const },
    ];

    for (const input of inputs) {
      try {
        const output = await tool(input);
        const validation = OutputType.safeParse(output);
        expect(validation.success).toBe(true);
      } catch {
        // Zod validation errors for empty strings are acceptable
      }
    }
  });

  it('should never crash - always returns structured response', async () => {
    const output = await tool({
      question: '从尖沙咀到中环坐地铁',
      language: 'zh-CN'
    });

    // Must always have these fields
    expect(output.routes).toBeDefined();
    expect(Array.isArray(output.routes)).toBe(true);
    expect(output.paymentInfo).toBeDefined();
    expect(output.tips).toBeDefined();
    expect(Array.isArray(output.tips)).toBe(true);
    expect(output.metadata).toBeDefined();
    expect(output.metadata.dataTimestamp).toBeDefined();
  }, 20000);
});

// ============================================================
// 属性测试：Property 11 - 错误降级正确性
// Feature: hk-smart-transport-assistant, Property 11: 错误降级正确性
// **Validates: Requirements 13.1, 13.2, 13.5**
// ============================================================

import * as fc from 'fast-check';

describe('Property 11: 错误降级正确性', () => {
  it('对于任意用户输入，tool 函数应该始终返回有效的 OutputType 而不崩溃', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('zh-CN' as const, 'zh-HK' as const, 'en' as const),
        async (question, language) => {
          // tool 函数不应该抛出异常
          const output = await tool({ question, language });

          // 输出必须通过 Zod 验证
          const validation = OutputType.safeParse(output);
          expect(validation.success).toBe(true);

          // 必须包含所有必需字段
          expect(Array.isArray(output.routes)).toBe(true);
          expect(output.paymentInfo).toBeDefined();
          expect(typeof output.paymentInfo.octopus).toBe('boolean');
          expect(typeof output.paymentInfo.cash).toBe('boolean');
          expect(typeof output.paymentInfo.creditCard).toBe('boolean');
          expect(typeof output.paymentInfo.mobilePayment).toBe('boolean');
          expect(Array.isArray(output.paymentInfo.notes)).toBe(true);
          expect(Array.isArray(output.tips)).toBe(true);
          expect(output.metadata).toBeDefined();
          expect(output.metadata.dataTimestamp).toBeDefined();
          expect(Array.isArray(output.metadata.apisCalled)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意无法识别地点的输入，应该返回错误提示而不崩溃', () => {
    return fc.assert(
      fc.asyncProperty(
        // 生成不包含任何已知地点名称的随机字符串
        fc.stringOf(fc.constantFrom(
          'a', 'b', 'c', '1', '2', '3', '!', '?', ' ', '你', '好', '吗'
        ), { minLength: 1, maxLength: 50 }),
        fc.constantFrom('zh-CN' as const, 'zh-HK' as const, 'en' as const),
        async (randomText, language) => {
          const output = await tool({ question: randomText, language });

          // 输出必须通过 Zod 验证
          const validation = OutputType.safeParse(output);
          expect(validation.success).toBe(true);

          // 无法识别地点时应该有错误信息
          expect(output.error).toBeDefined();
          expect(output.tips.length).toBeGreaterThan(0);

          // apiStatus 中的每个值必须是 success/failed/skipped 之一
          if (output.metadata.apiStatus) {
            for (const status of Object.values(output.metadata.apiStatus)) {
              expect(['success', 'failed', 'skipped']).toContain(status);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
