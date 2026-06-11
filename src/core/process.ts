import type { BookSource, AvailabilityStatus } from '../types/book-source.js';
import type { ProcessOptions, ProcessReport, ProcessSummary, SourceAnalysis, ZoneStats } from '../types/analysis.js';
import { readBookSources } from './parse.js';
import { cleanBookSourceName } from './clean-name.js';
import { normalizeUrl } from './normalize-url.js';
import { classifySource } from './classify.js';
import { validateStructure } from './validate-structure.js';
import { checkConnectivity } from './validate-online.js';
import { checkSearchUrl } from './validate-search.js';
import { calculateScore } from './score.js';
import { dedupeSources } from './dedupe.js';
import { splitByCategory } from './split.js';
import { writeJsonFile, ensureOutputDir, writeTextFile } from '../utils/fs.js';
import { generateSourcesCsv, generateDuplicatesCsv } from '../utils/csv.js';
import { renderHtmlReport } from '../utils/html-report.js';
import {
  validateOutputConsistency, buildGroupMismatchReport, buildCleanedGroupDiffReport,
  findDirtyNames, generateDirtyNamesCsv, generateGroupMismatchesCsv, generateDiffCsv,
  generateDuplicateRiskCsv, generateStructuralInvalidCsv, generateUnavailableCsv,
} from './consistency.js';
import { heading, info, success, warn, progress, keyValue } from '../utils/logger.js';
import pLimit from 'p-limit';
import path from 'node:path';

/**
 * Main processing pipeline.
 */
export async function processSources(options: ProcessOptions): Promise<ProcessReport> {
  const log = (msg: string) => { options.onLog?.(msg); };
  const setPhase = (phase: string) => { options.onPhaseChange?.(phase); };

  heading('Legado Source Toolkit — Processing');
  log('▶ 开始处理');

  // ═══ Step 1: Read and parse ═══
  setPhase('读取输入文件');
  info('Reading input file...');
  log('正在读取输入文件...');
  const { sources, analyses } = readBookSources(options.inputPath);
  info(`Found ${sources.length} book source(s)`);
  log(`✓ 找到 ${sources.length} 个书源`);

  if (sources.length === 0) {
    warn('Input file contains no sources. Exiting.');
    return createEmptyReport();
  }

  // ═══ Step 1b: Apply input filters (keepDisabled/onlyEnabled only — URL-based filter after normalization) ═══
  let filterCount = 0;
  for (let i = 0; i < analyses.length; i++) {
    if (options.onlyEnabled && sources[i].enabled !== true) {
      analyses[i].kept = false;
      analyses[i].removedReason = 'Filtered: --only-enabled (source not enabled)';
      filterCount++;
    }
    if (!options.keepDisabled && sources[i].enabled === false) {
      analyses[i].kept = false;
      analyses[i].removedReason = 'Filtered: disabled source excluded';
      filterCount++;
    }
  }
  if (filterCount > 0) { info(`Filtered ${filterCount} source(s) via input options`); log(`✓ 过滤 ${filterCount} 个源（来源选项）`); }

  // ═══ Step 2: Clean names ═══
  setPhase('名称清洗');
  heading('Phase 1/6: Name cleaning');
  for (let i = 0; i < analyses.length; i++) {
    const result = cleanBookSourceName(sources[i].bookSourceName ?? '', {
      mode: options.nameMode,
      keepLatinWhenNeeded: options.keepLatinWhenNeeded,
      fallbackUrl: sources[i].bookSourceUrl ?? undefined,
      sourceIndex: i,
    });
    analyses[i].cleanedName = result.cleaned;
    analyses[i].cleanNameSteps = result.steps;
    analyses[i].warnings.push(...result.warnings);
  }
  success(`Names cleaned (mode: ${options.nameMode})`);
  log(`✓ 名称清洗完成 (模式: ${options.nameMode})`);

  // ═══ Step 3: Normalize URLs ═══
  setPhase('URL 规范化');
  heading('Phase 2/6: URL normalization');
  for (let i = 0; i < analyses.length; i++) {
    const norm = normalizeUrl(sources[i].bookSourceUrl);
    analyses[i].normalizedUrl = norm.url;
    analyses[i].normalizedHost = norm.normalizedHost;
    analyses[i].urlStatus = norm.urlStatus;
    analyses[i].urlWarnings = norm.urlWarnings;
  }
  success('URLs normalized');
  log('✓ URL 规范化完成');
  if (!options.includeNonHttp) {
    let nhCount = 0;
    for (let i = 0; i < analyses.length; i++) {
      if (analyses[i].urlStatus !== 'VALID_HTTP') {
        analyses[i].kept = false;
        analyses[i].removedReason = 'Filtered: non-HTTP source excluded';
        nhCount++;
      }
    }
    if (nhCount > 0) info(`Filtered ${nhCount} non-HTTP source(s)`);
  }

  // ═══ Step 4: Classify ═══
  setPhase('分类');
  heading('Phase 3/6: Classification');
  for (let i = 0; i < analyses.length; i++) {
    const cls = classifySource(sources[i], analyses[i]);
    analyses[i].inferredGroup = cls.category;
    analyses[i].classificationConfidence = cls.confidence;
    analyses[i].classificationTags = cls.tags;
    analyses[i].classificationSignals = cls.signals;
  }
  success('Sources classified');
  log('✓ 分类完成');

  // ═══ Step 5: Validate structure (category-aware) ═══
  setPhase('结构校验');
  heading('Phase 4/6: Structure validation');
  for (let i = 0; i < analyses.length; i++) {
    const struct = validateStructure(sources[i], analyses[i].inferredGroup);
    analyses[i].validationStatus = struct.status;
    analyses[i].validationReason = struct.reasons;

    if (struct.status === 'STRUCTURE_INVALID') {
      analyses[i].availability = 'invalid';
    } else if (struct.status === 'STRUCTURE_WARN' && analyses[i].availability === 'unknown') {
      analyses[i].availability = 'probably_usable';
    }
  }
  const invalidCount = analyses.filter((a) => a.validationStatus === 'STRUCTURE_INVALID').length;
  const warnCount = analyses.filter((a) => a.validationStatus === 'STRUCTURE_WARN').length;
  success(`Structure validated: ${analyses.length - invalidCount - warnCount} OK, ${warnCount} warnings, ${invalidCount} invalid`);
  log(`✓ 结构校验完成: ${analyses.length - invalidCount - warnCount} OK, ${warnCount} 警告, ${invalidCount} 无效`);

  // ═══ Step 6: Online validation (if enabled) ═══
  if (options.online) {
    setPhase('在线验证');
    heading('Phase 5/6: Online validation');
    const limit = pLimit(options.concurrency);

    // 6a: Connectivity check
    info('Checking connectivity...');
    let connDone = 0;
    const connectivityTasks = analyses.map((analysis, i) =>
      limit(async () => {
        const result = await checkConnectivity(sources[i], {
          timeout: options.timeout,
          retry: options.retry,
        });
        analysis.connectivityStatus = result.status;
        analysis.connectivityDetail = result.detail;
        if (typeof result.responseTimeMs === 'number') {
          analysis.measuredRespondTime = result.responseTimeMs;
        }
        if (result.headerStatus) analysis.headerStatus = result.headerStatus;
        connDone++;
        options.onProgress?.('connectivity', connDone, analyses.length);
        progress(connDone, analyses.length, 'Connectivity');
      }),
    );
    await Promise.all(connectivityTasks);
    success('Connectivity checks complete');
    log('✓ 连通性检查完成');

    // 6b: Search validation
    info('Checking search...');
    let searchDone = 0;
    const searchTasks = analyses.map((analysis, i) =>
      limit(async () => {
        const result = await checkSearchUrl(sources[i], analysis.inferredGroup, {
          timeout: options.timeout,
        });
        analysis.searchStatus = result.status;
        analysis.searchDetail = result.detail;
        searchDone++;
        options.onProgress?.('search', searchDone, analyses.length);
        progress(searchDone, analyses.length, 'Search');
      }),
    );
    await Promise.all(searchTasks);
    success('Search checks complete');
    log('✓ 搜索验证完成');
  } else {
    info('Online validation skipped (use --online to enable)');
    log('⊘ 在线验证跳过 (未启用)');
  }

  // ═══ Compute login-related status ═══
  for (let i = 0; i < analyses.length; i++) {
    const src = sources[i];
    if (src.loginUrl || src.loginUi || src.loginCheckJs) {
      analyses[i].loginRelated = true;
      if (/cookie|token|session/i.test(src.loginCheckJs || '')) {
        analyses[i].loginStatus = 'needsLogin';
      } else {
        analyses[i].loginStatus = 'loginRelated';
      }
    }
  }

  // ═══ Compute availability ═══
  for (let i = 0; i < analyses.length; i++) {
    analyses[i].availability = computeAvailability(sources[i], analyses[i]);
  }

  // ═══ Step 7: Score ═══
  setPhase('评分');
  heading('Phase 6/6: Scoring & Deduplication');
  for (let i = 0; i < analyses.length; i++) {
    const result = calculateScore(sources[i], analyses[i]);
    analyses[i].score = result.score;
    analyses[i].scoreBreakdown = result.breakdown;
  }
  success('Scores calculated');
  log('✓ 评分计算完成');

  // ═══ Step 8: Deduplicate ═══
  setPhase('去重');
  const dedupeResult = dedupeSources(sources, analyses, {
    level: options.dedupeLevel,
    allowRiskyDedupe: options.allowRiskyDedupe,
  });
  for (let i = 0; i < analyses.length; i++) {
    analyses[i].kept = dedupeResult.kept[i];
  }
  const removedCount = analyses.filter((a) => !a.kept).length;
  success(`Deduplication complete: ${removedCount} removed (level: ${options.dedupeLevel})`);
  log(`✓ 去重完成: 移除 ${removedCount} 个 (级别: ${options.dedupeLevel})`);

  // ═══ Step 9: Apply group mode ═══
  log('应用分组模式...');
  for (let i = 0; i < analyses.length; i++) {
    const orig = sources[i].bookSourceGroup || '';
    const inferred = analyses[i].inferredGroup;

    switch (options.groupMode) {
      case 'overwrite':
        analyses[i].finalGroup = inferred;
        analyses[i].groupChangeReason = 'overwrite';
        break;
      case 'append':
        if (orig && !orig.includes(inferred)) {
          analyses[i].finalGroup = `${orig}, ${inferred}`;
        } else if (!orig) {
          analyses[i].finalGroup = inferred;
        } else {
          analyses[i].finalGroup = orig;
        }
        analyses[i].groupChangeReason = 'append';
        break;
      case 'preserve':
        analyses[i].finalGroup = orig;
        analyses[i].groupChangeReason = 'preserved-original';
        break;
      case 'category-first': {
        const tags = orig.split(',').map((s) => s.trim()).filter(Boolean);
        const nonCatTags = tags.filter((t) => t !== inferred && t !== '小说' && t !== '漫画' && t !== '有声' && t !== '影视' && t !== '下载');
        if (nonCatTags.length > 0) {
          analyses[i].finalGroup = [inferred, ...nonCatTags].join(', ');
        } else {
          analyses[i].finalGroup = inferred;
        }
        analyses[i].groupChangeReason = 'category-first';
        break;
      }
      case 'report-only':
        // Keep original group unchanged; only record suggested classification in report
        analyses[i].finalGroup = orig;
        analyses[i].groupChangeReason = 'report-only (suggested: ' + inferred + ')';
        break;
      default:
        analyses[i].finalGroup = inferred;
        analyses[i].groupChangeReason = 'overwrite';
    }
  }

  // ═══ Step 10: Build output filtering ═══
  // Default cleaned-sources excludes dead/timeout/forbidden
  const excludedAvail: Set<string> = new Set();
  if (!options.includeUnavailable) {
    excludedAvail.add('dead');
    excludedAvail.add('timeout');
    excludedAvail.add('forbidden');
    excludedAvail.add('invalid');
  }
  if (!options.includeUnknown) {
    excludedAvail.add('unknown');
  }
  if (!options.includeComplex) {
    excludedAvail.add('complex_unverified');
  }

  // kept = dedupe result AND availability filter
  for (let i = 0; i < analyses.length; i++) {
    if (!analyses[i].kept) continue;
    if (excludedAvail.has(analyses[i].availability)) {
      analyses[i].kept = false;
      analyses[i].removedReason = `Excluded: availability=${analyses[i].availability}`;
    }
  }

  const keptAnalyses = analyses.filter((a) => a.kept);
  const finalSources: BookSource[] = keptAnalyses.map((a) => {
    const src = { ...sources[a.index] }; // shallow clone so we can mutate
    src.bookSourceName = a.cleanedName || src.bookSourceName;
    src.bookSourceGroup = a.finalGroup;
    // Only write normalized URL if safe
    if (options.writeNormalizedUrl && a.normalizedUrl && a.urlStatus === 'VALID_HTTP') {
      src.bookSourceUrl = a.normalizedUrl;
    }
    // ── Tracking fields for audit / traceability ──
    if (options.writeMeta) {
      (src as Record<string, unknown>)['originalIndex'] = a.index;
      (src as Record<string, unknown>)['originalName'] = a.originalName;
      (src as Record<string, unknown>)['originalUrl'] = a.originalUrl;
      (src as Record<string, unknown>)['cleanedName'] = a.cleanedName;
      (src as Record<string, unknown>)['finalCategory'] = a.inferredGroup;
    }
    return src;
  });

  // ═══ Step 11: Build summary ═══
  const summary = buildSummary(analyses, sources, dedupeResult.groups.length, removedCount, excludedAvail.size > 0);

  const report: ProcessReport = {
    summary,
    sources: analyses,
    duplicates: dedupeResult.groups,
  };

  if (options.dryRun) {
    info('Dry run — skipping file output.');
    log('⊘ 试运行模式 — 跳过文件输出');
    return report;
  }

  // ═══ Step 12: Write output files ═══
  setPhase('输出写入');
  log('正在写入输出文件...');
  ensureOutputDir(options.outDir);

  // 1. cleaned-sources.json (only kept + availability-filtered)
  writeJsonFile(
    path.join(options.outDir, 'cleaned-sources.json'),
    finalSources,
    options.outputFormat === 'pretty',
  );

  // 2. all-sources-reviewed.json (complete audit)
  writeJsonFile(
    path.join(options.outDir, 'all-sources-reviewed.json'),
    analyses,
    true,
  );

  // 3. Group splits — use finalSources (same objects as cleaned-sources.json)
  const splitDir = path.join(options.outDir, 'groups');
  ensureOutputDir(splitDir);
  const groups = splitByCategory(finalSources);
  for (const [cat, groupSources] of Object.entries(groups)) {
    writeJsonFile(path.join(splitDir, `${cat}.json`), groupSources, true);
  }

  // 4. Reports
  const reportsDir = path.join(options.outDir, 'reports');
  ensureOutputDir(reportsDir);

  writeJsonFile(path.join(reportsDir, 'summary.json'), summary, true);
  writeJsonFile(path.join(reportsDir, 'sources.json'), analyses, true);
  writeJsonFile(path.join(reportsDir, 'duplicates.json'), dedupeResult.groups, true);
  writeTextFile(path.join(reportsDir, 'sources.csv'), generateSourcesCsv(analyses));
  writeTextFile(path.join(reportsDir, 'duplicates.csv'), generateDuplicatesCsv(dedupeResult.groups));

  // Structural invalid report
  const structuralInvalid = analyses.filter((a) => a.validationStatus === 'STRUCTURE_INVALID');
  writeJsonFile(path.join(reportsDir, 'structural-invalid.json'), structuralInvalid, true);

  // Unavailable report (dead/timeout/forbidden)
  const unavailable = analyses.filter((a) =>
    a.availability === 'dead' || a.availability === 'timeout' || a.availability === 'forbidden',
  );
  writeJsonFile(path.join(reportsDir, 'unavailable.json'), unavailable, true);

  // Risky report (unknown, complex_unverified, low confidence, dedupe risk)
  const risky = analyses.filter((a) =>
    a.availability === 'unknown' || a.availability === 'complex_unverified' ||
    (a.classificationConfidence === 'low' || a.classificationConfidence === 'conflict') ||
    a.risks.length > 0,
  );
  writeJsonFile(path.join(reportsDir, 'risky.json'), risky, true);

  // HTML report
  writeTextFile(path.join(reportsDir, 'report.html'), renderHtmlReport(report));

  // ═══ Output consistency check + detailed reports ═══
  const consistency = validateOutputConsistency(analyses, finalSources, groups, summary);
  writeJsonFile(path.join(reportsDir, 'output-consistency.json'), consistency, true);

  // Detailed issue reports
  const dirtyNames = findDirtyNames([...Object.values(groups).flat()]);
  const groupMismatches = buildGroupMismatchReport(groups);
  const cleanedGroupDiffs = buildCleanedGroupDiffReport(finalSources, groups);

  writeJsonFile(path.join(reportsDir, 'dirty-names.json'), dirtyNames, true);
  writeJsonFile(path.join(reportsDir, 'group-mismatches.json'), groupMismatches, true);
  writeJsonFile(path.join(reportsDir, 'cleaned-vs-groups-diff.json'), cleanedGroupDiffs, true);

  writeTextFile(path.join(reportsDir, 'dirty-names.csv'), generateDirtyNamesCsv(dirtyNames));
  writeTextFile(path.join(reportsDir, 'group-mismatches.csv'), generateGroupMismatchesCsv(groupMismatches));
  writeTextFile(path.join(reportsDir, 'cleaned-vs-groups-diff.csv'), generateDiffCsv(cleanedGroupDiffs));
  writeTextFile(path.join(reportsDir, 'duplicate-risk.csv'), generateDuplicateRiskCsv(dedupeResult.groups, sources, analyses));
  writeTextFile(path.join(reportsDir, 'structural-invalid.csv'), generateStructuralInvalidCsv(analyses));
  writeTextFile(path.join(reportsDir, 'unavailable.csv'), generateUnavailableCsv(analyses));

  if (!consistency.pass) {
    heading('⚠ Output Consistency Failures');
    for (const f of consistency.failures) {
      console.log(`  ❌ ${f}`);
    }
    if (options.strict) {
      throw new Error(`Output consistency check failed with ${consistency.failures.length} failure(s)`);
    }
  } else {
    success('Output consistency: all checks passed');
    log('✓ 输出一致性检查: 全部通过');
  }

  // ── Console summary ──
  heading('Results');
  keyValue('Input sources', summary.input.total);
  keyValue('Output sources', summary.output.total);
  keyValue('Removed duplicates', summary.removed.duplicateCount);
  keyValue('Unavailable excluded', summary.removed.unavailableCount);
  keyValue('Invalid (structure)', summary.validation.invalidCount);
  keyValue('Usable', summary.input.availabilityCounts['usable'] || 0);
  keyValue('Probably usable', summary.input.availabilityCounts['probably_usable'] || 0);
  keyValue('Complex (unverified)', summary.input.availabilityCounts['complex_unverified'] || 0);
  keyValue('Dead', summary.input.availabilityCounts['dead'] || 0);
  keyValue('Timeout', summary.input.availabilityCounts['timeout'] || 0);
  keyValue('Avg respond time (src)', `${summary.input.averageRespondTime}ms`);

  success(`Output written to: ${options.outDir}`);
  log(`✓ 输出完成: 输入 ${summary.input.total} → 输出 ${summary.output.total}`);

  return report;
}

// ── Helpers ──

function computeAvailability(
  source: BookSource,
  analysis: SourceAnalysis,
): AvailabilityStatus {
  if (analysis.validationStatus === 'STRUCTURE_INVALID') return 'invalid';

  // Login-related
  if (analysis.loginStatus === 'needsLogin') return 'needs_login';
  if (analysis.loginStatus === 'loginRelated') return 'login_related';

  if (analysis.connectivityStatus === 'NOT_CHECKED') {
    if (analysis.validationStatus === 'STRUCTURE_OK') return 'unknown';
    if (analysis.validationStatus === 'STRUCTURE_WARN') return 'probably_usable';
    return 'unknown';
  }

  // Non-HTTP source but searchUrl is HTTP — at least probably_usable
  if (analysis.connectivityStatus === 'NON_HTTP_SOURCE') {
    if (source.searchUrl && /^https?:\/\//i.test(source.searchUrl)) {
      return 'probably_usable';
    }
    return 'complex_unverified';
  }

  switch (analysis.connectivityStatus) {
    case 'CONNECT_OK':
      if (analysis.searchStatus === 'SEARCH_HTTP_OK' || analysis.searchStatus === 'SEARCH_RULE_LIKELY_OK' || analysis.searchStatus === 'SEARCH_PARSE_OK') {
        return 'usable';
      }
      if (analysis.searchStatus === 'SEARCH_COMPLEX_JS_SKIPPED' || analysis.searchStatus === 'SEARCH_SKIPPED_JS') {
        return 'complex_unverified';
      }
      if (analysis.searchStatus === 'SEARCH_TEMPLATE_COMPLEX') {
        return 'complex_unverified';
      }
      // Main URL OK but search unverified — still probably usable
      return 'probably_usable';

    case 'CONNECT_FORBIDDEN': return 'forbidden';
    case 'CONNECT_DEAD':
      // Main URL dead but searchUrl might be different and OK
      if (analysis.searchStatus === 'SEARCH_HTTP_OK' || analysis.searchStatus === 'SEARCH_RULE_LIKELY_OK') {
        return 'probably_usable';
      }
      return 'dead';
    case 'CONNECT_TIMEOUT': return 'timeout';
    case 'CONNECT_ERROR': return 'unknown';
    default: return 'unknown';
  }
}

function buildZoneStats(analyses: SourceAnalysis[], sources: BookSource[], which: 'all' | 'kept'): ZoneStats & { averageRespondTime: number; measuredAverageRespondTime: number | null } {
  const filtered = which === 'kept' ? analyses.filter((a) => a.kept) : analyses;
  const categoryCounts: Record<string, number> = {};
  const availabilityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  let totalRespTime = 0;
  let respCount = 0;
  let totalMeasuredTime = 0;
  let measuredCount = 0;

  for (const a of filtered) {
    categoryCounts[a.inferredGroup] = (categoryCounts[a.inferredGroup] || 0) + 1;
    typeCounts[String(a.originalType)] = (typeCounts[String(a.originalType)] || 0) + 1;
    availabilityCounts[a.availability] = (availabilityCounts[a.availability] || 0) + 1;
    const src = sources[a.index];
    const rt = src?.respondTime;
    if (typeof rt === 'number' && rt >= 0) {
      totalRespTime += rt;
      respCount++;
    }
    if (typeof a.measuredRespondTime === 'number' && a.measuredRespondTime >= 0) {
      totalMeasuredTime += a.measuredRespondTime;
      measuredCount++;
    }
  }
  return {
    total: filtered.length,
    categoryCounts,
    availabilityCounts,
    typeCounts,
    averageRespondTime: respCount > 0 ? Math.round(totalRespTime / respCount) : 0,
    measuredAverageRespondTime: measuredCount > 0 ? Math.round(totalMeasuredTime / measuredCount) : null,
  };
}

function buildSummary(
  analyses: SourceAnalysis[],
  sources: BookSource[],
  duplicateGroupCount: number,
  removedCount: number,
  _filterUnavailable: boolean,
): ProcessSummary {
  const input = buildZoneStats(analyses, sources, 'all');
  const output = buildZoneStats(analyses, sources, 'kept');

  let unavailableCount = 0;
  for (const a of analyses) {
    if (!a.kept && a.removedReason?.startsWith('Excluded:')) unavailableCount++;
  }

  return {
    generatedAt: new Date().toISOString(),
    input: { ...input, total: analyses.length },
    output,
    removed: {
      duplicateCount: removedCount,
      unavailableCount,
      riskyCount: analyses.filter((a) => !a.kept && a.removedReason?.includes('risk')).length,
    },
    validation: {
      okCount: analyses.filter((a) => a.validationStatus === 'STRUCTURE_OK').length,
      warnCount: analyses.filter((a) => a.validationStatus === 'STRUCTURE_WARN').length,
      invalidCount: analyses.filter((a) => a.validationStatus === 'STRUCTURE_INVALID').length,
    },
  };
}

function createEmptyReport(): ProcessReport {
  return {
    summary: {
      generatedAt: new Date().toISOString(),
      input: { total: 0, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0 },
      output: { total: 0, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0, measuredAverageRespondTime: null },
      removed: { duplicateCount: 0, unavailableCount: 0, riskyCount: 0 },
      validation: { okCount: 0, warnCount: 0, invalidCount: 0 },
    },
    sources: [],
    duplicates: [],
  };
}
