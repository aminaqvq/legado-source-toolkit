/**
 * Rule pipeline executor — the core orchestrator.
 *
 * Takes a parsed RulePipeline and executes each segment in sequence,
 * threading the intermediate result through.  Supports:
 *
 *   - Chained selectors (CSS → CSS → post-processor)
 *   - `@@` element boundary (apply subsequent rules per-element)
 *   - `!n` index selection on intermediate lists
 *   - `@text` / `@href` / `@html` etc. post-processors
 *   - `##pattern##replacement##` regex replacement
 *   - Logical operators `&&` `||` `%%` between rule groups
 *   - JS sandbox execution
 */

import type {
  RuleSegment,
  RuleGroup,
  RuleExecuteOptions,
  RuleResult,
  SelectorMode,
} from './types.js';
import { parseRuleString, parseSegment } from './rule-parser.js';
import { selectCss } from './selector-css.js';
import { selectJsonPath } from './selector-jsonpath.js';
import { selectXPath } from './selector-xpath.js';
import { regexReplace } from './selector-regex.js';
import { executeJs } from './sandbox.js';

// ── Internal types ──

/** Wrapper for intermediate pipeline values */
interface ValueNode {
  /** The raw element/value */
  raw: unknown;
  /** Type hint */
  kind: 'element' | 'string' | 'number' | 'object';
  /** Text representation */
  text: string;
}

// ── Internal state ──

interface ExecContext {
  content: string;
  options: Required<RuleExecuteOptions>;
  logs: string[];
  startTime: number;
  /** Variable map for @get / @put */
  varMap: Record<string, string>;
}

function defaults(opts: RuleExecuteOptions): Required<RuleExecuteOptions> {
  return {
    content: opts.content,
    baseUrl: opts.baseUrl ?? '',
    key: opts.key ?? '',
    page: opts.page ?? 1,
    headers: opts.headers ?? {},
    jsContext: opts.jsContext ?? {},
    jsTimeout: opts.jsTimeout ?? 5000,
    debug: opts.debug ?? false,
  };
}

// ── Main API ──

/**
 * Execute a complete rule string against content.
 * Parses the rule, runs the pipeline, returns the result.
 */
export function executeRule(
  ruleStr: string,
  options: RuleExecuteOptions,
): RuleResult {
  const ctx: ExecContext = {
    content: options.content,
    options: defaults(options),
    logs: [],
    startTime: Date.now(),
    varMap: {},
  };

  try {
    const groups = parseRuleString(ruleStr);
    let finalNodes: ValueNode[] = [];

    for (const group of groups) {
      const result = executeGroup(group, ctx);

      // Combine with previous results based on LogicOp
      if (group.logicOp === '||' && finalNodes.length > 0) {
        // OR — if we already have results, skip this group
        continue;
      }

      if (group.logicOp === '%%' && finalNodes.length > 0 && result.length > 0) {
        // Cross-merge by index
        const merged: ValueNode[] = [];
        const maxLen = Math.max(finalNodes.length, result.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < finalNodes.length) merged.push(finalNodes[i]);
          if (i < result.length) merged.push(result[i]);
        }
        finalNodes = merged;
      } else {
        // && (AND) or first group
        finalNodes = result;
      }
    }

    const duration = Date.now() - ctx.startTime;
    const list = finalNodes.map((n) => n.text);
    return {
      text: list[0] ?? null,
      list,
      elements: finalNodes.map((n) => n.raw),
      duration,
      logs: ctx.logs,
    };
  } catch (err) {
    const duration = Date.now() - ctx.startTime;
    return {
      text: null,
      list: [],
      elements: [],
      duration,
      logs: ctx.logs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute a single rule group (pipeline) against the current content.
 */
function executeGroup(
  group: RuleGroup,
  ctx: ExecContext,
): ValueNode[] {
  if (group.segments.length === 0) {
    return [];
  }

  // Start with the raw HTML content as a single node
  let nodes: ValueNode[] = [{ raw: ctx.content, kind: 'string', text: ctx.content }];

  for (const segment of group.segments) {
    nodes = executeSegment(segment, nodes, ctx);
    if (nodes.length === 0) {
      // Early stop if all elements filtered out
      break;
    }
  }

  return nodes;
}

/**
 * Execute a single segment against a list of current nodes.
 */
function executeSegment(
  segment: RuleSegment,
  currentNodes: ValueNode[],
  ctx: ExecContext,
): ValueNode[] {
  // Handle put/get
  if (segment.putMap && Object.keys(segment.putMap).length > 0) {
    Object.assign(ctx.varMap, segment.putMap);
    return currentNodes;
  }

  if (segment.getVariable && ctx.varMap[segment.getVariable] !== undefined) {
    const val = ctx.varMap[segment.getVariable];
    return [{ raw: val, kind: 'string', text: val }];
  }

  // Convert current nodes to the input format each selector expects
  const htmlInput = currentNodes.map((n) => n.text).join('\n');

  let resultNodes: ValueNode[];

  switch (segment.mode) {
    case 'css':
      resultNodes = execCssOnNodes(htmlInput, segment.rule, currentNodes);
      break;
    case 'jsonpath':
      resultNodes = execJsonPathOnNodes(htmlInput, segment.rule);
      break;
    case 'xpath':
      resultNodes = execXPathOnNodes(htmlInput, segment.rule);
      break;
    case 'regex':
      resultNodes = execRegexOnNodes(htmlInput, segment, currentNodes);
      break;
    case 'js':
      resultNodes = execJsOnNodes(htmlInput, segment, ctx);
      break;
    case 'text':
      resultNodes = execTextOnNodes(segment.rule, currentNodes);
      break;
    default:
      resultNodes = currentNodes;
  }

  return resultNodes;
}

// ── Segment executors ──

function execCssOnNodes(
  html: string,
  rule: string,
  currentNodes: ValueNode[],
): ValueNode[] {
  // If we have specific scope elements, use them; otherwise use the full HTML
  const scopeEls = currentNodes
    .filter((n) => n.kind === 'element')
    .map((n) => n.raw) as any[];

  const result = selectCss(html, rule, scopeEls.length > 0 ? scopeEls : undefined);

  return result.elements.map((el: any) => ({
    raw: el,
    kind: 'element' as const,
    text: extractElementText(el),
  }));
}

function extractElementText(el: any): string {
  if (!el) return '';
  // Cheerio/domhandler element
  if (el.type === 'text' || el.type === 'script' || el.type === 'comment') {
    return (el as any).data ?? '';
  }
  if (el.type === 'tag' || el.type === 'script') {
    // For tag elements, get all text from children
    if (el.children && Array.isArray(el.children)) {
      return el.children
        .map((child: any) => extractElementText(child))
        .join('');
    }
    // Attributes
    if (el.attribs) {
      return el.attribs.title || el.attribs.alt || '';
    }
  }
  if (typeof el === 'object' && 'data' in el) return (el as any).data;
  return String(el);
}

function execJsonPathOnNodes(
  data: string,
  rule: string,
): ValueNode[] {
  const result = selectJsonPath(data, rule);
  return result.values.map((v) => ({
    raw: v,
    kind: typeof v === 'string' ? 'string' : 'object',
    text: v === null || v === undefined ? '' : String(v),
  }));
}

function execXPathOnNodes(
  content: string,
  rule: string,
): ValueNode[] {
  const result = selectXPath(content, rule);
  return result.values.map((v) => ({
    raw: v,
    kind: 'object',
    text: v === null || v === undefined ? '' : String(v),
  }));
}

function execRegexOnNodes(
  input: string,
  segment: RuleSegment,
  currentNodes: ValueNode[],
): ValueNode[] {
  if (segment.replaceRegex && segment.replacement !== undefined) {
    const result = regexReplace(
      input,
      segment.replaceRegex,
      segment.replacement,
      segment.replaceFirst,
    );
    return [{ raw: result.text, kind: 'string', text: result.text }];
  }
  return currentNodes;
}

function execJsOnNodes(
  input: string,
  segment: RuleSegment,
  ctx: ExecContext,
): ValueNode[] {
  try {
    const result = executeJs(segment.rule, {
      key: ctx.options.key,
      baseUrl: ctx.options.baseUrl,
      page: ctx.options.page,
      timeout: ctx.options.jsTimeout,
      resultContext: { text: extractTextFromNodes(ctx), html: input },
      variables: ctx.varMap,
    });
    return [{ raw: result, kind: 'string', text: result }];
  } catch {
    return [];
  }
}

function execTextOnNodes(
  rule: string,
  currentNodes: ValueNode[],
): ValueNode[] {
  const lower = rule.toLowerCase();

  // !n index selection
  const indexMatch = lower.match(/^(!-?\d+)$/);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1].replace('!', ''), 10);
    const arr = currentNodes;
    const node = idx < 0 ? arr[arr.length + idx] : arr[idx];
    return node !== undefined ? [node] : [];
  }

  // @text — already have text, just return text
  if (lower === '@text' || lower === 'text()') {
    return currentNodes.map((n) => ({ ...n, text: n.text }));
  }

  // @href — extract href attribute from element
  if (lower === '@href') {
    return currentNodes.map((n) => {
      if (n.kind === 'element') {
        const el = n.raw as any;
        const href = el?.attribs?.href ?? '';
        return { raw: href, kind: 'string' as const, text: href };
      }
      return { raw: '', kind: 'string' as const, text: '' };
    });
  }

  // @src
  if (lower === '@src') {
    return currentNodes.map((n) => {
      if (n.kind === 'element') {
        const el = n.raw as any;
        const src = el?.attribs?.src ?? '';
        return { raw: src, kind: 'string' as const, text: src };
      }
      return { raw: '', kind: 'string' as const, text: '' };
    });
  }

  // @html — serialize element to HTML
  if (lower === '@html' || lower === 'html()') {
    return currentNodes.map((n) => {
      const html = serializeElement(n.raw);
      return { raw: html, kind: 'string' as const, text: html };
    });
  }

  // @tag:xxx — get child tag content
  const tagMatch = lower.match(/^@tag:([a-zA-Z0-9_-]+)$/);
  if (tagMatch) {
    const tagName = tagMatch[1];
    return currentNodes.flatMap((n) => {
      if (n.kind === 'element') {
        const el = n.raw as any;
        const children = el?.children ?? [];
        const matches = children.filter(
          (c: any) => c?.name === tagName || c?.tagName === tagName,
        );
        return matches.map((c: any) => {
          const text = extractElementText(c);
          return { raw: c, kind: 'element' as const, text };
        });
      }
      return [];
    });
  }

  // Unknown text rule — pass through
  return currentNodes;
}

// ── Helpers ──

function extractTextFromNodes(ctx: ExecContext): string {
  // The initial content is the raw HTML
  return ctx.content;
}

function serializeElement(el: any): string {
  if (!el) return '';
  if (typeof el === 'string') return el;
  if (el.type === 'text') return el.data ?? '';
  if (el.type === 'tag') {
    const name = el.name || el.tagName || 'div';
    let html = `<${name}`;
    if (el.attribs) {
      for (const [k, v] of Object.entries(el.attribs)) {
        html += ` ${k}="${v}"`;
      }
    }
    html += '>';
    if (el.children) {
      for (const child of el.children) {
        html += serializeElement(child);
      }
    }
    html += `</${name}>`;
    return html;
  }
  return String(el);
}

// ── Item-scope rule execution ──

export type ScopeKind = 'html-element' | 'json-object' | 'text';

/**
 * Detect the scope kind of a raw element from executeRule results.
 * Used by extractSearchItems / extractChapterItems to decide how to run sub-rules.
 */
export function detectItemKind(el: unknown): ScopeKind {
  if (el === null || el === undefined) return 'text';
  if (typeof el === 'string') return 'text';
  if (typeof el === 'object') {
    // Cheerio element: has type/tagName/children/attribs properties
    const obj = el as Record<string, unknown>;
    if ('type' in obj && (obj.type === 'tag' || obj.type === 'text' || obj.type === 'script' || obj.type === 'comment')) {
      return 'html-element';
    }
    // HTML-like object from cheerio
    if ('tagName' in obj || ('attribs' in obj && 'children' in obj)) {
      return 'html-element';
    }
    // Plain JSON object
    return 'json-object';
  }
  return 'text';
}

export interface ScopeItem {
  /** The raw DOM element, JSON object, or string */
  raw: unknown;
  /** Type hint for the executor */
  kind: ScopeKind;
}

export interface ScopeRuleResult {
  /** Extracted text value (first result) */
  text: string | null;
  /** Duration in ms */
  duration: number;
  /** Error if any */
  error?: string;
}

/**
 * Execute a single rule on a scoped item (one search result, one chapter, etc.).
 *
 * This is the key Legado pattern: first extract a list of items from the full
 * page, then apply sub-rules to each individual item in its local scope.
 *
 * Handles three item kinds:
 *   - `html-element`: cheerio DOM element (sub-rules use CSS selectors in the element subtree)
 *   - `json-object`: a JSON object (sub-rules use JSONPath on the object)
 *   - `text`: a plain text string
 *
 * Sub-rules like `@text`, `@href`, `@html` act on the item itself, not on its children.
 */
export function executeRuleOnScope(
  ruleStr: string,
  item: ScopeItem,
  options: RuleExecuteOptions,
): ScopeRuleResult {
  const startTime = Date.now();

  try {
    if (!ruleStr || ruleStr.trim() === '') {
      return { text: null, duration: 0, error: 'empty_rule' };
    }

    // Resolve scoped pipeline: selector + optional getter
    const pipeline = resolveScopedPipeline(ruleStr);

    switch (item.kind) {
      case 'html-element': {
        return executeHtmlScopePipelined(pipeline, item.raw, options);
      }
      case 'json-object': {
        return executeJsonScopePipelined(pipeline, item.raw, options);
      }
      case 'text': {
        return executeTextScopePipelined(pipeline, item.raw, options);
      }
    }
  } catch (err) {
    return {
      text: null,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute a scoped pipeline on an HTML element.
 * Pipeline: optional CSS selector (find within scope element) → optional getter on result.
 */
function executeHtmlScopePipelined(
  pipeline: {
    selectorRule: string | null;
    getter: string | null;
    replaceRegex?: string;
    replacement?: string;
    replaceFirst?: boolean;
  },
  element: unknown,
  options: RuleExecuteOptions,
): ScopeRuleResult {
  const startTime = Date.now();

  try {
    const { selectorRule, getter, replaceRegex, replacement, replaceFirst } = pipeline;

    // Case 1: getter-only (self-acting on item): @href, @text, @src
    if (!selectorRule && getter) {
      const value = getElementAttribute(element, getter);
      const processed = applyReplace(value, replaceRegex, replacement, replaceFirst);
      return { text: processed || null, duration: Date.now() - startTime };
    }

    // Case 2: selector-only — find in scope, return text
    if (selectorRule && !getter) {
      // Detect mode: CSS, JSONPath, XPath
      const seg = parseSegment(selectorRule);
      if (seg.mode === 'css') {
        const el = element as any;
        const result = selectCss(options.content, seg.rule, [el]);
        if (result.elements.length > 0) {
          const firstText = result.textList[0] ?? '';
          const processed = applyReplace(firstText, replaceRegex, replacement, replaceFirst);
          return { text: processed || null, duration: Date.now() - startTime };
        }
        // Self-match fallback
        const elementHtml = serializeElement(el);
        const selfResult = selectCss(elementHtml, seg.rule);
        if (selfResult.elements.length > 0) {
          const firstText = selfResult.textList[0] ?? '';
          const processed = applyReplace(firstText, replaceRegex, replacement, replaceFirst);
          return { text: processed || null, duration: Date.now() - startTime };
        }
        return { text: null, duration: Date.now() - startTime };
      }
      if (seg.mode === 'jsonpath') {
        const text = getElementText(element);
        const result = selectJsonPath(text, seg.rule);
        const value = result.values[0] ?? '';
        const processed = applyReplace(
          value === null || value === undefined ? '' : String(value),
          replaceRegex, replacement, replaceFirst,
        );
        return { text: processed || null, duration: Date.now() - startTime };
      }
      if (seg.mode === 'xpath') {
        const html = serializeElement(element);
        const result = selectXPath(html, seg.rule);
        const value = result.values[0] ?? '';
        const processed = applyReplace(
          value === null || value === undefined ? '' : String(value),
          replaceRegex, replacement, replaceFirst,
        );
        return { text: processed || null, duration: Date.now() - startTime };
      }
      if (seg.mode === 'js') {
        return { text: null, duration: Date.now() - startTime, error: 'unsupported_rule_syntax: js in scope' };
      }
      return { text: null, duration: Date.now() - startTime };
    }

    // Case 3: selector + getter — find in scope, then extract attribute
    if (selectorRule && getter) {
      const seg = parseSegment(selectorRule);
      const el = element as any;

      if (seg.mode === 'css') {
        // Find element within scope
        const result = selectCss(options.content, seg.rule, [el]);

        if (result.elements.length > 0) {
          const value = getElementAttribute(result.elements[0], getter);
          const processed = applyReplace(value, replaceRegex, replacement, replaceFirst);
          return { text: processed || null, duration: Date.now() - startTime };
        }

        // Self-match fallback: if the scope element itself matches the selector
        const elementHtml = serializeElement(el);
        const selfResult = selectCss(elementHtml, seg.rule);
        if (selfResult.elements.length > 0) {
          const value = getElementAttribute(selfResult.elements[0], getter);
          const processed = applyReplace(value, replaceRegex, replacement, replaceFirst);
          return { text: processed || null, duration: Date.now() - startTime };
        }

        return { text: null, duration: Date.now() - startTime };
      }

      return { text: null, duration: Date.now() - startTime, error: 'unsupported_rule_syntax: non-css selector + getter' };
    }

    return { text: null, duration: Date.now() - startTime };
  } catch (err) {
    return {
      text: null,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Parse a sub-rule string to detect its mode and rule content.
 * Handles: @text, @href, @src, @html, @outerHtml, @val, .selector@text, $jsonpath, //xpath, etc.
 */
function detectScopeRule(ruleStr: string): {
  mode: SelectorMode;
  rule: string;
  replaceRegex?: string;
  replacement?: string;
  replaceFirst?: boolean;
} {
  const trimmed = ruleStr.trim();

  // Pure text getters that act on the item itself
  if (/^@(text|html|outerHtml|href|src|val)$/i.test(trimmed)) {
    return { mode: 'text', rule: trimmed.toLowerCase() };
  }

  // Parse with the existing segment parser to get mode detection
  const segment = parseSegment(trimmed);

  return {
    mode: segment.mode,
    rule: segment.rule,
    replaceRegex: segment.replaceRegex,
    replacement: segment.replacement,
    replaceFirst: segment.replaceFirst,
  };
}

/**
 * Recognised attribute getters that can follow a CSS selector via @.
 */
const SCOPE_GETTERS = ['@text', '@href', '@src', '@html', '@outerhtml', '@val'];

/**
 * Split a scope rule like `.name@href` into `{ selectorRule, getter }`.
 *
 * Only splits on the LAST `@getter` suffix — does NOT split on:
 *   - `@@` (Legado element boundary)
 *   - `@js:`, `@css:`, `@XPath:`, `@json:` (explicit mode prefixes)
 *   - `@` inside CSS attribute selectors like `a[href*="@"]`
 *   - `##...##` replacement patterns before the @
 */
function resolveScopedPipeline(ruleStr: string): {
  selectorRule: string | null;
  getter: string | null;
  replaceRegex?: string;
  replacement?: string;
  replaceFirst?: boolean;
} {
  const trimmed = ruleStr.trim();

  // Only-getter rules (self-acting on item): @href, @text, @src, @html
  if (/^@(text|html|outerHtml|href|src|val)$/i.test(trimmed)) {
    return { selectorRule: null, getter: trimmed.slice(1).toLowerCase() };
  }

  // Extract ##replace## suffix first (it comes AFTER the getter in Legado)
  let replaceRegex: string | undefined;
  let replacement: string | undefined;
  let replaceFirst: boolean | undefined;
  let working = trimmed;

  const REPLACE_SUFFIX = /##(.+?)##(.+?)(?:##(first?))?##?$/;
  const repMatch = working.match(REPLACE_SUFFIX);
  if (repMatch) {
    replaceRegex = repMatch[1];
    replacement = repMatch[2];
    replaceFirst = repMatch[3] === 'first';
    working = working.replace(REPLACE_SUFFIX, '').trim();
  }

  // Find the LAST @ that starts a recognised getter
  for (let i = working.length - 1; i >= 1; i--) {
    if (working[i] === '@') {
      // Check that preceding char is not @ (avoid @@)
      if (working[i - 1] === '@') continue;

      const suffix = working.slice(i).toLowerCase();
      const matchedGetter = SCOPE_GETTERS.find(g => suffix === g);
      if (matchedGetter) {
        const selectorPart = working.slice(0, i).trim();
        if (selectorPart.length === 0) {
          return { selectorRule: null, getter: matchedGetter.slice(1), replaceRegex, replacement, replaceFirst };
        }
        // Validate: the selector part must not be a mode prefix
        if (!/^@(js|css|XPath|json):/i.test(selectorPart)) {
          return { selectorRule: selectorPart, getter: matchedGetter.slice(1), replaceRegex, replacement, replaceFirst };
        }
      }
      // If it's not a recognised getter, stop — this is not a scoped pipeline
      break;
    }
  }

  // No getter found — the whole rule is a selector
  return { selectorRule: working || null, getter: null, replaceRegex, replacement, replaceFirst };
}

/**
 * Execute a rule in the scope of a single HTML element.
 */
function executeHtmlScope(
  rawRuleStr: string,
  mode: SelectorMode,
  rule: string,
  replaceRegex: string | undefined,
  replacement: string | undefined,
  replaceFirst: boolean | undefined,
  element: unknown,
  options: RuleExecuteOptions,
): ScopeRuleResult {
  const startTime = Date.now();

  try {
    // For text-mode getters, operate on the element itself
    if (mode === 'text') {
      const value = getElementAttribute(element, rule);
      const processed = applyReplace(value, replaceRegex, replacement, replaceFirst);
      return { text: processed || null, duration: Date.now() - startTime };
    }

    // For CSS rules: execute on the element's scope
    // The element is a cheerio node — we use it as scope for selectCss
    if (mode === 'css') {
      const el = element as any;
      const elementHtml = serializeElement(el);

      // Try selectors within the element's scope
      const result = selectCss(options.content, rule, [el as any]);

      if (result.elements.length > 0) {
        const firstText = result.textList[0] ?? '';
        const processed = applyReplace(firstText, replaceRegex, replacement, replaceFirst);
        return { text: processed || null, duration: Date.now() - startTime };
      }

      // Try self-match: if the element itself matches the selector
      // build a mini document with just this element
      const selfResult = selectCss(elementHtml, rule);
      if (selfResult.elements.length > 0) {
        const firstText = selfResult.textList[0] ?? '';
        const processed = applyReplace(firstText, replaceRegex, replacement, replaceFirst);
        return { text: processed || null, duration: Date.now() - startTime };
      }

      return { text: null, duration: Date.now() - startTime };
    }

    // For JSONPath: operate on element text
    if (mode === 'jsonpath') {
      const text = getElementText(element);
      const result = selectJsonPath(text, rule);
      const value = result.values[0] ?? '';
      const processed = applyReplace(
        value === null || value === undefined ? '' : String(value),
        replaceRegex, replacement, replaceFirst,
      );
      return { text: processed || null, duration: Date.now() - startTime };
    }

    // For XPath: serialize to HTML then run XPath
    if (mode === 'xpath') {
      const html = serializeElement(element);
      const result = selectXPath(html, rule);
      const value = result.values[0] ?? '';
      const processed = applyReplace(
        value === null || value === undefined ? '' : String(value),
        replaceRegex, replacement, replaceFirst,
      );
      return { text: processed || null, duration: Date.now() - startTime };
    }

    // For JS: run in sandbox
    if (mode === 'js') {
      return {
        text: null,
        duration: Date.now() - startTime,
        error: 'unsupported_rule_syntax: js in scope',
      };
    }

    return { text: null, duration: Date.now() - startTime };
  } catch (err) {
    return {
      text: null,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute a scoped pipeline on a JSON object.
 * Pipeline: optional JSONPath selector → optional getter.
 */
function executeJsonScopePipelined(
  pipeline: {
    selectorRule: string | null;
    getter: string | null;
  },
  item: unknown,
  _options: RuleExecuteOptions,
): ScopeRuleResult {
  const startTime = Date.now();

  try {
    const jsonStr = typeof item === 'string' ? item : JSON.stringify(item);
    const { selectorRule, getter } = pipeline;

    // Case 1: getter-only on JSON — @href/@src try url-like keys, @text returns JSON string
    if (!selectorRule && getter) {
      if (getter === 'text' || getter === 'html') {
        return { text: jsonStr, duration: Date.now() - startTime };
      }
      // @href / @src for url-like properties
      if ((getter === 'href' || getter === 'src') && typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const url = obj['url'] || obj['bookUrl'] || obj['href'] || obj['src'];
        return { text: url ? String(url) : null, duration: Date.now() - startTime };
      }
      return { text: null, duration: Date.now() - startTime };
    }

    // Case 2: selector-only
    if (selectorRule && !getter) {
      // Normalize shorthand field names: name → $.name, url → $.url, author → $.author
      let ruleToUse = selectorRule;
      if (typeof item === 'object' && item !== null && !selectorRule.startsWith('$') && !selectorRule.startsWith('/')) {
        // Simple field name without JSONPath prefix — try as property access
        const obj = item as Record<string, unknown>;
        if (selectorRule in obj) {
          return { text: String(obj[selectorRule]), duration: Date.now() - startTime };
        }
        // Auto-prefix common shorthand patterns
        if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(selectorRule)) {
          ruleToUse = '$.' + selectorRule;
        }
      }

      // Execute JSONPath
      const result = selectJsonPath(jsonStr, ruleToUse);
      const value = result.values[0];
      return {
        text: value === null || value === undefined ? null : String(value),
        duration: Date.now() - startTime,
      };
    }

    // Case 3: selector + getter on JSON is rare — not supported
    if (selectorRule && getter) {
      return { text: null, duration: Date.now() - startTime, error: 'unsupported_rule_syntax: selector+getter on json' };
    }

    return { text: null, duration: Date.now() - startTime };
  } catch (err) {
    return {
      text: null,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Execute a scoped pipeline on a plain text item.
 */
function executeTextScopePipelined(
  pipeline: {
    selectorRule: string | null;
    getter: string | null;
    replaceRegex?: string;
    replacement?: string;
    replaceFirst?: boolean;
  },
  text: unknown,
  _options: RuleExecuteOptions,
): ScopeRuleResult {
  const startTime = Date.now();
  const str = typeof text === 'string' ? text : String(text);
  const { selectorRule, getter, replaceRegex, replacement, replaceFirst } = pipeline;

  try {
    // getter-only: @text returns whole string, @href/@src are not applicable
    if (!selectorRule && getter) {
      if (getter === 'text' || getter === 'html') {
        const processed = applyReplace(str, replaceRegex, replacement, replaceFirst);
        return { text: processed || null, duration: Date.now() - startTime };
      }
      return { text: null, duration: Date.now() - startTime };
    }

    // selector-only or both: just return processed text
    const processed = applyReplace(str, replaceRegex, replacement, replaceFirst);
    return { text: processed || null, duration: Date.now() - startTime };
  } catch (err) {
    return {
      text: null,
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Attribute / text extraction helpers ──

function getElementAttribute(element: unknown, getter: string): string {
  const el = element as any;
  if (!el || typeof el !== 'object') return '';

  const g = getter.toLowerCase().replace(/^@/, '');
  switch (g) {
    case 'text':
      return getElementText(el);
    case 'html':
    case 'outerhtml':
      return serializeElement(el);
    case 'href':
      return el?.attribs?.href ?? '';
    case 'src':
      return el?.attribs?.src ?? '';
    case 'val':
      return el?.attribs?.value ?? '';
    default:
      return getElementText(el);
  }
}

function getElementText(element: unknown): string {
  const el = element as any;
  if (!el || typeof el !== 'object') return '';
  if (el.type === 'text' || el.type === 'script' || el.type === 'comment') {
    return el.data ?? '';
  }
  if (el.type === 'tag') {
    if (el.children && Array.isArray(el.children)) {
      return el.children.map((child: any) => getElementText(child)).join('');
    }
    if (el.attribs) {
      return el.attribs.title || el.attribs.alt || '';
    }
  }
  if (typeof el === 'object' && 'data' in el) return String(el.data);
  return String(el);
}

function applyReplace(
  text: string,
  pattern?: string,
  replacement?: string,
  firstOnly?: boolean,
): string {
  if (!pattern || replacement === undefined) return text;
  try {
    const re = new RegExp(pattern, firstOnly ? '' : 'g');
    return text.replace(re, replacement);
  } catch {
    return text;
  }
}
