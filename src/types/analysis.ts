import type {
  AvailabilityStatus,
  BatchValidationMode,
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
  index: number;
  originalName: string;
  cleanedName: string;
  cleanNameSteps: CleanNameStep[];
  originalGroup: string;
  finalGroup: string;
  groupChangeReason: string;
  inferredGroup: CategoryLabel;
  originalType: number;
  originalUrl: string;
  normalizedUrl: string | null;
  normalizedHost: string | null;
  urlStatus: UrlStatus;
  urlWarnings: string[];
  validationStatus: ValidationStatus;
  validationReason: string[];
  connectivityStatus: ConnectivityStatus;
  connectivityDetail: string;
  measuredRespondTime: number | null;
  searchStatus: SearchStatus;
  searchDetail: string;
  headerStatus: 'none' | 'parsed' | 'invalid';
  loginRelated: boolean;
  loginStatus: 'none' | 'loginRelated' | 'needsLogin' | 'loginMaybeRequired';
  ruleVerifySearchStatus?: string;
  ruleVerifySearchDetail?: string;
  ruleVerifySearchResultCount?: number;
  ruleVerifyBookInfoStatus?: string;
  ruleVerifyBookInfoDetail?: string;
  ruleVerifyTocStatus?: string;
  ruleVerifyTocDetail?: string;
  ruleVerifyTocResultCount?: number;
  ruleVerifyContentStatus?: string;
  ruleVerifyContentDetail?: string;
  ruleVerificationPassed?: boolean;
  ruleVerificationSummary?: string;
  ruleVerificationDuration?: number;
  batchValidationMode?: BatchValidationMode;
  batchValidationStatus?: string;
  batchFailureReasons: string[];
  batchWarnings: string[];
  batchSuggestions: string[];
  batchDurationMs?: number;
  firstFailureStage?: string;
  availability: AvailabilityStatus;
  duplicateKey: string;
  duplicateGroupId: number | null;
  kept: boolean;
  removedReason: string | null;
  score: number;
  scoreBreakdown: Record<string, number>;
  classificationConfidence: ClassificationConfidence;
  classificationTags: string[];
  classificationSignals: ClassificationSignal;
  warnings: string[];
  risks: string[];
  processedAt: string;
}

export interface CleanNameStep {
  reason: string;
  from: string;
  to: string;
}

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
  groupKey: string;
  keptIndex: number;
  removedIndices: number[];
  reason: string;
  scoreBreakdown: Record<string, number>;
  keptName?: string;
  removedNames?: string[];
  scoreDiffs?: number[];
  fieldDiffSummaries?: FieldDiffSummary[];
}

export interface ZoneStats {
  total: number;
  categoryCounts: Record<string, number>;
  availabilityCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface ProcessSummary {
  generatedAt: string;
  input: ZoneStats & { averageRespondTime: number };
  output: ZoneStats & { averageRespondTime: number; measuredAverageRespondTime: number | null };
  removed: { duplicateCount: number; unavailableCount: number; riskyCount: number };
  validation: { okCount: number; warnCount: number; invalidCount: number };
  batchValidation?: BatchValidationSummary;
}

export interface ProcessReport {
  summary: ProcessSummary;
  sources: SourceAnalysis[];
  duplicates: DuplicateGroup[];
}

export interface BatchValidationSummary {
  total: number;
  pass: number;
  partialPass: number;
  fail: number;
  blocked: number;
  needsLogin: number;
  unsupported: number;
  risky: number;
  unknown: number;
  byFailureReason: Record<string, number>;
  byHost: Record<string, number>;
  byGroup: Record<string, number>;
  bySourceType: Record<string, number>;
}

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
  allowRiskyDedupe: boolean;
  includeUnknown: boolean;
  includeComplex: boolean;
  includeUnavailable: boolean;
  writeNormalizedUrl: boolean;
  strict: boolean;
  validateMode?: BatchValidationMode;
  batchConcurrency?: number;
  onPhaseChange?: (phase: string) => void;
  onLog?: (message: string) => void;
  onProgress?: (label: 'connectivity' | 'search' | 'batch', done: number, total: number) => void;
}
