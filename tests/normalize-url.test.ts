import { describe, it, expect } from 'vitest';
import { normalizeUrl, normalizeHost, isHttpUrl, getHostKey, getUrlKey } from '../src/core/normalize-url.js';

describe('normalizeUrl', () => {
  it('should parse a standard HTTPS URL', () => {
    const r = normalizeUrl('https://www.example.com/page');
    expect(r.url).toBe('https://www.example.com/page');
    expect(r.host).toBe('www.example.com');
    expect(r.normalizedHost).toBe('example.com');
  });

  it('should keep http as-is (no forced upgrade)', () => {
    const r = normalizeUrl('http://www.example.com/');
    expect(r.url).toBe('http://www.example.com');
    expect(r.normalizedHost).toBe('example.com');
  });

  it('should strip trailing slash', () => {
    const r = normalizeUrl('https://example.com/');
    expect(r.url).toBe('https://example.com');
  });

  it('should handle URL without protocol', () => {
    const r = normalizeUrl('www.example.com');
    expect(r.url).toBe('https://www.example.com');
    expect(r.normalizedHost).toBe('example.com');
  });

  it('should return null for null input', () => {
    const r = normalizeUrl(null);
    expect(r.url).toBeNull();
    expect(r.host).toBeNull();
    expect(r.normalizedHost).toBeNull();
  });

  it('should return null for empty string', () => {
    const r = normalizeUrl('');
    expect(r.url).toBeNull();
  });

  it('should treat unparseable string as NON_HTTP_SOURCE', () => {
    const r = normalizeUrl('not a url at all !!!');
    expect(r.url).toBe('not a url at all');
    expect(r.urlStatus).toBe('NON_HTTP_SOURCE');
  });
});

describe('normalizeHost', () => {
  it('should strip www prefix', () => {
    expect(normalizeHost('www.example.com')).toBe('example.com');
  });

  it('should strip m prefix', () => {
    expect(normalizeHost('m.example.com')).toBe('example.com');
  });

  it('should strip wap prefix', () => {
    expect(normalizeHost('wap.example.com')).toBe('example.com');
  });

  it('should strip mobile prefix', () => {
    expect(normalizeHost('mobile.example.com')).toBe('example.com');
  });

  it('should strip read prefix', () => {
    expect(normalizeHost('read.example.com')).toBe('example.com');
  });

  it('should strip api prefix', () => {
    expect(normalizeHost('api.example.com')).toBe('example.com');
  });

  it('should only strip the first matching prefix', () => {
    // Only the first prefix in the list should be removed
    expect(normalizeHost('www.m.example.com')).toBe('m.example.com');
  });

  it('should lowercase the host', () => {
    expect(normalizeHost('Example.COM')).toBe('example.com');
  });

  it('should strip port numbers', () => {
    expect(normalizeHost('example.com:8080')).toBe('example.com');
  });
});

describe('isHttpUrl', () => {
  it('should return true for HTTPS URL', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
  });

  it('should return true for HTTP URL', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('should return false for non-HTTP string', () => {
    expect(isHttpUrl('custom-identifier')).toBe(false);
  });

  it('should return false for empty', () => {
    expect(isHttpUrl('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isHttpUrl(null)).toBe(false);
  });
});

describe('getHostKey', () => {
  it('should return normalized host for dedupe', () => {
    expect(getHostKey('https://www.example.com/page')).toBe('example.com');
    expect(getHostKey('https://m.example.com/page')).toBe('example.com');
  });
});

describe('getUrlKey', () => {
  it('should return cleaned URL without forced https upgrade', () => {
    expect(getUrlKey('https://example.com/page/')).toBe('https://example.com/page');
    expect(getUrlKey('http://example.com/page/')).toBe('http://example.com/page');
  });
});
