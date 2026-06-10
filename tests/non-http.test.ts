import { describe, it, expect } from 'vitest';
import { dedupeSources } from '../src/core/dedupe.js';
import { checkConnectivity } from '../src/core/validate-online.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis } from '../src/types/analysis.js';

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return {
    bookSourceName: '测试非HTTP源',
    bookSourceUrl: 'custom-id-123',
    bookSourceGroup: '自定义',
    bookSourceType: 0,
    searchUrl: 'https://test.com/search/{{key}}',
    ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
    ruleBookInfo: { name: 'h1' },
    ruleToc: { chapterList: 'ul li', chapterName: 'a' },
    ruleContent: { content: 'div' },
    enabled: true,
    respondTime: 1000,
    weight: 500,
    ...overrides,
  };
}

function makeAnalysis(index: number, overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    index,
    originalName: `非HTTP源${index}`,
    cleanedName: `非HTTP源${index}`,
    originalGroup: '自定义',
    inferredGroup: '小说',
    originalType: 0,
    normalizedUrl: null,
    normalizedHost: null,
    validationStatus: 'STRUCTURE_OK',
    validationReason: [],
    connectivityStatus: 'NON_HTTP_SOURCE',
    connectivityDetail: '',
    searchStatus: 'NOT_CHECKED',
    searchDetail: '',
    availability: 'complex_unverified',
    duplicateKey: '',
    duplicateGroupId: null,
    kept: true,
    removedReason: null,
    score: 100 - index * 10,
    scoreBreakdown: {},
    classificationConfidence: 'medium',
    classificationTags: [],
    warnings: [],
    processedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Non-HTTP source deduplication', () => {
  it('should not group different non-HTTP sources under host dedupe', () => {
    const s1 = makeSource({ bookSourceUrl: 'id-aaa', bookSourceName: '源A' });
    const s2 = makeSource({ bookSourceUrl: 'id-bbb', bookSourceName: '源B' });
    const a1 = makeAnalysis(0, { cleanedName: '源A' });
    const a2 = makeAnalysis(1, { cleanedName: '源B' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    // Both should be kept — different non-HTTP identifiers must not be grouped
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(true);
    expect(r.groups).toHaveLength(0);
  });

  it('should not group same-type different-name non-HTTP sources', () => {
    const s1 = makeSource({ bookSourceUrl: 'custom-a', bookSourceType: 0, bookSourceName: '源X' });
    const s2 = makeSource({ bookSourceUrl: 'custom-b', bookSourceType: 0, bookSourceName: '源Y' });
    const a1 = makeAnalysis(0, { cleanedName: '源X' });
    const a2 = makeAnalysis(1, { cleanedName: '源Y' });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(true);
    expect(r.groups).toHaveLength(0);
  });

  it('should group truly identical non-HTTP sources (same type + same name)', () => {
    const s1 = makeSource({ bookSourceUrl: 'custom-x', bookSourceType: 0, bookSourceName: 'ID源' });
    const s2 = makeSource({ bookSourceUrl: 'custom-x', bookSourceType: 0, bookSourceName: 'ID源' });
    const a1 = makeAnalysis(0, { cleanedName: 'ID源', score: 100 });
    const a2 = makeAnalysis(1, { cleanedName: 'ID源', score: 50 });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(false);
    expect(r.groups).toHaveLength(1);
  });

  it('should not group non-HTTP source with HTTP source of same name', () => {
    const s1 = makeSource({ bookSourceUrl: 'custom-id', bookSourceName: '同名言情' });
    const s2: BookSource = {
      ...makeSource({ bookSourceUrl: 'https://www.tongming.com', bookSourceName: '同名言情' }),
    };
    const a1 = makeAnalysis(0, { cleanedName: '同名言情' });
    const a2 = makeAnalysis(1, {
      cleanedName: '同名言情',
      connectivityStatus: 'CONNECT_OK',
      normalizedUrl: 'https://www.tongming.com',
      normalizedHost: 'tongming.com',
      availability: 'usable',
    });

    const r = dedupeSources([s1, s2], [a1, a2], { level: 'host' });
    // Non-HTTP key (non-http:...) vs HTTP key (tongming.com) → different groups
    expect(r.kept[0]).toBe(true);
    expect(r.kept[1]).toBe(true);
    expect(r.groups).toHaveLength(0);
  });
});

describe('Non-HTTP connectivity', () => {
  it('should detect non-HTTP URL as NON_HTTP_SOURCE', async () => {
    const source: BookSource = {
      bookSourceName: '自定义标识源',
      bookSourceUrl: 'hello-world-identifier',
      bookSourceType: 0,
      searchUrl: 'https://example.com/search',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkConnectivity(source, { timeout: 3000 });
    expect(result.status).toBe('NON_HTTP_SOURCE');
  });
});
