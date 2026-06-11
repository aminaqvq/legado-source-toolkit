import type { BookSource, ConnectivityStatus } from '../types/book-source.js';
import { isHttpUrl } from './normalize-url.js';
import { parseHeaderField } from '../utils/safe-json.js';
import {
  DEFAULT_TIMEOUT,
  DEFAULT_RETRY,
  DEFAULT_USER_AGENT,
} from '../constants/defaults.js';
import dns from 'node:dns/promises';

export interface OnlineCheckOptions {
  timeout?: number;
  retry?: number;
  userAgent?: string;
  allowPrivateNetwork?: boolean;
}

export interface ConnectivityResult {
  status: ConnectivityStatus;
  detail: string;
  statusCode?: number;
  responseTimeMs?: number;
  headerStatus?: 'none' | 'parsed' | 'invalid';
}

// ── SSRF protection ──

const PRIVATE_RANGES = [
  { start: BigInt('0x7F000000'), end: BigInt('0x7FFFFFFF') },        // 127.0.0.0/8
  { start: BigInt('0x0A000000'), end: BigInt('0x0AFFFFFF') },        // 10.0.0.0/8
  { start: BigInt('0xAC100000'), end: BigInt('0xAC1FFFFF') },        // 172.16.0.0/12
  { start: BigInt('0xC0A80000'), end: BigInt('0xC0A8FFFF') },        // 192.168.0.0/16
  { start: BigInt('0xA9FE0000'), end: BigInt('0xA9FEFFFF') },        // 169.254.0.0/16
];

function ipToBigInt(ip: string): bigint {
  const parts = ip.split('.').map(Number);
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

export function isPrivateIP(ip: string): boolean {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7
  if (!ip.includes(':')) {
    // IPv4
    const num = ipToBigInt(ip);
    return PRIVATE_RANGES.some((r) => num >= r.start && num <= r.end);
  }
  return false;
}

export async function isSafeURL(urlStr: string, allowPrivate: boolean): Promise<{ safe: boolean; error?: string }> {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      return { safe: allowPrivate, error: 'localhost/private hostname blocked' };
    }
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ]);
    const addrs = [...v4.map(a => ({ address: a })), ...v6.map(a => ({ address: a }))];
    for (const addr of addrs) {
      if (isPrivateIP(addr.address)) {
        return { safe: allowPrivate, error: `Private IP ${addr.address} blocked for ${hostname}` };
      }
    }
    return { safe: true };
  } catch {
    return { safe: false, error: 'Invalid URL for connectivity check' };
  }
}

// ── Header whitelist ──

export const DANGEROUS_HEADERS = new Set([
  'host', 'content-length', 'connection', 'proxy-authorization',
  'authorization', 'cookie', 'x-forwarded-for', 'x-forwarded-host',
  'x-real-ip', 'x-auth-token', 'x-api-key',
]);

export function filterCustomHeaders(raw: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!DANGEROUS_HEADERS.has(key.toLowerCase())) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Check HTTP connectivity of a book source URL.
 * Does NOT attempt to bypass Cloudflare, CAPTCHA, or login walls.
 * Includes SSRF protection, header whitelist, and response body limit.
 */
export async function checkConnectivity(
  source: BookSource,
  options: OnlineCheckOptions = {},
): Promise<ConnectivityResult> {
  const url = source.bookSourceUrl;

  // Parse custom headers from source
  let customHeaders: Record<string, string> = {};
  let headerStatus: 'none' | 'parsed' | 'invalid' = 'none';
  if (source.header) {
    try {
      customHeaders = filterCustomHeaders(parseHeaderField(source.header));
      headerStatus = 'parsed';
    } catch {
      headerStatus = 'invalid';
    }
  }

  const hdr = () => headerStatus;

  if (!isHttpUrl(url)) {
    return { status: 'NON_HTTP_SOURCE', detail: `Not an HTTP/HTTPS URL: ${url ?? 'undefined'}`, headerStatus: hdr() };
  }

  // SSRF check
  if (!options.allowPrivateNetwork) {
    const safety = await isSafeURL(url!, false);
    if (!safety.safe) {
      return { status: 'CONNECT_ERROR', detail: `SSRF blocked: ${safety.error}`, headerStatus: hdr() };
    }
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = options.retry ?? DEFAULT_RETRY;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/json,*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...customHeaders,
  };

  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await fetch(url!, { method: 'GET', headers, signal: controller.signal, redirect: 'manual' });
      } finally {
        clearTimeout(timeoutId);
      }

      // Follow redirects manually with SSRF re-check at each hop (max 5 redirects)
      let redirectCount = 0;
      const MAX_REDIRECTS = 5;
      while ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) && redirectCount < MAX_REDIRECTS) {
        const location = response.headers.get('location');
        if (!location) break;
        const redirectUrl = new URL(location, url!).toString();
        if (!options.allowPrivateNetwork) {
          const redirectSafety = await isSafeURL(redirectUrl, false);
          if (!redirectSafety.safe) {
            return { status: 'CONNECT_ERROR', detail: `SSRF blocked on redirect: ${redirectSafety.error}`, headerStatus: hdr() };
          }
        }
        const timeoutId2 = setTimeout(() => controller.abort(), timeout);
        try {
          response = await fetch(redirectUrl, { method: 'GET', headers, signal: controller.signal, redirect: 'manual' });
        } finally {
          clearTimeout(timeoutId2);
        }
        redirectCount++;
      }

      const responseTime = Date.now() - startTime;
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

      // Status classification
      if (response.status >= 200 && response.status < 300) {
        return { status: 'CONNECT_OK', detail: `HTTP ${response.status}`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        return { status: 'CONNECT_OK', detail: `HTTP ${response.status} redirect`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      if (response.status === 401 || response.status === 403) {
        return { status: 'CONNECT_FORBIDDEN', detail: `HTTP ${response.status} — access forbidden/unauthorized`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      if (response.status === 404 || response.status === 410) {
        return { status: 'CONNECT_DEAD', detail: `HTTP ${response.status} — resource not found`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      if (response.status === 429) {
        return { status: 'CONNECT_ERROR', detail: `HTTP 429 — rate limited`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      if (response.status >= 500) {
        return { status: 'CONNECT_ERROR', detail: `HTTP ${response.status} — server error`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
      }
      // 300-399 (not redirect), 402, 405-428, 430-499
      return { status: 'CONNECT_OK', detail: `HTTP ${response.status}`, statusCode: response.status, responseTimeMs: responseTime, headerStatus: hdr() };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);

      if (lastError.includes('abort') || lastError.includes('AbortError') || lastError.includes('timeout')) {
        if (attempt < maxRetries) continue;
        return { status: 'CONNECT_TIMEOUT', detail: `Timeout after ${timeout}ms (${maxRetries + 1} attempt(s))`, headerStatus: hdr() };
      }
      if (lastError.includes('ENOTFOUND') || lastError.includes('DNS') || lastError.includes('getaddrinfo')) {
        return { status: 'CONNECT_ERROR', detail: `DNS resolution failed: ${lastError}`, headerStatus: hdr() };
      }
      if (lastError.includes('ECONNREFUSED') || lastError.includes('ECONNRESET') || lastError.includes('TLS') || lastError.includes('certificate')) {
        return { status: 'CONNECT_ERROR', detail: `Connection error: ${lastError}`, headerStatus: hdr() };
      }
      if (attempt < maxRetries) continue;
      return { status: 'CONNECT_ERROR', detail: `Error: ${lastError}`, headerStatus: hdr() };
    }
  }

  return { status: 'CONNECT_ERROR', detail: `All retries exhausted: ${lastError}`, headerStatus: hdr() };
}
