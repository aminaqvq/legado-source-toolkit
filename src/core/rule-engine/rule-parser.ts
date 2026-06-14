/**
 * Rule string parser — splits Legado source-rule strings into
 * a structured RulePipeline (array of RuleSegments).
 *
 * Handles:
 *   - Mode detection (CSS / JSONPath / XPath / JS / regex)
 *   - `@@` element-boundary separator
 *   - `##pattern##replacement##` replacement extraction
 *   - `@get:key` variable reference extraction
 *   - `@put:{key:val}` put-map extraction
 *   - `!` index post-processor
 *   - Logic operators `&&` `||` `%%`
 */

import type { RuleSegment, RuleGroup, RulePipeline, SelectorMode, LogicOp } from './types.js';

// ── Constants ──

/** Regex for `##pattern##replacement##flags##` — optional interior replacement */
const REPLACE_PATTERN = /##(.+?)##(.+?)(?:##(first?))?##?$/;

/** Regex to detect JS blocks `{{...}}` or `@js:...` */
const JS_BLOCK = /^\{\{(.+)\}\}$/;

/** JSONPath prefix patterns */
const JSONPATH_PREFIX = /^(\$\.|\$\[|@Json:)/i;

/** XPath prefix pattern (starts with / or @XPath:) */
const XPATH_PREFIX = /^(\/|@XPath:)/i;

/** CSS explicit prefix */
const CSS_PREFIX = /^@CSS:/i;

/** @get:variable reference */
const GET_PATTERN = /^@get:(.+)$/;

/** @put:{...} map */
const PUT_PATTERN = /^@put:\{(.+)\}$/i;

/** Index selector !n or -n */
const INDEX_PATTERN = /^(!-?\d+)$/;

/** Attribute/text getters */
const ATTR_GETTERS = /^@(text|html|outerHtml|href|src|val|tag:[a-zA-Z0-9_-]+|allText)$/i;

/** Charset extraction from URL options */
const CHARSET_PATTERN = /charset=([a-zA-Z0-9_-]+)/i;

// ── Main API ──

/**
 * Parse a full rule string into an ordered list of RuleGroups.
 * Each group contains a pipeline (list of segments) and a logical operator
 * connecting it to the next group.
 */
export function parseRuleString(fullRule: string): RuleGroup[] {
  if (!fullRule || fullRule.trim() === '') {
    return [{ segments: [], logicOp: null }];
  }

  const trimmed = fullRule.trim();

  // Phase 1: split by logic operators at top level
  const groups = splitLogicLevel(trimmed);

  return groups.map(({ text, op }) => ({
    segments: parsePipeline(text),
    logicOp: op as LogicOp | null,
  }));
}

/**
 * Parse a single pipeline string (no logic operators) into RuleSegments.
 */
export function parsePipeline(ruleStr: string): RulePipeline {
  if (!ruleStr || ruleStr.trim() === '') return [];

  // Handle JS-only rule
  const jsMatch = ruleStr.trim().match(JS_BLOCK);
  if (jsMatch) {
    return [{
      mode: 'js',
      rule: jsMatch[1],
    }];
  }

  const segments: RulePipeline = [];

  // Split by @@ (element boundary) and @ (segment boundary)
  // But: `@@` is a special marker that means "apply to each element",
  // while `@` (without another @) is a segment separator.
  //
  // Strategy: tokenise by `@` then re-join `@` if it started a getter/put/attr.
  // Actually, Legado splits on `@@` and then on `@`:
  //   class.book@@tag:li!0@@tag:a@text
  //   → [class.book] → [tag:li, !0] → [tag:a, @text]
  //
  // Simpler approach: split by `@@` first, then each part by `@`.

  const parts = splitByDoubleAt(ruleStr);

  for (const part of parts) {
    const subSegments = splitByAt(part);
    for (const sub of subSegments) {
      segments.push(parseSegment(sub));
    }
  }

  return segments;
}

/**
 * Split a rule string into top-level logical groups.
 * Resolves `&&`, `||`, `%%` at the top level, respecting
 * balanced groups inside `{...}` and `{{...}}`.
 */
function splitLogicLevel(input: string): Array<{ text: string; op: string | null }> {
  const groups: Array<{ text: string; op: string | null }> = [];
  let current = '';
  let depth = 0;
  let jsDepth = 0;
  let i = 0;

  const emit = (op: string | null) => {
    const trimmed = current.trim();
    if (trimmed) {
      groups.push({ text: trimmed, op });
    }
    current = '';
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === '{' && input[i - 1] === '{') {
      jsDepth++;
    } else if (ch === '{' && input[i - 1] !== '{') {
      depth++;
    } else if (ch === '}' && input[i + 1] === '}') {
      jsDepth--;
      i++; // skip the second }
    } else if (ch === '}') {
      depth--;
    } else if (jsDepth === 0 && depth === 0) {
      // Check for logic operators at top level
      const rest = input.substring(i);
      const andMatch = rest.match(/^&&/);
      const orMatch = rest.match(/^\|\|/);
      const crossMatch = rest.match(/^%%/);

      if (andMatch) {
        emit('&&');
        i += andMatch[0].length;
        continue;
      }
      if (orMatch) {
        emit('||');
        i += orMatch[0].length;
        continue;
      }
      if (crossMatch) {
        emit('%%');
        i += crossMatch[0].length;
        continue;
      }
    }

    current += ch;
    i++;
  }

  emit(null);
  return groups;
}

/**
 * Split by `@@` — returns parts. Each `@@` segment is a complete
 * rule applied to each element from the prior step.
 */
function splitByDoubleAt(input: string): string[] {
  // Handle @@ as separator, but NOT @@ inside attribute names
  const parts: string[] = [];
  let current = '';
  let i = 0;
  while (i < input.length) {
    if (input[i] === '@' && input[i + 1] === '@') {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
      i += 2;
      continue;
    }
    current += input[i];
    i++;
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

/**
 * Split a single `@@` block by `@` separators.
 * This is the per-element pipeline.
 */
function splitByAt(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < input.length) {
    if (input[i] === '@') {
      // Check if this @ starts a known pattern or is just a segment separator
      // If it starts an attribute getter (@text, @href, etc.) or is the
      // first character, it's a separator
      const trimmed = current.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }
    current += input[i];
    i++;
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

/**
 * Parse a single rule token into a RuleSegment with auto-detected mode.
 */
export function parseSegment(token: string): RuleSegment {
  const t = token.trim();
  if (!t) return { mode: 'text', rule: '' };

  const segment: RuleSegment = { mode: 'css', rule: t };

  // 1. Check JS block
  const jsMatch = t.match(JS_BLOCK);
  if (jsMatch) {
    segment.mode = 'js';
    segment.rule = jsMatch[1];
    return segment;
  }

  // 2. Check @get:variable
  const getMatch = t.match(GET_PATTERN);
  if (getMatch) {
    segment.mode = 'text';
    segment.rule = '';
    segment.getVariable = getMatch[1];
    return segment;
  }

  // 3. Check @put:{...}
  const putMatch = t.match(PUT_PATTERN);
  if (putMatch) {
    segment.mode = 'text';
    segment.rule = '';
    try {
      segment.putMap = JSON.parse(`{${putMatch[1]}}`);
    } catch {
      // ignore malformed put
    }
    return segment;
  }

  // 4. Check index selector !n
  const idxMatch = t.match(INDEX_PATTERN);
  if (idxMatch) {
    segment.mode = 'text';
    segment.rule = idxMatch[1];
    return segment;
  }

  // 5. Check attribute/text getter
  const attrMatch = t.match(ATTR_GETTERS);
  if (attrMatch) {
    segment.mode = 'text';
    segment.rule = attrMatch[0];
    return segment;
  }

  // 6. Detect mode from prefix
  if (CSS_PREFIX.test(t)) {
    segment.mode = 'css';
    segment.rule = t.replace(CSS_PREFIX, '');
  } else if (XPATH_PREFIX.test(t)) {
    segment.mode = 'xpath';
    segment.rule = t.replace(/^@XPath:\s*/i, '');
  } else if (JSONPATH_PREFIX.test(t)) {
    segment.mode = 'jsonpath';
    segment.rule = t.replace(/^@Json:\s*/i, '');
  } else if (t.startsWith('/')) {
    segment.mode = 'xpath';
    segment.rule = t;
  } else if (t.startsWith('$.') || t.startsWith('$[')) {
    segment.mode = 'jsonpath';
    segment.rule = t;
  } else if (t.startsWith('@js:') || t.startsWith('@JS:')) {
    segment.mode = 'js';
    segment.rule = t.replace(/^@js:\s*/i, '');
  } else {
    // Default: CSS mode
    segment.mode = 'css';
    segment.rule = t;
  }

  // 7. Extract ##pattern##replacement## from the rule
  const repMatch = segment.rule.match(REPLACE_PATTERN);
  if (repMatch) {
    segment.replaceRegex = repMatch[1];
    segment.replacement = repMatch[2];
    segment.replaceFirst = repMatch[3] === 'first';
    segment.rule = segment.rule.replace(REPLACE_PATTERN, '').trim();
  }

  // 8. Check for charset in rule
  const csMatch = segment.rule.match(CHARSET_PATTERN);
  if (csMatch) {
    // charset hint — strip from rule for now
    segment.rule = segment.rule.replace(CHARSET_PATTERN, '').trim();
  }

  // Clean up trailing/leading artifacts
  segment.rule = segment.rule.trim();

  return segment;
}

/**
 * Check if a rule string contains JS patterns that Legado's
 * CheckSourceService would skip.
 */
export function hasComplexJs(rule: string): boolean {
  return /\beval\b/i.test(rule) || /java\.ajax/i.test(rule);
}

/**
 * Get the search keyword from a source's ruleSearch.checkKeyWord
 * or fall back to a default.
 */
export function getSearchKeyword(
  ruleSearch: { checkKeyWord?: string } | undefined,
  defaultKeyword = '斗破苍穹',
): string {
  if (ruleSearch?.checkKeyWord?.trim()) {
    return ruleSearch.checkKeyWord.trim();
  }
  return defaultKeyword;
}
