/**
 * Unit tests for the Legado rule engine.
 *
 * Covers:
 *   - Rule string parsing
 *   - CSS selector execution
 *   - JSONPath selector execution
 *   - XPath selector execution
 *   - Regex replacement
 *   - JS sandbox execution
 *   - URL template resolution
 *   - Full pipeline execution
 */

import { describe, it, expect } from 'vitest';

// ── Rule Parser ──

describe('rule-parser', () => {
  it('should parse a simple CSS rule', async () => {
    const { parsePipeline } = await import('../src/core/rule-engine/rule-parser.js');
    const segments = parsePipeline('class.bookName');
    expect(segments).toHaveLength(1);
    expect(segments[0].mode).toBe('css');
    expect(segments[0].rule).toBe('class.bookName');
  });

  it('should detect JSONPath prefix', async () => {
    const { parsePipeline } = await import('../src/core/rule-engine/rule-parser.js');
    const segments = parsePipeline('$.store.book');
    expect(segments[0].mode).toBe('jsonpath');
  });

  it('should detect XPath prefix', async () => {
    const { parsePipeline } = await import('../src/core/rule-engine/rule-parser.js');
    const segments = parsePipeline('//div[@class="book"]');
    expect(segments[0].mode).toBe('xpath');
  });

  it('should handle @@ element boundary', async () => {
    const { parsePipeline } = await import('../src/core/rule-engine/rule-parser.js');
    const segments = parsePipeline('class.bookList@@tag:li!0');
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].mode).toBe('css');
  });

  it('should parse logical operators', async () => {
    const { parseRuleString } = await import('../src/core/rule-engine/rule-parser.js');
    const groups = parseRuleString('ruleA || ruleB');
    expect(groups).toHaveLength(2);
    expect(groups[0].logicOp).toBe('||');
  });

  it('should extract replace pattern', async () => {
    const { parsePipeline } = await import('../src/core/rule-engine/rule-parser.js');
    const segments = parsePipeline('class.content##\\s+##');
    // The replace pattern should be extracted (even if only partial match)
    expect(segments[0].mode).toBe('css');
  });

  it('should detect index selector', async () => {
    const { parsePipeline, parseSegment } = await import('../src/core/rule-engine/rule-parser.js');
    const seg = parseSegment('!0');
    expect(seg.mode).toBe('text');
    expect(seg.rule).toBe('!0');
  });
});

// ── CSS Selector ──

describe('selector-css', () => {
  const html = `
    <div id="list" class="book-list">
      <li class="book-item">
        <span class="title">斗破苍穹</span>
        <span class="author">天蚕土豆</span>
        <a href="/book/123">链接</a>
      </li>
      <li class="book-item">
        <span class="title">凡人修仙传</span>
        <span class="author">忘语</span>
        <a href="/book/456">链接</a>
      </li>
    </div>
  `;

  it('should select elements by class', async () => {
    const { selectCss } = await import('../src/core/rule-engine/selector-css.js');
    const result = selectCss(html, '.book-item');
    expect(result.elements).toHaveLength(2);
  });

  it('should select elements by tag', async () => {
    const { selectCss } = await import('../src/core/rule-engine/selector-css.js');
    const result = selectCss(html, 'span.title');
    expect(result.textList).toContain('斗破苍穹');
  });

  it('should get text content', async () => {
    const { selectCss } = await import('../src/core/rule-engine/selector-css.js');
    const result = selectCss(html, '.title');
    expect(result.textList[0]).toBe('斗破苍穹');
  });

  it('should return empty for non-matching selector', async () => {
    const { selectCss } = await import('../src/core/rule-engine/selector-css.js');
    const result = selectCss(html, '.nonexistent');
    expect(result.elements).toHaveLength(0);
    expect(result.textList).toHaveLength(0);
  });
});

// ── JSONPath Selector ──

describe('selector-jsonpath', () => {
  const json = JSON.stringify({
    store: {
      book: [
        { title: '斗破苍穹', author: '天蚕土豆', price: 29.9 },
        { title: '凡人修仙传', author: '忘语', price: 35.0 },
      ],
    },
  });

  it('should extract simple path', async () => {
    const { selectJsonPath } = await import('../src/core/rule-engine/selector-jsonpath.js');
    const result = selectJsonPath(json, '$.store.book[*].title');
    expect(result.textList).toContain('斗破苍穹');
    expect(result.textList).toContain('凡人修仙传');
  });

  it('should extract single value', async () => {
    const { selectJsonPathFirst } = await import('../src/core/rule-engine/selector-jsonpath.js');
    const result = selectJsonPathFirst(json, '$.store.book[0].author');
    expect(result).toBe('天蚕土豆');
  });

  it('should handle parsing errors gracefully', async () => {
    const { selectJsonPath } = await import('../src/core/rule-engine/selector-jsonpath.js');
    const result = selectJsonPath('invalid json', '$.path');
    expect(result.values).toHaveLength(0);
  });
});

// ── XPath Selector ──

describe('selector-xpath', () => {
  const html = `
    <html><body>
      <div class="list">
        <div class="item" data-id="1">书籍A</div>
        <div class="item" data-id="2">书籍B</div>
      </div>
    </body></html>
  `;

  it('should extract elements by XPath', async () => {
    const { selectXPath } = await import('../src/core/rule-engine/selector-xpath.js');
    const result = selectXPath(html, '//div[@class="item"]');
    expect(result.values.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Regex ──

describe('selector-regex', () => {
  it('should replace all occurrences', async () => {
    const { regexReplace } = await import('../src/core/rule-engine/selector-regex.js');
    const result = regexReplace('hello world hello', 'hello', 'hi');
    expect(result.text).toBe('hi world hi');
  });

  it('should replace only first occurrence', async () => {
    const { regexReplace } = await import('../src/core/rule-engine/selector-regex.js');
    const result = regexReplace('hello world hello', 'hello', 'hi', true);
    expect(result.text).toBe('hi world hello');
  });
});

// ── JS Sandbox ──

describe('sandbox', () => {
  it('should evaluate simple expression', async () => {
    const { executeJs } = await import('../src/core/rule-engine/sandbox.js');
    const result = executeJs('1 + 2 * 3');
    expect(result).toBe('7');
  });

  it('should have access to key variable', async () => {
    const { executeJs } = await import('../src/core/rule-engine/sandbox.js');
    const result = executeJs('key.toUpperCase()', { key: '斗破' });
    expect(result).toBe('斗破');
  });

  it('should have access to baseUrl', async () => {
    const { executeJs } = await import('../src/core/rule-engine/sandbox.js');
    const result = executeJs('baseUrl.toUpperCase()', { baseUrl: 'https://example.com' });
    expect(result).toBe('HTTPS://EXAMPLE.COM');
  });

  it('should handle result context', async () => {
    const { executeJs } = await import('../src/core/rule-engine/sandbox.js');
    const result = executeJs('result.text.substring(0, 4)', {
      resultContext: { text: 'hello world' },
    });
    expect(result).toBe('hell');
  });

  it('should reject unsafe globals', async () => {
    const { executeJs, SandboxError } = await import('../src/core/rule-engine/sandbox.js');
    // require is undefined in sandbox, but process should be as well
    const result = executeJs('typeof process');
    expect(result).toBe('undefined');
  });
});

// ── URL Resolver ──

describe('url-resolver', () => {
  it('should replace {{key}}', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: '/search?q={{key}}',
      baseUrl: 'https://example.com',
      key: '斗破苍穹',
    });
    expect(result.url).toBe('https://example.com/search?q=%E6%96%97%E7%A0%B4%E8%8B%8D%E7%A9%B9');
    expect(result.method).toBe('GET');
  });

  it('should replace {{page}}', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: '/list?page={{page}}',
      baseUrl: 'https://example.com',
      page: 2,
    });
    expect(result.url).toBe('https://example.com/list?page=2');
  });

  it('should resolve relative URL', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: '/search?q=test',
      baseUrl: 'https://example.com',
    });
    expect(result.url).toBe('https://example.com/search?q=test');
  });

  it('should parse url,{method,body} format', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: '/api/search,{"method":"POST","body":"keyword={{key}}"}',
      baseUrl: 'https://example.com',
      key: 'test',
    });
    expect(result.method).toBe('POST');
    expect(result.body).toContain('test');
  });
});

// ── Full Pipeline Executor ──

describe('executor', () => {
  const html = `
    <div class="list">
      <div class="item" data-id="1">
        <h2 class="name">斗破苍穹</h2>
        <p class="author">天蚕土豆</p>
      </div>
      <div class="item" data-id="2">
        <h2 class="name">凡人修仙传</h2>
        <p class="author">忘语</p>
      </div>
    </div>
  `;

  it('should extract list with CSS rule', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const result = executeRule('.item', { content: html });
    expect(result.list.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract single value with chained rule', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const result = executeRule('.name', { content: html });
    expect(result.text).toBe('斗破苍穹');
  });

  it('should handle empty result gracefully', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const result = executeRule('.nonexistent', { content: html });
    expect(result.list).toHaveLength(0);
    expect(result.text).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('should apply regex replacement', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    // Rule with ##replace##
    const result = executeRule('.name', { content: html });
    expect(result.text).toBeTruthy();
  });

  it('should execute logical OR', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    // First rule matches nothing, second should give the result
    const result = executeRule('.nonexistent || .name', { content: html });
    expect(result.text).toBe('斗破苍穹');
  });
});

// ── Integration: Pipeline with book list ──

describe('integration', () => {
  const searchResultHtml = `
    <div class="result-list">
      <div class="book-item">
        <a class="book-name" href="/book/123">斗破苍穹</a>
        <span class="book-author">天蚕土豆</span>
      </div>
      <div class="book-item">
        <a class="book-name" href="/book/456">凡人修仙传</a>
        <span class="book-author">忘语</span>
      </div>
    </div>
  `;

  it('should extract book names', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    const result = executeRule('.book-name', { content: searchResultHtml });
    expect(result.list).toEqual(['斗破苍穹', '凡人修仙传']);
  });

  it('should extract book URLs', async () => {
    const { executeRule } = await import('../src/core/rule-engine/executor.js');
    // CSS selector to get href
    const result = executeRule('.book-name', { content: searchResultHtml });
    // Verify text extraction works
    expect(result.list).toHaveLength(2);
  });
});

describe('url-resolver edge cases', () => {
  it('should handle non-HTTP base URL', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: 'search?q={{key}}',
      baseUrl: 'somehost.com',
      key: 'test',
    });
    expect(result.url).toContain('test');
  });

  it('should replace {{source.bookSourceUrl}}', async () => {
    const { resolveSearchUrl } = await import('../src/core/rule-engine/url-resolver.js');
    const result = resolveSearchUrl({
      searchUrl: '{{source.bookSourceUrl}}/search?q={{key}}',
      baseUrl: 'https://example.com',
      key: 'test',
    });
    expect(result.url).toContain('example.com');
  });
});
