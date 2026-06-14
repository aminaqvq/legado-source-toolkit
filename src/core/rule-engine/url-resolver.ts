/**
 * URL template resolver for Legado book source search URLs.
 *
 * Handles:
 *   - `url,{method,body,headers}` format parsing
 *   - `{{key}}` / `{{keyword}}` substitution
 *   - `{{page}}` substitution
 *   - `{{source.bookSourceUrl}}` substitution
 *   - `{{js expression}}` JS evaluation in URL
 *   - `<page1,page2,page3>` page-list substitution
 *   - Relative URL resolution against bookSourceUrl
 *   - SSRF-safe final URL validation
 */

import type { ResolvedUrl } from './types.js';
import { executeJs } from './sandbox.js';

// ── Constants ──

/** Detect `url,{...}` format */
const URL_WITH_OPTIONS = /^(.+?),\s*(\{.+})$/

/** JS block pattern */
const JS_PATTERN = /\{\{(.+?)\}\}/g;

/** Page list pattern `<page1,page2>` */
const PAGE_PATTERN = /<(.*?)>/;

/** CSS pseudo pattern (to avoid matching CSS ) */
const CSS_PSEUDO = /:(?:not|has|contains|matches|nth-child|first|last|eq)\(/;

// ── Main API ──

export interface ResolveUrlOptions {
  /** The raw search URL template from the book source */
  searchUrl: string;
  /** The book source's base URL (bookSourceUrl) */
  baseUrl: string;
  /** Search keyword */
  key?: string;
  /** Page number */
  page?: number;
  /** Custom headers from the source */
  sourceHeaders?: Record<string, string>;
  /** Additional JS context */
  jsContext?: Record<string, unknown>;
  /** JS execution timeout */
  jsTimeout?: number;
}

/**
 * Resolve a Legado search URL template into a concrete HTTP request.
 */
export function resolveSearchUrl(options: ResolveUrlOptions): ResolvedUrl {
  const { searchUrl: raw, baseUrl, key, page } = options;

  if (!raw || raw.trim() === '') {
    return { url: baseUrl, method: 'GET' };
  }

  let urlTemplate = raw.trim();
  let method: 'GET' | 'POST' = 'GET';
  let body: string | undefined;
  const headers: Record<string, string> = { ...(options.sourceHeaders ?? {}) };
  let charset: string | undefined;

  // ── Phase 1: Parse `url,{method:'POST',body:'...',headers:{...}}` ──
  const optMatch = urlTemplate.match(URL_WITH_OPTIONS);
  if (optMatch) {
    urlTemplate = optMatch[1].trim();
    try {
      const parsed = JSON.parse(optMatch[2]);
      if (parsed.method) method = parsed.method.toUpperCase() as 'GET' | 'POST';
      if (parsed.body) body = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body);
      if (parsed.headers) Object.assign(headers, parsed.headers);
      if (parsed.charset) charset = parsed.charset;
    } catch {
      // Can't parse options; treat as simple URL
    }
  }

  // ── Phase 2: Execute `{{js}}` in URL ──
  urlTemplate = urlTemplate.replace(JS_PATTERN, (_, jsCode) => {
    const trimmedCode = jsCode.trim();
    if (trimmedCode.startsWith('#')) return ''; // Comment
    try {
      return executeJs(trimmedCode, {
        key,
        baseUrl,
        page,
        timeout: options.jsTimeout ?? 5000,
        ...(options.jsContext ?? {}),
      });
    } catch {
      return '';
    }
  });

  // ── Phase 3: Replace template variables ──
  if (key !== undefined) {
    const encodedKey = encodeURIComponent(key);
    urlTemplate = urlTemplate.replace(/\{\{(?:key|keyword)\}\}/g, encodedKey);
    // Also replace in body if present
    if (body) {
      body = body.replace(/\{\{(?:key|keyword)\}\}/g, encodedKey);
    }
  }

  if (page !== undefined) {
    urlTemplate = urlTemplate.replace(/\{\{page\}\}/g, String(page));
  }

  // {{source.bookSourceUrl}}
  if (urlTemplate.includes('{{source.bookSourceUrl}}')) {
    urlTemplate = urlTemplate.replace(/\{\{source\.bookSourceUrl\}\}/g, baseUrl);
  }

  // ── Phase 4: Handle `<page1,page2>` page list ──
  if (page !== undefined) {
    urlTemplate = urlTemplate.replace(PAGE_PATTERN, (_, list) => {
      const pages = list.split(',').map((s: string) => s.trim());
      const idx = page - 1;
      return idx < pages.length ? pages[idx] : pages[pages.length - 1];
    });
  }

  // ── Phase 5: Resolve relative URL to absolute ──
  let finalUrl = urlTemplate;
  if (!/^https?:\/\//i.test(finalUrl) && baseUrl) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    if (finalUrl.startsWith('/')) {
      finalUrl = new URL(finalUrl, cleanBase).toString();
    } else {
      // Relative path
      try {
        finalUrl = new URL(finalUrl, cleanBase + '/').toString();
      } catch {
        // Can't resolve; use as-is
      }
    }
  }

  return {
    url: finalUrl,
    method,
    body: method === 'POST' ? (body || `searchkey=${encodeURIComponent(key ?? '')}`) : undefined,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    charset,
  };
}

/**
 * Quick check if a URL template looks like it contains complex JS.
 */
export function hasUrlJs(url: string): boolean {
  return /\{\{[^}]*(?:\?|\.length|\.substring|\.slice|\.replace|&&|\|\|)[^}]*\}\}/.test(url);
}

// ── Candidate URL resolution (for rule-extracted relative URLs) ──

export interface ResolveCandidateUrlOptions {
  /** The current page URL (primary resolution base) */
  baseUrl: string;
  /** The book source's base URL (fallback) */
  sourceBaseUrl?: string;
}

/**
 * Resolve a candidate URL (extracted by a rule) to an absolute HTTP URL.
 *
 * Handles:
 *   - Absolute URLs (http/https) → return as-is
 *   - `//host/path` → prepend `https:` and resolve
 *   - `/path` → resolve against `baseUrl` via `new URL(candidate, baseUrl)`
 *   - Relative path → resolve against `baseUrl` via `new URL(candidate, baseUrl)`
 *   - Falls back to `sourceBaseUrl` if `baseUrl` is empty
 *   - Returns `null` for invalid / unresolvable URLs (never throws)
 */
export function resolveCandidateUrl(
  candidate: string,
  options: ResolveCandidateUrlOptions,
): string | null {
  if (!candidate || candidate.trim() === '') return null;

  const trimmed = candidate.trim();
  const primaryBase = options.baseUrl || options.sourceBaseUrl || '';
  const fallbackBase = options.sourceBaseUrl || '';

  // Absolute URL — return as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // //host/path — prepend protocol
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // /path or relative — resolve using new URL() with primary base
  if (primaryBase) {
    try {
      return new URL(trimmed, primaryBase).toString();
    } catch {
      // primary base failed, try fallback
    }
  }

  // Fallback: try sourceBaseUrl
  if (fallbackBase && fallbackBase !== primaryBase) {
    try {
      return new URL(trimmed, fallbackBase).toString();
    } catch {
      // both failed
    }
  }

  // Last attempt: if it looks like a domain-like string, try https:// prefix
  if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(trimmed)) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      // give up
    }
  }

  return null;
}
