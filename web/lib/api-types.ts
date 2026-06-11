// ── API wrapper ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

// ── Health ──

export interface HealthData {
  status: string;
  version: string;
}

// ── Inspect ──

export interface InspectData {
  total: number;
  typeCounts: Record<string, number>;
  topGroups: Record<string, number>;
  duplicateHostCount: number;
  nonHttpCount: number;
  complexJsCount: number;
  emojiCount: number;
}

// ── Job ──

export interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  progress?: string;
  createdAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  // ── Structured progress ──
  logs?: string[];
  phase?: string;
  totalProgress?: number;
  phaseProgress?: number;
  connProgress?: { done: number; total: number; percent: number };
  searchProgress?: { done: number; total: number; percent: number };
  resultDir?: string;
  displayResultDir?: string;
  inputPath?: string;
}

// ── Process options ──

export interface ProcessFormOptions {
  inputPath: string;
  outDir: string;
  online: boolean;
  dedupeLevel: string;
  groupMode: string;
  nameMode: string;
  concurrency: number;
  timeout: number;
  dryRun: boolean;
  outputFormat: string;
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
}

// ── Summary ──

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
}

// ── Consistency ──

export interface ConsistencyCheck {
  id: string;
  label: string;
  pass: boolean;
  count?: number;
  actual?: number;
  expected?: number;
  detail?: string;
}

export interface ConsistencyReport {
  pass: boolean;
  failures: string[];
  checks: ConsistencyCheck[];
  summary: { dirtyNamesInGroups: number; groupFieldMismatches: number; cleanedGroupsDiffs: number };
}

// ── Issues ──

export interface DirtyNameItem {
  file: string;
  originalIndex: number;
  originalName: string;
  currentName: string;
  cleanedName: string;
  url: string;
  issueType: string;
  suggestion: string;
}

export interface GroupMismatchItem {
  file: string;
  expectedCategory: string;
  originalIndex: number;
  bookSourceName: string;
  currentBookSourceGroup: string;
  expectedBookSourceGroup: string;
  bookSourceUrl: string;
}

export interface DiffItem {
  originalIndex: number;
  cleanedName: string;
  groupName: string;
  cleanedGroup: string;
  groupGroup: string;
  cleanedUrl: string;
  groupUrl: string;
  groupFile: string;
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

export interface FieldDiffSummary {
  typeConflict: boolean;
  categoryConflict: boolean;
  ruleDifferences: string[];
  freshnessComparison: string;
  respondTimeComparison: string;
  whyKept: string;
  whyRemoved: string;
}

export interface IssuesData {
  consistency: ConsistencyReport | null;
  dirtyNames: DirtyNameItem[];
  groupMismatches: GroupMismatchItem[];
  cleanedGroupDiffs: DiffItem[];
  duplicateRisks: DuplicateGroup[];
  duplicates: DuplicateGroup[];
  structuralInvalid: unknown[];
  unavailable: unknown[];
  risky: unknown[];
}

// ── Source detail ──

export interface ClassificationSignal {
  fromType: string | null;
  fromName: string[];
  fromGroup: string | null;
  fromRules: string[];
  finalCategory: string;
  confidence: string;
  conflictTags: string[];
}

export interface CleanNameStep {
  reason: string;
  from: string;
  to: string;
}

export interface SourceAnalysisItem {
  index: number;
  originalName: string;
  cleanedName: string;
  cleanNameSteps: CleanNameStep[];
  originalGroup: string;
  finalGroup: string;
  inferredGroup: string;
  originalType: number;
  originalUrl: string;
  normalizedUrl: string | null;
  normalizedHost: string | null;
  urlStatus: string;
  urlWarnings: string[];
  validationStatus: string;
  validationReason: string[];
  connectivityStatus: string;
  connectivityDetail: string;
  searchStatus: string;
  searchDetail: string;
  availability: string;
  kept: boolean;
  removedReason: string | null;
  score: number;
  scoreBreakdown: Record<string, number>;
  classificationConfidence: string;
  classificationTags: string[];
  classificationSignals: ClassificationSignal;
  warnings: string[];
  risks: string[];
}

// ── Upload ──

export interface UploadResult {
  uploadId: string;
  path: string;
  name: string;
  size: number;
}

export interface UploadPreview {
  uploadId: string;
  fileName: string;
  path: string;
  count: number;
  limit: number;
  preview: Record<string, unknown>[];
}

// ── Results list ──

export interface ResultsListEntry {
  name: string;
  path: string;
  summary?: ProcessSummary;
}
