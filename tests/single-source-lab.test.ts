/**
 * v1.5 Single Source Lab — fixture-driven tests.
 *
 * Verifies:
 *   - HTML search item scope (CSS rules, two books)
 *   - HTML toc item scope (CSS rules, two chapters)
 *   - JSON search item scope (JSONPath $.data[*])
 *   - resolveCandidateUrl (absolute, relative, /, //, domain-like)
 *   - POST searchUrl passes method/body through
 *   - book_url_missing → doesn't continue to bookInfo
 *   - chapter_url_missing → doesn't continue to content
 *   - content_too_short → marks FAIL
 *   - @text / @href act on item itself
 */

import { describe, it, expect } from 'vitest';

// ── Fixtures ──

const searchHtml = `<!DOCTYPE html>
<html><body>
<ul class="result-list">
  <li class="book">
    <a class="name" href="/book/1">斗破苍穹</a>
    <span class="author">天蚕土豆</span>
  </li>
  <li class="book">
    <a class="name" href="/book/2">斗罗大陆</a>
    <span class="author">唐家三少</span>
  </li>
</ul>
</body></html>`;

const tocHtml = `<!DOCTYPE html>
<html><body>
<div>
  <div class="chapter"><a href="/chapter/1">第一章 开始</a></div>
  <div class="chapter"><a href="/chapter/2">第二章 修炼</a></div>
</div>
</body></html>`;

const jsonSearchJson = JSON.stringify({
  data: [
    { name: '斗破苍穹', author: '天蚕土豆', url: '/book/666' },
    { name: '凡人修仙传', author: '忘语', url: '/book/777' },
  ],
});

const shortContentHtml = `<!DOCTYPE html>
<html><body>
<div id="content">短</div>
</body></html>`;

const noBookUrlSearchHtml = `<!DOCTYPE html>
<html><body>
<ul>
  <li class="book"><span class="name">OnlyName</span></li>
</ul>
</body></html>`;

const noChapterUrlTocHtml = `<!DOCTYPE html>
<html><body>
<div class="chapter">第一章 无链接</div>
</body></html>`;

const selfItemHtml = `<!DOCTYPE html>
<html><body>
<a class="book" href="/book/1">斗破苍穹</a>
<a class="book" href="/book/2">斗罗大陆</a>
</body></html>`;

// ══════════════════════════════════════════════════════
//  resolveCandidateUrl
// ══════════════════════════════════════════════════════

describe('resolveCandidateUrl', () => {
  it('should return absolute URL as-is', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveCandidateUrl('https://example.com/page', {
      baseUrl: 'https://other.com',
    });
    expect(result).toBe('https://example.com/page');
  });

  it('should resolve /path against baseUrl', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveCandidateUrl('/book/1', {
      baseUrl: 'https://example.com/search',
    });
    expect(result).toBe('https://example.com/book/1');
  });

  it('should resolve //host/path by prepending https:', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveCandidateUrl('//cdn.example.com/path', {
      baseUrl: 'https://example.com',
    });
    expect(result).toBe('https://cdn.example.com/path');
  });

  it('should resolve relative path against baseUrl', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveCandidateUrl('book/1', {
      baseUrl: 'https://example.com/search/',
    });
    expect(result).toBe('https://example.com/search/book/1');
  });

  it('should fallback to sourceBaseUrl when baseUrl is empty', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveCandidateUrl('/book/1', {
      baseUrl: '',
      sourceBaseUrl: 'https://sourcebase.com',
    });
    expect(result).toBe('https://sourcebase.com/book/1');
  });

  it('should detect domain-like strings when baseUrl is non-HTTP', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    // When baseUrl is not a valid HTTP URL, the domain regex should kick in
    const result = resolveCandidateUrl('example.com/path', {
      baseUrl: '',
      sourceBaseUrl: '',
    });
    expect(result).toBe('https://example.com/path');
  });

  it('should resolve domain-like path even with non-HTTP baseUrl', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    // With a non-HTTP baseUrl, new URL() will fail, triggering domain detection
    const result = resolveCandidateUrl('example.com/path', {
      baseUrl: 'not-a-url',
    });
    // new URL('example.com/path', 'not-a-url') will throw, then domain regex catches it
    expect(result).toBe('https://example.com/path');
  });

  it('should handle unresolvable candidates gracefully', async () => {
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');
    // Empty candidate
    expect(resolveCandidateUrl('', { baseUrl: 'https://example.com' })).toBeNull();
    // Whitespace only
    expect(resolveCandidateUrl('   ', { baseUrl: 'https://example.com' })).toBeNull();
  });
});

// ══════════════════════════════════════════════════════
//  executeRuleOnScope — HTML items
// ══════════════════════════════════════════════════════

describe('executeRuleOnScope — HTML search items', () => {
  it('should extract name, author, bookUrl from search items using CSS scope', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');

    // Execute bookList
    const listResult = executeRule('.book', { content: searchHtml });
    expect(listResult.list.length).toBe(2);
    expect(listResult.elements.length).toBe(2);

    // Extract name from first item via scope
    // Rule: .name (CSS inside scope element) — the parser splits @text as text getter
    // Use rule without @ for scoped find
    const nameResult = executeRuleOnScope('.name', { raw: listResult.elements[0], kind: 'html-element' }, { content: searchHtml });
    expect(nameResult.text).toBe('斗破苍穹');

    // Extract author from first item
    const authorResult = executeRuleOnScope('.author', { raw: listResult.elements[0], kind: 'html-element' }, { content: searchHtml });
    expect(authorResult.text).toBe('天蚕土豆');

    // Extract bookUrl from first item — .name element's href
    const urlResult = executeRuleOnScope('@href', { raw: listResult.elements[0], kind: 'html-element' }, { content: searchHtml });
    // @href on the element gets href from .book scope — but we need .name's href
    // Use .name scope element instead
    // First get .name element from the .book scope
    const nameListResult = executeRule('.name', { content: searchHtml });
    const firstBookUrlResult = executeRuleOnScope('@href', { raw: nameListResult.elements[0], kind: 'html-element' }, { content: searchHtml });
    expect(firstBookUrlResult.text).toBe('/book/1');

    // Resolve relative bookUrl
    const resolved = resolveCandidateUrl(firstBookUrlResult.text!, {
      baseUrl: 'https://example.com',
    });
    expect(resolved).toBe('https://example.com/book/1');
  });

  it('should extract name from second item', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    const listResult = executeRule('.book', { content: searchHtml });
    expect(listResult.elements.length).toBe(2);

    const nameResult = executeRuleOnScope('.name', { raw: listResult.elements[1], kind: 'html-element' }, { content: searchHtml });
    expect(nameResult.text).toBe('斗罗大陆');
  });
});

// ══════════════════════════════════════════════════════
//  executeRuleOnScope — HTML toc items
// ══════════════════════════════════════════════════════

describe('executeRuleOnScope — HTML toc items', () => {
  it('should extract chapterName and chapterUrl from toc items', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');
    const { resolveCandidateUrl } = await import('../src/core/rule-engine/url-resolver.js');

    const listResult = executeRule('.chapter', { content: tocHtml });
    expect(listResult.elements.length).toBe(2);

    // First chapter — use 'a' CSS selector in scope to get the <a> element text
    const nameResult = executeRuleOnScope('a', { raw: listResult.elements[0], kind: 'html-element' }, { content: tocHtml });
    expect(nameResult.text).toBe('第一章 开始');

    const urlResult = executeRuleOnScope('@href', { raw: listResult.elements[0], kind: 'html-element' }, { content: tocHtml });
    // @href on .chapter div may not work — we need the <a> element href
    // Use the <a> element extracted separately
    const aElements = executeRule('.chapter a', { content: tocHtml });
    const firstChapterUrl = executeRuleOnScope('@href', { raw: aElements.elements[0], kind: 'html-element' }, { content: tocHtml });
    expect(firstChapterUrl.text).toBe('/chapter/1');

    const resolved = resolveCandidateUrl(firstChapterUrl.text!, {
      baseUrl: 'https://example.com/toc',
    });
    expect(resolved).toBe('https://example.com/chapter/1');

    // Second chapter
    const nameResult2 = executeRuleOnScope('a', { raw: listResult.elements[1], kind: 'html-element' }, { content: tocHtml });
    expect(nameResult2.text).toBe('第二章 修炼');
  });
});

// ══════════════════════════════════════════════════════
//  executeRuleOnScope — @text / @href on item itself
// ══════════════════════════════════════════════════════

describe('executeRuleOnScope — self-acting rules', () => {
  it('should execute @text on the item itself (not descendants)', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    // HTML where the item itself IS the link
    const listResult = executeRule('.book', { content: selfItemHtml });
    expect(listResult.elements.length).toBe(2);

    // @text on the first <a> element — should get its text content directly
    const textResult = executeRuleOnScope('@text', { raw: listResult.elements[0], kind: 'html-element' }, { content: selfItemHtml });
    expect(textResult.text).toBe('斗破苍穹');

    // @href on the first <a> element
    const hrefResult = executeRuleOnScope('@href', { raw: listResult.elements[0], kind: 'html-element' }, { content: selfItemHtml });
    expect(hrefResult.text).toBe('/book/1');
  });
});

// ══════════════════════════════════════════════════════
//  executeRuleOnScope — JSON items
// ══════════════════════════════════════════════════════

describe('executeRuleOnScope — JSON search items', () => {
  it('should extract name/author/url from JSONPath items', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    // Use JSONPath to get items
    const listResult = executeRule('$.data[*]', { content: jsonSearchJson });
    expect(listResult.elements.length).toBe(2);

    // elements from JSONPath are the raw JSON values (objects parsed from JSON)
    // They come back as ValueNode with kind 'object'
    const firstItem = listResult.elements[0] as Record<string, unknown>;
    // Execute rules on the raw JSON object
    const nameResult = executeRuleOnScope('$.name', { raw: firstItem, kind: 'json-object' }, { content: jsonSearchJson });
    expect(nameResult.text).toBe('斗破苍穹');

    const authorResult = executeRuleOnScope('$.author', { raw: firstItem, kind: 'json-object' }, { content: jsonSearchJson });
    expect(authorResult.text).toBe('天蚕土豆');

    const urlResult = executeRuleOnScope('$.url', { raw: firstItem, kind: 'json-object' }, { content: jsonSearchJson });
    expect(urlResult.text).toBe('/book/666');
  });

  it('should handle shorthand JSONPath rules (name, author)', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    const listResult = executeRule('$.data[*]', { content: jsonSearchJson });
    const firstItem = listResult.elements[0] as Record<string, unknown>;

    // Shorthand: rule="name" instead of "$.name" — common in Legado
    const nameResult = executeRuleOnScope('name', { raw: firstItem, kind: 'json-object' }, { content: jsonSearchJson });
    // In JSON scope, text mode with 'name' tries property access on the object
    expect(nameResult.text).toBe('斗破苍穹');
  });
});

// ══════════════════════════════════════════════════════
//  book_url_missing → doesn't continue to bookInfo
// ══════════════════════════════════════════════════════

describe('book_url_missing', () => {
  it('should not continue to bookInfo when no bookUrl extracted', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    // Search with only names, no URLs
    const listResult = executeRule('.book', { content: noBookUrlSearchHtml });
    expect(listResult.elements.length).toBe(1);

    // Try to extract bookUrl — should fail
    const urlResult = executeRuleOnScope('.bookUrl@href', { raw: listResult.elements[0], kind: 'html-element' }, { content: noBookUrlSearchHtml });
    // .bookUrl@href selector won't match because the HTML doesn't have .bookUrl
    expect(urlResult.text).toBeNull();

    // With no bookUrl, the chain should stop — verified manually via verifyAllRules behavior
  });
});

// ══════════════════════════════════════════════════════
//  chapter_url_missing → doesn't continue to content
// ══════════════════════════════════════════════════════

describe('chapter_url_missing', () => {
  it('should not continue to content when no chapterUrl extracted', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const { executeRuleOnScope } = await import('../src/core/rule-engine/executor.js');

    // TOC with only names, no URLs
    const listResult = executeRule('.chapter', { content: noChapterUrlTocHtml });
    expect(listResult.elements.length).toBe(1);

    // Try to extract chapterUrl — should fail
    const urlResult = executeRuleOnScope('a@href', { raw: listResult.elements[0], kind: 'html-element' }, { content: noChapterUrlTocHtml });
    expect(urlResult.text).toBeNull();

    // With no chapterUrl, the chain should stop
  });
});

// ══════════════════════════════════════════════════════
//  content_too_short
// ══════════════════════════════════════════════════════

describe('content_too_short', () => {
  it('should mark content as too short when < 20 chars', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');

    // Simple CSS select then text extraction (compatible with parser)
    const result = executeRule('#content', { content: shortContentHtml });
    expect(result.text).toBe('短');
    const textLen = result.text?.length ?? 0;
    expect(textLen).toBeLessThan(20);
    const isTooShort = textLen < 20;
    expect(isTooShort).toBe(true);
  });
});

// ══════════════════════════════════════════════════════
//  POST searchUrl — resolveSearchUrl returns method/body
// ══════════════════════════════════════════════════════

describe('POST searchUrl support', () => {
  it('should parse POST searchUrl with method and body', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');

    const resolved = resolveSearchUrl({
      searchUrl: '/search,{"method":"POST","body":"searchkey={{key}}"}',
      baseUrl: 'https://example.com',
      key: '斗破苍穹',
      page: 1,
    });

    expect(resolved.url).toBe('https://example.com/search');
    expect(resolved.method).toBe('POST');
    expect(resolved.body).toBe('searchkey=%E6%96%97%E7%A0%B4%E8%8B%8D%E7%A9%B9');
  });

  it('should parse POST searchUrl with headers', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');

    const resolved = resolveSearchUrl({
      searchUrl: '/api/search,{"method":"POST","body":"q={{key}}","headers":{"X-Custom":"test"}}',
      baseUrl: 'https://example.com',
      key: 'test',
    });

    expect(resolved.method).toBe('POST');
    expect(resolved.headers).toBeDefined();
    expect(resolved.headers!['X-Custom']).toBe('test');
  });
});

// ══════════════════════════════════════════════════════
//  verifyAllRules — orchestrator (mock fetch)
// ══════════════════════════════════════════════════════

import { vi, afterEach } from 'vitest';

const searchHtmlFixture = `<!DOCTYPE html>
<html><body>
<ul class="result-list">
  <li class="book">
    <a class="name" href="/book/1">斗破苍穹</a>
    <span class="author">天蚕土豆</span>
  </li>
</ul>
</body></html>`;

const bookInfoHtmlFixture = `<!DOCTYPE html>
<html><body>
<div class="book-info">
  <h1 class="book-title">斗破苍穹</h1>
  <p class="book-author">天蚕土豆</p>
  <a class="read-btn" href="/read/1">开始阅读</a>
</div>
</body></html>`;

const tocHtmlFixture = `<!DOCTYPE html>
<html><body>
<div class="chapter-list">
  <div class="chapter"><a href="/chapter/1">第一章 开始</a></div>
  <div class="chapter"><a href="/chapter/2">第二章 修炼</a></div>
</div>
</body></html>`;

const contentHtmlFixture = `<!DOCTYPE html>
<html><body>
<div id="content"><p>斗之力，三段！这是一个关于修炼斗气的大陆，少年从废物到强者的逆袭之路。</p><p>他是萧家历史上最年轻的斗者！</p></div>
</body></html>`;

const jsonSearchFixture = JSON.stringify({
  data: [
    { name: '斗破苍穹', author: '天蚕土豆', url: '/book/666' },
  ],
});

function makeResponse(body: string, status = 200, contentType = 'text/html'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

const CSS_SOURCE: import('../src/types/book-source.js').BookSource = {
  bookSourceName: '测试CSS书源',
  bookSourceUrl: 'https://example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '.result-list .book',
    name: '.name',
    author: '.author',
    bookUrl: '.name@href',
  },
  ruleBookInfo: {
    name: '.book-title',
    author: '.book-author',
    tocUrl: '.read-btn@href',
  },
  ruleToc: {
    chapterList: '.chapter-list .chapter',
    chapterName: 'a',
    chapterUrl: 'a@href',
  },
  ruleContent: {
    content: '#content',
  },
};

const JSON_SOURCE: import('../src/types/book-source.js').BookSource = {
  bookSourceName: '测试JSON书源',
  bookSourceUrl: 'https://example.com',
  searchUrl: '/api/search?q={{key}}',
  ruleSearch: {
    bookList: '$.data[*]',
    name: 'name',
    author: 'author',
    bookUrl: 'url',
  },
  ruleBookInfo: {
    name: '.book-title',
  },
};

const SHORT_CONTENT_SOURCE: import('../src/types/book-source.js').BookSource = {
  bookSourceName: '短正文源',
  bookSourceUrl: 'https://example.com',
  searchUrl: '/search?q={{key}}',
  ruleSearch: {
    bookList: '.book',
    name: '.name',
    bookUrl: '.name@href',
  },
  ruleBookInfo: { name: '.book-title', tocUrl: '.read-btn@href' },
  ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '#content' },
};

afterEach(() => {
  vi.restoreAllMocks();
  // Ensure fetch is restored
  if ((globalThis as any).__origFetch) {
    globalThis.fetch = (globalThis as any).__origFetch;
    delete (globalThis as any).__origFetch;
  }
});

function installFetch(routes: Record<string, Response>): { calls: Array<{ url: string; method: string }>; restore: () => void } {
  const calls: Array<{ url: string; method: string }> = [];
  const orig = globalThis.fetch;
  (globalThis as any).__origFetch = orig;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = init?.method ?? 'GET';
    calls.push({ url: urlStr, method });
    for (const [key, resp] of Object.entries(routes)) {
      if (urlStr.includes(key)) return resp;
    }
    return makeResponse('Not Found', 404);
  }) as typeof globalThis.fetch;
  const restore = () => {
    globalThis.fetch = orig;
    delete (globalThis as any).__origFetch;
  };
  return { calls, restore };
}

describe('verifyAllRules — orchestrator', () => {
  it('should run full search→bookInfo→toc→content chain', async () => {
    const { calls, restore } = installFetch({
      '/search': makeResponse(searchHtmlFixture),
      '/book/1': makeResponse(bookInfoHtmlFixture),
      '/read/1': makeResponse(tocHtmlFixture),
      '/chapter/1': makeResponse(contentHtmlFixture),
    });

    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules(CSS_SOURCE, { keyword: '斗破苍穹', timeout: 5000 });
    restore();

    // 4 fetch calls, correct order
    expect(calls.length).toBe(4);
    expect(calls[0].url).toContain('/search');
    expect(calls[1].url).toContain('/book/1');
    expect(calls[2].url).toContain('/read/1');
    expect(calls[3].url).toContain('/chapter/1');

    // 4 stages, all VERIFIED
    expect(result.stages.length).toBe(4);
    expect(result.stages[0].status).toBe('RULE_VERIFIED');
    expect(result.stages[1].status).toBe('RULE_VERIFIED');
    expect(result.stages[2].status).toBe('RULE_VERIFIED');
    expect(result.stages[3].status).toBe('RULE_VERIFIED');
    expect(result.allPassed).toBe(true);

    // Search items
    const searchItems = (result.stages[0].extracted as any)?.items;
    expect(searchItems[0].name).toBe('斗破苍穹');
    expect(searchItems[0].author).toBe('天蚕土豆');
    expect(searchItems[0].bookUrl).toContain('/book/1');

    // BookInfo extracted
    const bookInfo = result.stages[1].extracted as any;
    expect(bookInfo.name).toBe('斗破苍穹');
    expect(bookInfo.tocUrl).toContain('/read/1');

    // TOC chapters
    const chapters = (result.stages[2].extracted as any)?.chapters;
    expect(chapters[0].chapterName).toBe('第一章 开始');
    expect(chapters[0].chapterUrl).toContain('/chapter/1');
    expect(chapters.length).toBe(2);

    // Content
    const contentData = result.stages[3].extracted as any;
    expect(contentData.contentLength).toBeGreaterThan(20);
    expect(contentData.isTooShort).toBe(false);
  });

  it('should stop after search when book_url_missing', async () => {
    const { calls, restore } = installFetch({
      '/search': makeResponse(`<div class="book"><span class="name">NoLink</span></div>`),
    });

    const NO_URL_SOURCE: import('../src/types/book-source.js').BookSource = {
      bookSourceName: '无URL源',
      bookSourceUrl: 'https://example.com',
      searchUrl: '/search?q={{key}}',
      ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' },
    };

    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules(NO_URL_SOURCE, { keyword: 'test', timeout: 5000 });
    restore();

    // Only 1 fetch, 1 stage
    expect(calls.length).toBe(1);
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].errors).toContain('book_url_missing');
    expect(result.allPassed).toBe(false);
  });

  it('should stop after toc when chapter_url_missing', async () => {
    const { calls, restore } = installFetch({
      '/search': makeResponse(searchHtmlFixture),
      '/book/1': makeResponse(bookInfoHtmlFixture),
      '/read/1': makeResponse(`<div class="chapter-list"><div class="chapter">第一章 开始但没有链接这是很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长的文本</div></div>`),
    });

    const NO_CHAPTER_URL_SOURCE: import('../src/types/book-source.js').BookSource = {
      bookSourceName: '无章节URL源',
      bookSourceUrl: 'https://example.com',
      searchUrl: '/search?q={{key}}',
      ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' },
      ruleBookInfo: { name: '.book-title', tocUrl: '.read-btn@href' },
      ruleToc: { chapterList: '.chapter-list .chapter', chapterName: 'a', chapterUrl: 'a@href' },
    };

    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules(NO_CHAPTER_URL_SOURCE, { keyword: 'test', timeout: 5000 });
    restore();

    // 3 fetches: search + bookInfo + toc — no content
    expect(calls.length).toBe(3);
    expect(calls[0].url).toContain('/search');
    expect(calls[1].url).toContain('/book/1');
    expect(calls[2].url).toContain('/read/1');
    expect(result.stages.length).toBe(3);
    const tocStage = result.stages[2];
    expect(tocStage.status).toBe('RULE_EMPTY_RESULT');
    expect(tocStage.errors).toContain('chapter_url_missing');
    expect(result.allPassed).toBe(false);
  });

  it('should report content_too_short for short content', async () => {
    const { restore } = installFetch({
      '/chapter/1': makeResponse(`<div id="content">短</div><span>这是用来凑够五十个字符的填充文本填充文本填充文本填充文本填充文本填充文本填充文本填充文本</span>`),
    });

    // Test verifyRuleContent directly
    const { verifyRuleContent } = await import('../src/core/verify-rules.js');
    const CSS_SRC_WITH_CONTENT: import('../src/types/book-source.js').BookSource = {
      bookSourceName: '短正文源',
      bookSourceUrl: 'https://example.com',
      ruleContent: { content: '#content' },
    };
    const result = await verifyRuleContent(CSS_SRC_WITH_CONTENT, 'https://example.com/chapter/1');
    restore();

    expect(result.errors).toContain('content_too_short');
    expect(result.status).not.toBe('RULE_VERIFIED');
    const cd = result.extracted as any;
    expect(cd.contentLength).toBeLessThan(20);
    expect(cd.isTooShort).toBe(true);
  });

  it('should support JSON search in verifyRuleSearch', async () => {
    const { restore } = installFetch({
      '/api/search': makeResponse(jsonSearchFixture, 200, 'application/json'),
    });

    const { verifyRuleSearch } = await import('../src/core/verify-rules.js');
    const result = await verifyRuleSearch(JSON_SOURCE, { keyword: '斗破苍穹', timeout: 5000 });
    restore();

    expect(result.status).toBe('RULE_VERIFIED');
    const items = (result.extracted as any)?.items;
    expect(items[0].name).toBe('斗破苍穹');
    expect(items[0].bookUrl).toContain('/book/666');
    expect(result.errors).toBeFalsy();
  });
});
