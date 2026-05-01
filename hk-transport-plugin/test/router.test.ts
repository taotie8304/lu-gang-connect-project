// 鲁港通 - 智能路由器测试

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createAPICallPlan, resolveETATypes, buildRoutePlan } from '../src/router';
import type { ParsedQuestion, GeoLocation } from '../src/types';

// ============================================================
// 测试用坐标
// ============================================================

const SAMPLE_ORIGIN: GeoLocation = { lat: 22.5144, lng: 114.0683, name: '落马洲口岸' };
const SAMPLE_DEST: GeoLocation = { lat: 22.2802, lng: 114.1662, name: '香港立法会' };

// ============================================================
// 单元测试：路由规则引擎
// ============================================================

describe('路由规则引擎', () => {
  it('有起点和终点坐标时应该启用 TDAS', () => {
    const parsed: ParsedQuestion = { keywords: ['test'] };
    const plan = createAPICallPlan(parsed, SAMPLE_ORIGIN, SAMPLE_DEST);
    expect(plan.useTDAS).toBe(true);
    expect(plan.tdasParams).toBeDefined();
    expect(plan.tdasParams!.start.lat).toBe(SAMPLE_ORIGIN.lat);
    expect(plan.tdasParams!.end.lat).toBe(SAMPLE_DEST.lat);
  });

  it('缺少起点坐标时不应该启用 TDAS', () => {
    const parsed: ParsedQuestion = { keywords: ['test'] };
    const plan = createAPICallPlan(parsed, undefined, SAMPLE_DEST);
    expect(plan.useTDAS).toBe(false);
    expect(plan.tdasParams).toBeUndefined();
  });

  it('缺少终点坐标时不应该启用 TDAS', () => {
    const parsed: ParsedQuestion = { keywords: ['test'] };
    const plan = createAPICallPlan(parsed, SAMPLE_ORIGIN, undefined);
    expect(plan.useTDAS).toBe(false);
    expect(plan.tdasParams).toBeUndefined();
  });

  it('无偏好时应该默认查询 KMB + CTB', () => {
    const parsed: ParsedQuestion = { keywords: ['test'] };
    const plan = createAPICallPlan(parsed);
    const types = plan.etaQueries.map(q => q.type);
    expect(types).toContain('kmb');
    expect(types).toContain('ctb');
  });

  it('偏好巴士时应该查询 KMB + CTB', () => {
    const parsed: ParsedQuestion = { transportPreference: ['bus'], keywords: ['test'] };
    const plan = createAPICallPlan(parsed);
    const types = plan.etaQueries.map(q => q.type);
    expect(types).toContain('kmb');
    expect(types).toContain('ctb');
  });

  it('偏好地铁时应该查询 MTR', () => {
    const parsed: ParsedQuestion = { transportPreference: ['mtr'], keywords: ['test'] };
    const plan = createAPICallPlan(parsed);
    const types = plan.etaQueries.map(q => q.type);
    expect(types).toContain('mtr');
    expect(types).not.toContain('kmb');
  });

  it('偏好小巴时应该查询 GMB', () => {
    const parsed: ParsedQuestion = { transportPreference: ['gmb'], keywords: ['test'] };
    const plan = createAPICallPlan(parsed);
    const types = plan.etaQueries.map(q => q.type);
    expect(types).toContain('gmb');
  });

  it('多种偏好时应该查询所有对应 API', () => {
    const parsed: ParsedQuestion = { transportPreference: ['bus', 'mtr'], keywords: ['test'] };
    const plan = createAPICallPlan(parsed);
    const types = plan.etaQueries.map(q => q.type);
    expect(types).toContain('kmb');
    expect(types).toContain('ctb');
    expect(types).toContain('mtr');
  });
});

// ============================================================
// 属性测试：Property 4 - 智能路由正确性
// Feature: hk-smart-transport-assistant, Property 4: 智能路由正确性
// **Validates: Requirements 2.1, 5.1, 6.1, 7.1, 8.1**
// ============================================================

describe('Property 4: 智能路由正确性', () => {
  // 偏好 → 期望的 ETA API 类型
  const preferenceExpectations: Record<string, string[]> = {
    bus: ['kmb', 'ctb'],
    mtr: ['mtr'],
    gmb: ['gmb'],
    nlb: ['nlb'],
  };

  const validPreferences = Object.keys(preferenceExpectations);

  // 属性：对于任意交通偏好，路由器应该生成包含对应 API 类型的调用计划
  it('对于任意交通偏好关键词，路由计划应该包含对应的 API 类型', () => {
    fc.assert(
      fc.property(
        fc.subarray(validPreferences, { minLength: 1 }),
        (preferences) => {
          const parsed: ParsedQuestion = {
            transportPreference: preferences,
            keywords: ['test'],
          };
          const plan = createAPICallPlan(parsed);
          const actualTypes = plan.etaQueries.map(q => q.type);

          // 每个偏好对应的 API 类型都应该出现在计划中
          for (const pref of preferences) {
            const expected = preferenceExpectations[pref];
            for (const expectedType of expected) {
              expect(actualTypes).toContain(expectedType);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // 坐标生成器
  const geoLocationArb = fc.record({
    lat: fc.double({ min: 22.15, max: 22.56, noNaN: true }),
    lng: fc.double({ min: 113.83, max: 114.35, noNaN: true }),
    name: fc.constant('test-location'),
  });

  // 属性：有起点和终点坐标时，TDAS 应该被启用且参数正确
  it('有起点和终点坐标时，TDAS 应该被启用且参数匹配输入坐标', () => {
    fc.assert(
      fc.property(
        geoLocationArb,
        geoLocationArb,
        (origin, dest) => {
          const parsed: ParsedQuestion = { keywords: ['test'] };
          const plan = createAPICallPlan(parsed, origin, dest);

          expect(plan.useTDAS).toBe(true);
          expect(plan.tdasParams).toBeDefined();
          expect(plan.tdasParams!.start.lat).toBe(origin.lat);
          expect(plan.tdasParams!.start.long).toBe(origin.lng);
          expect(plan.tdasParams!.end.lat).toBe(dest.lat);
          expect(plan.tdasParams!.end.long).toBe(dest.lng);
        }
      ),
      { numRuns: 100 }
    );
  });

  // 属性：无偏好时，默认应该包含 KMB 和 CTB
  it('无偏好时，默认应该包含 KMB 和 CTB', () => {
    fc.assert(
      fc.property(
        fc.option(geoLocationArb, { nil: undefined }),
        fc.option(geoLocationArb, { nil: undefined }),
        (origin, dest) => {
          const parsed: ParsedQuestion = { keywords: ['test'] };
          const plan = createAPICallPlan(parsed, origin, dest);
          const types = plan.etaQueries.map(q => q.type);

          expect(types).toContain('kmb');
          expect(types).toContain('ctb');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// 单元测试：API 调用计划生成（buildRoutePlan）
// ============================================================

describe('API 调用计划生成', () => {
  it('已知地点应该生成包含 TDAS 的完整计划', () => {
    const result = buildRoutePlan('从落马洲口岸到香港立法会怎么走', 'zh-CN');
    expect(result.plan.useTDAS).toBe(true);
    expect(result.plan.tdasParams).toBeDefined();
    expect(result.plan.tdasParams!.start.lat).toBeCloseTo(22.5144, 2);
    expect(result.plan.tdasParams!.end.lat).toBeCloseTo(22.2802, 2);
    expect(result.errors).toHaveLength(0);
  });

  it('未知地点应该返回错误信息且不启用 TDAS', () => {
    const result = buildRoutePlan('从火星到月球怎么走', 'zh-CN');
    expect(result.plan.useTDAS).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('带交通偏好时应该生成对应的 ETA 查询', () => {
    const result = buildRoutePlan('坐地铁从尖沙咀到中环', 'zh-CN');
    expect(result.plan.useTDAS).toBe(true);
    const types = result.plan.etaQueries.map(q => q.type);
    expect(types).toContain('mtr');
  });

  it('无法识别任何地点时应该返回提示', () => {
    const result = buildRoutePlan('今天天气怎么样', 'zh-CN');
    expect(result.errors).toContain('无法识别起点或终点，请提供更具体的地点名称');
  });

  it('TDAS 参数中 long 字段应该对应 geocoder 的 lng', () => {
    const result = buildRoutePlan('从沙田到大埔', 'zh-CN');
    expect(result.plan.useTDAS).toBe(true);
    // lng → long 转换正确
    expect(result.plan.tdasParams!.start.long).toBeDefined();
    expect(result.plan.tdasParams!.end.long).toBeDefined();
  });
});
