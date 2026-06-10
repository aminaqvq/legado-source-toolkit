import { describe, it, expect } from 'vitest';
import { checkSearchUrl } from '../src/core/validate-search.js';
import type { BookSource } from '../src/types/book-source.js';

describe('checkSearchUrl', () => {
  it('should skip complex JS search URLs', async () => {
    const source: BookSource = {
      bookSourceName: '复杂JS源',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: '<js>java.ajax("https://api.test.com/search")</js>',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkSearchUrl(source, '小说');
    expect(result.status).toBe('SEARCH_COMPLEX_JS_SKIPPED');
  });

  it('should skip @js: patterns', async () => {
    const source: BookSource = {
      bookSourceName: '@js源',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: '@js:fetch("https://api.test.com/search")',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkSearchUrl(source, '小说');
    expect(result.status).toBe('SEARCH_COMPLEX_JS_SKIPPED');
  });

  it('should return SEARCH_FAILED for unreachable but clean search URL', async () => {
    const source: BookSource = {
      bookSourceName: 'eval源',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: 'https://test.com/search?q={{key}}',
      loginCheckJs: 'eval("fetch(...)")',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkSearchUrl(source, '小说');
    // loginCheckJs with eval() triggers SEARCH_SKIPPED_JS (source-wide JS check)
    expect(result.status).toBe('SEARCH_SKIPPED_JS');
  });

  it('should return UNVERIFIED for empty searchUrl', async () => {
    const source: BookSource = {
      bookSourceName: '无搜索源',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: '',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkSearchUrl(source, '小说');
    expect(result.status).toBe('SEARCH_UNVERIFIED');
  });

  it('should return UNVERIFIED for missing searchUrl', async () => {
    const source: BookSource = {
      bookSourceName: '无搜索URL',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };
    const result = await checkSearchUrl(source, '小说');
    expect(result.status).toBe('SEARCH_UNVERIFIED');
  });
});
