import type { BookSource, CategoryLabel } from '../types/book-source.js';
import type { RuleVerifyDetail, VerifyAllResult, SearchItem, ChapterItem, BookInfoResult, ContentResult, NetworkTrace, RuleTrace, FailureReason } from './rule-engine/types.js';
import { executeRule, executeRuleOnScope, detectItemKind } from './rule-engine/executor.js';
import { resolveSearchUrl, resolveCandidateUrl } from './rule-engine/url-resolver.js';
import { isSafeURL, filterCustomHeaders } from './validate-online.js';
import { parseHeaderField } from '../utils/safe-json.js';
import { DEFAULT_TIMEOUT, DEFAULT_USER_AGENT, DEFAULT_SEARCH_KEYWORDS } from '../constants/defaults.js';

interface SafeFetchResult {
  ok: boolean; status: number; body: string; url: string; finalUrl: string;
  contentType?: string; duration: number;
  failureReason?: 'ssrf_blocked' | 'timeout' | 'dns_failed' | 'connection_error' | 'network_error';
  error?: string;
}

interface SafeFetchOptions {
  timeout?: number; allowPrivateNetwork?: boolean; method?: string; body?: string; extraHeaders?: Record<string, string>;
}

async function safeFetch(url: string, source: BookSource, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const method = (options.method ?? 'GET').toUpperCase();
  const MAX_REDIRECTS = 5;
  if (!options.allowPrivateNetwork) {
    const safety = await isSafeURL(url, false);
    if (!safety.safe) return { ok: false, status: 0, body: '', url, finalUrl: url, duration: 0, failureReason: 'ssrf_blocked', error: safety.error };
  }
  const headers: Record<string, string> = { 'User-Agent': DEFAULT_USER_AGENT, 'Accept': 'text/html,application/json,*/*', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' };
  if (source.header) { try { const custom = parseHeaderField(source.header); Object.assign(headers, filterCustomHeaders(custom)); } catch { /* ignore */ } }
  if (options.extraHeaders) Object.assign(headers, filterCustomHeaders(options.extraHeaders));
  const startTime = Date.now();
  let currentUrl = url;
  let redirectCount = 0;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);
    let response: Response;
    try { response = await fetch(currentUrl, { method, headers, body: method === 'POST' ? (options.body || undefined) : undefined, signal: controller.signal, redirect: 'manual' }); } finally { clearTimeout(tid); }
    while ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) && redirectCount < MAX_REDIRECTS) {
      const location = response.headers.get('location');
      if (!location) break;
      const redirectUrl = new URL(location, currentUrl).toString();
      if (!options.allowPrivateNetwork) {
        const redirectSafety = await isSafeURL(redirectUrl, false);
        if (!redirectSafety.safe) return { ok: false, status: 0, body: '', url, finalUrl: redirectUrl, duration: Date.now() - startTime, failureReason: 'ssrf_blocked', error: 'SSRF blocked on redirect: ' + redirectSafety.error };
      }
      currentUrl = redirectUrl;
      redirectCount++;
      const redirectMethod = (response.status === 307 || response.status === 308) ? method : 'GET';
      const redirectBody = (response.status === 307 || response.status === 308) ? options.body : undefined;
      const tid2 = setTimeout(() => controller.abort(), timeout);
      try { response = await fetch(currentUrl, { method: redirectMethod, headers, body: redirectMethod === 'POST' ? (redirectBody || undefined) : undefined, signal: controller.signal, redirect: 'manual' }); } finally { clearTimeout(tid2); }
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    if (reader) {
      let total = 0;
      const MAX = 256 * 1024;
      try { while (total < MAX) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); total += value.length; } } finally { reader.releaseLock(); }
    }
    const body = Buffer.concat(chunks).toString('utf-8');
    const duration = Date.now() - startTime;
    return { ok: response.ok, status: response.status, body, url, finalUrl: currentUrl, contentType: response.headers.get('content-type') ?? undefined, duration };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let failureReason: SafeFetchResult['failureReason'] = 'network_error';
    if (msg.includes('abort') || msg.includes('AbortError') || msg.includes('timeout')) failureReason = 'timeout';
    else if (msg.includes('ENOTFOUND') || msg.includes('DNS') || msg.includes('getaddrinfo')) failureReason = 'dns_failed';
    else if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || msg.includes('TLS') || msg.includes('certificate')) failureReason = 'connection_error';
    return { ok: false, status: 0, body: '', url, finalUrl: currentUrl, duration: Date.now() - startTime, failureReason, error: msg };
  }
}

function isErrorBody(body: string): boolean {
  const lower = body.toLowerCase();
  return lower.includes('cloudflare') || lower.includes('captcha') || lower.includes('403 forbidden') || lower.includes('access denied') || (lower.includes('请登录') && lower.includes('密码')) || lower.includes('verification') || lower.includes('blocked') || body.length < 50;
}

function resolveKeyword(source: BookSource, classification?: CategoryLabel): string {
  const ckw = source.ruleSearch?.checkKeyWord;
  if (ckw?.trim()) return ckw.trim();
  if (classification && DEFAULT_SEARCH_KEYWORDS[classification]) return DEFAULT_SEARCH_KEYWORDS[classification];
  return '斗破苍穹';
}

function makeResult(stage: string, status: string, startTime: number, logs: string[], error?: string, url?: string, responseSize?: number, resultCount?: number, resultSample?: string, rules: RuleTrace[] = [], errors: FailureReason[] = [], suggestions: string[] = [], request?: NetworkTrace, extracted?: any): RuleVerifyDetail {
  return { stage: stage as any, status: status as any, url, responseSize, resultCount, resultSample, duration: Date.now() - startTime, logs, rules, errors: errors.length > 0 ? errors : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined, request, extracted } as any;
}

function buildNetworkTrace(initialUrl: string, method: string, fetchResult: SafeFetchResult): NetworkTrace {
  return { url: initialUrl, method, status: fetchResult.status, finalUrl: fetchResult.finalUrl, contentType: fetchResult.contentType, responseSize: fetchResult.body.length, bodyPreview: fetchResult.body.slice(0, 500), durationMs: fetchResult.duration, error: fetchResult.error };
}

function isCloudflareOrCaptcha(body: string): boolean {
  const lower = body.toLowerCase();
  return lower.includes('cloudflare') || lower.includes('captcha') || lower.includes('verification') || lower.includes('blocked') || lower.includes('access denied');
}

function mapFetchFailure(fetchResult: SafeFetchResult, errors: FailureReason[]): void {
  if (fetchResult.ok && !isErrorBody(fetchResult.body)) return;
  if (fetchResult.status === 403) errors.push('http_403');
  else if (isCloudflareOrCaptcha(fetchResult.body)) errors.push('cloudflare_detected');
  else if (fetchResult.failureReason === 'ssrf_blocked') errors.push('ssrf_blocked');
  else if (fetchResult.failureReason === 'timeout') errors.push('http_timeout');
  else if (fetchResult.failureReason === 'dns_failed' || fetchResult.failureReason === 'connection_error' || fetchResult.failureReason === 'network_error') errors.push('network_error');
  else errors.push('empty_response');
}

export async function verifyRuleSearch(source: BookSource, options: { keyword?: string; classification?: CategoryLabel; timeout?: number; allowPrivateNetwork?: boolean } = {}): Promise<RuleVerifyDetail> {
  const logs: string[] = [];
  const startTime = Date.now();
  const keyword = options.keyword ?? resolveKeyword(source, options.classification);
  const rules: RuleTrace[] = [];
  const errors: FailureReason[] = [];
  const suggestions: string[] = [];
  logs.push('keyword="' + keyword + '"');
  if (!source.searchUrl?.trim()) return makeResult('search', 'RULE_NOT_CHECKED', startTime, logs, undefined, undefined, undefined, undefined, undefined, rules, errors, suggestions);
  if (/\beval\b/i.test(source.searchUrl) || /java\.ajax/i.test(source.searchUrl)) {
    errors.push('unsupported_java_ajax');
    suggestions.push('当前安全模式不执行 java.ajax，请改用兼容模式或人工复核');
    return makeResult('search', 'RULE_SKIPPED', startTime, logs, undefined, undefined, undefined, undefined, undefined, rules, errors, suggestions);
  }
  if (/webView/i.test(source.searchUrl)) { errors.push('unsupported_webview'); suggestions.push('当前 Node Safe Runner 不支持 webView:true，后续应使用 Browser Runner'); }
  const bookListRule = source.ruleSearch?.bookList;
  if (!bookListRule) return makeResult('search', 'RULE_NOT_CHECKED', startTime, logs, 'No ruleSearch.bookList defined');
  try {
    const resolved = resolveSearchUrl({ searchUrl: source.searchUrl, baseUrl: source.bookSourceUrl ?? '', key: keyword, page: 1 });
    logs.push('resolved URL: ' + resolved.url);
    const fetchResult = await safeFetch(resolved.url, source, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork, method: resolved.method, body: resolved.body, extraHeaders: resolved.headers });
    logs.push('HTTP ' + fetchResult.status + ', ' + fetchResult.body.length + ' bytes');
    const netTrace = buildNetworkTrace(resolved.url, resolved.method, fetchResult);
    if (!fetchResult.ok || isErrorBody(fetchResult.body)) {
      mapFetchFailure(fetchResult, errors);
      return makeResult('search', 'RULE_EMPTY_RESULT', startTime, logs, 'HTTP ' + fetchResult.status + ' — response appears invalid', resolved.url, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const listResult = executeRule(bookListRule, { content: fetchResult.body, debug: true });
    rules.push({ ruleName: 'bookList', rule: bookListRule, inputKind: 'document', outputPreview: listResult.list.slice(0, 3).join('|'), outputCount: listResult.list.length, status: listResult.list.length > 0 ? 'PASS' : 'FAIL', durationMs: listResult.duration });
    if (listResult.list.length === 0) {
      errors.push('rule_empty_result');
      suggestions.push('检查 bookList 规则是否正确匹配搜索结果列表');
      return makeResult('search', 'RULE_EMPTY_RESULT', startTime, logs, 'bookList rule returned 0 results', resolved.url, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const pageUrl = fetchResult.finalUrl || resolved.url;
    const searchItems = extractSearchItems(source, fetchResult.body, listResult, pageUrl, logs, rules, errors, suggestions);
    const hasBookUrl = searchItems.some(i => i.bookUrl);
    const sample = searchItems.length > 0 ? searchItems[0].name ?? '?' + ' by ' + searchItems[0].author ?? '?' : listResult.text?.slice(0, 200) ?? '';
    return { status: searchItems.length > 0 && hasBookUrl ? 'RULE_VERIFIED' : 'RULE_EMPTY_RESULT', stage: 'search', url: resolved.url, responseSize: fetchResult.body.length, resultCount: searchItems.length, resultSample: sample, duration: Date.now() - startTime, logs, extracted: { items: searchItems }, request: netTrace, rules, errors: errors.length > 0 ? errors : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined } as any;
  } catch (err) {
    errors.push('network_error');
    return makeResult('search', 'RULE_PARSE_ERROR', startTime, logs, 'Error: ' + (err instanceof Error ? err.message : String(err)), undefined, undefined, undefined, undefined, rules, errors, suggestions);
  }
}

export async function verifyRuleBookInfo(source: BookSource, bookUrl: string, options: { timeout?: number; allowPrivateNetwork?: boolean } = {}): Promise<RuleVerifyDetail> {
  const logs: string[] = [];
  const startTime = Date.now();
  const rules: RuleTrace[] = [];
  const errors: FailureReason[] = [];
  const suggestions: string[] = [];
  if (!bookUrl) return makeResult('bookInfo', 'RULE_NOT_CHECKED', startTime, logs, 'No bookUrl provided');
  const nameRule = source.ruleBookInfo?.name;
  if (!nameRule) return makeResult('bookInfo', 'RULE_NOT_CHECKED', startTime, logs, 'No ruleBookInfo.name');
  try {
    const fetchResult = await safeFetch(bookUrl, source, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
    logs.push('HTTP ' + fetchResult.status + ', ' + fetchResult.body.length + ' bytes');
    const netTrace = buildNetworkTrace(bookUrl, 'GET', fetchResult);
    if (!fetchResult.ok || isErrorBody(fetchResult.body)) {
      mapFetchFailure(fetchResult, errors);
      return makeResult('bookInfo', 'RULE_EMPTY_RESULT', startTime, logs, 'HTTP ' + fetchResult.status + ' — response appears invalid', bookUrl, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const nameResult = executeRule(nameRule, { content: fetchResult.body });
    rules.push({ ruleName: 'name', rule: nameRule, inputKind: 'document', outputPreview: (nameResult.text ?? '').slice(0, 40), status: nameResult.text ? 'PASS' : 'FAIL', durationMs: nameResult.duration });
    const bookInfo = extractBookInfo(source, fetchResult.body, bookUrl, logs, rules, errors, suggestions);
    const sample = bookInfo.name ?? '';
    if (!bookInfo.name) { errors.push('rule_empty_result'); suggestions.push('检查 ruleBookInfo.name 是否正确匹配书名'); }
    if (!bookInfo.tocUrl) { suggestions.push('检查 ruleBookInfo.tocUrl 是否正确匹配目录页 URL'); }
    return { status: bookInfo.name ? 'RULE_VERIFIED' : 'RULE_EMPTY_RESULT', stage: 'bookInfo', url: bookUrl, responseSize: fetchResult.body.length, resultSample: sample, duration: Date.now() - startTime, logs, extracted: bookInfo, request: netTrace, rules, errors: errors.length > 0 ? errors : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined } as any;
  } catch (err) {
    errors.push('network_error');
    return makeResult('bookInfo', 'RULE_PARSE_ERROR', startTime, logs, 'Error: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export async function verifyRuleToc(source: BookSource, tocUrl: string, options: { timeout?: number; allowPrivateNetwork?: boolean } = {}): Promise<RuleVerifyDetail> {
  const logs: string[] = [];
  const startTime = Date.now();
  const rules: RuleTrace[] = [];
  const errors: FailureReason[] = [];
  const suggestions: string[] = [];
  if (!tocUrl) return makeResult('toc', 'RULE_NOT_CHECKED', startTime, logs, 'No tocUrl provided');
  const chapterListRule = source.ruleToc?.chapterList;
  if (!chapterListRule) return makeResult('toc', 'RULE_NOT_CHECKED', startTime, logs, 'No ruleToc.chapterList');
  try {
    const fetchResult = await safeFetch(tocUrl, source, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
    logs.push('HTTP ' + fetchResult.status + ', ' + fetchResult.body.length + ' bytes');
    const netTrace = buildNetworkTrace(tocUrl, 'GET', fetchResult);
    if (!fetchResult.ok || isErrorBody(fetchResult.body)) {
      mapFetchFailure(fetchResult, errors);
      return makeResult('toc', 'RULE_EMPTY_RESULT', startTime, logs, 'HTTP ' + fetchResult.status + ' — response appears invalid', tocUrl, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const listResult = executeRule(chapterListRule, { content: fetchResult.body });
    rules.push({ ruleName: 'chapterList', rule: chapterListRule, inputKind: 'document', outputPreview: listResult.list.slice(0, 3).join('|'), outputCount: listResult.list.length, status: listResult.list.length > 0 ? 'PASS' : 'FAIL', durationMs: listResult.duration });
    if (listResult.list.length === 0) {
      errors.push('rule_empty_result');
      suggestions.push('检查 ruleToc.chapterList 规则');
      return makeResult('toc', 'RULE_EMPTY_RESULT', startTime, logs, 'chapterList returned 0 results', tocUrl, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const chapters = extractChapterItems(source, fetchResult.body, listResult, tocUrl, logs, rules, errors, suggestions);
    const hasChapterUrl = chapters.some(c => c.chapterUrl);
    const sample = chapters.length > 0 ? (chapters[0].chapterName ?? '?') : '';
    return { status: chapters.length > 0 && hasChapterUrl ? 'RULE_VERIFIED' : 'RULE_EMPTY_RESULT', stage: 'toc', url: tocUrl, responseSize: fetchResult.body.length, resultCount: chapters.length, resultSample: sample, duration: Date.now() - startTime, logs, extracted: { chapters }, request: netTrace, rules, errors: errors.length > 0 ? errors : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined } as any;
  } catch (err) {
    errors.push('network_error');
    return makeResult('toc', 'RULE_PARSE_ERROR', startTime, logs, 'Error: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export async function verifyRuleContent(source: BookSource, chapterUrl: string, options: { timeout?: number; allowPrivateNetwork?: boolean } = {}): Promise<RuleVerifyDetail> {
  const logs: string[] = [];
  const startTime = Date.now();
  const rules: RuleTrace[] = [];
  const errors: FailureReason[] = [];
  const suggestions: string[] = [];
  if (!chapterUrl) return makeResult('content', 'RULE_NOT_CHECKED', startTime, logs, 'No chapterUrl provided');
  const contentRule = source.ruleContent?.content;
  if (!contentRule) return makeResult('content', 'RULE_NOT_CHECKED', startTime, logs, 'No ruleContent.content');
  try {
    const fetchResult = await safeFetch(chapterUrl, source, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
    logs.push('HTTP ' + fetchResult.status + ', ' + fetchResult.body.length + ' bytes');
    const netTrace = buildNetworkTrace(chapterUrl, 'GET', fetchResult);
    if (!fetchResult.ok || isErrorBody(fetchResult.body)) {
      mapFetchFailure(fetchResult, errors);
      return makeResult('content', 'RULE_EMPTY_RESULT', startTime, logs, 'HTTP ' + fetchResult.status + ' — response appears invalid', chapterUrl, fetchResult.body.length, 0, undefined, rules, errors, suggestions, netTrace);
    }
    const contentResult = executeRule(contentRule, { content: fetchResult.body });
    rules.push({ ruleName: 'content', rule: contentRule, inputKind: 'document', outputPreview: (contentResult.text ?? '').slice(0, 80), outputCount: 1, status: contentResult.text && contentResult.text.length >= 20 ? 'PASS' : 'FAIL', durationMs: contentResult.duration });
    const text = contentResult.text ?? '';
    if (text.length < 20) { errors.push('empty_response'); suggestions.push('检查 ruleContent.content 规则是否正确匹配正文'); }
    return { status: text.length >= 20 ? 'RULE_VERIFIED' : 'RULE_EMPTY_RESULT', stage: 'content', url: chapterUrl, responseSize: fetchResult.body.length, resultSample: text.slice(0, 80), duration: Date.now() - startTime, logs, request: netTrace, rules, errors: errors.length > 0 ? errors : undefined, suggestions: suggestions.length > 0 ? suggestions : undefined } as any;
  } catch (err) {
    errors.push('network_error');
    return makeResult('content', 'RULE_PARSE_ERROR', startTime, logs, 'Error: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export async function verifyAllRules(source: BookSource, options: { keyword?: string; timeout?: number; allowPrivateNetwork?: boolean; maxStage?: 'toc' | 'content' } = {}): Promise<VerifyAllResult> {
  const startTime = Date.now();
  const steps: RuleVerifyDetail[] = [];
  const keyword = options.keyword ?? resolveKeyword(source);
  // 1. search
  const searchResult = await verifyRuleSearch(source, { keyword, timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
  steps.push(searchResult);
  if (searchResult.status !== 'RULE_VERIFIED') {
    return { stages: steps, allPassed: false, totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': search failed (' + searchResult.status + ')' };
  }
  if (options.maxStage === 'toc') {
    const summarySteps = steps;
    const bookUrl = pickFirstValidBookUrl(searchResult.extracted?.items);
    if (bookUrl) {
      const bookInfoResult = await verifyRuleBookInfo(source, bookUrl, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
      summarySteps.push(bookInfoResult);
      if (bookInfoResult.status === 'RULE_VERIFIED' && bookInfoResult.extracted?.tocUrl) {
        const tocResult = await verifyRuleToc(source, bookInfoResult.extracted.tocUrl, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
        summarySteps.push(tocResult);
      }
    }
    const verified = summarySteps.filter(s => s.status === 'RULE_VERIFIED').length;
    return { stages: summarySteps, allPassed: summarySteps.every(s => s.status === 'RULE_VERIFIED'), totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': ' + verified + '/' + summarySteps.length + ' stages passed' };
  }
  const bookUrl = pickFirstValidBookUrl(searchResult.extracted?.items);
  if (!bookUrl) return { stages: steps, allPassed: false, totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': no valid bookUrl found in search results' };
  // 2. bookInfo
  const bookInfoResult = await verifyRuleBookInfo(source, bookUrl, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
  steps.push(bookInfoResult);
  if (bookInfoResult.status !== 'RULE_VERIFIED') {
    return { stages: steps, allPassed: false, totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': bookInfo failed (' + bookInfoResult.status + ')' };
  }
  const tocUrl = bookInfoResult.extracted?.tocUrl;
  if (!tocUrl) return { stages: steps, allPassed: false, totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': no tocUrl found in bookInfo' };
  // 3. toc
  const tocResult = await verifyRuleToc(source, tocUrl, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
  steps.push(tocResult);
  if (options.maxStage === 'content' && tocResult.status === 'RULE_VERIFIED') {
    const chapterUrl = pickFirstValidChapterUrl(tocResult.extracted?.chapters);
    if (chapterUrl) {
      const contentResult = await verifyRuleContent(source, chapterUrl, { timeout: options.timeout, allowPrivateNetwork: options.allowPrivateNetwork });
      steps.push(contentResult);
    }
  }
  const verified = steps.filter(s => s.status === 'RULE_VERIFIED').length;
  return { stages: steps, allPassed: steps.every(s => s.status === 'RULE_VERIFIED'), totalDuration: Date.now() - startTime, summary: source.bookSourceName + ': ' + verified + '/' + steps.length + ' stages passed' };
}

function pickFirstValidBookUrl(items?: SearchItem[]): string | null {
  if (!items) return null;
  for (const item of items) { if (item.bookUrl && item.bookUrl.trim()) return item.bookUrl.trim(); }
  return null;
}

function pickFirstValidChapterUrl(chapters?: ChapterItem[]): string | null {
  if (!chapters) return null;
  for (const ch of chapters) { if (ch.chapterUrl && ch.chapterUrl.trim()) return ch.chapterUrl.trim(); }
  return null;
}

function extractSearchItems(source: BookSource, searchBody: string, listResult: { list: string[]; elements: unknown[]; duration: number }, pageUrl: string, logs: string[], rules: RuleTrace[], errors: FailureReason[], suggestions: string[]): SearchItem[] {
  const nameRule = source.ruleSearch?.name;
  const authorRule = source.ruleSearch?.author;
  const bookUrlRule = source.ruleSearch?.bookUrl;
  const items: SearchItem[] = [];
  const elements = listResult.elements;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const kind = detectItemKind(el);
    const item: SearchItem = { confidence: 0 };
    let okCount = 0, totalCount = 0;
    if (nameRule) { totalCount++; const nameResult = executeRuleOnScope(nameRule, { raw: el, kind }, { content: searchBody }); if (nameResult.text) { item.name = nameResult.text; okCount++; } if (nameResult.error) item.error = nameResult.error; }
    if (authorRule) { totalCount++; const authorResult = executeRuleOnScope(authorRule, { raw: el, kind }, { content: searchBody }); if (authorResult.text) { item.author = authorResult.text; okCount++; } }
    if (bookUrlRule) {
      totalCount++;
      const urlResult = executeRuleOnScope(bookUrlRule, { raw: el, kind }, { content: searchBody, baseUrl: pageUrl });
      if (urlResult.text) { const resolved = resolveCandidateUrl(urlResult.text, { baseUrl: pageUrl, sourceBaseUrl: source.bookSourceUrl ?? '' }); if (resolved) { item.bookUrl = resolved; okCount++; } }
      else if (urlResult.error === 'unsupported_rule_syntax') { errors.push('unsupported_rule_syntax'); suggestions.push('bookUrl rule "' + bookUrlRule + '" 语法暂不支持'); }
    }
    item.confidence = totalCount > 0 ? okCount / totalCount : 0;
    item.rawPreview = listResult.list[i]?.slice(0, 80) ?? '';
    items.push(item);
  }
  if (nameRule && items.length > 0) rules.push({ ruleName: 'name (scope)', rule: nameRule, inputKind: 'scope', outputPreview: items[0].name?.slice(0, 40) ?? '', outputCount: items.filter(i => i.name).length, status: items.some(i => i.name) ? 'PASS' : 'FAIL', durationMs: 0 });
  if (bookUrlRule && items.length > 0) rules.push({ ruleName: 'bookUrl (scope)', rule: bookUrlRule, inputKind: 'scope', outputPreview: items[0].bookUrl?.slice(0, 40) ?? '', outputCount: items.filter(i => i.bookUrl).length, status: items.some(i => i.bookUrl) ? 'PASS' : 'FAIL', durationMs: 0 });
  if (items.length > 0 && !items.some(i => i.bookUrl)) { errors.push('book_url_missing'); suggestions.push('检查 ruleSearch.bookUrl 是否需要在 bookList item 内执行；检查是否需要 @href'); }
  return items;
}

function extractBookInfo(source: BookSource, body: string, pageUrl: string, logs: string[], rules: RuleTrace[], errors: FailureReason[], suggestions: string[]): BookInfoResult {
  const result: BookInfoResult = {};
  const nameRule = source.ruleBookInfo?.name;
  if (nameRule) { const nameRes = executeRule(nameRule, { content: body }); result.name = nameRes.text ?? undefined; rules.push({ ruleName: 'name', rule: nameRule, inputKind: 'document', outputPreview: (nameRes.text ?? '').slice(0, 40), status: nameRes.text ? 'PASS' : 'FAIL', durationMs: nameRes.duration }); }
  const authorRule = source.ruleBookInfo?.author;
  if (authorRule) { const authorRes = executeRule(authorRule, { content: body }); result.author = authorRes.text ?? undefined; }
  const introRule = source.ruleBookInfo?.intro;
  if (introRule) { const introRes = executeRule(introRule, { content: body }); result.intro = introRes.text?.slice(0, 200) ?? undefined; }
  const coverRule = source.ruleBookInfo?.coverUrl;
  if (coverRule) {
    const pipeline = resolveScopedPipelineForExtract(coverRule);
    let coverText: string | null = null;
    if (pipeline.selectorRule) { const coverRes = executeRule(pipeline.selectorRule, { content: body }); if (coverRes.text && pipeline.getter && coverRes.elements.length > 0) coverText = getElementAttributeForExtract(coverRes.elements[0], pipeline.getter); else coverText = coverRes.text; }
    if (coverText) { const resolved = resolveCandidateUrl(coverText, { baseUrl: pageUrl, sourceBaseUrl: source.bookSourceUrl ?? '' }); result.coverUrl = resolved ?? coverText; }
  }
  const tocUrlRule = source.ruleBookInfo?.tocUrl;
  if (tocUrlRule) {
    const pipeline = resolveScopedPipelineForExtract(tocUrlRule);
    let tocText: string | null = null;
    if (pipeline.selectorRule) { const tocRes = executeRule(pipeline.selectorRule, { content: body }); if (tocRes.text && pipeline.getter) { if (tocRes.elements.length > 0) tocText = getElementAttributeForExtract(tocRes.elements[0], pipeline.getter); } else tocText = tocRes.text; } else if (pipeline.getter) { tocText = null; }
    if (tocText) { const resolved = resolveCandidateUrl(tocText, { baseUrl: pageUrl, sourceBaseUrl: source.bookSourceUrl ?? '' }); result.tocUrl = resolved ?? tocText; }
  }
  return result;
}

function resolveScopedPipelineForExtract(ruleStr: string): { selectorRule: string | null; getter: string | null } {
  const trimmed = ruleStr.trim();
  if (/^@(text|html|outerhtml|href|src|val)$/i.test(trimmed)) return { selectorRule: null, getter: trimmed.slice(1).toLowerCase() };
  for (let i = trimmed.length - 1; i >= 1; i--) {
    if (trimmed[i] === '@' && trimmed[i - 1] !== '@') {
      const suffix = trimmed.slice(i).toLowerCase();
      if (['@text', '@href', '@src', '@html', '@outerhtml', '@val'].includes(suffix)) {
        const selectorPart = trimmed.slice(0, i).trim();
        return selectorPart.length > 0 ? { selectorRule: selectorPart, getter: suffix.slice(1) } : { selectorRule: null, getter: suffix.slice(1) };
      }
      break;
    }
  }
  return { selectorRule: trimmed, getter: null };
}

function getElementAttributeForExtract(element: unknown, getter: string): string | null {
  const el = element as any;
  if (!el || typeof el !== 'object') return null;
  const g = getter.toLowerCase().replace(/^@/, '');
  switch (g) {
    case 'text': return getElementTextForExtract(el);
    case 'html': case 'outerhtml': return serializeElementForExtract(el);
    case 'href': return el?.attribs?.href ?? null;
    case 'src': return el?.attribs?.src ?? null;
    case 'val': return el?.attribs?.value ?? null;
    default: return getElementTextForExtract(el);
  }
}

function getElementTextForExtract(el: any): string | null {
  if (!el) return null;
  if (el.type === 'text' || el.type === 'script' || el.type === 'comment') return el.data ?? null;
  if (el.type === 'tag') {
    if (el.children && Array.isArray(el.children)) return el.children.map((c: any) => getElementTextForExtract(c)).join('') || null;
    return el.attribs?.title || el.attribs?.alt || null;
  }
  return String(el);
}

function serializeElementForExtract(el: any): string {
  if (!el) return '';
  if (typeof el === 'string') return el;
  if (el.type === 'text') return el.data ?? '';
  if (el.type === 'tag') {
    const name = el.name || el.tagName || 'div';
    let html = '<' + name;
    if (el.attribs) { for (const [k, v] of Object.entries(el.attribs)) { html += ' ' + k + '="' + v + '"'; } }
    html += '>';
    if (el.children) { for (const child of el.children) { html += serializeElementForExtract(child); } }
    html += '</' + name + '>';
    return html;
  }
  return String(el);
}

function extractChapterItems(source: BookSource, tocBody: string, listResult: { list: string[]; elements: unknown[]; duration: number }, resolvedTocUrl: string, logs: string[], rules: RuleTrace[], errors: FailureReason[], suggestions: string[]): ChapterItem[] {
  const chapterNameRule = source.ruleToc?.chapterName;
  const chapterUrlRule = source.ruleToc?.chapterUrl;
  const chapters: ChapterItem[] = [];
  const elements = listResult.elements;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const kind = detectItemKind(el);
    const ch: ChapterItem = {};
    if (chapterNameRule) { const nameResult = executeRuleOnScope(chapterNameRule, { raw: el, kind }, { content: tocBody }); if (nameResult.text) ch.chapterName = nameResult.text; }
    if (chapterUrlRule) {
      const urlResult = executeRuleOnScope(chapterUrlRule, { raw: el, kind }, { content: tocBody, baseUrl: resolvedTocUrl });
      if (urlResult.text) { const resolved = resolveCandidateUrl(urlResult.text, { baseUrl: resolvedTocUrl, sourceBaseUrl: source.bookSourceUrl ?? '' }); ch.chapterUrl = resolved ?? urlResult.text; }
      else if (urlResult.error === 'unsupported_rule_syntax') { errors.push('unsupported_rule_syntax'); suggestions.push('chapterUrl rule "' + chapterUrlRule + '" 语法暂不支持'); }
    }
    ch.rawPreview = listResult.list[i]?.slice(0, 80) ?? '';
    chapters.push(ch);
  }
  if (chapterNameRule && chapters.length > 0) rules.push({ ruleName: 'chapterName (scope)', rule: chapterNameRule, inputKind: 'scope', outputPreview: chapters[0].chapterName?.slice(0, 40) ?? '', outputCount: chapters.filter(c => c.chapterName).length, status: chapters.some(c => c.chapterName) ? 'PASS' : 'FAIL', durationMs: 0 });
  if (chapterUrlRule && chapters.length > 0) rules.push({ ruleName: 'chapterUrl (scope)', rule: chapterUrlRule, inputKind: 'scope', outputPreview: chapters[0].chapterUrl?.slice(0, 40) ?? '', outputCount: chapters.filter(c => c.chapterUrl).length, status: chapters.some(c => c.chapterUrl) ? 'PASS' : 'FAIL', durationMs: 0 });
  if (chapters.length > 0 && !chapters.some(c => c.chapterUrl)) { errors.push('chapter_url_missing'); suggestions.push('检查 ruleToc.chapterUrl；如果章节链接由 JS 生成，可能需要 Browser Runner'); }
  return chapters;
}
