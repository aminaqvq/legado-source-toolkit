/**
 * Legado rule engine — type definitions.
 *
 * Mirrors the rule system used by the 开源阅读 (Legado) Android app:
 * CSS (Jsoup), JSONPath, XPath, regex, and JS-embedded selectors
 * chained through a pipeline model.
 */

// ── Selector execution modes ──

export type SelectorMode =
  | 'css'        // CSS/Jsoup selector (default) — via cheerio
  | 'jsonpath'   // JSONPath selector — via jsonpath-plus
  | 'xpath'      // XPath selector — via xpath + xmldom
  | 'regex'      // Regex replacement or extraction
  | 'js'         // JavaScript expression sandbox
  | 'text';      // Indexed access / attribute read / text read

// ── Logical operators between rule groups ──

export type LogicOp = '&&' | '||' | '%%';

// ── Single rule segment in a pipeline ──

export interface RuleSegment {
  /** Detected execution mode */
  mode: SelectorMode;
  /** The rule text (stripped of mode-prefix markers) */
  rule: string;
  /** ##pattern##replacement## — replacement pattern */
  replaceRegex?: string;
  /** Replacement text for the regex */
  replacement?: string;
  /** Only replace first occurrence */
  replaceFirst?: boolean;
  /** @get:key — reference a stored variable */
  getVariable?: string;
  /** @put:{key:val} — store variables for later use */
  putMap?: Record<string, string>;
}

export type RulePipeline = RuleSegment[];

// ── A group of pipelines connected by a logical operator ──

export interface RuleGroup {
  segments: RulePipeline;
  logicOp: LogicOp | null; // null = last group
}

// ── Execution options ──

export interface RuleExecuteOptions {
  /** The page/doc content (HTML / JSON / text) */
  content: string;
  /** Base URL for resolving relative links */
  baseUrl?: string;
  /** Search keyword ({{key}}, {{keyword}}) */
  key?: string;
  /** Page number ({{page}}) */
  page?: number;
  /** Custom request headers from the source */
  headers?: Record<string, string>;
  /** Additional JS-context bindings */
  jsContext?: Record<string, unknown>;
  /** JS execution timeout in ms (default 5000) */
  jsTimeout?: number;
  /** Whether to collect debug logs */
  debug?: boolean;
}

// ── Execution result ──

export interface RuleResult {
  /** Single string result (first of list if available) */
  text: string | null;
  /** Full list of extracted strings */
  list: string[];
  /** Raw element objects (for further chaining) */
  elements: unknown[];
  /** Execution duration in milliseconds */
  duration: number;
  /** Debug log lines */
  logs: string[];
  /** Error message if any step failed */
  error?: string;
}

// ── URL template resolution result ──

export interface ResolvedUrl {
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  charset?: string;
}

// ── Verification status (for Phase 2 integration) ──

export type RuleVerifyStatus =
  | 'RULE_VERIFIED'
  | 'RULE_EMPTY_RESULT'
  | 'RULE_PARSE_ERROR'
  | 'RULE_SKIPPED'
  | 'RULE_NOT_CHECKED';

// ── Debug step (for Phase 3 single-source debugging) ──

export interface DebugStep {
  stage: 'search' | 'bookInfo' | 'toc' | 'content';
  url?: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  ruleUsed?: string;
  responseSize?: number;
  resultCount?: number;
  duration: number;
  extracted?: Record<string, unknown>;
  error?: string;
  logs: string[];
}

// ── Per-stage verification detail (Phase 2) ──

export interface RuleVerifyDetail {
  status: RuleVerifyStatus;
  stage: 'search' | 'bookInfo' | 'toc' | 'content';
  url?: string;
  responseSize?: number;
  resultCount?: number;
  /** Sample of extracted data (first 200 chars) */
  resultSample?: string;
  duration: number;
  error?: string;
  logs: string[];
  /** v1.5: structured extracted data */
  extracted?: unknown;
  /** v1.5: HTTP request trace */
  request?: NetworkTrace;
  /** v1.5: rule execution traces */
  rules?: RuleTrace[];
  /** v1.5: failure reasons */
  errors?: FailureReason[];
  /** v1.5: suggestions for fixing */
  suggestions?: string[];
}

// ── Full verification result (Phase 2 orchestrator) ──

export interface VerifyAllResult {
  sourceName: string;
  sourceUrl: string;
  allPassed: boolean;
  totalDuration: number;
  stages: RuleVerifyDetail[];
  summary: string;
  /** v1.5 enriched stage results (backward-compatible, added alongside stages) */
  stageResults?: StageResult[];
}

// ══════════════════════════════════════════════════════
//  v1.5 Single Source Lab — new types
// ══════════════════════════════════════════════════════

export type ValidationStage = 'structure' | 'online' | 'search' | 'bookInfo' | 'toc' | 'content';

export type ValidationStatus =
  | 'PASS'
  | 'LIKELY_PASS'
  | 'PARTIAL_PASS'
  | 'FAIL'
  | 'NEEDS_LOGIN'
  | 'BLOCKED'
  | 'UNSUPPORTED'
  | 'RISKY'
  | 'SKIPPED'
  | 'UNKNOWN';

export type FailureReason =
  | 'missing_field'
  | 'invalid_url'
  | 'ssrf_blocked'
  | 'http_timeout'
  | 'http_403'
  | 'cloudflare_detected'
  | 'captcha_detected'
  | 'login_required'
  | 'empty_response'
  | 'rule_parse_error'
  | 'rule_empty_result'
  | 'book_url_missing'
  | 'toc_url_missing'
  | 'chapter_url_missing'
  | 'content_too_short'
  | 'unsupported_webview'
  | 'unsupported_java_ajax'
  | 'unsupported_rhino_api'
  | 'unsupported_rule_syntax'
  | 'network_error'
  | 'unknown_error';

export interface SearchItem {
  name?: string;
  author?: string;
  bookUrl?: string;
  rawPreview?: string;
  confidence: number;
  error?: string;
}

export interface ChapterItem {
  chapterName?: string;
  chapterUrl?: string;
  rawPreview?: string;
}

/** Detailed trace of one rule execution */
export interface RuleTrace {
  ruleName: string;
  rule: string;
  inputKind: 'document' | 'scope' | 'json' | 'text';
  outputPreview: string;
  outputCount?: number;
  status: ValidationStatus;
  error?: string;
  durationMs: number;
}

/** Trace of one HTTP request */
export interface NetworkTrace {
  url: string;
  method: string;
  status?: number;
  finalUrl?: string;
  contentType?: string;
  responseSize?: number;
  bodyPreview?: string;
  durationMs: number;
  error?: string;
}

export interface BookInfoResult {
  name?: string;
  author?: string;
  intro?: string;
  coverUrl?: string;
  tocUrl?: string;
}

export interface ContentResult {
  contentLength: number;
  contentPreview: string;
  isTooShort: boolean;
}

export interface StageResult<T = unknown> {
  stage: ValidationStage;
  status: ValidationStatus;
  confidence: number;
  runner: 'node-safe';
  request?: NetworkTrace;
  rules: RuleTrace[];
  extracted?: T;
  warnings: string[];
  errors: FailureReason[];
  suggestions: string[];
  durationMs: number;
}
