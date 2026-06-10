import { describe, it, expect } from 'vitest';
import { calculateScore } from '../src/core/score.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis } from '../src/types/analysis.js';

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return {
    bookSourceName: '测试源',
    bookSourceUrl: 'https://test.com',
    bookSourceType: 0,
    searchUrl: 'https://test.com/search/{{key}}',
    ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
    ruleBookInfo: { name: 'h1' },
    ruleToc: { chapterList: 'ul li', chapterName: 'a' },
    ruleContent: { content: 'div#content' },
    enabled: true,
    respondTime: 1000,
    lastUpdateTime: Date.now(),
    weight: 1000,
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    index: 0,
    originalName: '测试源',
    cleanedName: '测试源',
    originalGroup: '',
    inferredGroup: '小说',
    originalType: 0,
    normalizedUrl: 'https://test.com',
    normalizedHost: 'test.com',
    validationStatus: 'STRUCTURE_OK',
    validationReason: [],
    connectivityStatus: 'CONNECT_OK',
    connectivityDetail: 'HTTP 200',
    searchStatus: 'SEARCH_HTTP_OK',
    searchDetail: 'HTTP 200, response size 5000',
    availability: 'usable',
    duplicateKey: '',
    duplicateGroupId: null,
    kept: true,
    removedReason: null,
    score: 0,
    scoreBreakdown: {},
    classificationConfidence: 'high',
    classificationTags: [],
    warnings: [],
    processedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('calculateScore', () => {
  it('should give high score to usable source', () => {
    const s = makeSource();
    const a = makeAnalysis({ availability: 'usable' });
    const r = calculateScore(s, a);
    expect(r.score).toBeGreaterThan(100);
    expect(r.breakdown['availability_usable']).toBe(100);
  });

  it('should give penalty to dead source', () => {
    // Create a minimal source with no bonuses
    const s = makeSource({
      enabled: false,
      enabledExplore: false,
      searchUrl: undefined,
      ruleSearch: { bookList: '', name: '', bookUrl: '' },
      ruleBookInfo: undefined,
      ruleToc: undefined,
      ruleContent: undefined,
      respondTime: 999999,
      weight: 0,
      lastUpdateTime: 0,
    });
    const a = makeAnalysis({
      availability: 'dead',
      connectivityStatus: 'CONNECT_DEAD',
      searchStatus: 'NOT_CHECKED',
      classificationConfidence: 'low',
    });
    const r = calculateScore(s, a);
    expect(r.score).toBeLessThan(0);
    expect(r.breakdown['availability_dead']).toBe(-100);
  });

  it('should give penalty to invalid source', () => {
    const s = makeSource({
      enabled: false,
      enabledExplore: false,
      searchUrl: undefined,
      ruleSearch: { bookList: '', name: '', bookUrl: '' },
      ruleBookInfo: undefined,
      ruleToc: undefined,
      ruleContent: undefined,
      respondTime: 999999,
      weight: 0,
      lastUpdateTime: 0,
    });
    const a = makeAnalysis({
      availability: 'invalid',
      connectivityStatus: 'NOT_CHECKED',
      searchStatus: 'NOT_CHECKED',
      classificationConfidence: 'low',
    });
    const r = calculateScore(s, a);
    expect(r.score).toBeLessThan(0);
  });

  it('should penalize missing searchUrl', () => {
    const s = makeSource({ searchUrl: undefined });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['missing_search_url']).toBe(-20);
  });

  it('should penalize missing ruleSearch', () => {
    const s = makeSource({ ruleSearch: undefined });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['missing_rule_search']).toBe(-20);
  });

  it('should give bonus for enabled flags', () => {
    const s = makeSource({ enabled: true, enabledExplore: true });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['enabled']).toBe(10);
    expect(r.breakdown['enabled_explore']).toBe(5);
  });

  it('should penalize name containing 失效', () => {
    const s = makeSource({ bookSourceName: '失效站点' });
    const a = makeAnalysis({ cleanedName: '失效站点' });
    const r = calculateScore(s, a);
    expect(r.breakdown['name_contains_dead']).toBe(-40);
  });

  it('should give respond time bonus', () => {
    const s = makeSource({ respondTime: 400 });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['respond_time']).toBeGreaterThan(0);
  });

  it('should penalize high respond time', () => {
    const s = makeSource({ respondTime: 40000 });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['respond_time_high']).toBe(-20);
  });

  it('should give weight bonus', () => {
    const s = makeSource({ weight: 10000 });
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown['weight']).toBe(10);
  });

  it('should produce score breakdown with all relevant fields', () => {
    const s = makeSource();
    const a = makeAnalysis();
    const r = calculateScore(s, a);
    expect(r.breakdown).toBeDefined();
    expect(Object.keys(r.breakdown).length).toBeGreaterThan(5);
    expect(typeof r.score).toBe('number');
    expect(isFinite(r.score)).toBe(true);
  });
});
