import { describe, it, expect } from 'vitest';
import { checkConnectivity } from '../src/core/validate-online.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis, AvailabilityStatus } from '../src/types/analysis.js';

/**
 * Replicate computeAvailability logic for unit testing.
 * Mirrors src/core/process.ts:computeAvailability.
 */
function computeAvailability(
  source: BookSource,
  analysis: SourceAnalysis,
): AvailabilityStatus {
  if (analysis.validationStatus === 'STRUCTURE_INVALID') return 'invalid';

  if (analysis.connectivityStatus === 'NON_HTTP_SOURCE') {
    return 'complex_unverified';
  }

  if (analysis.connectivityStatus === 'NOT_CHECKED') {
    if (analysis.validationStatus === 'STRUCTURE_OK') return 'unknown';
    if (analysis.validationStatus === 'STRUCTURE_WARN') return 'probably_usable';
    return 'unknown';
  }

  switch (analysis.connectivityStatus) {
    case 'CONNECT_OK':
      if (analysis.searchStatus === 'SEARCH_HTTP_OK' || analysis.searchStatus === 'SEARCH_RULE_LIKELY_OK') {
        return 'usable';
      }
      if (analysis.searchStatus === 'SEARCH_COMPLEX_JS_SKIPPED') {
        return 'complex_unverified';
      }
      return 'probably_usable';

    case 'CONNECT_FORBIDDEN':
      return 'forbidden';

    case 'CONNECT_DEAD':
      return 'dead';

    case 'CONNECT_TIMEOUT':
      return 'timeout';

    case 'CONNECT_ERROR':
      // DNS/TLS/ECONNRESET — not immediately dead
      return 'unknown';

    default:
      return 'unknown';
  }
}

function makeAnalysis(overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    index: 0,
    originalName: '测试',
    cleanedName: '测试',
    originalGroup: '',
    inferredGroup: '小说',
    originalType: 0,
    normalizedUrl: 'https://test.com',
    normalizedHost: 'test.com',
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
    score: 0,
    scoreBreakdown: {},
    classificationConfidence: 'low',
    classificationTags: [],
    warnings: [],
    processedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeAvailability', () => {
  it('should return invalid for STRUCTURE_INVALID', () => {
    const a = makeAnalysis({ validationStatus: 'STRUCTURE_INVALID' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('invalid');
  });

  it('should return complex_unverified for NON_HTTP_SOURCE', () => {
    const a = makeAnalysis({ connectivityStatus: 'NON_HTTP_SOURCE' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('complex_unverified');
  });

  it('should return unknown for NOT_CHECKED + STRUCTURE_OK', () => {
    const a = makeAnalysis({ connectivityStatus: 'NOT_CHECKED', validationStatus: 'STRUCTURE_OK' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('unknown');
  });

  it('should return probably_usable for NOT_CHECKED + STRUCTURE_WARN', () => {
    const a = makeAnalysis({ connectivityStatus: 'NOT_CHECKED', validationStatus: 'STRUCTURE_WARN' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('probably_usable');
  });

  it('should return unknown for CONNECT_ERROR (not dead)', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_ERROR' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('unknown');
    expect(computeAvailability(s, a)).not.toBe('dead');
  });

  it('should return dead for CONNECT_DEAD', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_DEAD' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('dead');
  });

  it('should return forbidden for CONNECT_FORBIDDEN', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_FORBIDDEN' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('forbidden');
  });

  it('should return timeout for CONNECT_TIMEOUT', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_TIMEOUT' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('timeout');
  });

  it('should return usable for CONNECT_OK + SEARCH_HTTP_OK', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_OK', searchStatus: 'SEARCH_HTTP_OK' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('usable');
  });

  it('should return usable for CONNECT_OK + SEARCH_RULE_LIKELY_OK', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_OK', searchStatus: 'SEARCH_RULE_LIKELY_OK' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('usable');
  });

  it('should return complex_unverified for CONNECT_OK + SEARCH_COMPLEX_JS_SKIPPED', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_OK', searchStatus: 'SEARCH_COMPLEX_JS_SKIPPED' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('complex_unverified');
  });

  it('should return probably_usable for CONNECT_OK + unverified search', () => {
    const a = makeAnalysis({ connectivityStatus: 'CONNECT_OK', searchStatus: 'SEARCH_UNVERIFIED' });
    const s: BookSource = {};
    expect(computeAvailability(s, a)).toBe('probably_usable');
  });
});

describe('checkConnectivity for non-HTTP sources', () => {
  it('should mark non-HTTP bookSourceUrl as NON_HTTP_SOURCE', async () => {
    const source: BookSource = {
      bookSourceName: '非HTTP源',
      bookSourceUrl: 'custom-identifier',
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

  it('should mark custom schema sources as NON_HTTP_SOURCE', async () => {
    const source: BookSource = {
      bookSourceName: '自定义标识',
      bookSourceUrl: 'mi-guo-du',
      bookSourceType: 0,
      searchUrl: '',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };

    const result = await checkConnectivity(source, { timeout: 3000 });
    expect(result.status).toBe('NON_HTTP_SOURCE');
  });
});
