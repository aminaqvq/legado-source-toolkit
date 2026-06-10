import type {
  AvailabilityStatus,
  CategoryLabel,
  ClassificationConfidence,
  ConnectivityStatus,
  DedupeLevel,
  GroupMode,
  NameMode,
  SearchStatus,
  UrlStatus,
  ValidationStatus,
} from './book-source.js';

// ── Per-source analysis ──

export interface ClassificationSignal {
  fromType: string | null;
  fromName: string[];
  fromGroup: string | null;
  fromRules: string[];
  finalCategory: CategoryLabel;
  confidence: ClassificationConfidence;
  conflictTags: string[];
}

export interface SourceAnalysis {
  /** 0-based index in the ORIGINAL input array (never changes) */
  index: number;

  /** Original bookSourceName as-is */
  originalName: string;

  /** Name after cleaning */
  cleanedName: string;

  /** Name cleaning steps for audit */
  cleanNameSteps: CleanNameStep[];

  /** Original bookSourceGroup */
  originalGroup: string;

  /** Final bookSourceGroup after group-mode application */
  finalGroup: string;
  groupChangeReason: string;

  /** Inferred / corrected category */
  inferredGroup: CategoryLabel;

  /** Original bookSourceType */
  originalType: number;

  /** Original bookSourceUrl */
  originalUrl: string;

  /** Normalized bookSourceUrl */
  normalizedUrl: string | null;

  /** Normalized host (no www/m/wap prefix) */
  normalizedHost: string | null;

  /** URL status after cleaning */
  urlStatus: UrlStatus;

  urlWarnings: string[];

  /** Structural validation */
  validationStatus: ValidationStatus;
  validationReason: string[];

  /** Connectivity check result */
  connectivityStatus: ConnectivityStatus;
  connectivityDetail: string;

  /** Measured respond time from this run (null if not checked) */
  measuredRespondTime: number | null;

  /** Search check result */
  searchStatus: SearchStatus;
  searchDetail: string;

  /** Header parsing status */
  headerStatus: 'none' | 'parsed' | 'invalid';

  /** Login-related fields */
  loginRelated: boolean;
  loginStatus: 'none' | 'loginRelated' | 'needsLogin' | 'loginMaybeRequired';

  /** Final availability */
  availability: AvailabilityStatus;

  /** Deduplication info */
  duplicateKey: string;
  duplicateGroupId: number | null;
  kept: boolean;
  removedReason: string | null;

  /** Quality score */
  score: number;
  scoreBreakdown: Record<string, number>;

  /** Classification */
  classificationConfidence: ClassificationConfidence;
  classificationTags: string[];
  classificationSignals: ClassificationSignal;

  /** Warnings collected during processing */
  warnings: string[];

  /** Risks collected during processing */
  risks: string[];

  /** Timestamp */
  processedAt: string;
}

export interface CleanNameStep {
  reason: string;
  from: string;
  to: string;
}

// ── Deduplication ──

export interface FieldDiffSummary {
  typeConflict: boolean;
  categoryConflict: boolean;
  ruleDifferences: string[];
  freshnessComparison: string;
  respondTimeComparison: string;
  whyKept: string;
  whyRemoved: string;
}

export interface DuplicateGroup {
  groupId: number;
  /** Normalized key that grouped these sources */
  groupKey: string;
  /** The analysis index that was kept (in original array) */
  keptIndex: number;
  /** Indices that were removed */
  removedIndices: number[];
  reason: string;
  scoreBreakdown: Record<string, number>;
  /** Expanded detail for audit */
  keptName?: string;
  removedNames?: string[];
  scoreDiffs?: number[];
  fieldDiffSummaries?: FieldDiffSummary[];
}

// ── Summary report ──

export interface ZoneStats {
  total: number;
  categoryCounts: Record<string, number>;
  availabilityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface ProcessSummary {
  generatedAt: string;

  input: ZoneStats & {
    averageRespondTime: number;
  };

  output: ZoneStats & {
    averageRespondTime: number;
    measuredAverageRespondTime: number | null;
  };

  removed: {
    duplicateCount: number;
    unavailableCount: number;
    riskyCount: number;
  };

  validation: {
    okCount: number;
    warnCount: number;
    invalidCount: number;
  };
}

// ── Full process report ──

export interface ProcessReport {
  summary: ProcessSummary;
  sources: SourceAnalysis[];
  duplicates: DuplicateGroup[];
}

// ── Process options ──

export interface ProcessOptions {
  inputPath: string;
  outDir: string;

  online: boolean;
  dedupeLevel: DedupeLevel;
  groupMode: GroupMode;
  nameMode: NameMode;
  concurrency: number;
  timeout: number;
  retry: number;

  dryRun: boolean;
  writeMeta: boolean;
  outputFormat: 'pretty' | 'minified';
  keepDisabled: boolean;
  onlyEnabled: boolean;
  includeNonHttp: boolean;
  keepLatinWhenNeeded: boolean;

  // New safety options
  allowRiskyDedupe: boolean;
  includeUnknown: boolean;
  includeComplex: boolean;
  includeUnavailable: boolean;
  writeNormalizedUrl: boolean;
  strict: boolean;
}
