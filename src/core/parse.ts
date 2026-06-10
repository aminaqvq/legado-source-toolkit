import type { BookSource } from '../types/book-source.js';
import type { SourceAnalysis } from '../types/analysis.js';
import { BookSourceArraySchema } from './schema.js';
import { readJsonFile } from '../utils/fs.js';
import { warn } from '../utils/logger.js';

/**
 * Read book sources from a JSON file and validate structure.
 * Returns parsed sources + initial analyses.
 */
export function readBookSources(filePath: string): {
  sources: BookSource[];
  analyses: SourceAnalysis[];
} {
  const raw = readJsonFile<unknown>(filePath);

  if (!Array.isArray(raw)) {
    throw new Error(
      `Input file "${filePath}" must contain a JSON array. ` +
      `Found type: ${typeof raw}`,
    );
  }

  const result = BookSourceArraySchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues;
    warn(`Schema validation found ${issues.length} issue(s). Sources will still be processed but may have missing fields.`);
    // Fall through — we still process the raw array
  }

  const sources: BookSource[] = [];
  const analyses: SourceAnalysis[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];

    // Try to parse as BookSource via schema; fall back to casting
    let source: BookSource;
    if (result.success) {
      source = result.data[i] as BookSource;
    } else {
      source = item as BookSource;
    }

    sources.push(source);

    analyses.push(createInitialAnalysis(source, i));
  }

  return { sources, analyses };
}

/**
 * Create the initial SourceAnalysis skeleton for one source.
 */
function createInitialAnalysis(source: BookSource, index: number): SourceAnalysis {
  return {
    index,
    originalName: source.bookSourceName ?? '',
    cleanedName: '',
    cleanNameSteps: [],
    originalGroup: source.bookSourceGroup ?? '',
    finalGroup: source.bookSourceGroup ?? '',
    groupChangeReason: '',
    inferredGroup: '其他',
    originalType: source.bookSourceType ?? -1,
    originalUrl: source.bookSourceUrl ?? '',
    normalizedUrl: null,
    normalizedHost: null,
    urlStatus: 'INVALID_URL',
    urlWarnings: [],
    validationStatus: 'STRUCTURE_OK',
    validationReason: [],
    connectivityStatus: 'NOT_CHECKED',
    connectivityDetail: '',
    measuredRespondTime: null,
    searchStatus: 'NOT_CHECKED',
    searchDetail: '',
    headerStatus: 'none',
    loginRelated: false,
    loginStatus: 'none',
    availability: 'unknown',
    duplicateKey: '',
    duplicateGroupId: null,
    kept: true,
    removedReason: null,
    score: 0,
    scoreBreakdown: {},
    classificationConfidence: 'low',
    classificationTags: [],
    classificationSignals: {
      fromType: null,
      fromName: [],
      fromGroup: null,
      fromRules: [],
      finalCategory: '其他',
      confidence: 'low',
      conflictTags: [],
    },
    warnings: [],
    risks: [],
    processedAt: new Date().toISOString(),
  };
}
