/**
 * 鲁港通 - 联网搜索引用解析器属性测试
 * Feature: web-search-citation-fix
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseSearchResults,
  extractCitationsFromAnswerText,
  extractBareNumberReferences,
  cleanOrphanCitations
} from '@fastgpt/service/core/ai/llm/searchInfoParser';
import type { AliSearchResult } from '@fastgpt/service/core/ai/llm/searchInfoParser';

// 鲁港通 - 生成有效的 URL
const arbUrl = fc.webUrl();

// 鲁港通 - 生成有效的 AliSearchResult（带 url）
const arbSearchResult = fc.record({
  index: fc.nat({ max: 99 }),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  url: arbUrl,
  icon: fc.option(fc.string({ maxLength: 30 }), { nil: undefined }),
  site_name: fc.option(fc.string({ maxLength: 30 }), { nil: undefined })
});

// Feature: web-search-citation-fix, Property 1: Search results 解析完整性与去重
// Validates: Requirements 1.1, 1.5
describe('Property 1: Search results 解析完整性与去重', () => {
  it('对于任意有效的 search_results 数组，parseSearchResults 返回的结果应包含所有有 url 的元素', () => {
    fc.assert(
      fc.property(
        fc.array(arbSearchResult, { minLength: 0, maxLength: 20 }),
        (results) => {
          const parsed = parseSearchResults(results);
          const inputWithUrl = results.filter((r) => !!r.url);
          // 鲁港通 - 每个有 url 的输入都应该在输出中找到
          for (const item of inputWithUrl) {
            const found = parsed.some((p) => p.url === item.url);
            if (!found) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意 search_results，输出的 URL 应全部唯一', () => {
    fc.assert(
      fc.property(
        fc.array(arbSearchResult, { minLength: 0, maxLength: 20 }),
        (results) => {
          const parsed = parseSearchResults(results);
          const urls = parsed.map((p) => p.url);
          return new Set(urls).size === urls.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意 search_results，index/title/url 字段应正确映射', () => {
    fc.assert(
      fc.property(
        fc.array(arbSearchResult, { minLength: 1, maxLength: 10 }),
        (results) => {
          const parsed = parseSearchResults(results);
          return parsed.every((p) => {
            return typeof p.index === 'number' &&
              typeof p.title === 'string' && p.title.length > 0 &&
              typeof p.url === 'string' && p.url.length > 0;
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于无 url 的 search_results 项，应被过滤掉', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            index: fc.nat({ max: 99 }),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            url: fc.constant(undefined as unknown as string)
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (results) => {
          const parsed = parseSearchResults(results as AliSearchResult[]);
          return parsed.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: web-search-citation-fix, Property 2: Markdown 链接提取正确性
// Validates: Requirements 1.3
// 鲁港通 - 过滤掉含 ) 的 URL，因为 ) 是 markdown 链接的结束符
const arbSafeUrl = arbUrl.filter((u) => !u.includes(')'));

describe('Property 2: Markdown 链接提取正确性', () => {
  it('对于任意包含 [title](https://url) 的文本，应提取所有非图片、非知识库的 http/https 链接', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 20 }).filter(
              (s) => !s.includes('[') && !s.includes(']') && !s.includes('(') && !s.includes(')')
            ),
            url: arbSafeUrl
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (links) => {
          // 鲁港通 - 构造包含 markdown 链接的文本
          const text = links.map((l) => `参考 [${l.title}](${l.url}) 了解更多`).join('\n');
          const citations = extractCitationsFromAnswerText(text);
          // 每个链接的 URL 都应该在结果中（去重后）
          const uniqueUrls = new Set(links.map((l) => l.url));
          return citations.length === uniqueUrls.size &&
            citations.every((c) => uniqueUrls.has(c.url));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意图片链接 ![alt](url)，不应被提取', () => {
    fc.assert(
      fc.property(
        arbSafeUrl,
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !s.includes('[') && !s.includes(']')
        ),
        (url, alt) => {
          const text = `这是图片 ![${alt}](${url}) 不应提取`;
          const citations = extractCitationsFromAnswerText(text);
          return citations.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意提取结果，URL 应全部唯一', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 20 }).filter(
              (s) => !s.includes('[') && !s.includes(']') && !s.includes('(') && !s.includes(')')
            ),
            url: arbSafeUrl
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (links) => {
          const text = links.map((l) => `[${l.title}](${l.url})`).join(' ');
          const citations = extractCitationsFromAnswerText(text);
          const urls = citations.map((c) => c.url);
          return new Set(urls).size === urls.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: web-search-citation-fix, Property 3: 裸数字引用提取
// Validates: Requirements 1.2, 1.4
describe('Property 3: 裸数字引用提取', () => {
  it('对于任意包含 [N] 引用的文本，应返回所有数字引用序号（去重、升序）', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
        (nums) => {
          // 鲁港通 - 构造包含裸数字引用的文本
          const text = nums.map((n) => `参考[${n}]了解更多`).join('。');
          const result = extractBareNumberReferences(text);
          const expected = Array.from(new Set(nums)).sort((a, b) => a - b);
          return JSON.stringify(result) === JSON.stringify(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意不含 [N] 引用的纯文本，应返回空数组', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !/\[\d+\]/.test(s)),
        (text) => {
          const result = extractBareNumberReferences(text);
          return result.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于任意结果，数组应严格升序排列', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 15 }),
        (nums) => {
          const text = nums.map((n) => `[${n}]`).join(' ');
          const result = extractBareNumberReferences(text);
          for (let i = 1; i < result.length; i++) {
            if (result[i] <= result[i - 1]) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('markdown 链接 [N](url) 中的数字不应被提取为裸引用', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        arbUrl,
        (num, url) => {
          const text = `参考[${num}](${url})了解更多`;
          const result = extractBareNumberReferences(text);
          return !result.includes(num);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: web-search-citation-fix, Property 4: 孤立引用清理
// Validates: Requirements 4.1, 4.2, 4.3
describe('Property 4: 孤立引用清理', () => {
  it('对于有对应 citation 的 [N]，应保留在文本中', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 5 }),
        (indices) => {
          const uniqueIndices = Array.from(new Set(indices));
          // 鲁港通 - 构造文本和对应的 citations
          const text = uniqueIndices.map((n) => `内容[${n}]`).join('。');
          const citations = uniqueIndices.map((n) => ({
            index: n,
            title: `来源${n}`,
            url: `https://example.com/${n}`
          }));
          const result = cleanOrphanCitations(text, citations);
          return uniqueIndices.every((n) => result.includes(`[${n}]`));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('对于无对应 citation 的 [N]，应从文本中移除', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 1, maxLength: 5 }),
        (indices) => {
          const uniqueIndices = Array.from(new Set(indices));
          const text = uniqueIndices.map((n) => `内容[${n}]`).join('。');
          // 鲁港通 - 空 citations，所有引用都应被移除
          const result = cleanOrphanCitations(text, []);
          return uniqueIndices.every((n) => !result.includes(`[${n}]`));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('部分有对应 citation 时，仅保留有对应的引用', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 2, maxLength: 8 }),
        (indices) => {
          const uniqueIndices = Array.from(new Set(indices));
          if (uniqueIndices.length < 2) return true;

          const text = uniqueIndices.map((n) => `内容[${n}]`).join('。');
          // 鲁港通 - 只为前半部分创建 citations
          const half = Math.ceil(uniqueIndices.length / 2);
          const validIndices = uniqueIndices.slice(0, half);
          const orphanIndices = uniqueIndices.slice(half);
          const citations = validIndices.map((n) => ({
            index: n,
            title: `来源${n}`,
            url: `https://example.com/${n}`
          }));

          const result = cleanOrphanCitations(text, citations);
          const validKept = validIndices.every((n) => result.includes(`[${n}]`));
          const orphansRemoved = orphanIndices.every((n) => !result.includes(`[${n}]`));
          return validKept && orphansRemoved;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('非引用格式的文本内容应保持不变', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !/\[\d+\](?!\()/.test(s)),
        (text) => {
          const result = cleanOrphanCitations(text, []);
          return result === text;
        }
      ),
      { numRuns: 100 }
    );
  });
});
