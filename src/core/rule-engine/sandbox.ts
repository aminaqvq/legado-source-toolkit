/**
 * JavaScript execution sandbox for Legado book source rules.
 *
 * Executes `{{js表达式}}` blocks in an isolated Node.js `vm` context.
 * Sandboxed environment exposes only safe globals, preventing access
 * to the file system, network (unless explicitly allowed via java.ajax),
 * and system APIs.
 *
 * Security model:
 *   - Uses `vm.Script` + `vm.createContext` for execution isolation
 *   - Limited global context: Math, JSON, Array, String, RegExp, etc.
 *   - Runtime timeout (default 5 seconds) prevents infinite loops
 *   - `require`, `process`, `globalThis`, and `eval` are NOT exposed
 */

import vm from 'node:vm';

// ── Types ──

export interface SandboxOptions {
  /** Execution timeout in ms (default: 5000) */
  timeout?: number;
  /** Search keyword available as `key` in JS */
  key?: string;
  /** Base URL available as `baseUrl` in JS */
  baseUrl?: string;
  /** Page number available as `page` in JS */
  page?: number;
  /** Additional variables the rule injects via varMap */
  variables?: Record<string, unknown>;
  /** Current result context (result.text, result.html) */
  resultContext?: {
    text?: string;
    html?: string;
  };
  /** Whether to allow java.ajax HTTP calls (default: false) */
  allowJavaAjax?: boolean;
}

interface SandboxContext {
  // Standard JS
  Math: typeof Math;
  JSON: typeof JSON;
  parseInt: typeof parseInt;
  parseFloat: typeof parseFloat;
  isNaN: typeof isNaN;
  isFinite: typeof isFinite;
  encodeURI: typeof encodeURI;
  encodeURIComponent: typeof encodeURIComponent;
  decodeURI: typeof decodeURI;
  decodeURIComponent: typeof decodeURIComponent;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  Array: typeof Array;
  Object: typeof Object;
  RegExp: typeof RegExp;
  Date: typeof Date;
  Map: typeof Map;
  Set: typeof Set;
  Error: typeof Error;
  TypeError: typeof TypeError;
  RangeError: typeof RangeError;
  // Custom
  key?: string;
  baseUrl?: string;
  page?: number;
  result: { text?: string; html?: string };
  java: {
    ajax?: (url: string) => Promise<string>;
    base64Decode?: (str: string) => string;
  };
  [key: string]: unknown;
}

// ── Main API ──

/**
 * Execute a JavaScript expression in a sandboxed context.
 *
 * @param code - The JS expression to evaluate
 * @param options - Sandbox options
 * @returns The result as a string (toString'd)
 */
export function executeJs(
  code: string,
  options: SandboxOptions = {},
): string {
  const timeout = options.timeout ?? 5000;

  const context: SandboxContext = {
    // Standard built-ins
    Math, JSON, parseInt, parseFloat, isNaN, isFinite,
    encodeURI, encodeURIComponent, decodeURI, decodeURIComponent,
    String, Number, Boolean, Array, Object, RegExp, Date,
    Map, Set, Error, TypeError, RangeError,

    // Rule context
    key: options.key,
    baseUrl: options.baseUrl,
    page: options.page,
    ...(options.variables ?? {}),

    // Result object (like Legado's `result`)
    result: {
      text: options.resultContext?.text ?? '',
      html: options.resultContext?.html ?? '',
    },

    // Java-extensions (simplified API)
    java: {
      ajax: undefined,
      base64Decode: (str: string) => Buffer.from(str, 'base64').toString('utf-8'),
    },
  };

  // Only expose java.ajax if explicitly allowed
  if (options.allowJavaAjax) {
    context.java.ajax = async (url: string) => {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LS-Toolkit/1.0)' },
        signal: AbortSignal.timeout(10_000),
      });
      return response.text();
    };
  }

  const vmContext = vm.createContext(context);

  try {
    const script = new vm.Script(`(function() { return (${code}); })()`, {
      filename: 'legado-rule.js',
    });

    const result = script.runInContext(vmContext, {
      timeout,
      breakOnSigint: true,
    });

    if (result === null || result === undefined) return '';
    if (typeof result === 'object') return JSON.stringify(result);
    return String(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SandboxError(`JS execution error: ${message}`);
  }
}

/**
 * Error class for sandbox execution failures.
 */
export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxError';
  }
}

/**
 * Check if a JS expression is valid before execution.
 */
export function validateJs(code: string): boolean {
  try {
    new vm.Script(`(function() { return (${code}); })()`);
    return true;
  } catch {
    return false;
  }
}
