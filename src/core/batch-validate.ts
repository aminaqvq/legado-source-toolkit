/**
 * Batch Deep Validate — v1.6
 *
 * Turns v1.5's single-source verifyAllRules chain into a batch-oriented
 * pipeline with three modes (fast / standard / deep), status summarization,
 * and aggregate reporting.
 *
 * fast:    existing structure + connectivity + lightweight search (no rule engine)
 * standard: search → bookInfo → toc (stops before content)
 * deep:    search → bookInfo → toc → content (full chain)
 */

import type { BookSource, BatchValidationMode } from '../types/book-source.js';

// ══════════════════════════════════════════════════════
//  Runtime validation helpers
// ══════════════════════════════════════════════════════

const VALID_BATCH_MODES: readonly BatchValidationMode[] = ['fast', 'standard', 'deep'] as const;

/** Type guard: checks whether an unknown value is a valid BatchValidationMode. */
export function isBatchValidationMode(mode: unknown): mode is BatchValidationMode {
  return typeof mode === 'string' && (VALID_BATCH_MODES as readonly string[]).includes(mode);
}

/**
 * Normalize an unknown value to a BatchValidationMode or null.
 * Returns null for invalid / undefined / empty-string inputs.
 */
export function normalizeValidateMode(mode: unknown): BatchValidationMode | null {
  if (typeof mode !== 'string' || mode.trim() === '') return null;
  const trimmed = mode.trim().toLowerCase();
  if ((VALID_BATCH_MODES as readonly string[]).includes(trimmed)) {
    return trimmed as BatchValidationMode;
  }
  return null;
}
import type { SourceAnalysis } from '../types/analysis.js';
import type {
  RuleVerifyDetail,
  StageResult,
  ValidationStage,
  FailureReason,
} from './rule-engine/types.js';
import { verifyAllRules } from './verify-rules.js';

// ══════════════════════════════════════════════════════
//  Batch status type
// ══════════════════════════════════════════════════════

export type BatchSourceStatus =
  | 'PASS'
  | 'PARTIAL_PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'NEEDS_LOGIN'
  | 'UNSUPPORTED'
  | 'RISKY'
  | 'UNKNOWN';

// ══════════════════════════════════════════════════════
//  Batch source result
// ══════════════════════════════════════════════════════

export interface BatchSourceValidationResult {
  sourceName: string;
  sourceUrl?: string;
  sourceType?: number;
  group?: string;
  host?: string;

  mode: BatchValidationMode;
  status: BatchSourceStatus;
  score?: number;

  structureStatus?: string;
  onlineStatus?: string;
  searchStatus?: string;
  ruleStatus?: string;

  failureReasons: string[];
  warnings: string[];
  suggestions: string[];

  stages: StageResult[];
  durationMs: number;
  firstFailureStage?: string;
}

// ══════════════════════════════════════════════════════
//  Runner — dispatches to verifyAllRules per mode
// ══════════════════════════════════════════════════════

export interface BatchRunOptions {
  keyword?: string;
  timeout?: number;
}

export async function runBatchValidation(
  source: BookSource,
  mode: BatchValidationMode,
  options: BatchRunOptions = {},
): Promise<{ stageResults: StageResult[]; allStages: RuleVerifyDetail[] }> {
  // Defensive: reject invalid modes at runtime so they never reach verifyAllRules
  if (!isBatchValidationMode(mode)) {
    throw new Error(`Invalid batch validation mode: ${String(mode)}. Expected one of: fast, standard, deep.`);
  }

  // fast: no rule engine — caller populates from existing analysis
  if (mode === 'fast') {
    return { stageResults: [], allStages: [] };
  }

  const maxStage = mode === 'standard' ? 'toc' as const : 'content' as const;

  const result = await verifyAllRules(source, {
    keyword: options.keyword,
    timeout: options.timeout,
    maxStage,
  });

  const stageResults: StageResult[] = result.stages.map((d) =>
    mapRuleVerifyDetailToStageResult(d),
  );

  return { stageResults, allStages: result.stages };
}

// ══════════════════════════════════════════════════════
//  Convert v1.5 RuleVerifyDetail → v1.5 StageResult
// ══════════════════════════════════════════════════════

export function mapRuleVerifyDetailToStageResult(
  detail: RuleVerifyDetail,
): StageResult {
  const stageMap: Record<string, ValidationStage> = {
    search: 'search',
    bookInfo: 'bookInfo',
    toc: 'toc',
    content: 'content',
  };

  const statusMap: Record<string, StageResult['status']> = {
    RULE_VERIFIED: 'PASS',
    RULE_EMPTY_RESULT: 'FAIL',
    RULE_PARSE_ERROR: 'FAIL',
    RULE_SKIPPED: 'SKIPPED',
    RULE_NOT_CHECKED: 'SKIPPED',
  };

  const stage: ValidationStage = stageMap[detail.stage] ?? 'search';

  return {
    stage,
    status: statusMap[detail.status] ?? 'UNKNOWN',
    confidence: detail.status === 'RULE_VERIFIED' ? 1 : 0,
    runner: 'node-safe',
    request: detail.request,
    rules: detail.rules ?? [],
    extracted: detail.extracted,
    warnings: [],
    errors: (detail.errors ?? []) as FailureReason[],
    suggestions: detail.suggestions ?? [],
    durationMs: detail.duration,
  };
}

// ══════════════════════════════════════════════════════
//  Status summarization — stage results → BatchSourceStatus
// ══════════════════════════════════════════════════════

export function mapStagesToBatchResult(
  source: BookSource,
  mode: BatchValidationMode,
  analysis: SourceAnalysis,
  stageResults: StageResult[],
  durationMs: number,
): BatchSourceValidationResult {
  const failureReasons: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let firstFailureStage: string | undefined;

  // Collect all errors / suggestions from stages
  for (const sr of stageResults) {
    failureReasons.push(...sr.errors);
    suggestions.push(...sr.suggestions);
    if (sr.status !== 'PASS' && sr.status !== 'SKIPPED' && !firstFailureStage) {
      firstFailureStage = sr.stage;
    }
  }

  // ── Determine status ──
  let status: BatchSourceStatus = 'UNKNOWN';

  // Check structure first
  if (analysis.validationStatus === 'STRUCTURE_INVALID') {
    status = 'FAIL';
    failureReasons.unshift('structure_invalid');
  } else if (!source.searchUrl || source.searchUrl.trim() === '') {
    status = 'FAIL';
    failureReasons.unshift('search_url_missing');
  } else if (!source.bookSourceUrl || source.bookSourceUrl.trim() === '') {
    status = 'FAIL';
    failureReasons.unshift('book_source_url_missing');
  } else if (failureReasons.includes('ssrf_blocked')) {
    status = 'BLOCKED';
  } else if (failureReasons.includes('http_403') || failureReasons.includes('cloudflare_detected') || failureReasons.includes('captcha_detected')) {
    status = 'BLOCKED';
  } else if (failureReasons.includes('unsupported_webview') || failureReasons.includes('unsupported_java_ajax') || failureReasons.includes('unsupported_rhino_api') || failureReasons.includes('unsupported_rule_syntax')) {
    status = 'UNSUPPORTED';
  } else if (failureReasons.includes('login_required') || analysis.loginStatus === 'needsLogin') {
    status = 'NEEDS_LOGIN';
  } else if (stageResults.length === 0) {
    // fast mode: derive from existing analysis
    if (analysis.availability === 'usable') status = 'PASS';
    else if (analysis.availability === 'probably_usable') status = 'PARTIAL_PASS';
    else if (analysis.availability === 'forbidden') status = 'BLOCKED';
    else if (analysis.availability === 'dead' || analysis.availability === 'timeout') status = 'FAIL';
    else if (analysis.availability === 'needs_login') status = 'NEEDS_LOGIN';
    else if (analysis.availability === 'complex_unverified') status = 'RISKY';
    else status = 'UNKNOWN';
  } else {
    // standard / deep: evaluate stages
    const searchOk = stageResults.some((s) => s.stage === 'search' && s.status === 'PASS');
    const allPassed = stageResults.every((s) => s.status === 'PASS' || s.status === 'SKIPPED');
    const anyPassed = stageResults.some((s) => s.status === 'PASS');

    if (allPassed) {
      status = 'PASS';
    } else if (searchOk && anyPassed && stageResults.some((s) => s.status === 'FAIL')) {
      status = 'PARTIAL_PASS';
    } else if (!anyPassed) {
      // Check if blocked/unsupported was the cause
      if (failureReasons.some((r) => r === 'http_403' || r === 'cloudflare_detected' || r === 'captcha_detected' || r === 'ssrf_blocked')) {
        status = 'BLOCKED';
      } else if (failureReasons.some((r) => r === 'unsupported_webview' || r === 'unsupported_java_ajax' || r === 'unsupported_rhino_api')) {
        status = 'UNSUPPORTED';
      } else if (failureReasons.some((r) => r === 'login_required')) {
        status = 'NEEDS_LOGIN';
      } else {
        status = 'FAIL';
      }
    } else {
      status = 'PARTIAL_PASS';
    }
  }

  // Check for risky patterns even if not executed
  if (status === 'UNKNOWN' || (status === 'PASS' && analysis.risks.length > 0)) {
    // Only set RISKY if not already in a more specific state
    const riskyPatterns = ['FUTURE_TIMESTAMP', 'complex_js_eval', 'complex_js_dynamic'];
    if (analysis.risks.some((r) => riskyPatterns.includes(r))) {
      status = 'RISKY';
    }
  }

  return {
    sourceName: source.bookSourceName ?? '(unnamed)',
    sourceUrl: source.bookSourceUrl,
    sourceType: source.bookSourceType,
    group: source.bookSourceGroup,
    host: analysis.normalizedHost ?? undefined,

    mode,
    status,
    score: analysis.score,

    structureStatus: analysis.validationStatus,
    onlineStatus: analysis.connectivityStatus,
    searchStatus: analysis.searchStatus,
    ruleStatus: status,

    failureReasons,
    warnings,
    suggestions,

    stages: stageResults,
    durationMs,
    firstFailureStage,
  };
}

// ══════════════════════════════════════════════════════
//  Aggregate summary
// ══════════════════════════════════════════════════════

import type { BatchValidationSummary } from '../types/analysis.js';

export function summarizeBatchValidation(
  results: BatchSourceValidationResult[],
): BatchValidationSummary {
  const summary: BatchValidationSummary = {
    total: results.length,
    pass: 0,
    partialPass: 0,
    fail: 0,
    blocked: 0,
    needsLogin: 0,
    unsupported: 0,
    risky: 0,
    unknown: 0,
    byFailureReason: {},
    byHost: {},
    byGroup: {},
    bySourceType: {},
  };

  for (const r of results) {
    // Status counts
    switch (r.status) {
      case 'PASS': summary.pass++; break;
      case 'PARTIAL_PASS': summary.partialPass++; break;
      case 'FAIL': summary.fail++; break;
      case 'BLOCKED': summary.blocked++; break;
      case 'NEEDS_LOGIN': summary.needsLogin++; break;
      case 'UNSUPPORTED': summary.unsupported++; break;
      case 'RISKY': summary.risky++; break;
      case 'UNKNOWN': summary.unknown++; break;
    }

    // By failure reason
    for (const reason of r.failureReasons) {
      summary.byFailureReason[reason] = (summary.byFailureReason[reason] || 0) + 1;
    }

    // By host
    if (r.host) {
      summary.byHost[r.host] = (summary.byHost[r.host] || 0) + 1;
    }

    // By group
    const group = r.group || '(none)';
    summary.byGroup[group] = (summary.byGroup[group] || 0) + 1;

    // By sourceType
    const st = String(r.sourceType ?? 'undefined');
    summary.bySourceType[st] = (summary.bySourceType[st] || 0) + 1;
  }

  return summary;
}
