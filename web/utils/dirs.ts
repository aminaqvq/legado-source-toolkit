/** Normalize a directory path for frontend display.
 *  Converts absolute paths like `D:\\project\\output` → `output`.
 *  Keeps relative paths like `output-verify` as-is. */
export function normalizeDisplayDir(value: string): string {
  if (!value || typeof value !== 'string') return '';
  // Already a clean relative name like "output" or "output-verify"
  if (/^output[\w-]*$/.test(value)) return value;
  // Strip drive letters and absolute prefixes
  let cleaned = value.replace(/\\/g, '/');
  // Remove leading drive letter / absolute prefix
  cleaned = cleaned.replace(/^[A-Za-z]:\//, '').replace(/^\/+/, '');
  // Find the first "output" segment
  const parts = cleaned.split('/');
  for (const part of parts) {
    if (/^output/.test(part) && part.length <= 80) return part;
  }
  // Fallback: return the last segment if it looks reasonable
  const last = parts[parts.length - 1];
  if (last && !last.startsWith('.') && last.length <= 80) return last;
  return '';
}

/** Normalize a directory for API calls — same as display normalization. */
export function normalizeApiDir(value: string): string {
  return normalizeDisplayDir(value);
}

/** Check if a value looks like an absolute path. */
export function isAbsoluteDir(value: string): boolean {
  if (!value) return false;
  return /^[A-Za-z]:[\\/]/.test(value) || /^\//.test(value);
}

/** Validate that a result directory name is acceptable. */
export function isValidResultDir(value: string): boolean {
  return /^output[\w-]*$/.test(value) && value.length <= 80;
}
