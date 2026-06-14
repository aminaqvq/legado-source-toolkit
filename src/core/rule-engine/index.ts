/**
 * Rule Engine — public API.
 *
 * Re-exports all rule-engine components for external use.
 */

// ── Types ──
export type {
  SelectorMode,
  LogicOp,
  RuleSegment,
  RulePipeline,
  RuleGroup,
  RuleExecuteOptions,
  RuleResult,
  ResolvedUrl,
  RuleVerifyStatus,
  RuleVerifyDetail,
  VerifyAllResult,
  DebugStep,
} from './types.js';

// ── Rule Parser ──
export {
  parseRuleString,
  parsePipeline,
  parseSegment,
} from './rule-parser.js';

// ── Selectors ──
export { selectCss, selectFirstText, selectAllText } from './selector-css.js';
export type { CssSelectResult } from './selector-css.js';
export { selectJsonPath, selectJsonPathFirst } from './selector-jsonpath.js';
export { selectXPath, selectXPathFirst } from './selector-xpath.js';
export { regexReplace, regexExtract, parseReplacePattern } from './selector-regex.js';

// ── Sandbox ──
export { executeJs, SandboxError, validateJs } from './sandbox.js';
export type { SandboxOptions } from './sandbox.js';

// ── URL Resolver ──
export { resolveSearchUrl, hasUrlJs } from './url-resolver.js';
export type { ResolveUrlOptions } from './url-resolver.js';

// ── Executor ──
export { executeRule } from './executor.js';
