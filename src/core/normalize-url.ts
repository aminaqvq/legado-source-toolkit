import { DOMAIN_PREFIXES } from '../constants/keywords.js';
import type { UrlStatus } from '../types/book-source.js';

export interface NormalizedUrl {
  url: string | null;
  host: string | null;
  normalizedHost: string | null;
  urlStatus: UrlStatus;
  urlWarnings: string[];
  cleanedCandidate: string | null;
}

/**
 * Step 1: Clean decorations from a raw URL string.
 * Strips trailing annotations, comments, CJK punctuation, etc.
 * Does NOT add schemes to arbitrary text.
 */
export function cleanUrlDecorations(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || rawUrl.trim() === '') return null;

  let result = rawUrl.trim();

  // Strip trailing CJK annotations like "已校验", "备用", "推荐"
  result = result.replace(/[\u4e00-\u9fff]+$/, '').trim();
  if (!result) return rawUrl.trim(); // if everything was CJK, keep original

  // Strip trailing #annotations (both CJK and digit)
  result = result.replace(/#[^\s]*$/, '').trim();

  // Strip trailing @maintainer annotations
  result = result.replace(/@[^\s]*$/, '').trim();

  // Strip trailing CJK punctuation
  result = result.replace(/[,，。；;！!？?、]+$/, '').trim();

  // Strip trailing regular punctuation that doesn't belong in URLs
  result = result.replace(/[;；]+$/, '').trim();

  if (!result) return rawUrl.trim();

  return result;
}

/**
 * Looks like a domain name (e.g. "novel.html5.qq.com", "www.example.com/path").
 * Has dots, no spaces, starts with letters/digits.
 */
export function looksLikeDomain(text: string): boolean {
  return /^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(\/.*)?$/.test(text) ||
         /^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(text);
}

/**
 * Step 2: Parse and normalize a (cleaned) URL string.
 */
export function normalizeUrl(rawUrl: string | null | undefined): NormalizedUrl {
  const empty = {
    url: null, host: null, normalizedHost: null,
    urlStatus: 'INVALID_URL' as UrlStatus, urlWarnings: [] as string[],
    cleanedCandidate: null as string | null,
  };

  if (!rawUrl || rawUrl.trim() === '') return empty;

  const cleaned = cleanUrlDecorations(rawUrl);
  if (!cleaned) return empty;

  const warnings: string[] = [];

  // Already a valid HTTP URL
  if (/^https?:\/\/.+/i.test(cleaned)) {
    try {
      const parsed = new URL(cleaned);
      const host = parsed.hostname.toLowerCase();
      const normalizedHost = normalizeHost(host);
      const url = cleaned.replace(/\/+$/, '');
      return { url, host, normalizedHost, urlStatus: 'VALID_HTTP', urlWarnings: warnings, cleanedCandidate: cleaned };
    } catch {
      warnings.push('Failed to parse valid-looking HTTP URL');
      return { ...empty, urlStatus: 'INVALID_URL', urlWarnings: warnings, cleanedCandidate: cleaned };
    }
  }

  // Missing scheme — check if it looks like a domain
  if (looksLikeDomain(cleaned)) {
    try {
      const withScheme = `https://${cleaned}`;
      const parsed = new URL(withScheme);
      const host = parsed.hostname.toLowerCase();
      const normalizedHost = normalizeHost(host);
      return { url: withScheme.replace(/\/+$/, ''), host, normalizedHost, urlStatus: 'NON_HTTP_LOOKS_LIKE_DOMAIN', urlWarnings: warnings, cleanedCandidate: cleaned };
    } catch {
      warnings.push('Looks like domain but failed to parse with https:// prefix');
      return { ...empty, urlStatus: 'NON_HTTP_LOOKS_LIKE_DOMAIN', urlWarnings: warnings, cleanedCandidate: cleaned };
    }
  }

  // Is it a non-HTTP identifier? (custom source id, Chinese name, etc.)
  if (/[\u4e00-\u9fff\p{Extended_Pictographic}]/u.test(cleaned)) {
    // Chinese text or emoji — this is a custom identifier, NOT a URL
    return {
      url: cleaned,
      host: cleaned.toLowerCase().replace(/\s+/g, '_'),
      normalizedHost: cleaned.toLowerCase().replace(/\s+/g, '_'),
      urlStatus: 'NON_HTTP_SOURCE',
      urlWarnings: warnings,
      cleanedCandidate: cleaned,
    };
  }

  // Any other non-HTTP string
  return {
    url: cleaned,
    host: cleaned.toLowerCase().replace(/\s+/g, '_'),
    normalizedHost: cleaned.toLowerCase().replace(/\s+/g, '_'),
    urlStatus: 'NON_HTTP_SOURCE',
    urlWarnings: warnings,
    cleanedCandidate: cleaned,
  };
}

/**
 * Normalize a hostname by removing common prefixes.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;

  let normalized = host.toLowerCase().trim();

  // Remove port
  const portIdx = normalized.indexOf(':');
  if (portIdx !== -1) {
    normalized = normalized.substring(0, portIdx);
  }

  // Strip common prefixes
  for (const prefix of DOMAIN_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
      break;
    }
  }

  return normalized;
}

/**
 * Check if a URL is a valid HTTP/HTTPS URL.
 */
export function isHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\/.+/i.test(url.trim());
}

/**
 * Extract the host key used for host-level deduplication.
 */
export function getHostKey(rawUrl: string | null | undefined): string | null {
  const normalized = normalizeUrl(rawUrl);
  return normalized.normalizedHost;
}

/**
 * Extract the normalized URL key used for url-level deduplication.
 */
export function getUrlKey(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const cleaned = cleanUrlDecorations(rawUrl);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) {
    if (looksLikeDomain(cleaned)) return `https://${cleaned}`.replace(/\/+$/, '');
    return cleaned.toLowerCase().trim();
  }
  return cleaned.replace(/\/+$/, '');
}
