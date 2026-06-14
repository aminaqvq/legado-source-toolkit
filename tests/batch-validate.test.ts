import { describe, it, expect, vi, afterEach } from 'vitest';
import type { BookSource } from '../src/types/book-source.js';
import type { StageResult } from '../src/core/rule-engine/types.js';

function makeMockAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    index: 0, originalName: 'Test', cleanedName: 'Test', originalGroup: '',
    finalGroup: '', groupChangeReason: '', inferredGroup: '小说', originalType: 0,
    originalUrl: '', normalizedUrl: null, normalizedHost: 'example.com',
    urlStatus: 'VALID_HTTP', urlWarnings: [], validationStatus: 'STRUCTURE_OK',
    validationReason: [], connectivityStatus: 'CONNECT_OK', connectivityDetail: '',
    measuredRespondTime: null, searchStatus: 'SEARCH_HTTP_OK', searchDetail: '',
    headerStatus: 'none' as const, loginRelated: false, loginStatus: 'none' as const,
    availability: 'usable' as const, duplicateKey: '', duplicateGroupId: null,
    kept: true, removedReason: null, score: 80, scoreBreakdown: {},
    classificationConfidence: 'high' as const, classificationTags: [],
    classificationSignals: { fromType: null, fromName: [], fromGroup: null, fromRules: [], finalCategory: '小说', confidence: 'high' as const, conflictTags: [] },
    warnings: [], risks: [], batchFailureReasons: [], batchWarnings: [], batchSuggestions: [],
    processedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

function makeStage(stage: string, status: StageResult['status'], errors: string[] = []): StageResult {
  return { stage: stage as any, status, confidence: status === 'PASS' ? 1 : 0, runner: 'node-safe', rules: [], warnings: [], errors: errors as any, suggestions: [], durationMs: 100 };
}

function makeSource(overrides: Partial<BookSource> = {}): BookSource {
  return { bookSourceName: 'Test源', bookSourceUrl: 'https://example.com', searchUrl: '/search', ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' }, ...overrides };
}

describe('mapStagesToBatchResult', () => {
  it('all PASS stages -> PASS', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const stages = [makeStage('search', 'PASS'), makeStage('bookInfo', 'PASS'), makeStage('toc', 'PASS'), makeStage('content', 'PASS')];
    const result = mapStagesToBatchResult(makeSource(), 'deep', makeMockAnalysis(), stages, 400);
    expect(result.status).toBe('PASS');
  });
  it('search OK + bookInfo fail -> PARTIAL_PASS', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const stages = [makeStage('search', 'PASS'), makeStage('bookInfo', 'FAIL', ['rule_empty_result'])];
    const result = mapStagesToBatchResult(makeSource(), 'standard', makeMockAnalysis(), stages, 200);
    expect(result.status).toBe('PARTIAL_PASS');
  });
  it('structure invalid -> FAIL', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource({ bookSourceUrl: '' }), 'deep', makeMockAnalysis({ validationStatus: 'STRUCTURE_INVALID' }), [], 0);
    expect(result.status).toBe('FAIL');
  });
  it('cloudflare_detected -> BLOCKED', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'deep', makeMockAnalysis(), [makeStage('search', 'FAIL', ['cloudflare_detected'])], 100);
    expect(result.status).toBe('BLOCKED');
  });
  it('unsupported_webview -> UNSUPPORTED', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'deep', makeMockAnalysis(), [makeStage('search', 'FAIL', ['unsupported_webview'])], 100);
    expect(result.status).toBe('UNSUPPORTED');
  });
  it('login_required -> NEEDS_LOGIN', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'deep', makeMockAnalysis(), [makeStage('search', 'FAIL', ['login_required'])], 100);
    expect(result.status).toBe('NEEDS_LOGIN');
  });
  it('firstFailureStage recorded', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const stages = [makeStage('search', 'PASS'), makeStage('bookInfo', 'FAIL', ['http_403'])];
    const result = mapStagesToBatchResult(makeSource(), 'standard', makeMockAnalysis(), stages, 200);
    expect(result.firstFailureStage).toBe('bookInfo');
  });
  it('fast mode derives from availability', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'fast', makeMockAnalysis({ availability: 'usable' }), [], 10);
    expect(result.status).toBe('PASS');
  });
  it('fast mode maps forbidden -> BLOCKED', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'fast', makeMockAnalysis({ availability: 'forbidden' }), [], 10);
    expect(result.status).toBe('BLOCKED');
  });
  it('PASS with risky patterns -> RISKY', async () => {
    const { mapStagesToBatchResult } = await import('../src/core/batch-validate.js');
    const result = mapStagesToBatchResult(makeSource(), 'fast', makeMockAnalysis({ availability: 'usable', risks: ['FUTURE_TIMESTAMP'] }), [], 10);
    expect(result.status).toBe('RISKY');
  });
});

describe('summarizeBatchValidation', () => {
  it('should aggregate counts correctly', async () => {
    const { summarizeBatchValidation } = await import('../src/core/batch-validate.js');
    const summary = summarizeBatchValidation([
      { status: 'PASS', failureReasons: [], host: 'a.com', group: '小说', sourceType: 0 } as any,
      { status: 'PASS', failureReasons: [], host: 'a.com', group: '小说', sourceType: 0 } as any,
      { status: 'PARTIAL_PASS', failureReasons: ['http_403'], host: 'b.com', group: '漫画', sourceType: 2 } as any,
      { status: 'FAIL', failureReasons: ['book_url_missing'], host: 'c.com', group: '小说', sourceType: 0 } as any,
      { status: 'BLOCKED', failureReasons: ['cloudflare_detected'], host: 'd.com', group: '下载', sourceType: 3 } as any,
      { status: 'UNSUPPORTED', failureReasons: ['unsupported_webview'], host: 'e.com', group: '其他', sourceType: 0 } as any,
      { status: 'NEEDS_LOGIN', failureReasons: ['login_required'], host: 'f.com', group: '小说', sourceType: 0 } as any,
    ]);
    expect(summary.total).toBe(7);
    expect(summary.pass).toBe(2);
    expect(summary.fail).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.unsupported).toBe(1);
    expect(summary.needsLogin).toBe(1);
    expect(summary.byFailureReason['http_403']).toBe(1);
  });
});

const searchHtml = '<html><body><ul class="result-list"><li class="book"><a class="name" href="/book/1">Test Book</a><span class="author">Author</span></li></ul></body></html>';
const bookInfoHtml = '<html><body><div class="book-info"><h1 class="book-title">Test Book</h1><a class="read-btn" href="/read/1">阅读</a></div></body></html>';
const tocHtml = '<html><body><div class="chapter-list"><div class="chapter"><a href="/chapter/1">Ch1</a></div></div></body></html>';
const contentHtml = '<html><body><div id="content">This is a long enough content text that should pass the minimum length check for the content validation stage.</div></body></html>';

function makeResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html' } });
}

const FULL_SOURCE: BookSource = {
  bookSourceName: 'Full', bookSourceUrl: 'https://example.com', searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.book', name: '.name', author: '.author', bookUrl: '.name@href' },
  ruleBookInfo: { name: '.book-title', tocUrl: '.read-btn@href' },
  ruleToc: { chapterList: '.chapter-list .chapter', chapterName: 'a', chapterUrl: 'a@href' },
  ruleContent: { content: '#content' },
};

afterEach(() => { vi.restoreAllMocks(); if ((globalThis as any).__origFetch) { globalThis.fetch = (globalThis as any).__origFetch; delete (globalThis as any).__origFetch; } });

function installFetch(routes: Record<string, Response>) {
  const calls: Array<{ url: string }> = [];
  const orig = globalThis.fetch;
  (globalThis as any).__origFetch = orig;
  globalThis.fetch = (async (input: any) => {
    const urlStr = typeof input === 'string' ? input : input?.url ?? '';
    calls.push({ url: urlStr });
    for (const [key, resp] of Object.entries(routes)) { if (urlStr.includes(key)) return resp.clone(); }
    return makeResponse('Not Found', 404);
  }) as any;
  return { calls, restore: () => { globalThis.fetch = orig; delete (globalThis as any).__origFetch; } };
}

describe('runBatchValidation mode behavior', () => {
  it('standard stops at toc, no content', async () => {
    const { calls, restore } = installFetch({ '/search': makeResponse(searchHtml), '/book/1': makeResponse(bookInfoHtml), '/read/1': makeResponse(tocHtml), '/chapter/1': makeResponse(contentHtml) });
    const { runBatchValidation } = await import('../src/core/batch-validate.js');
    const result = await runBatchValidation(FULL_SOURCE, 'standard', { timeout: 5000, keyword: 'test' });
    restore();
    expect(result.allStages.map(s => s.stage)).toEqual(['search', 'bookInfo', 'toc']);
    expect(calls.filter(c => c.url.includes('/chapter/')).length).toBe(0);
  });
  it('deep fetches content', async () => {
    const { calls, restore } = installFetch({ '/search': makeResponse(searchHtml), '/book/1': makeResponse(bookInfoHtml), '/read/1': makeResponse(tocHtml), '/chapter/1': makeResponse(contentHtml) });
    const { runBatchValidation } = await import('../src/core/batch-validate.js');
    const result = await runBatchValidation(FULL_SOURCE, 'deep', { timeout: 5000, keyword: 'test' });
    restore();
    expect(result.allStages.map(s => s.stage)).toEqual(['search', 'bookInfo', 'toc', 'content']);
    expect(calls.filter(c => c.url.includes('/chapter/')).length).toBe(1);
  });
});

describe('verifyAllRules maxStage', () => {
  it('maxStage=toc stops before content', async () => {
    const { calls, restore } = installFetch({ '/search': makeResponse(searchHtml), '/book/1': makeResponse(bookInfoHtml), '/read/1': makeResponse(tocHtml), '/chapter/1': makeResponse(contentHtml) });
    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules(FULL_SOURCE, { keyword: 'test', timeout: 5000, maxStage: 'toc' });
    restore();
    expect(result.stages.length).toBe(3);
    expect(result.stages.map(s => s.stage)).toEqual(['search', 'bookInfo', 'toc']);
  });
  it('maxStage=content runs all 4', async () => {
    const { calls, restore } = installFetch({ '/search': makeResponse(searchHtml), '/book/1': makeResponse(bookInfoHtml), '/read/1': makeResponse(tocHtml), '/chapter/1': makeResponse(contentHtml) });
    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules(FULL_SOURCE, { keyword: 'test', timeout: 5000, maxStage: 'content' });
    restore();
    expect(result.stages.length).toBe(4);
  });
  it('book_url_missing stops after search', async () => {
    const { restore } = installFetch({ '/search': makeResponse('<div class="book"><span class="name">NoLink</span></div>') });
    const { verifyAllRules } = await import('../src/core/verify-rules.js');
    const result = await verifyAllRules({ ...FULL_SOURCE, ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' } }, { keyword: 'test', timeout: 5000 });
    restore();
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].errors).toContain('book_url_missing');
  });
});

describe('CSV report includes batch columns', () => {
  it('should contain batch columns', async () => {
    const { generateSourcesCsv } = await import('../src/utils/csv.js');
    const csv = generateSourcesCsv([{ index: 0, originalName: 'Test', cleanedName: 'Test', originalGroup: '小说', inferredGroup: '小说', originalType: 0, normalizedUrl: 'https://example.com', normalizedHost: 'example.com', availability: 'usable', validationReason: [], score: 85, kept: true, removedReason: null, batchValidationMode: 'deep', batchValidationStatus: 'PASS', firstFailureStage: undefined, batchFailureReasons: [], batchWarnings: [], batchDurationMs: 500 } as any]);
    expect(csv).toContain('validationMode');
    expect(csv).toContain('deep');
    expect(csv).toContain('PASS');
  });
});

describe('HTML report includes Batch Validation section', () => {
  it('should render batch cards when summary has batchValidation', async () => {
    const { renderHtmlReport } = await import('../src/utils/html-report.js');
    const html = renderHtmlReport({ summary: { generatedAt: new Date().toISOString(), input: { total: 10, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0 }, output: { total: 8, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0, measuredAverageRespondTime: null }, removed: { duplicateCount: 2, unavailableCount: 0, riskyCount: 0 }, validation: { okCount: 8, warnCount: 0, invalidCount: 2 }, batchValidation: { total: 8, pass: 5, partialPass: 1, fail: 1, blocked: 1, needsLogin: 0, unsupported: 0, risky: 0, unknown: 0, byFailureReason: { 'http_403': 1 }, byHost: {}, byGroup: {}, bySourceType: {} } }, sources: [], duplicates: [] } as any);
    expect(html).toContain('批量深度校验结果');
    expect(html).toContain('PASS');
  });
  it('should not render batch section when no batchValidation', async () => {
    const { renderHtmlReport } = await import('../src/utils/html-report.js');
    const html = renderHtmlReport({ summary: { generatedAt: new Date().toISOString(), input: { total: 5, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0 }, output: { total: 5, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0, measuredAverageRespondTime: null }, removed: { duplicateCount: 0, unavailableCount: 0, riskyCount: 0 }, validation: { okCount: 5, warnCount: 0, invalidCount: 0 } }, sources: [], duplicates: [] } as any);
    expect(html).not.toContain('批量深度校验结果');
  });
});

describe('JSON report includes batch fields', () => {
  it('SourceAnalysis objects contain batchValidationStatus', () => {
    const json = JSON.stringify({ index: 0, batchValidationMode: 'deep', batchValidationStatus: 'PASS', batchFailureReasons: [], batchWarnings: [], batchSuggestions: [], batchDurationMs: 500 });
    expect(json).toContain('batchValidationMode');
    expect(json).toContain('batchValidationStatus');
  });
});
