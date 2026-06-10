import type { BookSource, DedupeLevel } from '../types/book-source.js';
import type { SourceAnalysis, DuplicateGroup, FieldDiffSummary } from '../types/analysis.js';
import { getHostKey, getUrlKey } from './normalize-url.js';

interface DedupeOptions {
  level: DedupeLevel;
  allowRiskyDedupe?: boolean;
}

interface DedupeResult {
  kept: boolean[];
  groups: DuplicateGroup[];
}

/**
 * Deduplicate book sources at the specified level.
 * For each group of duplicates, keeps the highest-scoring source.
 */
export function dedupeSources(
  sources: BookSource[],
  analyses: SourceAnalysis[],
  options: DedupeOptions,
): DedupeResult {
  const n = sources.length;
  const kept = new Array<boolean>(n).fill(true);
  const groups: DuplicateGroup[] = [];
  let groupIdCounter = 0;

  if (options.level === 'none') {
    return { kept, groups };
  }

  // ── Group sources by dedupe key ──
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const key = getDedupeKey(sources[i], analyses[i], options.level);
    if (!key) continue;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(i);
  }

  // ── For each group, determine which to keep ──
  for (const [groupKey, indices] of buckets) {
    if (indices.length < 2) continue;

    // Sort indices by score descending
    const sorted = [...indices].sort((a, b) => compareSources(sources, analyses, a, b));

    const keptIdx = sorted[0];

    // For host/aggressive dedupe: check if categories/types/rules differ
    if (!options.allowRiskyDedupe && (options.level === 'host' || options.level === 'aggressive')) {
      const hasConflicts = indices.some((i) => {
        if (i === keptIdx) return false;
        return analyses[i].inferredGroup !== analyses[keptIdx].inferredGroup ||
               sources[i].bookSourceType !== sources[keptIdx].bookSourceType;
      });

      if (hasConflicts) {
        // Mark all as kept but record risk group
        const fieldDiffs: FieldDiffSummary[] = [];
        for (const ri of indices) {
          if (ri === keptIdx) continue;
          fieldDiffs.push(buildFieldDiff(sources, analyses, keptIdx, ri));
        }

        groups.push({
          groupId: groupIdCounter,
          groupKey: `${groupKey} (RISK: type/category conflict — NOT auto-removed)`,
          keptIndex: keptIdx,
          removedIndices: [],
          reason: `dedupe-risk: host matched but type/category differs — kept all`,
          scoreBreakdown: analyses[keptIdx].scoreBreakdown,
          keptName: analyses[keptIdx].originalName,
          removedNames: [],
          scoreDiffs: [],
          fieldDiffSummaries: fieldDiffs,
        });
        groupIdCounter++;
        continue;
      }
    }

    const removedIndices = sorted.slice(1);

    // Build detailed field diffs
    const fieldDiffs: FieldDiffSummary[] = [];
    const removedNames: string[] = [];
    const scoreDiffs: number[] = [];
    for (const ri of removedIndices) {
      fieldDiffs.push(buildFieldDiff(sources, analyses, keptIdx, ri));
      removedNames.push(analyses[ri].originalName);
      scoreDiffs.push(analyses[keptIdx].score - analyses[ri].score);
    }

    // Mark removed indices
    for (const ri of removedIndices) {
      kept[ri] = false;
      analyses[ri].kept = false;
      const diff = fieldDiffs[removedIndices.indexOf(ri)];
      analyses[ri].removedReason =
        `Duplicate of "${analyses[keptIdx].originalName}" ` +
        `(score diff: ${analyses[keptIdx].score - analyses[ri].score}, ` +
        `same category: ${diff.categoryConflict ? 'no' : 'yes'}, ` +
        `same type: ${diff.typeConflict ? 'no' : 'yes'})`;
      analyses[ri].duplicateGroupId = groupIdCounter;
    }

    analyses[keptIdx].duplicateGroupId = groupIdCounter;

    groups.push({
      groupId: groupIdCounter,
      groupKey,
      keptIndex: keptIdx,
      removedIndices,
      reason: getDedupeReason(options.level),
      scoreBreakdown: analyses[keptIdx].scoreBreakdown,
      keptName: analyses[keptIdx].originalName,
      removedNames,
      scoreDiffs,
      fieldDiffSummaries: fieldDiffs,
    });

    groupIdCounter++;
  }

  return { kept, groups };
}

function buildFieldDiff(
  sources: BookSource[],
  analyses: SourceAnalysis[],
  keptIdx: number,
  removedIdx: number,
): FieldDiffSummary {
  const k = sources[keptIdx];
  const r = sources[removedIdx];
  const ak = analyses[keptIdx];
  const ar = analyses[removedIdx];

  const ruleDiffs: string[] = [];

  if (k.ruleSearch?.bookList !== r.ruleSearch?.bookList) ruleDiffs.push('ruleSearch.bookList');
  if (k.ruleSearch?.name !== r.ruleSearch?.name) ruleDiffs.push('ruleSearch.name');
  if (k.ruleSearch?.bookUrl !== r.ruleSearch?.bookUrl) ruleDiffs.push('ruleSearch.bookUrl');
  if (k.ruleBookInfo?.name !== r.ruleBookInfo?.name) ruleDiffs.push('ruleBookInfo.name');
  if (k.ruleToc?.chapterList !== r.ruleToc?.chapterList) ruleDiffs.push('ruleToc.chapterList');
  if (k.ruleContent?.content !== r.ruleContent?.content) ruleDiffs.push('ruleContent.content');

  const freshKept = k.lastUpdateTime ?? 0;
  const freshRemoved = r.lastUpdateTime ?? 0;
  const freshnessComparison = freshRemoved > freshKept
    ? `removed is newer (${freshRemoved} > ${freshKept})`
    : freshRemoved < freshKept
    ? 'kept is newer'
    : 'same freshness';

  const rtKept = k.respondTime ?? Infinity;
  const rtRemoved = r.respondTime ?? Infinity;
  const respondTimeComparison = rtRemoved < rtKept
    ? `removed responds faster (${rtRemoved}ms < ${rtKept}ms)`
    : rtRemoved > rtKept
    ? 'kept responds faster'
    : 'same respondTime';

  return {
    typeConflict: k.bookSourceType !== r.bookSourceType,
    categoryConflict: ak.inferredGroup !== ar.inferredGroup,
    ruleDifferences: ruleDiffs,
    freshnessComparison,
    respondTimeComparison,
    whyKept: `score: ${ak.score}, availability: ${ak.availability}`,
    whyRemoved: `score: ${ar.score}, availability: ${ar.availability}`,
  };
}

function getDedupeKey(
  source: BookSource,
  analysis: SourceAnalysis,
  level: DedupeLevel,
): string | null {
  switch (level) {
    case 'none':
      return null;

    case 'exact':
      return source.bookSourceUrl?.trim().toLowerCase() ?? null;

    case 'url':
      return getUrlKey(source.bookSourceUrl);

    case 'conservative': {
      // Group by normalizedUrl + category + bookSourceType
      const urlKey = getUrlKey(source.bookSourceUrl);
      if (!urlKey) {
        // Non-HTTP: use type + name
        const type = source.bookSourceType ?? -1;
        const name = analysis.cleanedName || source.bookSourceName || urlKey || '';
        return `conservative-nonhttp:${type}:${analysis.inferredGroup}:${name.toLowerCase().trim()}`;
      }
      return `${urlKey}:${analysis.inferredGroup}:${source.bookSourceType ?? 'x'}`;
    }

    case 'host': {
      const url = source.bookSourceUrl;
      if (!url || !/^https?:\/\//i.test(url)) {
        const type = source.bookSourceType ?? -1;
        const name = analysis.cleanedName || source.bookSourceName || url || '';
        return `non-http:${type}:${name.toLowerCase().trim()}`;
      }
      return getHostKey(url);
    }

    case 'aggressive': {
      const url = source.bookSourceUrl;
      if (!url || !/^https?:\/\//i.test(url)) {
        const type = source.bookSourceType ?? -1;
        const name = analysis.cleanedName || source.bookSourceName || url || '';
        return `non-http-aggressive:${type}:${name.toLowerCase().trim()}`;
      }
      const host = getHostKey(url);
      const name = analysis.cleanedName || source.bookSourceName || '';
      return host && name ? `${host}::${name.toLowerCase()}` : host;
    }

    default:
      return null;
  }
}

function compareSources(
  sources: BookSource[],
  analyses: SourceAnalysis[],
  a: number,
  b: number,
): number {
  const sa = analyses[a];
  const sb = analyses[b];

  if (sa.score !== sb.score) return sb.score - sa.score;

  const availOrder: Record<string, number> = {
    'usable': 0, 'probably_usable': 1, 'complex_unverified': 2,
    'login_related': 3, 'needs_login': 3, 'forbidden': 4,
    'timeout': 5, 'unknown': 6, 'dead': 7, 'invalid': 8,
  };
  const availDiff = (availOrder[sa.availability] ?? 99) - (availOrder[sb.availability] ?? 99);
  if (availDiff !== 0) return availDiff;

  const ra = sources[a].respondTime ?? Infinity;
  const rb = sources[b].respondTime ?? Infinity;
  if (ra !== rb) return ra - rb;

  const la = sources[a].lastUpdateTime ?? 0;
  const lb = sources[b].lastUpdateTime ?? 0;
  if (la !== lb) return lb - la;

  const wa = sources[a].weight ?? 0;
  const wb = sources[b].weight ?? 0;
  if (wa !== wb) return wb - wa;

  const rcA = countRuleFields(sources[a]);
  const rcB = countRuleFields(sources[b]);
  if (rcA !== rcB) return rcB - rcA;

  return a - b;
}

function countRuleFields(source: BookSource): number {
  let count = 0;
  const rs = source.ruleSearch;
  if (rs?.bookList) count++;
  if (rs?.name) count++;
  if (rs?.author) count++;
  if (rs?.bookUrl) count++;
  if (source.ruleBookInfo?.name) count++;
  if (source.ruleBookInfo?.author) count++;
  if (source.ruleToc?.chapterList) count++;
  if (source.ruleToc?.chapterName) count++;
  if (source.ruleContent?.content) count++;
  return count;
}

function getDedupeReason(level: DedupeLevel): string {
  switch (level) {
    case 'exact': return 'exact URL match';
    case 'url': return 'normalized URL match';
    case 'conservative': return 'conservative: same normalized URL + category + type';
    case 'host': return 'same host (host-level dedup)';
    case 'aggressive': return 'aggressive: same host + name';
    default: return 'unknown';
  }
}
