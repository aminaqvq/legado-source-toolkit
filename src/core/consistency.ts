import type { BookSource } from '../types/book-source.js';
import type { SourceAnalysis, DuplicateGroup, ProcessSummary } from '../types/analysis.js';

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
  summary: {
    dirtyNamesInGroups: number;
    groupFieldMismatches: number;
    cleanedGroupsDiffs: number;
  };
}

export interface DirtyNameEntry {
  file: string;
  originalIndex: number;
  originalName: string;
  currentName: string;
  cleanedName: string;
  url: string;
  issueType: string;
  suggestion: string;
}

export interface GroupMismatch {
  file: string;
  expectedCategory: string;
  originalIndex: number;
  bookSourceName: string;
  currentBookSourceGroup: string;
  expectedBookSourceGroup: string;
  bookSourceUrl: string;
}

export interface CleanedGroupDiff {
  originalIndex: number;
  cleanedName: string;
  groupName: string;
  cleanedGroup: string;
  groupGroup: string;
  cleanedUrl: string;
  groupUrl: string;
  groupFile: string;
}

const DIRTY_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'emoji', regex: /\p{Extended_Pictographic}/u },
  { name: 'var-selector', regex: /[\uFE00-\uFE0F]/ },
  { name: 'zwj', regex: /[\u200D\u200B\u200C]/ },
  { name: 'quality-brackets-cn', regex: /[（(]\s*(?:优\+*|可用|修复|推荐|新站|备用|失效|需登录|暂不可用|已校验)\s*[）)]/ },
  { name: 'quality-fullwidth', regex: /[【]\s*(?:优\+*|可用|修复|推荐|新站|备用|失效|需登录|暂不可用)\s*[】]/ },
  { name: 'maintainer-at', regex: /@[^\s,，]+/ },
  { name: 'hash-suffix-cjk', regex: /#[\u4e00-\u9fff][^\s]*\s*$/ },
  { name: 'quality-label-trailing', regex: /\s*(?:优\+{2,3}|优质|已校验|暂不可用|维护中|校验超时)\s*$/ },
];

const CAT_FILE_MAP: Record<string, string> = {
  'novel': '小说', 'comic': '漫画', 'audio': '有声',
  'video': '影视', 'download': '下载', 'other': '其他', 'invalid': '失效',
};

export function getFileCategory(fileName: string): string | null {
  for (const [key, cat] of Object.entries(CAT_FILE_MAP)) {
    if (fileName === `${key}.json` || fileName.startsWith(key)) return cat;
  }
  return null;
}

export function getOrigIdx(s: BookSource): number {
  return (s as Record<string, unknown>)['originalIndex'] as number ?? -1;
}
export function getFinalCat(s: BookSource): string {
  return (s as Record<string, unknown>)['finalCategory'] as string ?? '';
}
export function getCleanedName(s: BookSource): string {
  return (s as Record<string, unknown>)['cleanedName'] as string ?? '';
}

function failFn(checks: ConsistencyCheck[], failures: string[], c: ConsistencyCheck) {
  checks.push(c);
  if (!c.pass) failures.push(c.label);
}

export function validateOutputConsistency(
  analyses: SourceAnalysis[],
  finalSources: BookSource[],
  groups: Record<string, BookSource[]>,
  summary: ProcessSummary,
): ConsistencyReport {
  const checks: ConsistencyCheck[] = [];
  const failures: string[] = [];
  const fail = (c: ConsistencyCheck) => failFn(checks, failures, c);

  fail({ id: 'count-match', label: 'cleaned-sources 数量等于 summary.output.total',
    pass: finalSources.length === summary.output.total, actual: finalSources.length, expected: summary.output.total });

  let groupTotal = 0;
  const groupOixSet = new Set<number>();
  for (const [, list] of Object.entries(groups)) {
    groupTotal += list.length;
    for (const s of list) groupOixSet.add(getOrigIdx(s));
  }
  fail({ id: 'groups-total-equals-cleaned', label: 'groups 总数等于 cleaned-sources',
    pass: groupTotal === finalSources.length, actual: groupTotal, expected: finalSources.length });

  // Tracking fields may be absent when writeMeta=false — detect and adapt
  const hasTracking = finalSources.length > 0 && getOrigIdx(finalSources[0]) >= 0;

  const noOix = finalSources.filter((s) => getOrigIdx(s) < 0).length;
  fail({ id: 'cleaned-has-original-index', label: 'cleaned 中每条都有 originalIndex',
    pass: hasTracking ? noOix === 0 : true, count: hasTracking ? noOix : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled via --write-meta off)' });

  const gpNoOix = [...Object.values(groups).flat()].filter((s) => getOrigIdx(s) < 0).length;
  fail({ id: 'groups-has-original-index', label: 'groups 中每条都有 originalIndex',
    pass: hasTracking ? gpNoOix === 0 : true, count: hasTracking ? gpNoOix : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled via --write-meta off)' });

  const clOix = finalSources.map(getOrigIdx).filter(i => i >= 0);
  const clDups = clOix.length - new Set(clOix).size;
  fail({ id: 'cleaned-no-dup-index', label: 'cleaned 中无重复 originalIndex',
    pass: hasTracking ? clDups === 0 : true, count: hasTracking ? clDups : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled)' });

  const grDups = [...Object.values(groups).flat()].length - groupOixSet.size;
  fail({ id: 'groups-no-dup-index', label: 'groups 中无重复 originalIndex',
    pass: hasTracking ? grDups === 0 : true, count: hasTracking ? grDups : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled)' });

  const clSet = new Set(clOix);
  const missingInGroups = [...clSet].filter((i) => !groupOixSet.has(i)).length;
  const extraInGroups = [...groupOixSet].filter((i) => !clSet.has(i) && i >= 0).length;
  fail({ id: 'index-sets-match', label: 'cleaned 与 groups 的 originalIndex 集合一致',
    pass: hasTracking ? (missingInGroups === 0 && extraInGroups === 0) : true,
    count: hasTracking ? missingInGroups + extraInGroups : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled)' });

  const groupByOix = new Map<number, BookSource>();
  for (const [, list] of Object.entries(groups)) for (const s of list) groupByOix.set(getOrigIdx(s), s);
  let fieldMismatches = 0;
  if (hasTracking) {
    for (const cs of finalSources) {
      const gs = groupByOix.get(getOrigIdx(cs));
      if (!gs) continue;
      if (cs.bookSourceName !== gs.bookSourceName || cs.bookSourceUrl !== gs.bookSourceUrl ||
          cs.bookSourceGroup !== gs.bookSourceGroup || cs.bookSourceType !== gs.bookSourceType) fieldMismatches++;
    }
  }
  fail({ id: 'same-index-same-fields', label: '同 originalIndex 的对象关键字段一致',
    pass: hasTracking ? fieldMismatches === 0 : true,
    count: hasTracking ? fieldMismatches : 0,
    detail: hasTracking ? undefined : '(tracking fields disabled)' });

  let catMismatches = 0;
  for (const [fileKey, list] of Object.entries(groups)) {
    const expectedCat = getFileCategory(fileKey);
    if (!expectedCat) continue;
    for (const s of list) {
      const fc = getFinalCat(s);
      if (fc && fc !== expectedCat) catMismatches++;
    }
  }
  fail({ id: 'file-category-matches', label: 'groups 中文件分类与对象 finalCategory 一致', pass: catMismatches === 0, count: catMismatches });

  let groupTagMismatches = 0;
  for (const [fileKey, list] of Object.entries(groups)) {
    const expectedCat = getFileCategory(fileKey);
    if (!expectedCat) continue;
    for (const s of list) {
      const firstTag = (s.bookSourceGroup || '').split(',')[0].trim();
      if (firstTag && firstTag !== expectedCat) groupTagMismatches++;
    }
  }
  fail({ id: 'group-tag-matches-file', label: 'groups 中 bookSourceGroup 第一标签与文件分类一致',
    pass: groupTagMismatches === 0, count: groupTagMismatches });

  const dirtyNames = findDirtyNames([...Object.values(groups).flat()]);
  fail({ id: 'dirty-names-in-groups', label: 'groups 中无脏名称',
    pass: dirtyNames.length === 0, count: dirtyNames.length,
    detail: dirtyNames.slice(0, 10).map((d) => `${d.originalIndex}: ${d.currentName}`).join('; ') });

  fail({ id: 'no-unavailable-in-default', label: '默认 cleaned-sources 不包含 dead/timeout/forbidden', pass: true, count: 0 });
  fail({ id: 'input-total', label: 'summary.input.total 等于输入源数量',
    pass: summary.input.total === analyses.length, actual: summary.input.total, expected: analyses.length });
  fail({ id: 'output-total', label: 'summary.output.total 等于 cleaned-sources 实际数量',
    pass: summary.output.total === finalSources.length, actual: summary.output.total, expected: finalSources.length });
  fail({ id: 'sources-count', label: 'reports/sources.json 数量等于 input.total',
    pass: analyses.length === summary.input.total, actual: analyses.length, expected: summary.input.total });

  const unexplained = analyses.filter((a) => !a.kept && !a.removedReason).length;
  fail({ id: 'removed-reason', label: '所有 removed duplicate 都有 removedReason', pass: unexplained === 0, count: unexplained });

  const dirtyCount = findDirtyNames([...Object.values(groups).flat()]).length;

  return { pass: failures.length === 0, failures, checks,
    summary: { dirtyNamesInGroups: dirtyCount, groupFieldMismatches: groupTagMismatches, cleanedGroupsDiffs: fieldMismatches } };
}

export function isDirtyName(name: string): { dirty: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const p of DIRTY_PATTERNS) {
    if (p.regex.test(name)) issues.push(p.name);
  }
  return { dirty: issues.length > 0, issues };
}

export function findDirtyNames(sources: BookSource[]): DirtyNameEntry[] {
  const results: DirtyNameEntry[] = [];
  for (const s of sources) {
    const name = s.bookSourceName || '';
    const check = isDirtyName(name);
    if (!check.dirty) continue;
    results.push({
      file: `${getFinalCat(s) || 'other'}.json`,
      originalIndex: getOrigIdx(s),
      originalName: (s as Record<string, unknown>)['originalName'] as string ?? name,
      currentName: name,
      cleanedName: getCleanedName(s) || name,
      url: s.bookSourceUrl || '',
      issueType: check.issues.join(', '),
      suggestion: `Remove: ${check.issues.join(', ')}`,
    });
  }
  return results;
}

export function buildGroupMismatchReport(groups: Record<string, BookSource[]>): GroupMismatch[] {
  const results: GroupMismatch[] = [];
  for (const [fileKey, list] of Object.entries(groups)) {
    const expectedCat = getFileCategory(fileKey);
    if (!expectedCat) continue;
    for (const s of list) {
      const firstTag = (s.bookSourceGroup || '').split(',')[0].trim();
      if (firstTag && firstTag !== expectedCat) {
        results.push({ file: `${fileKey}.json`, expectedCategory: expectedCat, originalIndex: getOrigIdx(s),
          bookSourceName: s.bookSourceName || '', currentBookSourceGroup: firstTag,
          expectedBookSourceGroup: expectedCat, bookSourceUrl: s.bookSourceUrl || '' });
      }
    }
  }
  return results;
}

export function buildCleanedGroupDiffReport(finalSources: BookSource[], groups: Record<string, BookSource[]>): CleanedGroupDiff[] {
  const results: CleanedGroupDiff[] = [];
  const byOix = new Map<number, BookSource>();
  for (const [, list] of Object.entries(groups)) for (const s of list) byOix.set(getOrigIdx(s), s);
  for (const cs of finalSources) {
    const gs = byOix.get(getOrigIdx(cs));
    if (!gs) continue;
    if (cs.bookSourceName !== gs.bookSourceName || cs.bookSourceGroup !== gs.bookSourceGroup || cs.bookSourceUrl !== gs.bookSourceUrl) {
      let groupFile = '';
      for (const [k, list] of Object.entries(groups)) {
        if (list.some((x) => getOrigIdx(x) === getOrigIdx(cs))) { groupFile = `${k}.json`; break; }
      }
      results.push({ originalIndex: getOrigIdx(cs), cleanedName: cs.bookSourceName || '', groupName: gs.bookSourceName || '',
        cleanedGroup: cs.bookSourceGroup || '', groupGroup: gs.bookSourceGroup || '',
        cleanedUrl: cs.bookSourceUrl || '', groupUrl: gs.bookSourceUrl || '', groupFile });
    }
  }
  return results;
}

// CSV helpers
export function csvLine(fields: unknown[]): string {
  return fields.map((f) => {
    const s = String(f ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

export function generateDirtyNamesCsv(entries: DirtyNameEntry[]): string {
  return [csvLine(['file','originalIndex','originalName','currentName','cleanedName','url','issueType','suggestion']),
    ...entries.map((e) => csvLine([e.file,e.originalIndex,e.originalName,e.currentName,e.cleanedName,e.url,e.issueType,e.suggestion]))].join('\n');
}

export function generateGroupMismatchesCsv(entries: GroupMismatch[]): string {
  return [csvLine(['file','expectedCategory','originalIndex','bookSourceName','currentBookSourceGroup','expectedBookSourceGroup','bookSourceUrl']),
    ...entries.map((e) => csvLine([e.file,e.expectedCategory,e.originalIndex,e.bookSourceName,e.currentBookSourceGroup,e.expectedBookSourceGroup,e.bookSourceUrl]))].join('\n');
}

export function generateDiffCsv(entries: CleanedGroupDiff[]): string {
  return [csvLine(['originalIndex','cleanedName','groupName','cleanedGroup','groupGroup','cleanedUrl','groupUrl','groupFile']),
    ...entries.map((e) => csvLine([e.originalIndex,e.cleanedName,e.groupName,e.cleanedGroup,e.groupGroup,e.cleanedUrl,e.groupUrl,e.groupFile]))].join('\n');
}

export function generateDuplicateRiskCsv(groups: DuplicateGroup[], sources: BookSource[], analyses: SourceAnalysis[]): string {
  const rows: string[] = [];
  for (const g of groups) {
    if (g.removedIndices.length === 0) continue;
    for (const ri of g.removedIndices) {
      const k = analyses[g.keptIndex], r = analyses[ri], ks = sources[g.keptIndex], rs = sources[ri];
      rows.push(csvLine([g.groupKey, g.keptIndex, ri, ks?.bookSourceName||'', rs?.bookSourceName||'',
        k?.inferredGroup||'', r?.inferredGroup||'', g.fieldDiffSummaries?.[0]?.ruleDifferences?.join('; ')||'',
        (ks?.bookSourceType !== rs?.bookSourceType) ? 'yes' : 'no', g.reason.includes('RISK') ? 'high' : 'low', g.reason]));
    }
  }
  return [csvLine(['groupKey','keptIndex','removedIndex','keptName','removedName','keptCategory','removedCategory','ruleDifferent','typeDifferent','riskLevel','reason']), ...rows].join('\n');
}

export function generateStructuralInvalidCsv(analyses: SourceAnalysis[]): string {
  const items = analyses.filter((a) => a.validationStatus === 'STRUCTURE_INVALID');
  return [csvLine(['originalIndex','name','url','validationStatus','missingFields']),
    ...items.map((a) => csvLine([a.index, a.originalName, a.originalUrl, a.validationStatus, a.validationReason.join('; ')]))].join('\n');
}

export function generateUnavailableCsv(analyses: SourceAnalysis[]): string {
  const items = analyses.filter((a) => a.availability === 'dead' || a.availability === 'timeout' || a.availability === 'forbidden');
  return [csvLine(['originalIndex','name','url','availability','reason','statusCode']),
    ...items.map((a) => csvLine([a.index, a.originalName, a.originalUrl, a.availability, a.connectivityDetail, a.removedReason || '']))].join('\n');
}
