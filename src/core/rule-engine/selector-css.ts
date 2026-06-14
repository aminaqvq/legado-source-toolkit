/**
 * CSS (Jsoup-style) selector executor.
 *
 * Uses `cheerio` to parse HTML and execute CSS selectors.
 * Returns a list of elements and a default text representation.
 */

import * as cheerio from 'cheerio';

// Cheerio's Element type — `any` avoids version-dependent imports
export type CheerioElement = any;

export interface CssSelectResult {
  /** Raw cheerio elements (for pipeline chaining) */
  elements: CheerioElement[];
  /** Default text content of each element */
  textList: string[];
  /** Default HTML of each element */
  htmlList: string[];
  /** The CheerioAPI instance (for further use) */
  $: ReturnType<typeof cheerio.load>;
}

/**
 * Execute a CSS selector against HTML content.
 * Optionally scope to a list of parent elements.
 */
export function selectCss(
  html: string,
  selector: string,
  scopeElements?: CheerioElement[],
): CssSelectResult {
  const $ = cheerio.load(html);

  let $selected: ReturnType<typeof $>;

  if (scopeElements && scopeElements.length > 0) {
    const results: CheerioElement[] = [];
    for (const el of scopeElements) {
      $(el).find(selector).each((_, found) => {
        results.push(found as CheerioElement);
      });
    }
    $selected = $(results);
  } else {
    $selected = $(selector);
  }

  const elements = $selected.toArray() as CheerioElement[];
  const textList = elements.map((el) => $(el).text());
  const htmlList = elements.map((el) => $(el).html() ?? '');

  return { elements, textList, htmlList, $ };
}

/**
 * Get a single string from the first matching element.
 */
export function selectFirstText(html: string, selector: string): string | null {
  const result = selectCss(html, selector);
  return result.textList[0] ?? null;
}

/**
 * Get all text from matching elements.
 */
export function selectAllText(html: string, selector: string): string[] {
  return selectCss(html, selector).textList;
}
