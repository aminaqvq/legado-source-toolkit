/**
 * Regex selector / replacer.
 *
 * Handles:
 *   - `##pattern##replacement##` replacement
 *   - `##pattern##replacement##first##` (replace only first occurrence)
 *   - Direct regex extraction (rules that look like regex patterns)
 */

export interface RegexResult {
  text: string;
  list: string[];
}

/**
 * Apply a regex replacement to the input text.
 * Supports Legado's `##pattern##replacement##` format.
 *
 * @param input - The text to process
 * @param pattern - The regex pattern (as string, without // delimiters)
 * @param replacement - The replacement text
 * @param replaceFirst - Only replace first occurrence (default: false = replace all)
 */
export function regexReplace(
  input: string,
  pattern: string,
  replacement: string,
  replaceFirst = false,
): RegexResult {
  try {
    const flags = replaceFirst ? '' : 'g';
    const regex = new RegExp(pattern, flags);
    const text = input.replace(regex, replacement);

    return { text, list: [text] };
  } catch {
    // If regex is invalid, return input unchanged
    return { text: input, list: [input] };
  }
}

/**
 * Extract regex groups from input.
 * Like Legado's `AnalyzeByRegex.getElement()` — applies multiple
 * regex patterns sequentially.
 *
 * @param input - The text to match against
 * @param patterns - Array of regex patterns
 * @param groupIndex - Which capture group to extract (default 0 = full match)
 */
export function regexExtract(
  input: string,
  patterns: string[],
  groupIndex = 0,
): string[] {
  let currentText = input;
  const results: string[] = [];

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'g');
      let match: RegExpExecArray | null;
      const extracted: string[] = [];

      while ((match = regex.exec(currentText)) !== null) {
        const value = match[groupIndex] ?? match[0];
        extracted.push(value);
      }

      if (extracted.length > 0) {
        currentText = extracted.join('\n');
      } else {
        return [];
      }
    } catch {
      return [];
    }
  }

  return currentText.split('\n').filter(Boolean);
}

/**
 * Check if a rule string contains a regex replacement pattern.
 */
export function hasReplacePattern(rule: string): boolean {
  return /##.+?##.+?(?:##first?)?##?$/.test(rule);
}

/**
 * Extract replacement parts from a rule string.
 * Returns null if no pattern found.
 */
export function parseReplacePattern(
  rule: string,
): { pattern: string; replacement: string; replaceFirst: boolean } | null {
  const match = rule.match(/##(.+?)##(.+?)(?:##(first?))?##?$/);
  if (!match) return null;

  return {
    pattern: match[1],
    replacement: match[2],
    replaceFirst: match[3] === 'first',
  };
}
