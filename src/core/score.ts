import type { BookSource } from '../types/book-source.js';
import type { SourceAnalysis } from '../types/analysis.js';
import {
  SCORE,
  RESPOND_TIME_BONUS,
  LAST_UPDATE_BONUS,
  WEIGHT_BONUS,
} from '../constants/defaults.js';
import { COMPLEX_JS_PATTERNS } from '../constants/keywords.js';
import { isOldTimestamp } from '../utils/time.js';

interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
}

/**
 * Calculate a quality score for a book source.
 * Higher = better.
 */
export function calculateScore(
  source: BookSource,
  analysis: SourceAnalysis,
): ScoreResult {
  const breakdown: Record<string, number> = {};
  let score = 0;

  // ── Bonuses ──

  // Availability bonus
  if (analysis.availability === 'usable') {
    score += addBonus(breakdown, 'availability_usable', SCORE.AVAILABILITY_USABLE);
  } else if (analysis.availability === 'probably_usable') {
    score += addBonus(breakdown, 'availability_probably_usable', SCORE.AVAILABILITY_PROBABLY_USABLE);
  } else if (analysis.availability === 'complex_unverified') {
    score += addBonus(breakdown, 'availability_complex_unverified', SCORE.AVAILABILITY_COMPLEX_UNVERIFIED);
  }

  // Connectivity bonus
  if (analysis.connectivityStatus === 'CONNECT_OK') {
    score += addBonus(breakdown, 'connect_ok', SCORE.CONNECT_OK);
  }

  // Search bonus
  if (analysis.searchStatus === 'SEARCH_HTTP_OK' || analysis.searchStatus === 'SEARCH_PARSE_OK') {
    score += addBonus(breakdown, 'search_http_ok', SCORE.SEARCH_HTTP_OK);
  } else if (analysis.searchStatus === 'SEARCH_RULE_LIKELY_OK') {
    score += addBonus(breakdown, 'search_rule_likely_ok', SCORE.SEARCH_RULE_LIKELY_OK);
  }

  // Enabled flags
  if (source.enabled === true) {
    score += addBonus(breakdown, 'enabled', SCORE.ENABLED);
  }
  if (source.enabledExplore === true) {
    score += addBonus(breakdown, 'enabled_explore', SCORE.ENABLED_EXPLORE);
  }

  // Has searchUrl
  if (source.searchUrl) {
    score += addBonus(breakdown, 'has_search_url', SCORE.HAS_SEARCH_URL);
  }

  // Rule completeness
  if (source.ruleSearch?.bookList) {
    score += addBonus(breakdown, 'has_rule_search_booklist', SCORE.HAS_RULE_SEARCH_BOOKLIST);
  }
  if (source.ruleSearch?.name) {
    score += addBonus(breakdown, 'has_rule_search_name', SCORE.HAS_RULE_SEARCH_NAME);
  }
  if (source.ruleSearch?.bookUrl) {
    score += addBonus(breakdown, 'has_rule_search_bookurl', SCORE.HAS_RULE_SEARCH_BOOKURL);
  }
  if (source.ruleBookInfo?.name) {
    score += addBonus(breakdown, 'has_rule_bookinfo_name', SCORE.HAS_RULE_BOOKINFO_NAME);
  }
  if (source.ruleToc?.chapterList) {
    score += addBonus(breakdown, 'has_rule_toc_chapterlist', SCORE.HAS_RULE_TOC_CHAPTERLIST);
  }
  if (source.ruleContent?.content) {
    score += addBonus(breakdown, 'has_rule_content_content', SCORE.HAS_RULE_CONTENT_CONTENT);
  }

  // Respond time bonus — prefer measured over source field
  const effectiveRespTime = analysis.measuredRespondTime ?? source.respondTime;
  if (typeof effectiveRespTime === 'number' && effectiveRespTime >= 0) {
    const bonus = getBracketBonus(effectiveRespTime, RESPOND_TIME_BONUS);
    score += addBonus(breakdown, 'respond_time', bonus);
  }

  // High respond time penalty
  if (typeof effectiveRespTime === 'number' && effectiveRespTime > 30000) {
    score += addPenalty(breakdown, 'respond_time_high', SCORE.RESPOND_TIME_HIGH);
  }

  // Last update time bonus
  const lastUpdate = source.lastUpdateTime;
  if (typeof lastUpdate === 'number' && lastUpdate > 0) {
    // Check for FUTURE timestamp (> 1 day ahead)
    if (lastUpdate > Date.now() + 24 * 60 * 60 * 1000) {
      analysis.risks.push('FUTURE_TIMESTAMP');
      // No freshness bonus for future dates
    } else {
      const daysAgo = (Date.now() - lastUpdate) / (24 * 60 * 60 * 1000);
      const bonus = getBracketBonus(daysAgo, LAST_UPDATE_BONUS);
      score += addBonus(breakdown, 'last_update', bonus);
    }
  }

  // Old last update
  if (isOldTimestamp(lastUpdate)) {
    score += addPenalty(breakdown, 'last_update_old', SCORE.LAST_UPDATE_OLD);
  }

  // Weight bonus
  const weight = source.weight;
  if (typeof weight === 'number') {
    const bonus = getWeightBonus(weight);
    score += addBonus(breakdown, 'weight', bonus);
  }

  // Classification confidence
  if (analysis.classificationConfidence === 'high') {
    score += addBonus(breakdown, 'classification_high', SCORE.CLASSIFICATION_HIGH);
  }

  // ── Penalties ──

  // Availability penalties
  if (analysis.availability === 'dead') {
    score += addPenalty(breakdown, 'availability_dead', SCORE.AVAILABILITY_DEAD);
  }
  if (analysis.availability === 'invalid') {
    score += addPenalty(breakdown, 'availability_invalid', SCORE.AVAILABILITY_INVALID);
  }
  if (analysis.availability === 'timeout') {
    score += addPenalty(breakdown, 'availability_timeout', SCORE.AVAILABILITY_TIMEOUT);
  }
  if (analysis.availability === 'forbidden') {
    score += addPenalty(breakdown, 'availability_forbidden', SCORE.AVAILABILITY_FORBIDDEN);
  }

  // Name/group contains "失效"
  const name = (source.bookSourceName || '').toLowerCase();
  const group = (source.bookSourceGroup || '').toLowerCase();
  if (/失效/.test(name)) {
    score += addPenalty(breakdown, 'name_contains_dead', SCORE.NAME_CONTAINS_DEAD);
  }
  if (/失效|校验超时/.test(group)) {
    score += addPenalty(breakdown, 'group_contains_dead', SCORE.GROUP_CONTAINS_DEAD);
  }

  // Missing rules
  if (!source.searchUrl) {
    score += addPenalty(breakdown, 'missing_search_url', SCORE.MISSING_SEARCH_URL);
  }
  if (!source.ruleSearch) {
    score += addPenalty(breakdown, 'missing_rule_search', SCORE.MISSING_RULE_SEARCH);
  }
  if (!source.ruleContent || Object.keys(source.ruleContent).length === 0) {
    score += addPenalty(breakdown, 'missing_rule_content', SCORE.MISSING_RULE_CONTENT);
  }

  // Needs login penalty
  if (analysis.availability === 'needs_login' || analysis.availability === 'login_related') {
    score += addPenalty(breakdown, 'needs_login', SCORE.NEEDS_LOGIN);
  }

  // Complex JS penalty
  const [jsPenalty, jsTier] = calcComplexJsPenalty(source);
  if (jsPenalty < 0) {
    score += addPenalty(breakdown, `complex_js_${jsTier}`, Math.abs(jsPenalty));
    // Note: addPenalty already subtracts Math.abs(), so we only need one subtraction
  }

  return { score, breakdown };
}

// ── Helpers ──

function addBonus(breakdown: Record<string, number>, key: string, value: number): number {
  breakdown[key] = value;
  return value;
}

function addPenalty(breakdown: Record<string, number>, key: string, value: number): number {
  breakdown[key] = -Math.abs(value);
  return -Math.abs(value);
}

function getBracketBonus(
  value: number,
  brackets: readonly { max: number; bonus: number }[],
): number {
  for (const b of brackets) {
    if (value <= b.max) return b.bonus;
  }
  return 0;
}

function getWeightBonus(weight: number): number {
  for (const b of WEIGHT_BONUS) {
    if (weight >= b.min) return b.bonus;
  }
  return 0;
}

/**
 * Calculate penalty for complex JS dependencies.
 * Returns [penalty (negative), tier name].
 * Tiers: simple (-5), static (-5), dynamic (-10), eval (-20)
 */
function calcComplexJsPenalty(source: BookSource): [number, string] {
  const fields = [
    source.searchUrl,
    source.exploreUrl,
    source.loginUrl,
    source.loginCheckJs,
    source.jsLib,
  ].filter(Boolean);

  // Check for eval/dynamic code (worst tier)
  for (const field of fields) {
    if (/\beval\b/i.test(field!)) {
      return [-20, 'eval'];
    }
  }

  // Check for java.ajax / cookie / WebView (medium tier)
  for (const field of fields) {
    if (/java\.ajax/i.test(field!) || /\bcookie\b/i.test(field!) || /\bcache\b/i.test(field!) || /WebView/i.test(field!) || /Reload/i.test(field!) || /source\.getKey/i.test(field!) || /source\.login/i.test(field!)) {
      return [-10, 'dynamic'];
    }
  }

  // Check for static JS markers (<js> / @js:)
  for (const field of fields) {
    for (const pattern of COMPLEX_JS_PATTERNS) {
      if (pattern.test(field!)) {
        return [-5, 'static'];
      }
    }
  }

  return [0, 'none'];
}
