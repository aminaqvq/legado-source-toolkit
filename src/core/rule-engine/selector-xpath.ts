/**
 * XPath selector executor.
 *
 * Uses `xpath` + `xmldom` to evaluate XPath expressions
 * against HTML/XML documents.
 */

import { select as xpathSelect, useNamespaces } from 'xpath';
import { DOMParser } from 'xmldom';

export interface XPathSelectResult {
  /** The matched nodes */
  values: unknown[];
  /** String representation of matched values */
  textList: string[];
}

/**
 * Execute an XPath expression against HTML/XML content.
 *
 * @param content - HTML or XML string
 * @param expression - XPath expression (e.g. `//div[@class='book']`)
 */
export function selectXPath(
  content: string,
  expression: string,
): XPathSelectResult {
  const doc = tryParseHtml(content);
  if (!doc) {
    return { values: [], textList: [] };
  }

  try {
    const nodes = xpathSelect(expression, doc) as unknown[];
    const textList = nodes.map((n) => {
      if (n === null || n === undefined) return '';
      if (typeof n === 'object' && 'toString' in (n as object)) {
        return (n as { toString: () => string }).toString();
      }
      return String(n);
    });

    return { values: nodes, textList };
  } catch {
    return { values: [], textList: [] };
  }
}

/**
 * Get a single string from the first XPath match.
 */
export function selectXPathFirst(
  content: string,
  expression: string,
): string | null {
  const result = selectXPath(content, expression);
  return result.textList[0] ?? null;
}

/**
 * Parse HTML/XML with auto-repair for common partial-document patterns.
 */
function tryParseHtml(html: string): Document | null {
  let processed = html;

  // Auto-repair: wrap table fragments
  if (processed.includes('</td>') && !processed.includes('<table')) {
    processed = `<tr>${processed}</tr>`;
  }
  if (processed.includes('</tr>') && !processed.includes('<table')) {
    processed = `<table>${processed}</table>`;
  }

  try {
    const parser = new DOMParser({
      errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
    });
    return parser.parseFromString(processed);
  } catch {
    return null;
  }
}
