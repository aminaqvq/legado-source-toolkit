/**
 * JSONPath selector executor.
 *
 * Uses `jsonpath-plus` to evaluate JSONPath expressions
 * against JSON data. Supports `$.` and `$[` style paths.
 */

import { JSONPath } from 'jsonpath-plus';

export interface JsonPathSelectResult {
  /** The matched values */
  values: unknown[];
  /** String representation of matched values */
  textList: string[];
}

/**
 * Execute a JSONPath expression against JSON data.
 *
 * @param data - The JSON string or parsed object
 * @param path  - JSONPath expression (e.g. `$.store.book`, `$..author`)
 */
export function selectJsonPath(
  data: string | unknown,
  path: string,
): JsonPathSelectResult {
  const parsed = typeof data === 'string' ? tryParseJson(data) : data;
  if (parsed === undefined) {
    return { values: [], textList: [] };
  }

  const values = JSONPath({ path, json: parsed }) as unknown[];
  const textList = values.map((v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });

  return { values, textList };
}

/**
 * Get a single string from the first JSONPath match.
 */
export function selectJsonPathFirst(
  data: string | unknown,
  path: string,
): string | null {
  const result = selectJsonPath(data, path);
  return result.textList[0] ?? null;
}

/**
 * Safely parse JSON, returning undefined on failure.
 */
function tryParseJson(s: string): unknown | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
