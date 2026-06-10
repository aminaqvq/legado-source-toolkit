import { describe, it, expect } from 'vitest';
import { classifySource } from '../src/core/classify.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis } from '../src/types/analysis.js';

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return {
    bookSourceName: '测试源',
    bookSourceUrl: 'https://test.com',
    bookSourceGroup: '',
    bookSourceType: 0,
    searchUrl: 'https://test.com/search/{{key}}',
    ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
    ruleBookInfo: { name: 'h1' },
    ruleToc: { chapterList: 'ul li', chapterName: 'a' },
    ruleContent: { content: 'div#content' },
    enabled: true,
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<SourceAnalysis> = {}): SourceAnalysis {
  return {
    index: 0,
    originalName: '测试源',
    cleanedName: '测试源',
    originalGroup: '',
    inferredGroup: '其他',
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

describe('classifySource', () => {
  it('should classify type 0 as 小说', () => {
    const s = makeSource({ bookSourceType: 0, bookSourceName: '笔趣阁' });
    const a = makeAnalysis({ cleanedName: '笔趣阁' });
    const r = classifySource(s, a);
    expect(r.category).toBe('小说');
    expect(r.confidence).toBe('high');
  });

  it('should classify type 1 as 有声', () => {
    const s = makeSource({ bookSourceType: 1, bookSourceName: '喜马拉雅' });
    const a = makeAnalysis({ cleanedName: '喜马拉雅' });
    const r = classifySource(s, a);
    expect(r.category).toBe('有声');
  });

  it('should classify type 2 as 漫画', () => {
    const s = makeSource({ bookSourceType: 2, bookSourceName: '漫蛙' });
    const a = makeAnalysis({ cleanedName: '漫蛙' });
    const r = classifySource(s, a);
    expect(r.category).toBe('漫画');
  });

  it('should classify type 3 as 下载', () => {
    const s = makeSource({ bookSourceType: 3, bookSourceName: 'EPUB下载' });
    const a = makeAnalysis({ cleanedName: 'EPUB下载' });
    const r = classifySource(s, a);
    expect(r.category).toBe('下载');
  });

  it('should detect comic from keywords (type vs keyword tie goes to keyword)', () => {
    const s = makeSource({ bookSourceType: 2, bookSourceName: '动漫之家' });
    const a = makeAnalysis({ cleanedName: '动漫之家' });
    const r = classifySource(s, a);
    expect(r.category).toBe('漫画');
  });

  it('should detect video from m3u8 in rules', () => {
    const s = makeSource({
      bookSourceType: 0,
      bookSourceName: '测试',
      ruleContent: { content: 'video', sourceRegex: 'm3u8' },
    });
    const a = makeAnalysis({ cleanedName: '测试' });
    const r = classifySource(s, a);
    expect(r.category).toBe('影视');
  });

  it('should detect audio from keyword in name (type vs keyword tie goes to keyword)', () => {
    const s = makeSource({ bookSourceType: 1, bookSourceName: '听书网' });
    const a = makeAnalysis({ cleanedName: '听书网' });
    const r = classifySource(s, a);
    expect(r.category).toBe('有声');
  });

  it('should classify as 失效 when name contains marker', () => {
    const s = makeSource({ bookSourceName: '失效站点', bookSourceGroup: '' });
    const a = makeAnalysis({ originalName: '失效站点', cleanedName: '失效站点' });
    const r = classifySource(s, a);
    expect(r.category).toBe('失效');
  });

  it('should classify as 失效 when group contains marker', () => {
    const s = makeSource({ bookSourceName: '测试站', bookSourceGroup: '失效' });
    const a = makeAnalysis({ cleanedName: '测试站' });
    const r = classifySource(s, a);
    expect(r.category).toBe('失效');
  });

  it('should return low confidence for unknown types', () => {
    const s = makeSource({ bookSourceType: 99, bookSourceName: '未知站' });
    const a = makeAnalysis({ cleanedName: '未知站' });
    const r = classifySource(s, a);
    expect(r.confidence).toBe('low');
    expect(r.category).toBe('其他');
  });

  it('should cross-validate type 1 + audio keyword', () => {
    const s = makeSource({ bookSourceType: 1, bookSourceName: 'FM电台' });
    const a = makeAnalysis({ cleanedName: 'FM电台' });
    const r = classifySource(s, a);
    expect(r.category).toBe('有声');
    expect(r.confidence).toBe('high');
  });

  it('should cross-validate type 2 + comic keyword', () => {
    const s = makeSource({ bookSourceType: 2, bookSourceName: '漫画站' });
    const a = makeAnalysis({ cleanedName: '漫画站' });
    const r = classifySource(s, a);
    expect(r.category).toBe('漫画');
    expect(r.confidence).toBe('high');
  });
});
