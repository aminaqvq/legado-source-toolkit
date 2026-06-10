import { describe, it, expect } from 'vitest';
import { splitByCategory } from '../src/core/split.js';
import {
  validateOutputConsistency, isDirtyName, findDirtyNames,
  buildGroupMismatchReport, buildCleanedGroupDiffReport,
} from '../src/core/consistency.js';
import type { BookSource } from '../src/types/book-source.js';
import type { SourceAnalysis, ProcessSummary } from '../src/types/analysis.js';

function makeSrc(idx: number, name: string, group: string, url: string, cat: string): BookSource {
  return {
    bookSourceName: name,
    bookSourceGroup: group,
    bookSourceUrl: url,
    bookSourceType: 0,
    originalIndex: idx,
    originalName: name,
    originalUrl: url,
    cleanedName: name,
    finalCategory: cat,
  } as BookSource;
}

function makeSummary(inputTotal: number, outputTotal: number): ProcessSummary {
  return {
    generatedAt: new Date().toISOString(),
    input: { total: inputTotal, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0 },
    output: { total: outputTotal, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0, measuredAverageRespondTime: null },
    removed: { duplicateCount: 0, unavailableCount: 0, riskyCount: 0 },
    validation: { okCount: inputTotal, warnCount: 0, invalidCount: 0 },
  };
}

describe('splitByCategory — uses cleaned sources', () => {
  it('should produce groups with cleaned names same as cleaned-sources', () => {
    const sources = [
      makeSrc(0, '米国度', '小说', 'https://miguodu.com', '小说'),
      makeSrc(1, 'UAA有声', '有声', 'https://uaa-audio.com', '有声'),
      makeSrc(2, '饭角有声', '有声', 'https://fanjiao.com', '有声'),
    ];
    const groups = splitByCategory(sources);

    expect(groups['novel']).toHaveLength(1);
    expect(groups['novel'][0].bookSourceName).toBe('米国度');
    expect(groups['audio']).toHaveLength(2);
    expect(groups['audio'][0].bookSourceName).toBe('UAA有声');
    expect(groups['audio'][1].bookSourceName).toBe('饭角有声');
  });

  it('should never have dirty names in groups when given clean sources', () => {
    const sources = [
      makeSrc(0, '米国度', '小说', 'u1', '小说'),
      makeSrc(1, 'QQ浏览器', '其他', 'u2', '其他'),
      makeSrc(2, '7wav', '有声', 'u3', '有声'),
      makeSrc(3, 'SF轻小说', '小说', 'u4', '小说'),
    ];
    const groups = splitByCategory(sources);
    const all = [...Object.values(groups).flat()];
    const dirty = findDirtyNames(all);
    expect(dirty).toHaveLength(0);
  });
});

describe('output consistency — detects errors', () => {
  it('should detect dirty names in groups', () => {
    const cleaned = [
      makeSrc(0, '米国度', '小说', 'u1', '小说'),
    ];
    const groups: Record<string, BookSource[]> = {
      'novel.json': [{ ...cleaned[0], bookSourceName: '🚖 米国度' } as BookSource],
    };
    const summary = makeSummary(1, 1);
    const result = validateOutputConsistency(
      [{ index: 0, originalName: '🚖 米国度', originalUrl: 'u1', validationStatus: 'STRUCTURE_OK', kept: true, removedReason: null } as SourceAnalysis],
      cleaned, groups, summary,
    );
    expect(result.pass).toBe(false);
    expect(result.summary.dirtyNamesInGroups).toBeGreaterThan(0);
  });

  it('should detect group field mismatches (bookSourceGroup != file category)', () => {
    const cleaned = [
      makeSrc(0, 'UAA有声', '小说', 'u1', '有声'),
    ];
    const groups: Record<string, BookSource[]> = {
      'audio.json': [{ ...cleaned[0], bookSourceGroup: '小说' } as BookSource],
    };
    const summary = makeSummary(1, 1);
    const result = validateOutputConsistency(
      [{ index: 0, originalName: 'UAA有声', originalUrl: 'u1', validationStatus: 'STRUCTURE_OK', kept: true, removedReason: null } as SourceAnalysis],
      cleaned, groups, summary,
    );
    expect(result.summary.groupFieldMismatches).toBeGreaterThan(0);
  });

  it('should detect cleaned-vs-groups field differences', () => {
    const cleaned = [
      makeSrc(0, '米国度', '小说', 'u1', '小说'),
    ];
    const groups: Record<string, BookSource[]> = {
      'novel.json': [{ ...cleaned[0], bookSourceName: '🚖 米国度' } as BookSource],
    };
    const summary = makeSummary(1, 1);
    const result = validateOutputConsistency(
      [{ index: 0, originalName: '🚖 米国度', originalUrl: 'u1', validationStatus: 'STRUCTURE_OK', kept: true, removedReason: null } as SourceAnalysis],
      cleaned, groups, summary,
    );
    expect(result.summary.cleanedGroupsDiffs).toBeGreaterThan(0);
  });

  it('should pass when everything is clean', () => {
    const cleaned = [
      makeSrc(0, '米国度', '小说', 'u1', '小说'),
      makeSrc(1, 'UAA有声', '有声', 'u2', '有声'),
    ];
    const groups: Record<string, BookSource[]> = {
      'novel.json': [cleaned[0]],
      'audio.json': [cleaned[1]],
    };
    const summary = makeSummary(2, 2);
    const result = validateOutputConsistency(
      [
        { index: 0, originalName: '米国度', originalUrl: 'u1', validationStatus: 'STRUCTURE_OK', kept: true, removedReason: null } as SourceAnalysis,
        { index: 1, originalName: 'UAA有声', originalUrl: 'u2', validationStatus: 'STRUCTURE_OK', kept: true, removedReason: null } as SourceAnalysis,
      ],
      cleaned, groups, summary,
    );
    expect(result.pass).toBe(true);
    expect(result.summary.dirtyNamesInGroups).toBe(0);
    expect(result.summary.groupFieldMismatches).toBe(0);
    expect(result.summary.cleanedGroupsDiffs).toBe(0);
  });
});

describe('isDirtyName', () => {
  it('should detect emoji as dirty', () => expect(isDirtyName('🚖 米国度').dirty).toBe(true));
  it('should detect quality brackets as dirty', () => expect(isDirtyName('茶马小说（优++）').dirty).toBe(true));
  it('should detect maintainer @ as dirty', () => expect(isDirtyName('笔趣阁@遇知').dirty).toBe(true));
  it('should NOT flag clean English', () => expect(isDirtyName('QQ浏览器').dirty).toBe(false));
  it('should NOT flag clean numbers', () => expect(isDirtyName('7wav').dirty).toBe(false));
  it('should NOT flag clean mixed', () => expect(isDirtyName('SF轻小说').dirty).toBe(false));
  it('should NOT flag clean Chinese', () => expect(isDirtyName('米国度').dirty).toBe(false));
});

describe('buildGroupMismatchReport', () => {
  it('should report bookSourceGroup not matching file category', () => {
    const src = { ...makeSrc(0, 'UAA有声', '小说', 'u1', '有声') };
    const groups: Record<string, BookSource[]> = { 'audio.json': [src] };
    const result = buildGroupMismatchReport(groups);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].currentBookSourceGroup).toBe('小说');
    expect(result[0].expectedBookSourceGroup).toBe('有声');
  });
});

describe('buildCleanedGroupDiffReport', () => {
  it('should report when cleaned and group source have different fields', () => {
    const cleaned = [makeSrc(0, '米国度', '小说', 'u1', '小说')];
    const groups: Record<string, BookSource[]> = { 'novel.json': [{ ...cleaned[0], bookSourceName: '🚖 米国度' } as BookSource] };
    const result = buildCleanedGroupDiffReport(cleaned, groups);
    expect(result.length).toBeGreaterThan(0);
  });
});
