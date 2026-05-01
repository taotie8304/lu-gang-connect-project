// 鲁港通 - 问题解析器测试

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractLocations, extractTransportPreference, extractTimeRequirement, parseQuestion, resolveLocation } from '../src/parser';

// ============================================================
// 单元测试：地点名称提取
// ============================================================

describe('地点名称提取', () => {
  it('应该从"从A到B"格式中提取起点和终点', () => {
    const result = extractLocations('从落马洲口岸到香港立法会怎么走');
    expect(result.origin).toBe('落马洲口岸');
    expect(result.destination).toBe('香港立法会');
  });

  it('应该从"由A去B"格式中提取起点和终点', () => {
    const result = extractLocations('由尖沙咀去旺角');
    expect(result.origin).toBe('尖沙咀');
    expect(result.destination).toBe('旺角');
  });

  it('应该从英文"from A to B"格式中提取', () => {
    const result = extractLocations('from central to causeway bay');
    expect(result.origin).toBe('中环');
    expect(result.destination).toBe('铜锣湾');
  });

  it('应该处理只有终点的情况', () => {
    const result = extractLocations('去尖沙咀怎么走');
    expect(result.destination).toBe('尖沙咀');
  });

  it('应该处理繁体中文地点', () => {
    const result = extractLocations('從落馬洲到銅鑼灣');
    expect(result.origin).toBe('落马洲口岸');
    expect(result.destination).toBe('铜锣湾');
  });

  it('应该在问题中搜索已知地点', () => {
    const result = extractLocations('中环附近有什么巴士到铜锣湾');
    expect(result.origin).toBe('中环');
    expect(result.destination).toBe('铜锣湾');
  });

  it('应该返回空结果当没有可识别的地点', () => {
    const result = extractLocations('今天天气怎么样');
    expect(result.origin).toBeUndefined();
    expect(result.destination).toBeUndefined();
  });
});

// ============================================================
// 属性测试：Property 1 - 地点名称提取准确性
// Feature: hk-smart-transport-assistant, Property 1: 地点名称提取准确性
// **Validates: Requirements 1.1**
// ============================================================

describe('Property 1: 地点名称提取准确性', () => {
  // 已知地点对列表
  const locationPairs = [
    ['落马洲口岸', '香港立法会'],
    ['尖沙咀', '旺角'],
    ['中环', '铜锣湾'],
    ['金钟', '湾仔'],
    ['沙田', '大埔'],
    ['元朗', '屯门'],
    ['荃湾', '将军澳'],
    ['红磡', '九龙塘'],
    ['上水', '粉岭'],
    ['东涌', '香港机场'],
    ['深圳湾口岸', '中环'],
    ['罗湖口岸', '尖沙咀'],
    ['西九龙站', '旺角'],
    ['迪士尼乐园', '海洋公园'],
    ['太平山顶', '维多利亚港'],
  ];

  // 问题模板（简体中文）
  const zhCNTemplates = [
    (o: string, d: string) => `从${o}到${d}怎么走`,
    (o: string, d: string) => `从${o}到${d}`,
    (o: string, d: string) => `由${o}到${d}怎么走`,
    (o: string, d: string) => `由${o}去${d}`,
  ];

  // 属性：对于任意已知地点对和任意问题模板，解析器应该正确提取起点和终点
  it('对于任意已知地点对和问题模板，应该正确提取起点和终点', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: locationPairs.length - 1 }),
        fc.integer({ min: 0, max: zhCNTemplates.length - 1 }),
        (pairIdx, templateIdx) => {
          const [origin, destination] = locationPairs[pairIdx];
          const template = zhCNTemplates[templateIdx];
          const question = template(origin, destination);

          const result = extractLocations(question);

          // 起点和终点都应该被正确提取
          expect(result.origin).toBe(origin);
          expect(result.destination).toBe(destination);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// 单元测试：交通偏好识别
// ============================================================

describe('交通偏好识别', () => {
  it('应该识别巴士关键词', () => {
    expect(extractTransportPreference('坐巴士去旺角')).toContain('bus');
    expect(extractTransportPreference('搭bus去旺角')).toContain('bus');
    expect(extractTransportPreference('九巴路线')).toContain('bus');
  });

  it('应该识别地铁关键词', () => {
    expect(extractTransportPreference('坐地铁去中环')).toContain('mtr');
    expect(extractTransportPreference('搭港鐵去金鐘')).toContain('mtr');
    expect(extractTransportPreference('take mtr to central')).toContain('mtr');
  });

  it('应该识别小巴关键词', () => {
    expect(extractTransportPreference('坐小巴去大埔')).toContain('gmb');
    expect(extractTransportPreference('搭專線小巴')).toContain('gmb');
    expect(extractTransportPreference('take minibus')).toContain('gmb');
  });

  it('应该识别多种交通方式', () => {
    const result = extractTransportPreference('坐巴士或地铁去旺角');
    expect(result).toContain('bus');
    expect(result).toContain('mtr');
  });

  it('没有交通偏好时应该返回空数组', () => {
    expect(extractTransportPreference('从落马洲到中环怎么走')).toEqual([]);
  });
});


// ============================================================
// 属性测试：Property 2 - 交通偏好识别准确性
// Feature: hk-smart-transport-assistant, Property 2: 交通偏好识别准确性
// **Validates: Requirements 1.2**
// ============================================================

describe('Property 2: 交通偏好识别准确性', () => {
  // 交通方式到关键词的映射
  const transportKeywordSamples: Record<string, string[]> = {
    bus: ['巴士', '公交', '公車', 'bus', '九巴', 'kmb', '城巴', 'ctb'],
    mtr: ['地铁', '地鐵', '港铁', '港鐵', 'mtr', 'metro', 'subway'],
    gmb: ['小巴', 'minibus', 'gmb', '专线小巴', '專線小巴'],
  };

  // 问题前缀模板
  const prefixes = ['我想坐', '搭', '坐', 'take ', 'by '];
  // 问题后缀模板
  const suffixes = ['去旺角', '去中环', ' to central', '到尖沙咀'];

  // 属性：对于任意交通方式关键词，解析器应该正确识别该交通方式
  it('对于任意交通方式关键词，应该正确识别对应的交通方式', () => {
    const transportTypes = Object.keys(transportKeywordSamples);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: transportTypes.length - 1 }),
        fc.integer({ min: 0, max: prefixes.length - 1 }),
        fc.integer({ min: 0, max: suffixes.length - 1 }),
        (typeIdx, prefixIdx, suffixIdx) => {
          const transportType = transportTypes[typeIdx];
          const keywords = transportKeywordSamples[transportType];
          // 随机选一个关键词（用 typeIdx + prefixIdx 做伪随机）
          const keyword = keywords[(typeIdx + prefixIdx + suffixIdx) % keywords.length];
          const question = prefixes[prefixIdx] + keyword + suffixes[suffixIdx];

          const result = extractTransportPreference(question);
          expect(result).toContain(transportType);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// 单元测试：多语言支持
// ============================================================

describe('多语言支持', () => {
  it('简体中文问题应该正确解析', () => {
    const result = parseQuestion('从落马洲口岸到香港立法会怎么走', 'zh-CN');
    expect(result.origin).toBe('落马洲口岸');
    expect(result.destination).toBe('香港立法会');
  });

  it('繁体中文问题应该正确解析', () => {
    const result = parseQuestion('從落馬洲到銅鑼灣怎麼走', 'zh-HK');
    expect(result.origin).toBe('落马洲口岸');
    expect(result.destination).toBe('铜锣湾');
  });

  it('英文问题应该正确解析', () => {
    const result = parseQuestion('from central to causeway bay', 'en');
    expect(result.origin).toBe('中环');
    expect(result.destination).toBe('铜锣湾');
  });

  it('简体中文交通偏好应该被识别', () => {
    const result = parseQuestion('坐地铁去中环', 'zh-CN');
    expect(result.transportPreference).toContain('mtr');
  });

  it('繁体中文交通偏好应该被识别', () => {
    const result = parseQuestion('搭港鐵去中環', 'zh-HK');
    expect(result.transportPreference).toContain('mtr');
  });

  it('英文交通偏好应该被识别', () => {
    const result = parseQuestion('take mtr to central', 'en');
    expect(result.transportPreference).toContain('mtr');
  });

  it('时间关键词应该在各语言中被识别', () => {
    expect(extractTimeRequirement('现在出发')).toBe('now');
    expect(extractTimeRequirement('現在出發')).toBe('now');
    expect(extractTimeRequirement('leave now')).toBe('now');
    expect(extractTimeRequirement('早上出发')).toBe('morning');
    expect(extractTimeRequirement('晚上出发')).toBe('evening');
  });
});


// ============================================================
// 属性测试：Property 3 - 多语言支持一致性
// Feature: hk-smart-transport-assistant, Property 3: 多语言支持一致性
// **Validates: Requirements 1.4**
// ============================================================

describe('Property 3: 多语言支持一致性', () => {
  // 同义问题组：每组包含简体、繁体、英文表达，应该解析出相同的标准地点
  const equivalentQuestions: Array<{
    zhCN: string;
    zhHK: string;
    en: string;
    expectedOrigin: string;
    expectedDestination: string;
  }> = [
    {
      zhCN: '从落马洲到中环',
      zhHK: '從落馬洲到中環',
      en: 'from lok ma chau to central',
      expectedOrigin: '落马洲口岸',
      expectedDestination: '中环',
    },
    {
      zhCN: '从尖沙咀到铜锣湾',
      zhHK: '由尖沙咀到銅鑼灣',
      en: 'from tsim sha tsui to causeway bay',
      expectedOrigin: '尖沙咀',
      expectedDestination: '铜锣湾',
    },
    {
      zhCN: '从金钟到湾仔',
      zhHK: '從金鐘到灣仔',
      en: 'from admiralty to wan chai',
      expectedOrigin: '金钟',
      expectedDestination: '湾仔',
    },
    {
      zhCN: '从沙田到大埔',
      zhHK: '從沙田到大埔',
      en: 'from sha tin to tai po',
      expectedOrigin: '沙田',
      expectedDestination: '大埔',
    },
    {
      zhCN: '从元朗到屯门',
      zhHK: '從元朗到屯門',
      en: 'from yuen long to tuen mun',
      expectedOrigin: '元朗',
      expectedDestination: '屯门',
    },
  ];

  // 属性：对于任意同义问题组，三种语言应该解析出相同的标准地点名称
  it('相同含义的问题在不同语言下应该解析出一致的标准地点', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: equivalentQuestions.length - 1 }),
        (idx) => {
          const group = equivalentQuestions[idx];

          const resultCN = parseQuestion(group.zhCN, 'zh-CN');
          const resultHK = parseQuestion(group.zhHK, 'zh-HK');
          const resultEN = parseQuestion(group.en, 'en');

          // 三种语言解析出的标准地点应该一致
          expect(resultCN.origin).toBe(group.expectedOrigin);
          expect(resultHK.origin).toBe(group.expectedOrigin);
          expect(resultEN.origin).toBe(group.expectedOrigin);

          expect(resultCN.destination).toBe(group.expectedDestination);
          expect(resultHK.destination).toBe(group.expectedDestination);
          expect(resultEN.destination).toBe(group.expectedDestination);
        }
      ),
      { numRuns: 100 }
    );
  });

  // 交通偏好多语言一致性
  const equivalentTransport: Array<{
    zhCN: string;
    zhHK: string;
    en: string;
    expectedType: string;
  }> = [
    { zhCN: '坐地铁', zhHK: '搭港鐵', en: 'take mtr', expectedType: 'mtr' },
    { zhCN: '坐巴士', zhHK: '搭巴士', en: 'take bus', expectedType: 'bus' },
    { zhCN: '坐小巴', zhHK: '搭小巴', en: 'take minibus', expectedType: 'gmb' },
  ];

  it('相同含义的交通偏好在不同语言下应该识别为同一类型', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: equivalentTransport.length - 1 }),
        (idx) => {
          const group = equivalentTransport[idx];

          const resultCN = extractTransportPreference(group.zhCN);
          const resultHK = extractTransportPreference(group.zhHK);
          const resultEN = extractTransportPreference(group.en);

          expect(resultCN).toContain(group.expectedType);
          expect(resultHK).toContain(group.expectedType);
          expect(resultEN).toContain(group.expectedType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
