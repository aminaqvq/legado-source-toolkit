import { describe, it, expect } from 'vitest';
import { validateStructure } from '../src/core/validate-structure.js';
import type { BookSource } from '../src/types/book-source.js';

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return {
    bookSourceName: '测试源',
    bookSourceUrl: 'https://test.com',
    bookSourceType: 0,
    searchUrl: 'https://test.com/search/{{key}}',
    ruleSearch: {
      bookList: 'div.list',
      name: 'h3',
      bookUrl: 'a@href',
    },
    ruleBookInfo: { name: 'h1' },
    ruleToc: { chapterList: 'ul li', chapterName: 'a' },
    ruleContent: { content: 'div#content' },
    ...overrides,
  };
}

describe('validateStructure', () => {
  it('should pass for complete source', () => {
    const r = validateStructure(makeSource());
    expect(r.status).toBe('STRUCTURE_OK');
    expect(r.reasons).toHaveLength(0);
  });

  it('should flag missing bookSourceName', () => {
    const r = validateStructure(makeSource({ bookSourceName: '' }));
    expect(r.status).toBe('STRUCTURE_INVALID');
    expect(r.reasons).toContain('Missing bookSourceName');
  });

  it('should flag missing bookSourceUrl', () => {
    const r = validateStructure(makeSource({ bookSourceUrl: '' }));
    expect(r.status).toBe('STRUCTURE_INVALID');
    expect(r.reasons).toContain('Missing bookSourceUrl');
  });

  it('should warn on missing bookSourceType', () => {
    const r = validateStructure(makeSource({ bookSourceType: undefined }));
    expect(r.status).toBe('STRUCTURE_WARN');
    expect(r.reasons.some((s) => s.includes('bookSourceType'))).toBe(true);
  });

  it('should warn on missing searchUrl', () => {
    const r = validateStructure(makeSource({ searchUrl: '' }));
    expect(r.status).toBe('STRUCTURE_WARN');
    expect(r.reasons).toContain('Missing searchUrl');
  });

  it('should flag missing ruleSearch', () => {
    const r = validateStructure(makeSource({ ruleSearch: undefined }));
    expect(r.status).toBe('STRUCTURE_INVALID');
    expect(r.reasons).toContain('Missing ruleSearch');
  });

  it('should warn on missing ruleSearch fields', () => {
    const r = validateStructure(makeSource({
      ruleSearch: { bookList: '', name: '', bookUrl: '' },
    }));
    expect(r.status).toBe('STRUCTURE_WARN');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('should warn on missing ruleBookInfo', () => {
    const r = validateStructure(makeSource({ ruleBookInfo: undefined }));
    expect(r.status).toBe('STRUCTURE_WARN');
    expect(r.reasons).toContain('Missing ruleBookInfo');
  });

  it('should warn on missing ruleToc', () => {
    const r = validateStructure(makeSource({ ruleToc: undefined }));
    expect(r.status).toBe('STRUCTURE_WARN');
    expect(r.reasons).toContain('Missing ruleToc');
  });

  it('should warn on missing ruleContent', () => {
    const r = validateStructure(makeSource({ ruleContent: undefined }));
    expect(r.status).toBe('STRUCTURE_WARN');
  });

  it('should support unknown fields passthrough', () => {
    const s: BookSource = {
      bookSourceName: '测试',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: 'https://test.com/search',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
      someUnknownField: 'should be preserved',
      anotherCustom: 42,
    };
    const r = validateStructure(s);
    expect(r.status).toBe('STRUCTURE_OK');
    // Unknown fields are just ignored by validation
  });
});
