import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  groupCitations,
  isGroupOrderValid,
  type CitationGroupItem
} from '@fastgpt/global/core/chat/citationGroup';

// Feature: citation-optimization, Property 4: 引用分组正确性
// Validates: Requirements 2.4, 2.5

const arbDatasetItem: fc.Arbitrary<CitationGroupItem> = fc.record({
  type: fc.constant('dataset' as const),
  key: fc.string({ minLength: 1, maxLength: 20 }),
  displayText: fc.string({ minLength: 1, maxLength: 50 })
});

const arbWebItem: fc.Arbitrary<CitationGroupItem> = fc.record({
  type: fc.constant('web' as const),
  key: fc.string({ minLength: 1, maxLength: 20 }),
  displayText: fc.string({ minLength: 1, maxLength: 50 })
});

const arbLinkItem: fc.Arbitrary<CitationGroupItem> = fc.record({
  type: fc.constant('link' as const),
  key: fc.string({ minLength: 1, maxLength: 20 }),
  displayText: fc.string({ minLength: 1, maxLength: 50 })
});

describe('groupCitations - Property 4: 引用分组正确性', () => {
  it('total count equals sum of all input groups', () => {
    fc.assert(
      fc.property(
        fc.array(arbDatasetItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbWebItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbLinkItem, { minLength: 0, maxLength: 10 }),
        (datasetItems, webItems, linkItems) => {
          const result = groupCitations(datasetItems, webItems, linkItems);
          expect(result.length).toBe(
            datasetItems.length + webItems.length + linkItems.length
          );
        }
      ),
      { numRuns: 10 }
    );
  });

  it('dataset items come before web items, web items come before link items', () => {
    fc.assert(
      fc.property(
        fc.array(arbDatasetItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbWebItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbLinkItem, { minLength: 0, maxLength: 10 }),
        (datasetItems, webItems, linkItems) => {
          const result = groupCitations(datasetItems, webItems, linkItems);
          expect(isGroupOrderValid(result)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('each citation retains its original type designation', () => {
    fc.assert(
      fc.property(
        fc.array(arbDatasetItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbWebItem, { minLength: 0, maxLength: 10 }),
        fc.array(arbLinkItem, { minLength: 0, maxLength: 10 }),
        (datasetItems, webItems, linkItems) => {
          const result = groupCitations(datasetItems, webItems, linkItems);

          const datasetCount = result.filter((i) => i.type === 'dataset').length;
          const webCount = result.filter((i) => i.type === 'web').length;
          const linkCount = result.filter((i) => i.type === 'link').length;

          expect(datasetCount).toBe(datasetItems.length);
          expect(webCount).toBe(webItems.length);
          expect(linkCount).toBe(linkItems.length);
        }
      ),
      { numRuns: 10 }
    );
  });
});
