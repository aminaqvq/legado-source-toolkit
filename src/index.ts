// ── Public API ──
export { processSources } from './core/process.js';
export { readBookSources } from './core/parse.js';
export { cleanBookSourceName } from './core/clean-name.js';
export type { CleanOptions } from './core/clean-name.js';
export { classifySource } from './core/classify.js';
export { normalizeUrl, normalizeHost, isHttpUrl, getHostKey, getUrlKey } from './core/normalize-url.js';
export { validateStructure } from './core/validate-structure.js';
export { checkConnectivity } from './core/validate-online.js';
export { checkSearchUrl } from './core/validate-search.js';
export { calculateScore } from './core/score.js';
export { dedupeSources } from './core/dedupe.js';
export { splitByCategory } from './core/split.js';
export { verifyAllRules, verifyRuleSearch } from './core/verify-rules.js';

// ── Rule Engine (Phase 1 & 2) ──
export {
  executeRule,
  resolveSearchUrl,
  parseRuleString,
  executeJs,
} from './core/rule-engine/index.js';
export type { RuleResult, RuleVerifyDetail, VerifyAllResult, ResolvedUrl } from './core/rule-engine/types.js';

// ── Types ──
export type { BookSource, RuleSearch, RuleBookInfo, RuleToc, RuleContent, BatchValidationMode } from './types/book-source.js';
export type {
  SourceAnalysis,
  DuplicateGroup,
  ProcessSummary,
  ProcessReport,
  ProcessOptions,
  BatchValidationSummary,
} from './types/analysis.js';
