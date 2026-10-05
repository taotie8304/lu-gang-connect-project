// 鲁港通 - 域名过滤算法单元测试（覆盖需求文档 11.2 全部必测用例）
import { describe, it, expect } from 'vitest';
import {
  normalizeHost,
  classify,
  judge,
  filterResults
} from '../src/domain-filter';
import type { RawSearchResult } from '../src/types';

function raw(url: string, title = 't'): RawSearchResult {
  return { title, url, snippet: 's' };
}

describe('normalizeHost 主机名规范化', () => {
  it('去掉前导 www. 并转小写', () => {
    expect(normalizeHost('https://www.gov.hk/tc/')).toBe('gov.hk');
    expect(normalizeHost('HTTPS://WWW.GOV.HK/EN')).toBe('gov.hk');
  });
  it('非法 URL 返回空串', () => {
    expect(normalizeHost('not a url')).toBe('');
  });
});

describe('classify 来源分类（A-F 白名单）', () => {
  it('A 政府 *.gov.hk', () => {
    expect(classify('www.gov.hk')).toBe('gov');
    expect(classify('info.gov.hk')).toBe('gov');
    expect(classify('ird.gov.hk')).toBe('gov');
  });
  it('B 公营机构', () => {
    expect(classify('hkex.com.hk')).toBe('public');
    expect(classify('mtr.com.hk')).toBe('public');
    expect(classify('sfc.hk')).toBe('public');
  });
  it('C 学术（后缀 + 显式大学 + 子域）', () => {
    expect(classify('hku.hk')).toBe('academic');
    expect(classify('fac.hku.hk')).toBe('academic');
    expect(classify('xxx.edu.hk')).toBe('academic');
    expect(classify('www.polyu.edu.hk')).toBe('academic');
  });
  it('D 非盈利 *.org.hk', () => {
    expect(classify('hkcss.org.hk')).toBe('nonprofit');
    expect(classify('redcross.org.hk')).toBe('nonprofit');
  });
  it('E 正规新闻媒体', () => {
    expect(classify('hk01.com')).toBe('news');
    expect(classify('on.cc')).toBe('news');
  });
  it('F 电视台', () => {
    expect(classify('tvb.com')).toBe('tv');
    expect(classify('rthk.hk')).toBe('tv');
  });
  it('未知域名分类为 other', () => {
    expect(classify('random-blog.com')).toBe('other');
  });
});

describe('judge - official 模式（默认拒绝策略）', () => {
  it('政府/公营/学术/非盈利/媒体/电视台放行，reason=whitelist', () => {
    expect(judge('https://www.gov.hk/', 'official')).toMatchObject({
      allow: true,
      reason: 'whitelist',
      sourceType: 'gov'
    });
    expect(judge('https://hkex.com.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'public'
    });
    expect(judge('https://hku.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'academic'
    });
    expect(judge('https://hkcss.org.hk/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'nonprofit'
    });
    expect(judge('https://hk01.com/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'news'
    });
    expect(judge('https://tvb.com/', 'official')).toMatchObject({
      allow: true,
      sourceType: 'tv'
    });
  });

  it('社交媒体硬拒绝，reason=social-media', () => {
    expect(judge('https://facebook.com/x', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
    expect(judge('https://youtube.com/watch?v=x', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
    expect(judge('https://x.com/somegov', 'official')).toMatchObject({
      allow: false,
      reason: 'social-media'
    });
  });

  it('营销平台拒绝，reason=marketing', () => {
    expect(judge('https://klook.com/activity', 'official')).toMatchObject({
      allow: false,
      reason: 'marketing'
    });
    expect(judge('https://tripadvisor.com/', 'official')).toMatchObject({
      allow: false,
      reason: 'marketing'
    });
  });

  it('未知域名默认拒绝，reason=not-whitelisted', () => {
    expect(judge('https://random-blog.com/a', 'official')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
    expect(judge('https://some-shop.com/', 'official')).toMatchObject({
      allow: false,
      reason: 'not-whitelisted'
    });
  });

  it('非法 URL 拒绝，reason=invalid-url', () => {
    expect(judge('bad url', 'official').allow).toBe(false);
    expect(judge('bad url', 'official').reason).toBe('invalid-url');
  });

  it('大小写规范化：WWW.GOV.HK 仍放行', () => {
    expect(judge('HTTPS://WWW.GOV.HK/TC', 'official')).toMatchObject({
      allow: true,
      sourceType: 'gov'
    });
  });
});

describe('judge - open 模式（香港本地生活小助手：完全不过滤）', () => {
  it('社交媒体放行', () => {
    expect(judge('https://facebook.com/x', 'open')).toMatchObject({
      allow: true,
      reason: 'open-scope'
    });
    expect(judge('https://youtube.com/watch?v=x', 'open').allow).toBe(true);
    expect(judge('https://x.com/gov', 'open').allow).toBe(true);
  });
  it('营销平台放行', () => {
    expect(judge('https://klook.com/', 'open')).toMatchObject({
      allow: true,
      reason: 'open-scope'
    });
    expect(judge('https://tripadvisor.com/', 'open').allow).toBe(true);
  });
  it('未知域名也放行', () => {
    expect(judge('https://random-blog.com/', 'open').allow).toBe(true);
  });
  it('权威来源在 open 模式同样放行', () => {
    expect(judge('https://www.gov.hk/', 'open').allow).toBe(true);
  });
});

describe('filterResults 批量过滤', () => {
  const input: RawSearchResult[] = [
    raw('https://www.gov.hk/a', 'gov'),
    raw('https://hk01.com/b', 'news'),
    raw('https://facebook.com/c', 'social'),
    raw('https://klook.com/d', 'marketing'),
    raw('https://random-blog.com/e', 'other')
  ];

  it('official：只保留白名单 2 条，拒绝 3 条并带 reason', () => {
    const { allowed, rejected } = filterResults(input, 'official');
    expect(allowed.map((r) => r.source)).toEqual(['gov.hk', 'hk01.com']);
    expect(allowed.map((r) => r.sourceType)).toEqual(['gov', 'news']);
    expect(rejected).toHaveLength(3);
    expect(rejected.map((r) => r.reason)).toEqual([
      'social-media',
      'marketing',
      'not-whitelisted'
    ]);
  });

  it('open：全部 5 条放行', () => {
    const { allowed, rejected } = filterResults(input, 'open');
    expect(allowed).toHaveLength(5);
    expect(rejected).toHaveLength(0);
  });
});
