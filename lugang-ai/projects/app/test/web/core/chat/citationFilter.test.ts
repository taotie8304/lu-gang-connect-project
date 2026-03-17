import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterCitationsByRelevance } from '@fastgpt/global/core/chat/citationFilter';

// Feature: citation-optimization, Property 1: 知识库引用相关性过滤
// Validates: Requirements 1.1, 1.2, 1.5

type TestScoreItem = { value?: number };
type TestCitationItem = { id: string; score: TestScoreItem[] };

const arbScoreEntry = fc.record({
  value: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined })
});

const arbCitationItem = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  score: fc.array(arbScoreEntry, { minLength: 0, maxLength: 5 })
});

const arbThreshold = fc.float({ min: 0, max: 1, noNaN: true });

describe('filterCitationsByRelevance - Property 1: 知识库引用相关性过滤', () => {
  it('admin users always receive all citations regardless of score', () => {
    fc.assert(
      fc.property(
        fc.array(arbCitationItem, { minLength: 0, maxLength: 20 }),
        arbThreshold,
        (items, threshold) => {
          const result = filterCitationsByRelevance(items, { isRoot: true, threshold });
          expect(result).toEqual(items);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('normal users only see citations with max score >= threshold', () => {
    fc.assert(
      fc.property(
        fc.array(arbCitationItem, { minLength: 0, maxLength: 20 }),
        arbThreshold,
        (items, threshold) => {
          const result = filterCitationsByRelevance(items, { isRoot: false, threshold });

          // Every returned item must have max score >= threshold
          for (const item of result) {
            const maxScore = Math.max(...item.score.map((s) => s.value ?? 0));
            expect(maxScore).toBeGreaterThanOrEqual(threshold);
          }

          // Every excluded item must have max score < threshold or empty score
          const excluded = items.filter((i) => !result.includes(i));
          for (const item of excluded) {
            if (item.score.length === 0) continue; // empty score → filtered out
            const maxScore = Math.max(...item.score.map((s) => s.value ?? 0));
            expect(maxScore).toBeLessThan(threshold);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('citations with empty score array are always filtered for normal users', () => {
    fc.assert(
      fc.property(arbThreshold, (threshold) => {
        const items: TestCitationItem[] = [
          { id: 'empty', score: [] },
          { id: 'has-score', score: [{ value: 1.0 }] }
        ];
        const result = filterCitationsByRelevance(items, { isRoot: false, threshold });
        expect(result.find((i) => i.id === 'empty')).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
