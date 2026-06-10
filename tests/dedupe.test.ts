import { describe, it, expect } from 'vitest';
import { dedupeSources } from '../src/core/dedupe.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis } from '../src/types/analysis.js';

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return {
    bookSourceName: '测试源',
    bookSourceUrl: 'https://test.com',
    bookSourceGroup: '测试',
    bookSourceType: 0,
    searchUrl: 'https://test.com/search/{{key}}',
    ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
    ruleBookInfo: { name: 'h1' },
    ruleToc: { chapterList: 'ul li', chapterName: 'a' },
    ruleContent: { content: 'div#content' },
    enabled: true,
    respondTime: 1000,
    lastUpdateTime: 1734567890000,
    weight: 1000,
    ...overrides,
  };
}

function makeAnalysis(index: number, overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    index,
    originalName: `源${index}`,
    cleanedName: `源${index}`,
    originalGroup: '测试',
    inferredGroup: '小说',
    originalType: 0,
    normalizedUrl: null,
    normalizedHost: null,
    validationStatus: 'STRUCTURE_OK',
    validationReason: [],
    connectivityStatus: 'NOT_CHECKED',
    connectivityDetail: '',
    searchStatus: 'NOT_CHECKED',
    searchDetail: '',
    availability: 'unknown',
    duplicateKey: '',
    duplicateGroupId: null,
    kept: true,
    removedReason: null,
    score: 100 - index * 10,
    scoreBreakdown: {},
    classificationConfidence: 'high',
    classificationTags: [],
    warnings: [],
    processedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('dedupeSources', () => {
  it('should not dedupe with level=none', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://example.com' });
    const s2 = makeSource({ bookSourceUrl: 'https://example.com' });
    const a1 = makeAnalysis(0, { normalizedHost: 'example.com' });
    const a2 = makeAnalysis(1, { normalizedHost: 'example.com' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'none' });
    expect(r.kept).toEqual([true, true]);
    expect(r.groups).toHaveLength(0);
  });

  it('should dedupe exact URL matches', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://example.com/page' });
    const s2 = makeSource({ bookSourceUrl: 'https://example.com/page' });
    const a1 = makeAnalysis(0, { score: 100 });
    const a2 = makeAnalysis(1, { score: 50 });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'exact' });
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(false);
    expect(r.groups).toHaveLength(1);
  });

  it('should dedupe host-level matches', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://www.example.com/a' });
    const s2 = makeSource({ bookSourceUrl: 'https://m.example.com/b' });
    const a1 = makeAnalysis(0, { score: 100, normalizedHost: 'example.com' });
    const a2 = makeAnalysis(1, { score: 50, normalizedHost: 'example.com' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(false);
  });

  it('should keep the higher-scoring source', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://example.com', weight: 100 });
    const s2 = makeSource({ bookSourceUrl: 'https://example.com', weight: 5000 });
    const a1 = makeAnalysis(0, { score: 30, normalizedHost: 'example.com' });
    const a2 = makeAnalysis(1, { score: 90, normalizedHost: 'example.com' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    expect(r.kept[0]).toBe(false);
    expect(r.kept[1]).toBe(true);
  });

  it('should handle no duplicates', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://a.com' });
    const s2 = makeSource({ bookSourceUrl: 'https://b.com' });
    const a1 = makeAnalysis(0, { normalizedHost: 'a.com' });
    const a2 = makeAnalysis(1, { normalizedHost: 'b.com' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    expect(r.kept).toEqual([true, true]);
    expect(r.groups).toHaveLength(0);
  });

  it('should handle three-way duplicates', () => {
    const s1 = makeSource({ bookSourceUrl: 'https://example.com/a' });
    const s2 = makeSource({ bookSourceUrl: 'https://m.example.com/b' });
    const s3 = makeSource({ bookSourceUrl: 'https://www.example.com/c' });
    const a1 = makeAnalysis(0, { score: 100, normalizedHost: 'example.com' });
    const a2 = makeAnalysis(1, { score: 80, normalizedHost: 'example.com' });
    const a3 = makeAnalysis(2, { score: 60, normalizedHost: 'example.com' });

    const r = dedupeSources([s1, s2, s3], [a1, a2, a3], { level: 'host' });
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(false);
    expect(r.kept[2]).toBe(false);
    expect(r.groups).toHaveLength(1);
  });
});
