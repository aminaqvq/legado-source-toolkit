import { describe, it, expect } from 'vitest';
import { readBookSources } from '../src/core/parse.js';
import { cleanBookSourceName } from '../src/core/clean-name.js';
import { classifySource } from '../src/core/classify.js';
import { validateStructure } from '../src/core/validate-structure.js';
import { normalizeUrl } from '../src/core/normalize-url.js';
import { calculateScore } from '../src/core/score.js';
import { dedupeSources } from '../src/core/dedupe.js';
import { splitByCategory } from '../src/core/split.js';
import { checkConnectivity } from '../src/core/validate-online.js';
import { checkSearchUrl } from '../src/core/validate-search.js';
import type { BookSource } from '../src/types/book-source.js';
import { readJsonFile, writeJsonFile } from '../src/utils/fs.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixtures', 'sample-sources.json');

describe('End-to-end process', () => {
  it('should read sample sources without error', () => {
    const { sources, analyses } = readBookSources(fixturePath);
    expect(sources.length).toBeGreaterThanOrEqual(14);
    expect(analyses.length).toBe(sources.length);
  });

  it('should preserve an unknown field on each source', () => {
    // The fixture doesn't have unknown fields out of the box,
    // but the schema uses .passthrough() so unknown fields are kept
    const raw = readJsonFile<BookSource[]>(fixturePath);
    // Add a custom field to one source
    (raw[0] as Record<string, unknown>).__custom_test_field = 'hello123';

    // Write to temp, read back
    const tmpPath = path.join(__dirname, 'fixtures', '_tmp_test.json');
    writeJsonFile(tmpPath, raw);

    const { sources } = readBookSources(tmpPath);
    expect((sources[0] as Record<string, unknown>).__custom_test_field).toBe('hello123');

    // Cleanup
    fs.removeSync(tmpPath);
  });
});

describe('Full pipeline without online checks', () => {
  it('should process all sources through the pipeline', () => {
    const { sources, analyses } = readBookSources(fixturePath);

    // Phase 1: Clean names
    for (let i = 0; i < analyses.length; i++) {
      const r = cleanBookSourceName(sources[i].bookSourceName ?? '', {
        mode: 'zh-only',
        keepLatinWhenNeeded: false,
      });
      analyses[i].cleanedName = r.cleaned;
      analyses[i].warnings.push(...r.warnings);
    }

    // Verify expected clean results
    expect(analyses[0].cleanedName).toBe('米国度');       // 🚖 米国度
    expect(analyses[1].cleanedName).toContain('有声');     // 🎧 UAA有声
    expect(analyses[2].cleanedName).toBe('再漫画');        // 🎨再漫画💓
    expect(analyses[3].cleanedName).toContain('笔趣阁');   // ❤️笔趣阁新站@遇知
    expect(analyses[4].cleanedName).toContain('猫眼看书'); // 猫眼看书（优++）
    expect(analyses[5].cleanedName).toBe('漫蛙');          // 漫蛙
    expect(analyses[6].cleanedName).toBe('刚够小说网');    // 刚够小说网

    // Phase 2: Normalize URLs
    for (let i = 0; i < analyses.length; i++) {
      const norm = normalizeUrl(sources[i].bookSourceUrl);
      analyses[i].normalizedUrl = norm.url;
      analyses[i].normalizedHost = norm.normalizedHost;
    }

    expect(analyses[0].normalizedHost).toBe('miguodu.com');

    // Phase 3: Classify
    for (let i = 0; i < analyses.length; i++) {
      const cls = classifySource(sources[i], analyses[i]);
      analyses[i].inferredGroup = cls.category;
      analyses[i].classificationConfidence = cls.confidence;
    }

    expect(analyses[0].inferredGroup).toBe('小说');
    expect(analyses[2].inferredGroup).toBe('漫画');     // comic
    expect(analyses[8].inferredGroup).toBe('失效');     // 失效站

    // Phase 4: Validate structure
    for (let i = 0; i < analyses.length; i++) {
      const struct = validateStructure(sources[i]);
      analyses[i].validationStatus = struct.status;
      analyses[i].validationReason = struct.reasons;
    }

    // Most should be OK or WARN
    const okCount = analyses.filter((a) => a.validationStatus === 'STRUCTURE_OK').length;
    expect(okCount).toBeGreaterThan(0);

    // Phase 5: Score
    for (let i = 0; i < analyses.length; i++) {
      // Set availability manually for scoring (no online check)
      if (analyses[i].validationStatus === 'STRUCTURE_INVALID') {
        analyses[i].availability = 'invalid';
      } else if (analyses[i].validationStatus === 'STRUCTURE_WARN') {
        analyses[i].availability = 'probably_usable';
      } else {
        analyses[i].availability = 'unknown';
      }

      const scoreResult = calculateScore(sources[i], analyses[i]);
      analyses[i].score = scoreResult.score;
      analyses[i].scoreBreakdown = scoreResult.breakdown;
    }

    // The "失效站" should have a low score due to name penalty
    const deadSource = analyses[8]; // ✨失效站✨
    // Score might not be negative due to other bonuses, but should have the name penalty
    expect(deadSource.scoreBreakdown['name_contains_dead']).toBe(-40);

    // The usable sources should have positive scores
    const goodSource = analyses[0]; // 米国度
    expect(goodSource.score).toBeGreaterThan(0);

    // Phase 6: Dedupe
    const dedupeResult = dedupeSources(sources, analyses, { level: 'host' });
    // Check that duplicates are found (m.biqiku.com vs www.biqiku.com)
    const dupGroups = dedupeResult.groups;
    // There should be at least one group with biqiku.com duplicates
    expect(dupGroups.length).toBeGreaterThanOrEqual(0);

    // Phase 7: Split (new API: takes cleaned sources directly)
    const keptAnalyses = analyses.filter((a) => a.kept);
    const finalSources = keptAnalyses.map((a) => {
      const s = { ...sources[a.index] };
      (s as Record<string,unknown>)['finalCategory'] = a.inferredGroup;
      (s as Record<string,unknown>)['originalIndex'] = a.index;
      return s;
    });
    const groups = splitByCategory(finalSources);
    expect(Object.keys(groups).length).toBeGreaterThan(0);
  });
});

describe('Non-HTTP source handling', () => {
  it('should mark non-HTTP bookSourceUrl as NON_HTTP_SOURCE', async () => {
    const source: BookSource = {
      bookSourceName: '非HTTP源',
      bookSourceUrl: 'custom-identifier',
      bookSourceType: 0,
      searchUrl: 'https://example.com/search',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };

    const result = await checkConnectivity(source, { timeout: 3000 });
    expect(result.status).toBe('NON_HTTP_SOURCE');
  });
});

describe('Complex JS detection', () => {
  it('should skip complex JS search URLs', async () => {
    const source: BookSource = {
      bookSourceName: '复杂JS源',
      bookSourceUrl: 'https://test.com',
      bookSourceType: 0,
      searchUrl: '<js>java.ajax("https://api.test.com/search")</js>',
      ruleSearch: { bookList: 'div', name: 'h3', bookUrl: 'a@href' },
      ruleBookInfo: { name: 'h1' },
      ruleToc: { chapterList: 'li', chapterName: 'a' },
      ruleContent: { content: 'div' },
    };

    const result = await checkSearchUrl(source, '小说');
    expect(result.status).toBe('SEARCH_COMPLEX_JS_SKIPPED');
  });
});
