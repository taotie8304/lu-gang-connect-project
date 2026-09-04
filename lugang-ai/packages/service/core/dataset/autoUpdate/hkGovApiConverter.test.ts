/**
 * 鲁港通 - 香港政府 CKAN 转换模块单元测试（D8 修复版）
 *
 * 聚焦纯函数（不触网）：
 * - isHkGovDatasetUrl：政府数据集 URL 识别
 * - extractDatasetId：data.gov.hk 路径式 / csdi geoportal 查询式两种格式提取
 * - pickDataResource：按格式优先级选资源并跳过图片（核心修复：实测 1020 资源中 1013 为 JPEG）
 * - contentHash：内容 MD5（可靠更新判据）
 *
 * 说明：hkGovApiConverter.ts 含运行时导入（axios / logger），本测试需阶段5 pnpm install
 *   装齐依赖后方可运行；上述函数自身为纯函数，断言不触网。
 */

import { describe, it, expect } from 'vitest';
import {
  isHkGovDatasetUrl,
  extractDatasetId,
  pickDataResource,
  contentHash,
  type HkGovResource
} from './hkGovApiConverter';

describe('isHkGovDatasetUrl 政府数据集 URL 识别', () => {
  it('data.gov.hk 域名应识别为政府数据集', () => {
    expect(isHkGovDatasetUrl('https://data.gov.hk/tc/dataset/foo')).toBe(true);
  });

  it('csdi.gov.hk 域名应识别为政府数据集', () => {
    expect(isHkGovDatasetUrl('https://portal.csdi.gov.hk/geoportal/')).toBe(true);
  });

  it('含 datasetId= 查询参数应识别为政府数据集', () => {
    expect(isHkGovDatasetUrl('https://example.com/page?datasetId=abc')).toBe(true);
  });

  it('无关域名不应识别为政府数据集', () => {
    expect(isHkGovDatasetUrl('https://example.com/dataset/foo')).toBe(false);
  });
});

describe('extractDatasetId 数据集 ID 提取', () => {
  it('应从 data.gov.hk /tc/dataset/<slug> 提取 slug', () => {
    expect(extractDatasetId('https://data.gov.hk/tc/dataset/hk-population')).toBe('hk-population');
  });

  it('应从 data.gov.hk /tc-data/dataset/<slug> 提取 slug', () => {
    expect(extractDatasetId('https://data.gov.hk/tc-data/dataset/budget-2025')).toBe('budget-2025');
  });

  it('应从 csdi geoportal 查询参数提取 datasetId', () => {
    expect(extractDatasetId('https://portal.csdi.gov.hk/geoportal/?datasetId=geo-123')).toBe(
      'geo-123'
    );
  });

  it('无关域名应返回 null', () => {
    expect(extractDatasetId('https://example.com/tc/dataset/foo')).toBeNull();
  });

  it('非法 URL 应返回 null（不抛出）', () => {
    expect(extractDatasetId('not-a-valid-url')).toBeNull();
  });
});

describe('pickDataResource 数据资源挑选', () => {
  it('应跳过图片资源并选中数据资源', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/a.jpg', format: 'jpg' },
      { url: 'https://x/b.png', format: 'png' },
      { url: 'https://x/data.csv', format: 'csv' }
    ];
    const picked = pickDataResource(resources);
    expect(picked?.url).toBe('https://x/data.csv');
  });

  it('全部为图片时应返回 null', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/a.jpeg', format: 'jpeg' },
      { url: 'https://x/b.gif', format: 'gif' }
    ];
    expect(pickDataResource(resources)).toBeNull();
  });

  it('空资源列表应返回 null', () => {
    expect(pickDataResource([])).toBeNull();
  });

  it('指定 preferFormat 时应优先选中该格式', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/data.csv', format: 'csv' },
      { url: 'https://x/data.xlsx', format: 'xlsx' }
    ];
    const picked = pickDataResource(resources, 'xlsx');
    expect(picked?.url).toBe('https://x/data.xlsx');
  });

  it('preferFormat 不存在时应回退到格式优先级', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/data.xml', format: 'xml' },
      { url: 'https://x/data.csv', format: 'csv' }
    ];
    // 指定 xlsx 但无此格式 → 回退优先级，csv 优先于 xml
    const picked = pickDataResource(resources, 'xlsx');
    expect(picked?.url).toBe('https://x/data.csv');
  });

  it('无 preferFormat 时应按 csv>xlsx>xml>json>api 优先级挑选', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/data.json', format: 'json' },
      { url: 'https://x/data.xml', format: 'xml' }
    ];
    // xml 优先于 json
    const picked = pickDataResource(resources);
    expect(picked?.url).toBe('https://x/data.xml');
  });

  it('仅含 api 格式时应选中 api 资源', () => {
    const resources: HkGovResource[] = [{ url: 'https://x/api', format: 'api' }];
    expect(pickDataResource(resources)?.format).toBe('api');
  });

  it('格式不在优先级列表且非图片时应回退首个候选', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/a.zip', format: 'zip' },
      { url: 'https://x/b.rar', format: 'rar' }
    ];
    expect(pickDataResource(resources)?.url).toBe('https://x/a.zip');
  });

  it('格式匹配应大小写不敏感（图片跳过）', () => {
    const resources: HkGovResource[] = [
      { url: 'https://x/a.JPG', format: 'JPG' },
      { url: 'https://x/data.csv', format: 'csv' }
    ];
    expect(pickDataResource(resources)?.url).toBe('https://x/data.csv');
  });
});

describe('contentHash 内容 MD5 哈希', () => {
  it('相同输入应产生相同哈希', () => {
    expect(contentHash('hello')).toBe(contentHash('hello'));
  });

  it('不同输入应产生不同哈希', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });

  it('应产生已知的 MD5 值', () => {
    // 'hello' 的标准 MD5
    expect(contentHash('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('应支持 Buffer 输入', () => {
    const hash = contentHash(Buffer.from('hello', 'utf-8'));
    expect(hash).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('哈希应为 32 位十六进制字符串', () => {
    expect(contentHash('any-content')).toMatch(/^[a-f0-9]{32}$/);
  });
});
