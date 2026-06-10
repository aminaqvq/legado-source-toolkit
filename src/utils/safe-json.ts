/**
 * Safely parse a JSON string, returning a fallback on failure.
 */
export function safeParseJson<T>(text: string, fallback: T): T;
export function safeParseJson<T>(text: string): T | null;
export function safeParseJson<T>(text: string, fallback?: T): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback ?? null;
  }
}

/**
 * Sanitize headers for display: mask sensitive values.
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitive = /^(cookie|authorization|token|x-auth-token|x-api-key|set-cookie)$/i;
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (sensitive.test(key)) {
      sanitized[key] = `${value.substring(0, 6)}***[REDACTED]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Parse the `header` field from a book source (JSON string → object).
 */
export function parseHeaderField(headerStr?: string): Record<string, string> {
  if (!headerStr) return {};
  const parsed = safeParseJson<Record<string, string>>(headerStr);
  return parsed ?? {};
}
