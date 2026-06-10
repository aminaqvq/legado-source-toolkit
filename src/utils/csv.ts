import type { DuplicateGroup, SourceAnalysis } from '../types/analysis.js';

/**
 * Escape a CSV field: wrap in quotes, escape inner quotes,
 * and prefix formula-triggering characters ('=', '+', '-', '@') with a single quote.
 */
function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  // Protect against CSV formula injection
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * CSV header row for source analysis.
 */
const SOURCE_CSV_HEADER = [
  'index', 'originalName', 'cleanedName', 'originalGroup', 'inferredGroup',
  'bookSourceType', 'bookSourceUrl', 'normalizedHost', 'availability',
  'validationReason', 'score', 'kept', 'removedReason',
].join(',');

/**
 * Generate CSV for sources.
 */
export function generateSourcesCsv(analyses: SourceAnalysis[]): string {
  const rows = analyses.map((a) =>
    [
      a.index,
      escapeCsv(a.originalName),
      escapeCsv(a.cleanedName),
      escapeCsv(a.originalGroup),
      escapeCsv(a.inferredGroup),
      a.originalType,
      escapeCsv(a.normalizedUrl),
      escapeCsv(a.normalizedHost),
      a.availability,
      escapeCsv(a.validationReason.join('; ')),
      a.score,
      a.kept ? 'yes' : 'no',
      escapeCsv(a.removedReason),
    ].join(','),
  );
  return [SOURCE_CSV_HEADER, ...rows].join('\n');
}

/**
 * CSV header row for duplicates.
 */
const DUP_CSV_HEADER = [
  'groupId', 'groupKey', 'keptIndex', 'removedIndices', 'reason',
].join(',');

/**
 * Generate CSV for duplicate groups.
 */
export function generateDuplicatesCsv(groups: DuplicateGroup[]): string {
  const rows = groups.map((g) =>
    [
      g.groupId,
      escapeCsv(g.groupKey),
      g.keptIndex,
      escapeCsv(g.removedIndices.join('; ')),
      escapeCsv(g.reason),
    ].join(','),
  );
  return [DUP_CSV_HEADER, ...rows].join('\n');
}

/**
 * CSV header row for invalid / problematic sources.
 */
const INVALID_CSV_HEADER = [
  'index', 'originalName', 'cleanedName', 'availability', 'validationReason',
  'score', 'warnings',
].join(',');

/**
 * Generate CSV for invalid sources.
 */
export function generateInvalidCsv(analyses: SourceAnalysis[]): string {
  const invalid = analyses.filter(
    (a) =>
      a.availability === 'dead' ||
      a.availability === 'invalid' ||
      a.availability === 'timeout' ||
      a.availability === 'forbidden',
  );
  const rows = invalid.map((a) =>
    [
      a.index,
      escapeCsv(a.originalName),
      escapeCsv(a.cleanedName),
      a.availability,
      escapeCsv(a.validationReason.join('; ')),
      a.score,
      escapeCsv(a.warnings.join('; ')),
    ].join(','),
  );
  return [INVALID_CSV_HEADER, ...rows].join('\n');
}
