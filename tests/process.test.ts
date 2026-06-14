import { describe, it, expect } from 'vitest';
import { readBookSources } from '../src/core/parse.js';
import { cleanBookSourceName } from '../src/core/clean-name.js';
import { classifySource } from '../src/core/classify.js';
import { validateStructure } from '../src/core/validate-structure.js';
import { normalizeUrl } from '../src/core/normalize-url.js';
import { calculateScore } from '../src/core/score.js';
import { dedupeSources } from '../src/core/dedupe.js';
import { splitByCategory } from '../src/core/split.js';
import { checkConnectivity } from '../src/core/validate-online.js';
import { checkSearchUrl } from '../src/core/validate-search.js';
import type { BookSource } from '../src/types/book-source.js';
import { readJsonFile, writeJsonFile } from '../src/utils/fs.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixtures', 'sample-sources.json');

describe('End-to-end process', () => {
  it('should read sample sources without error', () => {
    const { sources, analyses } = readBookSources(fixturePath);
    expect(sources.length).toBeGreaterThanOrEqual(14);
    expect(analyses.length).toBe(sources.length);
  });
  it('should preserve an unknown field on each source', () => {
    const raw = readJsonFile<BookSource[]>(fixturePath);
    (raw[0] as Record<string, unknown>).__custom_test_field = 'hello123';
    const tmpPath = path.join(__dirname, 'fixtures', '_tmp_test.json');
    writeJsonFile(tmpPath, raw);
    const { sources } = readBookSources(tmpPath);
    expect((sources[0] as Record<string, unknown>).__custom_test_field).toBe('hello123');
    fs.removeSync(tmpPath);
  });
});

describe('Full pipeline without online checks', () => {
  it('should process all sources through the pipeline', () => {
    const { sources, analyses } = readBookSources(fixturePath);
    for (let i = 0; i < analyses.length; i++) {
      const r = cleanBookSourceName(sources[i].bookSourceName ?? '', { mode: 'zh-only', keepLatinWhenNeeded: false });
      analyses[i].cleanedName = r.cleaned;
      analyses[i].warnings.push(...r.warnings);
    }
    expect(analyses[0].cleanedName).toBe('米国度');
    for (let i = 0; i < analyses.length; i++) {
      const norm = normalizeUrl(sources[i].bookSourceUrl);
      analyses[i].normalizedUrl = norm.url;
      analyses[i].normalizedHost = norm.normalizedHost;
    }
    expect(analyses[0].normalizedHost).toBe('miguodu.com');
    for (let i = 0; i < analyses.length; i++) {
      const cls = classifySource(sources[i], analyses[i]);
      analyses[i].inferredGroup = cls.category;
      analyses[i].classificationConfidence = cls.confidence;
    }
    expect(analyses[0].inferredGroup).toBe('小说');
    for (let i = 0; i < analyses.length; i++) {
      const struct = validateStructure(sources[i]);
      analyses[i].validationStatus = struct.status;
      analyses[i].validationReason = struct.reasons;
    }
    expect(analyses.filter((a) => a.validationStatus === 'STRUCTURE_OK').length).toBeGreaterThan(0);
    for (let i = 0; i < analyses.length; i++) {
      if (analyses[i].validationStatus === 'STRUCTURE_INVALID') analyses[i].availability = 'invalid';
      else if (analyses[i].validationStatus === 'STRUCTURE_WARN') analyses[i].availability = 'probably_usable';
      else analyses[i].availability = 'unknown';
      const scoreResult = calculateScore(sources[i], analyses[i]);
      analyses[i].score = scoreResult.score;
      analyses[i].scoreBreakdown = scoreResult.breakdown;
    }
    expect(analyses[8].scoreBreakdown['name_contains_dead']).toBe(-40);
    expect(analyses[0].score).toBeGreaterThan(0);
    const dedupeResult = dedupeSources(sources, analyses, { level: 'host' });
    const keptAnalyses = analyses.filter((a) => a.kept);
    const finalSources = keptAnalyses.map((a) => { const s = { ...sources[a.index] }; (s as Record<string,unknown>)['finalCategory'] = a.inferredGroup; (s as Record<string,unknown>)['originalIndex'] = a.index; return s; });
    const groups = splitByCategory(finalSources);
    expect(Object.keys(groups).length).toBeGreaterThan(0);
  });
});

describe('processSources batch validation scope', () => {
  it('should only batch-validate kept + VALID_HTTP + not STRUCTURE_INVALID sources', async () => {
    const searchHtml = '<html><body><ul class="result-list"><li class="book"><a class="name" href="/book/1">Test</a></li></ul></body></html>';
    const bookInfoHtml = '<html><body><h1 class="book-title">Test</h1><a class="read-btn" href="/toc">TOC</a></body></html>';
    const tocHtml = '<html><body><div class="chapter-list"><div class="chapter"><a href="/ch/1">Ch1</a></div></div></body></html>';
    const contentHtml = '<html><body><div id="content">This is a long enough content text for the validation to pass the minimum length check.</div></body></html>';
    function makeResponse(body: string): Response { return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } }); }
    const fetchCalls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any) => {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      fetchCalls.push(url);
      if (url.includes('/search')) return makeResponse(searchHtml);
      if (url.includes('/book/1')) return makeResponse(bookInfoHtml);
      if (url.includes('/toc')) return makeResponse(tocHtml);
      if (url.includes('/ch/1')) return makeResponse(contentHtml);
      return makeResponse('Not Found');
    }) as any;
    const validSource: BookSource = { bookSourceName: 'ValidSource', bookSourceUrl: 'https://example.com', bookSourceType: 0, enabled: true, searchUrl: '/search?q={{key}}', ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' }, ruleBookInfo: { name: '.book-title', tocUrl: '.read-btn@href' }, ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' }, ruleContent: { content: '#content' } };
    const disabledSource: BookSource = { bookSourceName: 'DisabledSource', bookSourceUrl: 'https://disabled.example.com', bookSourceType: 0, enabled: false, searchUrl: '/search?q={{key}}', ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' }, ruleBookInfo: { name: '.book-title', tocUrl: '.read-btn@href' }, ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' }, ruleContent: { content: '#content' } };
    const nonHttpSource: BookSource = { bookSourceName: 'NonHttpSource', bookSourceUrl: 'ftp://files.example.com', bookSourceType: 0, enabled: true, ruleSearch: { bookList: '.book', name: '.name', bookUrl: '.name@href' }, ruleBookInfo: { name: '.book-title' }, ruleToc: { chapterList: '.chapter', chapterName: 'a', chapterUrl: 'a@href' }, ruleContent: { content: '#content' } };
    const tmpPath = path.join(__dirname, 'fixtures', '_batch_scope_test.json');
    writeJsonFile(tmpPath, [validSource, disabledSource, nonHttpSource]);
    try {
      const { processSources } = await import('../src/core/process.js');
      const report = await processSources({ inputPath: tmpPath, outDir: path.join(__dirname, 'fixtures', '_batch_scope_out'), online: false, dedupeLevel: 'none', groupMode: 'preserve', nameMode: 'loose', concurrency: 1, timeout: 5000, retry: 0, dryRun: true, writeMeta: false, outputFormat: 'pretty', keepDisabled: false, onlyEnabled: false, includeNonHttp: false, includeUnknown: true, includeComplex: true, includeUnavailable: true, keepLatinWhenNeeded: false, allowRiskyDedupe: false, writeNormalizedUrl: false, strict: false, validateMode: 'deep', batchConcurrency: 1 });
      const validAnalysis = report.sources.find((a) => a.originalName === 'ValidSource');
      expect(validAnalysis!.batchValidationStatus).toBeDefined();
      const disabledAnalysis = report.sources.find((a) => a.originalName === 'DisabledSource');
      if (disabledAnalysis) expect(disabledAnalysis.batchValidationStatus).toBeUndefined();
      const nonHttpAnalysis = report.sources.find((a) => a.originalName === 'NonHttpSource');
      expect(nonHttpAnalysis!.batchValidationStatus).toBeUndefined();
      expect(report.summary.batchValidation).toBeDefined();
      expect(report.summary.batchValidation!.total).toBe(1);
      expect(fetchCalls.filter((c) => c.includes('ftp://')).length).toBe(0);
      expect(fetchCalls.filter((c) => c.includes('disabled.example.com')).length).toBe(0);
    } finally {
      globalThis.fetch = origFetch;
      fs.removeSync(tmpPath);
      fs.removeSync(path.join(__dirname, 'fixtures', '_batch_scope_out'));
    }
  });
});
