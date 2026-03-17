import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseSearchResults,
  extractSearchCitations,
  type AliSearchResult
} from '@fastgpt/service/core/ai/llm/searchInfoParser';

// Feature: citation-optimization, Property 2: 联网搜索结果解析
// Validates: Requirements 2.1, 2.6, 4.3

const arbSearchResult: fc.Arbitrary<AliSearchResult> = fc.record({
  index: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  url: fc.option(fc.webUrl(), { nil: undefined }),
  icon: fc.option(fc.webUrl(), { nil: undefined }),
  site_name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
});

// Generator that always produces a valid search result (with url)
const arbValidSearchResult: fc.Arbitrary<AliSearchResult> = fc.record({
  index: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  url: fc.webUrl(),
  icon: fc.option(fc.webUrl(), { nil: undefined }),
  site_name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
});

describe('parseSearchResults - Property 2: 联网搜索结果解析', () => {
  it('for all valid search_results arrays, parsed output preserves title and url for each item with a url', () => {
    fc.assert(
      fc.property(
        fc.array(arbSearchResult, { minLength: 0, maxLength: 20 }),
        (searchResults) => {
          const parsed = parseSearchResults(searchResults);
          const withUrl = searchResults.filter((item) => !!item?.url);

          // Length should match items that have a url
          expect(parsed.length).toBe(withUrl.length);

          // Each parsed item should have matching url from source
          parsed.forEach((citation, i) => {
            expect(citation.url).toBe(withUrl[i].url);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('for all valid search results, title defaults to url when title is missing', () => {
    fc.assert(
      fc.property(
        fc.array(arbValidSearchResult, { minLength: 1, maxLength: 10 }),
        (searchResults) => {
          const parsed = parseSearchResults(searchResults);

          parsed.forEach((citation, i) => {
            const source = searchResults[i];
            if (source.title) {
              expect(citation.title).toBe(source.title);
            } else {
              expect(citation.title).toBe(source.url);
            }
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('for all valid search results, site_name maps to siteName', () => {
    fc.assert(
      fc.property(
        fc.array(arbValidSearchResult, { minLength: 1, maxLength: 10 }),
        (searchResults) => {
          const parsed = parseSearchResults(searchResults);

          parsed.forEach((citation, i) => {
            const source = searchResults[i];
            expect(citation.siteName).toBe(source.site_name || undefined);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('extractSearchCitations returns empty array when search_info is absent', () => {
    fc.assert(
      fc.property(
        fc.record({
          choices: fc.array(fc.anything(), { minLength: 0, maxLength: 3 })
        }),
        (response) => {
          const result = extractSearchCitations(response);
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('extractSearchCitations correctly extracts from response with search_info', () => {
    fc.assert(
      fc.property(
        fc.array(arbValidSearchResult, { minLength: 1, maxLength: 10 }),
        (searchResults) => {
          const response = {
            search_info: { search_results: searchResults }
          };
          const result = extractSearchCitations(response);
          expect(result.length).toBe(searchResults.length);
          result.forEach((citation, i) => {
            expect(citation.url).toBe(searchResults[i].url);
          });
        }
      ),
      { numRuns: 20 }
    );
  });
});
