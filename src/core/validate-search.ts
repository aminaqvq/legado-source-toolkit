import type { BookSource, CategoryLabel, SearchStatus } from '../types/book-source.js';
import { COMPLEX_JS_PATTERNS } from '../constants/keywords.js';
import { DEFAULT_SEARCH_KEYWORDS, DEFAULT_TIMEOUT, DEFAULT_USER_AGENT } from '../constants/defaults.js';
import { parseHeaderField } from '../utils/safe-json.js';
import { isHttpUrl, looksLikeDomain } from './normalize-url.js';
import { isSafeURL, filterCustomHeaders } from './validate-online.js';

export interface SearchCheckOptions {
  timeout?: number;
  userAgent?: string;
}

export interface SearchResult {
  status: SearchStatus;
  detail: string;
  responseSize?: number;
}

/**
 * Attempt to verify a book source's search URL.
 * Does NOT execute JavaScript — marks complex JS sources as SKIPPED.
 * Supports {{key}}, {{page}}, {{source.bookSourceUrl}}, relative URLs, and url,{method,...}
 */
export async function checkSearchUrl(
  source: BookSource,
  classification: CategoryLabel,
  options: SearchCheckOptions = {},
): Promise<SearchResult> {
  const rawSearchUrl = source.searchUrl;

  if (!rawSearchUrl || rawSearchUrl.trim() === '') {
    return { status: 'SEARCH_UNVERIFIED', detail: 'No searchUrl defined' };
  }

  // ── Check for complex JavaScript ──
  const jsCheck = checkComplexJs(rawSearchUrl);
  if (jsCheck) return jsCheck;

  // ── Also check source-wide JS patterns ──
  const allJsFields = [source.searchUrl, source.exploreUrl, source.loginUrl, source.loginCheckJs, source.jsLib].filter(Boolean);
  for (const field of allJsFields) {
    if (/\beval\b/i.test(field!) || /java\.ajax/i.test(field!)) {
      return { status: 'SEARCH_SKIPPED_JS', detail: `Complex JS detected in source fields` };
    }
  }

  // ── Parse url,{method,body,headers} format ──
  let urlTemplate = rawSearchUrl.trim();
  let method = 'GET';
  let body: string | undefined;
  
  // Detect url,{...} pattern
  const commaIdx = urlTemplate.indexOf(',{');
  if (commaIdx !== -1) {
    const maybeOptions = urlTemplate.substring(commaIdx + 1);
    urlTemplate = urlTemplate.substring(0, commaIdx);
    try {
      const parsed = JSON.parse(maybeOptions);
      if (parsed.method) method = parsed.method.toUpperCase();
      if (parsed.body) body = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body);
    } catch { /* can't parse, use GET */ }
  }

  // ── Detect complex template expressions ──
  if (/\{\{[^}]*(?:\?|\.length|\.substring|\.slice|\.replace|&&|\|\|)[^}]*\}\}/.test(urlTemplate)) {
    return { status: 'SEARCH_TEMPLATE_COMPLEX', detail: 'Search URL contains complex template expression' };
  }

  // ── Template substitution ──
  const keyword = getSearchKeyword(source, classification);
  urlTemplate = urlTemplate.replace(/\{\{key\}\}/g, encodeURIComponent(keyword));
  urlTemplate = urlTemplate.replace(/\{\{keyword\}\}/g, encodeURIComponent(keyword));
  urlTemplate = urlTemplate.replace(/\{\{page\}\}/g, '1');

  // {{source.bookSourceUrl}}
  if (source.bookSourceUrl && urlTemplate.includes('{{source.bookSourceUrl}}')) {
    urlTemplate = urlTemplate.replace(/\{\{source\.bookSourceUrl\}\}/g, source.bookSourceUrl);
  }

  // ── Resolve relative URLs against bookSourceUrl ──
  let finalUrl = urlTemplate;
  if (!/^https?:\/\//i.test(finalUrl) && source.bookSourceUrl) {
    const baseUrl = source.bookSourceUrl.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(baseUrl)) {
      if (finalUrl.startsWith('/')) {
        finalUrl = new URL(finalUrl, baseUrl).toString();
      } else if (looksLikeDomain(finalUrl.split('/')[0] + '.com')) {
        // Looks like a domain fragment — try https:// prefix
        finalUrl = `https://${finalUrl}`;
      } else {
        // Relative path
        try {
          finalUrl = new URL(finalUrl, baseUrl + '/').toString();
        } catch {
          return { status: 'SEARCH_UNVERIFIED', detail: `Cannot resolve relative URL: ${finalUrl}` };
        }
      }
    }
  }

  // ── Final URL check ──
  if (!finalUrl || !isHttpUrl(finalUrl)) {
    if (source.bookSourceUrl && !/^https?:\/\//i.test(source.bookSourceUrl || '')) {
      return { status: 'SEARCH_SKIPPED_NON_HTTP', detail: 'Non-HTTP source — cannot verify search' };
    }
    return { status: 'SEARCH_UNVERIFIED', detail: `Search URL is not HTTP: ${finalUrl.substring(0, 80)}` };
  }

  // ── Execute HTTP request ──
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/json,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';

  // Filter dangerous headers from source
  try {
    const custom = parseHeaderField(source.header);
    const safe = filterCustomHeaders(custom);
    Object.assign(headers, safe);
  } catch { /* ignore — header already recorded elsewhere */ }

  // SSRF check
  const safety = await isSafeURL(finalUrl, false);
  if (!safety.safe) {
    return { status: 'SEARCH_FAILED', detail: `SSRF blocked: ${safety.error}` };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(finalUrl, {
        method,
        headers,
        body: method === 'POST' ? (body || `searchkey=${encodeURIComponent(keyword)}`) : undefined,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Read max 256KB to avoid memory pressure
    const bodyChunks: Uint8Array[] = [];
    const reader = response.body?.getReader();
    if (reader) {
      let totalRead = 0;
      const MAX_BYTES = 256 * 1024;
      try {
        while (totalRead < MAX_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          bodyChunks.push(value);
          totalRead += value.length;
        }
      } finally { reader.releaseLock(); }
    }
    const respBody = Buffer.concat(bodyChunks).toString('utf-8');

    if (response.ok && respBody.length > 50) {
      // Light parsing: detect error pages
      if (isErrorPage(respBody)) {
        return { status: 'SEARCH_FAILED', detail: 'Response appears to be an error/captcha/login page', responseSize: respBody.length };
      }
      // Try JSON parse
      try {
        JSON.parse(respBody);
        const bookListRule = source.ruleSearch?.bookList;
        if (bookListRule && respBody.length > 200) {
          return { status: 'SEARCH_RULE_LIKELY_OK', detail: `JSON response, size ${respBody.length}`, responseSize: respBody.length };
        }
        return { status: 'SEARCH_PARSE_OK', detail: `JSON response, size ${respBody.length}`, responseSize: respBody.length };
      } catch { /* not JSON, check HTML */ }

      const bookListRule = source.ruleSearch?.bookList;
      if (bookListRule && respBody.length > 200) {
        return { status: 'SEARCH_RULE_LIKELY_OK', detail: `HTTP ${response.status}, size ${respBody.length}`, responseSize: respBody.length };
      }
      return { status: 'SEARCH_HTTP_OK', detail: `HTTP ${response.status}, size ${respBody.length}`, responseSize: respBody.length };
    }

    return { status: 'SEARCH_UNVERIFIED', detail: `HTTP ${response.status}, size ${respBody.length}`, responseSize: respBody.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { status: 'SEARCH_FAILED', detail: `Timeout: ${msg}` };
    }
    return { status: 'SEARCH_FAILED', detail: `Error: ${msg}` };
  }
}

function isErrorPage(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes('cloudflare') || lower.includes('captcha') ||
         lower.includes('403 forbidden') || lower.includes('access denied') ||
         lower.includes('请登录') || lower.includes('登录') && lower.includes('密码') ||
         lower.includes('verification') || lower.includes('blocked');
}

function checkComplexJs(text: string): SearchResult | null {
  for (const pattern of COMPLEX_JS_PATTERNS) {
    if (pattern.test(text)) {
      return { status: 'SEARCH_COMPLEX_JS_SKIPPED', detail: `Contains complex JS pattern: ${pattern}` };
    }
  }
  return null;
}

function getSearchKeyword(source: BookSource, classification: CategoryLabel): string {
  const checkKeyWord = source.ruleSearch?.checkKeyWord;
  if (checkKeyWord && checkKeyWord.trim().length > 0) return checkKeyWord.trim();
  const catKeyword = DEFAULT_SEARCH_KEYWORDS[classification];
  if (catKeyword) return catKeyword;
  return '斗破苍穹';
}
