// 鲁港通 - 复合地名解析测试
import { describe, it, expect } from 'vitest';
import { parseQuestion } from '../src/parser';

describe('复合地名识别', () => {
  it('应该正确解析"从东涌逸东邨到沙田石门硕门邨"', () => {
    const result = parseQuestion('从东涌逸东邨到沙田石门硕门邨怎么坐车', 'zh-CN');
    expect(result.origin).toBe('东涌逸东邨');
    expect(result.destination).toBe('沙田石门硕门邨');
  });

  it('应该正确解析"落马洲口岸到尖沙咀海港城"', () => {
    const result = parseQuestion('落马洲口岸到尖沙咀海港城', 'zh-CN');
    expect(result.origin).toBe('落马洲口岸');
    expect(result.destination).toBe('尖沙咀海港城');
  });

  it('应该正确解析"从香港机场到旺角朗豪坊"', () => {
    const result = parseQuestion('从香港机场到旺角朗豪坊', 'zh-CN');
    expect(result.origin).toBe('香港机场');
    expect(result.destination).toBe('旺角朗豪坊');
  });

  it('应该正确解析"从中环到铜锣湾"（单地点）', () => {
    const result = parseQuestion('从中环到铜锣湾', 'zh-CN');
    expect(result.origin).toBe('中环');
    expect(result.destination).toBe('铜锣湾');
  });

  it('应该正确解析"西九龙站到香港大学"', () => {
    const result = parseQuestion('西九龙站到香港大学', 'zh-CN');
    expect(result.origin).toBe('西九龙站');
    expect(result.destination).toBe('香港大学');
  });

  it('应该正确解析"从深圳湾口岸到迪士尼乐园"', () => {
    const result = parseQuestion('从深圳湾口岸到迪士尼乐园', 'zh-CN');
    expect(result.origin).toBe('深圳湾口岸');
    expect(result.destination).toBe('迪士尼乐园');
  });
});
