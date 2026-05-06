// 鲁港通 - 本地集成测试
// 任务 10.1：测试各种用户问题、验证 API 调用、检查响应数据格式
// 模拟 FastGPT 工作流调用插件的完整流程

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputType, OutputType, tool } from '../src/index';
import { parseQuestion } from '../src/parser';
import { geocodeRoute } from '../src/geocoder';
import { createAPICallPlan } from '../src/router';

// ============================================================
// 端到端流程测试：模拟各种用户问题
// ============================================================

describe('端到端流程：各种用户问题', () => {
  // 简体中文路线查询
  it('简体中文：从口岸到市区', async () => {
    const output = await tool({
      question: '从落马洲口岸到香港立法会怎么走',
      language: 'zh-CN',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    expect(output.metadata.apisCalled.length).toBeGreaterThan(0);
    // transit-planner 优先使用内置路网数据，应成功返回路线
    expect(output.metadata.apisCalled).toContain('transit-planner');
    expect(output.metadata.apiStatus?.['transit-planner']).toBe('success');
    expect(output.routes.length).toBeGreaterThan(0);
  }, 20000);

  // 繁体中文路线查询
  it('繁体中文：從口岸到市區', async () => {
    const output = await tool({
      question: '從落馬洲到銅鑼灣怎麼走',
      language: 'zh-HK',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    expect(output.metadata.apisCalled).toContain('transit-planner');
    expect(output.routes.length).toBeGreaterThan(0);
  }, 20000);

  // 英文路线查询
  it('英文：from border to city', async () => {
    const output = await tool({
      question: 'from central to causeway bay',
      language: 'en',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    expect(output.metadata.apisCalled).toContain('transit-planner');
    expect(output.routes.length).toBeGreaterThan(0);
  }, 20000);

  // 带交通偏好的查询
  it('带交通偏好：坐地铁', async () => {
    const output = await tool({
      question: '坐地铁从尖沙咀到中环',
      language: 'zh-CN',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    // transit-planner 应处理 MTR 路线，routes 非空
    expect(output.routes.length).toBeGreaterThan(0);
  }, 20000);

  // 只有终点的查询
  it('只有终点：去尖沙咀', async () => {
    const output = await tool({
      question: '去尖沙咀怎么走',
      language: 'zh-CN',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    // 没有起点，TDAS 不应该被调用
    expect(output.metadata.apiStatus?.['tdas']).not.toBe('success');
  }, 20000);

  // 无法识别的问题
  it('无法识别的问题应该返回错误提示', async () => {
    const output = await tool({
      question: '今天天气怎么样',
      language: 'zh-CN',
    });
    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);
    expect(output.error).toBeDefined();
    expect(output.routes).toEqual([]);
  });
});

// ============================================================
// 输入验证测试
// ============================================================

describe('Zod 输入验证', () => {
  it('有效输入应该通过验证', () => {
    const cases = [
      { question: '从落马洲到中环', language: 'zh-CN' as const },
      { question: '去尖沙咀' },
      { question: 'from central to tst', language: 'en' as const },
      { question: '從落馬洲到銅鑼灣', language: 'zh-HK' as const },
    ];
    for (const c of cases) {
      const r = InputType.safeParse(c);
      expect(r.success, `输入 ${JSON.stringify(c)} 应该通过验证`).toBe(true);
    }
  });

  it('无效输入应该被拒绝', () => {
    const cases = [
      {},                          // 缺少 question
      { language: 'zh-CN' },       // 缺少 question
      { question: '' },            // 空字符串
    ];
    for (const c of cases) {
      const r = InputType.safeParse(c);
      expect(r.success, `输入 ${JSON.stringify(c)} 应该被拒绝`).toBe(false);
    }
  });
});

// ============================================================
// 输出格式验证测试
// ============================================================

describe('输出数据格式验证', () => {
  it('routes 数组中每个元素应该有完整字段', async () => {
    // 使用 mock 来确保有路线数据
    const mockTDAS = [{
      eta: '00:48',
      distM: 17100,
      route: [
        { segId: 1, mode: 'WALK', distM: 500, eta: '00:06' },
        { segId: 2, mode: 'BUS', routeNo: '215X', from: '新港中心', to: '旺角', eta: '00:25', stops: 5 },
      ],
    }];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockTDAS), { status: 200 })
    );

    const output = await tool({
      question: '从尖沙咀到旺角',
      language: 'zh-CN',
    });

    const v = OutputType.safeParse(output);
    expect(v.success).toBe(true);

    for (const route of output.routes) {
      expect(route.id).toBeDefined();
      expect(typeof route.totalTime).toBe('number');
      expect(typeof route.totalDistance).toBe('string');
      expect(['direct', 'transfer']).toContain(route.type);
      expect(Array.isArray(route.steps)).toBe(true);
      expect(typeof route.estimatedCost).toBe('number');

      for (const step of route.steps) {
        expect(['walk', 'bus', 'mtr', 'gmb', 'tram', 'ferry']).toContain(step.type);
        expect(typeof step.description).toBe('string');
        expect(typeof step.duration).toBe('number');
      }
    }

    vi.restoreAllMocks();
  });

  it('paymentInfo 应该有完整字段', async () => {
    const output = await tool({
      question: '从尖沙咀到旺角',
      language: 'zh-CN',
    });

    expect(typeof output.paymentInfo.octopus).toBe('boolean');
    expect(typeof output.paymentInfo.cash).toBe('boolean');
    expect(typeof output.paymentInfo.creditCard).toBe('boolean');
    expect(typeof output.paymentInfo.mobilePayment).toBe('boolean');
    expect(Array.isArray(output.paymentInfo.notes)).toBe(true);
  }, 20000);

  it('metadata 应该有有效的时间戳', async () => {
    const output = await tool({
      question: '从尖沙咀到旺角',
      language: 'zh-CN',
    });

    expect(output.metadata.dataTimestamp).toBeDefined();
    const ts = new Date(output.metadata.dataTimestamp);
    expect(ts.toString()).not.toBe('Invalid Date');
    expect(Array.isArray(output.metadata.apisCalled)).toBe(true);
  }, 20000);
});

// ============================================================
// 解析器 → 编码器 → 路由器 管道测试
// ============================================================

describe('解析管道完整性', () => {
  const testCases = [
    { q: '从落马洲口岸到香港立法会怎么走', lang: 'zh-CN', expectTDAS: true, expectOrigin: '落马洲口岸', expectDest: '香港立法会' },
    { q: '從尖沙咀到銅鑼灣', lang: 'zh-HK', expectTDAS: true, expectOrigin: '尖沙咀', expectDest: '铜锣湾' },
    { q: 'from central to causeway bay', lang: 'en', expectTDAS: true, expectOrigin: '中环', expectDest: '铜锣湾' },
    { q: '坐地铁从金钟到旺角', lang: 'zh-CN', expectTDAS: true, expectOrigin: '金钟', expectDest: '旺角' },
    { q: '去尖沙咀怎么走', lang: 'zh-CN', expectTDAS: false, expectDest: '尖沙咀' },
  ];

  for (const tc of testCases) {
    it(`解析管道：${tc.q}`, () => {
      // 1. Parser
      const parsed = parseQuestion(tc.q, tc.lang);
      if (tc.expectOrigin) expect(parsed.origin).toBe(tc.expectOrigin);
      if (tc.expectDest) expect(parsed.destination).toBe(tc.expectDest);

      // 2. Geocoder
      const { originCoord, destCoord } = geocodeRoute(parsed.origin, parsed.destination);
      if (tc.expectOrigin) expect(originCoord).toBeDefined();
      if (tc.expectDest) expect(destCoord).toBeDefined();

      // 3. Router
      const plan = createAPICallPlan(parsed, originCoord, destCoord);
      expect(plan.useTDAS).toBe(tc.expectTDAS);
      if (tc.expectTDAS) {
        expect(plan.tdasParams).toBeDefined();
      }
      expect(plan.etaQueries.length).toBeGreaterThan(0);
    });
  }
});
