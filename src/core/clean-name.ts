import type { NameMode } from '../types/book-source.js';
import type { CleanNameStep } from '../types/analysis.js';
import {
  EMOJI_CHARS,
  EMOJI_REGEX,
  FANCY_SYMBOLS,
  MAINTAINER_PATTERNS,
  TRAILING_HASH_CJK,
  TRAILING_HASH_DIGIT,
} from '../constants/keywords.js';

export interface CleanOptions {
  mode: NameMode;
  keepLatinWhenNeeded: boolean;
  /** Fallback hostname if name becomes empty after cleaning */
  fallbackHost?: string;
  /** Fallback URL if host is also unavailable */
  fallbackUrl?: string;
  /** Source index for generating a numbered fallback */
  sourceIndex?: number;
}

interface CleanResult {
  cleaned: string;
  warnings: string[];
  steps: CleanNameStep[];
}

/**
 * Clean a book source name by removing emoji, quality markers,
 * maintainer suffixes, and bracket-wrapped annotations.
 *
 * IMPORTANT: Must NOT destroy brand names, abbreviations, English, or digits.
 * QQ浏览器 stays QQ浏览器, UC小说 stays UC小说, SF轻小说 stays SF轻小说.
 */
export function cleanBookSourceName(
  name: string,
  options: CleanOptions,
): CleanResult {
  const warnings: string[] = [];
  const steps: CleanNameStep[] = [];
  const record = (reason: string, before: string, after: string) => {
    if (before !== after) steps.push({ reason, from: before, to: after });
  };

  if (!name || !name.trim()) {
    return { cleaned: '', warnings: ['EMPTY_NAME'], steps };
  }

  let cleaned = name.trim();
  const original = cleaned;

  // Step 1: Strip emoji (Extended_Pictographic + variation selectors + ZWJ)
  cleaned = stripEmoji(cleaned);
  record('removedEmoji', original, cleaned);

  // Step 2: Strip bracket-wrapped quality/status annotations
  // (优++), 【推荐】, [修复], 「失效」etc
  const beforeBracket = cleaned;
  cleaned = cleanBracketAnnotations(cleaned);
  record('removedQualityBrackets', beforeBracket, cleaned);

  // Step 3: Strip maintainer suffixes (@遇知, by Someone, ｜作者)
  const beforeMaint = cleaned;
  cleaned = cleanMaintainerSuffix(cleaned);
  record('removedMaintainerSuffix', beforeMaint, cleaned);

  // Step 4: Strip trailing #注释 (CJK comments) — but NOT #digits
  const beforeHashCjk = cleaned;
  cleaned = cleaned.replace(TRAILING_HASH_CJK, ' ').trim();
  record('removedHashComment', beforeHashCjk, cleaned);

  // Step 5: Strip trailing #digits (version markers like 笔趣阁#21)
  const beforeHashDig = cleaned;
  cleaned = cleaned.replace(TRAILING_HASH_DIGIT, ' ').trim();
  record('removedVersionMarker', beforeHashDig, cleaned);

  // Step 6: Strip annotation brackets like (生肉), (熟肉), (连载中)
  const beforeAnnot = cleaned;
  cleaned = cleanAnnotationBrackets(cleaned);
  record('removedAnnotationBrackets', beforeAnnot, cleaned);

  // Step 7: Strip quality markers that appear as standalone labels
  // (优++, 已校验, etc.) but only at word boundaries
  const beforeQual = cleaned;
  cleaned = cleanQualityLabels(cleaned);
  record('removedQualityLabels', beforeQual, cleaned);

  // Step 8: Strip fancy symbols 【】『』「」 etc.
  const beforeFancy = cleaned;
  cleaned = cleanFancySymbols(cleaned);
  record('removedFancySymbols', beforeFancy, cleaned);

  // Step 9: Collapse whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Step 10: Mode-specific filtering (loose is default and keeps everything; zh-only is destructive legacy)
  if (options.mode === 'zh-only') {
    cleaned = filterZhOnly(cleaned, options.keepLatinWhenNeeded);
  }

  // Step 11: Final trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Step 12: Fallback chain
  if (!cleaned || cleaned.length === 0) {
    const fallback1 = name
      .replace(EMOJI_REGEX, '')
      .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
      .trim();
    if (fallback1 && fallback1.length > 0) {
      warnings.push('CLEAN_NAME_EMPTY_FALLBACK');
      return { cleaned: fallback1, warnings, steps };
    }

    if (options.fallbackHost) {
      warnings.push('CLEAN_NAME_EMPTY_FALLBACK_HOST');
      return { cleaned: options.fallbackHost, warnings, steps };
    }

    if (options.fallbackUrl) {
      warnings.push('CLEAN_NAME_EMPTY_FALLBACK_URL');
      return { cleaned: options.fallbackUrl, warnings, steps };
    }

    if (options.sourceIndex !== undefined) {
      warnings.push('CLEAN_NAME_EMPTY_FALLBACK_INDEX');
      return { cleaned: `未命名源-${options.sourceIndex}`, warnings, steps };
    }

    warnings.push('CLEAN_NAME_EMPTY_FALLBACK');
  }

  return { cleaned, warnings, steps };
}

// ── Sub-cleaners ──

function stripEmoji(text: string): string {
  let result = text;
  // Unicode property escape for emoji
  result = result.replace(/\p{Extended_Pictographic}/gu, '');
  // Variation selectors
  result = result.replace(/[\uFE00-\uFE0F]/g, '');
  // Zero-width chars
  result = result.replace(/[\u200D\u200B\u200C\u200E\u200F\uFEFF]/g, '');
  // Fallback: our char set
  for (const ch of EMOJI_CHARS) {
    result = result.replaceAll(ch, '');
  }
  // Legacy regex fallback
  result = result.replace(EMOJI_REGEX, '');
  return result;
}

function cleanBracketAnnotations(text: string): string {
  let result = text;
  const qualityWords = '(?:优\\+*|可用|修复|推荐|新站|备用|失效|需登录|暂不可用|已失效|校验超时|恢复|维护中|测试|调试|首发|正版|纯净|无广告|需VIP|已恢复|广告)';
  // Chinese brackets
  result = result.replace(new RegExp(`[（(]\\s*${qualityWords}\\s*[）)]`, 'gi'), ' ');
  // 【】
  result = result.replace(new RegExp(`【\\s*${qualityWords}\\s*】`, 'gi'), ' ');
  // [ ]
  result = result.replace(new RegExp(`\\[\\s*${qualityWords}\\s*\\]`, 'gi'), ' ');
  return result;
}

function cleanMaintainerSuffix(text: string): string {
  let result = text;
  for (const pattern of MAINTAINER_PATTERNS) {
    result = result.replace(pattern, ' ');
  }
  return result;
}

function cleanAnnotationBrackets(text: string): string {
  // Remove short annotation brackets like (生肉), (熟肉), (连载中), (完本) etc.
  // Only if they're clearly trailing annotations (short content, at end of name)
  return text.replace(/\s*[（(](?:生肉|熟肉|连载中|已完结|完本|连载|完结|太监|断更|停更|\d+[集话章])[）)]\s*/gi, ' ');
}

function cleanQualityLabels(text: string): string {
  const qualityWords = [
    '优\\+\\+\\+', '优\\+\\+', '优\\+', '优质',
    '已校验', '已失效', '已恢复', '需登录', '需VIP', '需付费',
    '暂不可用', '维护中', '校验超时',
    '导', '导入', '外部',
  ];
  let result = text;
  for (const qw of qualityWords) {
    // Match only at word boundaries, trailing position, or parenthesized
    result = result.replace(new RegExp(`\\s*${qw}\\s*`, 'g'), ' ');
  }
  return result;
}

function cleanFancySymbols(text: string): string {
  let result = text;
  for (const sym of FANCY_SYMBOLS) {
    result = result.replaceAll(sym, ' ');
  }
  return result;
}

function filterZhOnly(name: string, keepLatin: boolean): string {
  let result = '';
  for (const ch of name) {
    if (
      (ch >= '\u4e00' && ch <= '\u9fff') ||
      (ch >= '\u3400' && ch <= '\u4dbf') ||
      (ch >= '\uf900' && ch <= '\ufaff') ||
      (ch >= '0' && ch <= '9') ||
      ch === '-' || ch === '—' || ch === '·' || ch === '•' ||
      ch === ' ' || ch === '\u3000' ||
      ch === '第' || ch === '上' || ch === '中' || ch === '下' ||
      ch === '之' || ch === '的' || ch === '与' || ch === '和'
    ) {
      result += ch;
    } else if (keepLatin &&
      ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'))) {
      result += ch;
    }
  }
  return result;
}
