// 鲁港通 - 地理编码器测试

import { describe, it, expect } from 'vitest';
import { geocode, geocodeRoute, getKnownLocations, isKnownLocation, isOrganizationName, geocodeWithFallback, geocodeRouteWithFallback } from '../src/geocoder';
import { resolveLocation } from '../src/parser';

// ============================================================
// 单元测试：地点坐标词典查询
// ============================================================

describe('地点坐标词典查询', () => {
  it('应该返回已知地点的坐标', () => {
    const result = geocode('落马洲口岸');
    expect(result).toBeDefined();
    expect(result!.lat).toBeCloseTo(22.5144, 3);
    expect(result!.lng).toBeCloseTo(114.0683, 3);
    expect(result!.name).toBe('落马洲口岸');
  });

  it('应该返回 undefined 对于未知地点', () => {
    const result = geocode('不存在的地方');
    expect(result).toBeUndefined();
  });

  it('应该返回空字符串的 undefined', () => {
    const result = geocode('');
    expect(result).toBeUndefined();
  });

  it('所有口岸都应该有坐标', () => {
    const borders = ['落马洲口岸', '福田口岸', '罗湖口岸', '深圳湾口岸', '港珠澳大桥口岸', '西九龙站', '莲塘口岸'];
    for (const border of borders) {
      const result = geocode(border);
      expect(result, `${border} 应该有坐标`).toBeDefined();
      expect(result!.lat).toBeGreaterThan(22);
      expect(result!.lat).toBeLessThan(23);
      expect(result!.lng).toBeGreaterThan(113);
      expect(result!.lng).toBeLessThan(115);
    }
  });
});

// ============================================================
// 单元测试：组织名检测
// ============================================================

describe('组织名检测', () => {
  it('应该识别组织/机构名称', () => {
    const orgNames = [
      '香港山东侨界联合会', '香港中华总商会', '福建同乡会',
      '香港佛教联合会', '香港律师协会', '香港医学会',
    ];
    for (const name of orgNames) {
      expect(isOrganizationName(name), `"${name}" 应被识别为组织名`).toBe(true);
    }
  });

  it('应该识别公司/企业名称', () => {
    const companyNames = [
      '中银香港有限公司', '汇丰银行', '友邦保险',
      '长江集团', '新鸿基集团',
    ];
    for (const name of companyNames) {
      expect(isOrganizationName(name), `"${name}" 应被识别为组织名`).toBe(true);
    }
  });

  it('应该识别学校/医院/政府建筑', () => {
    const buildingNames = [
      '香港大学', '伊利沙伯中学', '仁济医院',
      '香港政府合署', '入境事务大楼',
    ];
    for (const name of buildingNames) {
      expect(isOrganizationName(name), `"${name}" 应被识别为组织名`).toBe(true);
    }
  });

  it('不应将普通地名识别为组织名', () => {
    const placeNames = ['尖沙咀', '中环', '铜锣湾', '旺角', '沙田', '落马洲口岸'];
    for (const name of placeNames) {
      expect(isOrganizationName(name), `"${name}" 不应被识别为组织名`).toBe(false);
    }
  });
});

// ============================================================
// 单元测试：带外网回退的地理编码
// ============================================================

describe('带外网回退的地理编码', () => {
  it('已知地点应该直接返回本地坐标', async () => {
    const result = await geocodeWithFallback('落马洲口岸');
    expect(result).toBeDefined();
    expect(result!.lat).toBeCloseTo(22.5144, 3);
    expect(result!.name).toBe('落马洲口岸');
  });

  it('未知地名但不像是组织名时返回 undefined', async () => {
    const result = await geocodeWithFallback('一个完全不存在的地名abc123');
    expect(result).toBeUndefined();
  });

  it('undefined 输入应该返回 undefined', async () => {
    const result = await geocodeWithFallback(undefined);
    expect(result).toBeUndefined();
  });

  it('空字符串应该返回 undefined', async () => {
    const result = await geocodeWithFallback('');
    expect(result).toBeUndefined();
  });

  it('批量编码已知地点应该成功', async () => {
    const result = await geocodeRouteWithFallback('落马洲口岸', '香港立法会');
    expect(result.originCoord).toBeDefined();
    expect(result.destCoord).toBeDefined();
    expect(result.originCoord!.name).toBe('落马洲口岸');
    expect(result.destCoord!.name).toBe('香港立法会');
  });

  it('批量编码一个已知一个未知非组织名', async () => {
    const result = await geocodeRouteWithFallback('中环', '不存在的地点xyz');
    expect(result.originCoord).toBeDefined();
    expect(result.destCoord).toBeUndefined();
  });
});

// ============================================================
// 单元测试：同步批量地理编码
// ============================================================

describe('同步批量地理编码', () => {
  it('应该同时转换起点和终点', () => {
    const result = geocodeRoute('落马洲口岸', '香港立法会');
    expect(result.originCoord).toBeDefined();
    expect(result.destCoord).toBeDefined();
    expect(result.originCoord!.name).toBe('落马洲口岸');
    expect(result.destCoord!.name).toBe('香港立法会');
  });

  it('应该处理只有终点的情况', () => {
    const result = geocodeRoute(undefined, '尖沙咀');
    expect(result.originCoord).toBeUndefined();
    expect(result.destCoord).toBeDefined();
    expect(result.destCoord!.name).toBe('尖沙咀');
  });

  it('应该处理未知地点', () => {
    const result = geocodeRoute('未知地点A', '未知地点B');
    expect(result.originCoord).toBeUndefined();
    expect(result.destCoord).toBeUndefined();
  });

  it('应该处理起点已知终点未知', () => {
    const result = geocodeRoute('中环', '某个不存在的地方');
    expect(result.originCoord).toBeDefined();
    expect(result.destCoord).toBeUndefined();
  });
});

// ============================================================
// 单元测试：parser → geocoder 集成
// ============================================================

describe('parser → geocoder 集成', () => {
  it('parser 输出的标准名称应该能被 geocoder 识别', () => {
    const resolved = resolveLocation('落馬洲');
    expect(resolved).toBe('落马洲口岸');

    const coord = geocode(resolved!);
    expect(coord).toBeDefined();
    expect(coord!.lat).toBeCloseTo(22.5144, 3);
  });

  it('所有 parser 能识别的标准地点都应该有坐标', () => {
    const userInputs = [
      '落馬洲', '中環', '尖沙咀', 'central', 'causeway bay',
      '金鐘', '旺角', '沙田', '大埔', '元朗',
      '屯門', '荃灣', '將軍澳', '東涌', '上水',
    ];

    for (const input of userInputs) {
      const standardName = resolveLocation(input);
      expect(standardName, `"${input}" 应该能被 parser 识别`).toBeDefined();

      const coord = geocode(standardName!);
      expect(coord, `"${standardName}" 应该有坐标`).toBeDefined();
    }
  });
});
