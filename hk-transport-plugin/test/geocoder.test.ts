// 鲁港通 - 地理编码器测试

import { describe, it, expect } from 'vitest';
import { geocode, geocodeRoute, getKnownLocations, isKnownLocation } from '../src/geocoder';
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

  it('所有坐标应该在香港/深圳范围内', () => {
    const locations = getKnownLocations();
    for (const loc of locations) {
      const coord = geocode(loc)!;
      // 香港/深圳大致范围：纬度 22.15-22.56，经度 113.83-114.30
      expect(coord.lat, `${loc} 纬度超出范围`).toBeGreaterThan(22.1);
      expect(coord.lat, `${loc} 纬度超出范围`).toBeLessThan(22.6);
      expect(coord.lng, `${loc} 经度超出范围`).toBeGreaterThan(113.8);
      expect(coord.lng, `${loc} 经度超出范围`).toBeLessThan(114.4);
    }
  });
});

// ============================================================
// 单元测试：批量地理编码
// ============================================================

describe('批量地理编码', () => {
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
    // 模拟 parser 解析用户输入
    const resolved = resolveLocation('落馬洲');
    expect(resolved).toBe('落马洲口岸');

    // geocoder 应该能识别 parser 输出的标准名称
    const coord = geocode(resolved!);
    expect(coord).toBeDefined();
    expect(coord!.lat).toBeCloseTo(22.5144, 3);
  });

  it('所有 parser 能识别的标准地点都应该有坐标', () => {
    // 测试一些常见的用户输入 → 标准名称 → 坐标 的完整链路
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
