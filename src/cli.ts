#!/usr/bin/env node
import { Command } from 'commander';
import { processSources } from './core/process.js';
import { readBookSources } from './core/parse.js';
import { cleanBookSourceName } from './core/clean-name.js';
import { classifySource } from './core/classify.js';
import { getHostKey } from './core/normalize-url.js';
import { validateStructure } from './core/validate-structure.js';
import { splitByCategory } from './core/split.js';
import { writeJsonFile, ensureOutputDir } from './utils/fs.js';
import { keyValue, heading } from './utils/logger.js';
import { normalizeValidateMode } from './core/batch-validate.js';
import path from 'node:path';

const program = new Command();

program
  .name('ls-tk')
  .description('Legado Source Toolkit — 书源 JSON 清洗、校验、分类、去重工具')
  .version('1.2.0');

// ── process ──
program
  .command('process')
  .description('完整处理流程：清洗、分类、校验、去重、输出')
  .argument('<input>', '输入 JSON 文件路径')
  .option('-o, --out <dir>', '输出目录', './output')
  .option('--online', '启用在线连通性和搜索校验', false)
  .option('--no-online', '禁用在线校验')
  .option('--dedupe <level>', '去重级别: none | exact | url | conservative | host | aggressive', 'conservative')
  .option('--group-mode <mode>', '分组写入模式: overwrite | append | preserve | category-first | report-only', 'category-first')
  .option('--name-mode <mode>', '名称清洗模式: zh-only | loose', 'loose')
  .option('--concurrency <n>', '并发数', '16')
  .option('--timeout <ms>', '请求超时毫秒', '8000')
  .option('--retry <n>', '重试次数', '1')
  .option('--dry-run', '试运行，不写入文件', false)
  .option('--write-meta', '将分析元数据写回书源 JSON', false)
  .option('--format <fmt>', '输出格式: pretty | minified', 'pretty')
  .option('--keep-disabled', '保留 disabled 的源', false)
  .option('--only-enabled', '仅处理 enabled 的源', false)
  .option('--include-non-http', '保留非 HTTP 源', true)
  .option('--keep-latin-when-needed', 'zh-only 模式下保留拉丁字母', false)
  .option('--allow-risky-dedupe', '允许 host/aggressive 去重时跨分类跨类型删除', false)
  .option('--include-unknown', '在 cleaned-sources 中包含 unknown 状态源', false)
  .option('--include-complex', '在 cleaned-sources 中包含 complex_unverified 状态源', false)
  .option('--include-unavailable', '在 cleaned-sources 中包含 dead/timeout/forbidden 源', false)
  .option('--write-normalized-url', '将规范化后的 URL 写回输出', false)
  .option('--strict', '输出一致性检查失败时以非零退出码退出', false)
  .option('--validate-mode <mode>', '批量深度校验模式: fast | standard | deep (默认不启用)', '')
  .option('--batch-concurrency <n>', '批量校验并发数', '8')
  .action(async (input: string, options: Record<string, string | boolean>) => {
    const dedupe = String(options.dedupe);
    const groupMode = String(options.groupMode);
    const nameMode = String(options.nameMode);
    const format = String(options.format);

    await processSources({
      inputPath: input,
      outDir: String(options.out),
      online: Boolean(options.online),
      dedupeLevel: (['none', 'exact', 'url', 'conservative', 'host', 'aggressive'] as const).includes(dedupe as never)
        ? dedupe as never
        : 'conservative',
      groupMode: (['overwrite', 'append', 'report-only', 'preserve', 'category-first'] as const).includes(groupMode as never)
        ? groupMode as never
        : 'category-first',
      nameMode: (['zh-only', 'loose'] as const).includes(nameMode as never)
        ? nameMode as never
        : 'loose',
      concurrency: parseInt(String(options.concurrency), 10) || 16,
      timeout: parseInt(String(options.timeout), 10) || 8000,
      retry: parseInt(String(options.retry), 10) || 1,
      dryRun: Boolean(options.dryRun),
      writeMeta: Boolean(options.writeMeta),
      outputFormat: (['pretty', 'minified'] as const).includes(format as never) ? format as never : 'pretty',
      keepDisabled: Boolean(options.keepDisabled),
      onlyEnabled: Boolean(options.onlyEnabled),
      includeNonHttp: Boolean(options.includeNonHttp),
      keepLatinWhenNeeded: Boolean(options.keepLatinWhenNeeded),
      allowRiskyDedupe: Boolean(options.allowRiskyDedupe),
      includeUnknown: Boolean(options.includeUnknown),
      includeComplex: Boolean(options.includeComplex),
      includeUnavailable: Boolean(options.includeUnavailable),
      writeNormalizedUrl: Boolean(options.writeNormalizedUrl),
      strict: Boolean(options.strict),
      validateMode: (() => {
        const raw = String(options.validateMode ?? '');
        if (raw === '') return undefined;
        const mode = normalizeValidateMode(raw);
        if (!mode) {
          console.error(`Error: Invalid --validate-mode "${raw}". Expected one of: fast, standard, deep.`);
          process.exit(1);
        }
        return mode;
      })(),
      batchConcurrency: (() => {
        const raw = options.batchConcurrency;
        const n = parseInt(String(raw), 10);
        if (!Number.isInteger(n) || n < 1 || n > 100) {
          console.error(`Error: --batch-concurrency must be an integer between 1 and 100, got: ${raw}`);
          process.exit(1);
        }
        return n;
      })(),
    });
  });

// ── inspect ──
program
  .command('inspect')
  .description('快速检查书源 JSON 概况')
  .argument('<input>', '输入 JSON 文件路径')
  .action((input: string) => {
    heading('Inspecting book sources');

    const { sources } = readBookSources(input);

    keyValue('Total sources', sources.length);

    // bookSourceType stats
    const typeCounts: Record<string, number> = {};
    for (const s of sources) {
      const t = String(s.bookSourceType ?? 'undefined');
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    heading('bookSourceType 分布');
    for (const [t, c] of Object.entries(typeCounts)) {
      const labels: Record<string, string> = { '0': '小说', '1': '有声', '2': '漫画', '3': '下载' };
      keyValue(`${t} (${labels[t] || 'unknown'})`, c);
    }

    // bookSourceGroup stats
    const groupCounts: Record<string, number> = {};
    for (const s of sources) {
      const g = s.bookSourceGroup || '(none)';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    }
    heading('bookSourceGroup 分布');
    const topGroups = Object.entries(groupCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [g, c] of topGroups) {
      keyValue(g, c);
    }

    // Duplicate host stats
    const hostCounts: Record<string, number> = {};
    for (const s of sources) {
      const host = getHostKey(s.bookSourceUrl) || '(none)';
      hostCounts[host] = (hostCounts[host] || 0) + 1;
    }
    const dupHosts = Object.entries(hostCounts).filter(([, c]) => c > 1);
    keyValue('Duplicate hosts', dupHosts.length);

    // Emoji names count
    let emojiCount = 0;
    for (const s of sources) {
      const name = s.bookSourceName ?? '';
      if (/[\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/u.test(name)) {
        emojiCount++;
      }
    }
    keyValue('Names with emoji', emojiCount);

    // Non-HTTP sources
    let nonHttpCount = 0;
    for (const s of sources) {
      if (s.bookSourceUrl && !/^https?:\/\//i.test(s.bookSourceUrl)) {
        nonHttpCount++;
      }
    }
    keyValue('Non-HTTP sources', nonHttpCount);

    // Complex JS sources
    let complexJsCount = 0;
    const jsPatterns = [/<js>/i, /@js:/i, /java\.ajax/i, /\beval\b/i, /Reload/i, /WebView/i];
    for (const s of sources) {
      const searchUrl = s.searchUrl || '';
      if (jsPatterns.some((p) => p.test(searchUrl))) {
        complexJsCount++;
      }
    }
    keyValue('Complex JS sources', complexJsCount);
  });

// ── validate ──
program
  .command('validate')
  .description('仅校验书源（不清洗、不去重）')
  .argument('<input>', '输入 JSON 文件路径')
  .option('--online', '启用在线校验', false)
  .option('--concurrency <n>', '并发数', '16')
  .option('--timeout <ms>', '超时毫秒', '8000')
  .action(async (input: string, _options: Record<string, string | boolean>) => {
    heading('Validating book sources');

    const { sources, analyses } = readBookSources(input);
    const online = Boolean(_options.online);

    const ok: string[] = [];
    const warn: string[] = [];
    const invalid: string[] = [];

    for (let i = 0; i < sources.length; i++) {
      const result = validateStructure(sources[i]);
      analyses[i].validationStatus = result.status;
      analyses[i].validationReason = result.reasons;

      if (result.status === 'STRUCTURE_OK') {
        ok.push(`${i}: ${sources[i].bookSourceName || '(unnamed)'}`);
      } else if (result.status === 'STRUCTURE_WARN') {
        warn.push(`${i}: ${sources[i].bookSourceName || '(unnamed)'} — ${result.reasons.join(', ')}`);
      } else {
        invalid.push(`${i}: ${sources[i].bookSourceName || '(unnamed)'} — ${result.reasons.join(', ')}`);
      }
    }

    // Online validation — structure-only via validate CLI; for full online use `process --online`
    if (online) {
      console.log('  ⚠ 在线验证仅在 `process --online` 中完整可用。`validate --online` 仅做结构校验。');
    }

    keyValue('OK', ok.length);
    keyValue('Warnings', warn.length);
    keyValue('Invalid', invalid.length);

    if (warn.length > 0) {
      heading('Warnings');
      for (const w of warn) console.log(`  ⚠ ${w}`);
    }
    if (invalid.length > 0) {
      heading('Invalid');
      for (const iv of invalid) console.log(`  ✖ ${iv}`);
    }
  });

// ── clean-name ──
program
  .command('clean-name')
  .description('仅清洗书源名称')
  .argument('<input>', '输入 JSON 文件路径')
  .option('-o, --out <file>', '输出文件路径', './output/cleaned-names.json')
  .option('--name-mode <mode>', '清洗模式: zh-only | loose', 'zh-only')
  .action((input: string, options: Record<string, string>) => {
    heading('Cleaning book source names');

    const { sources } = readBookSources(input);

    for (const source of sources) {
      const result = cleanBookSourceName(source.bookSourceName ?? '', {
        mode: (['zh-only', 'loose'] as const).includes(options.nameMode as never)
          ? options.nameMode as never
          : 'zh-only',
        keepLatinWhenNeeded: false,
      });
      source.bookSourceName = result.cleaned || source.bookSourceName;
      keyValue(source.bookSourceName ?? '(unnamed)', result.cleaned || '(empty — fallback)');
    }

    writeJsonFile(String(options.out), sources, true);
    heading(`Output: ${options.out}`);
  });

// ── split ──
program
  .command('split')
  .description('仅按分类拆分书源')
  .argument('<input>', '输入 JSON 文件路径')
  .option('-o, --out <dir>', '输出目录', './output/groups')
  .action((input: string, options: Record<string, string>) => {
    heading('Splitting book sources by category');

    const { sources, analyses } = readBookSources(input);

    // Classify each source
    for (let i = 0; i < analyses.length; i++) {
      const cls = classifySource(sources[i], analyses[i]);
      analyses[i].inferredGroup = cls.category;
    }

    const groups = splitByCategory(sources);
    const outDir = String(options.out);
    ensureOutputDir(outDir);

    for (const [key, groupSources] of Object.entries(groups)) {
      writeJsonFile(path.join(outDir, `${key}.json`), groupSources, true);
      keyValue(key, groupSources.length);
    }

    heading(`Output: ${outDir}`);
  });

// ── debug ──
program
  .command('debug')
  .description('单源调试：逐步验证书源的搜索→详情→目录→正文规则')
  .argument('<input>', '包含书源的 JSON 文件路径（取第一个源；多个源可加 --index）')
  .option('-k, --keyword <word>', '搜索关键词（默认使用 ruleSearch.checkKeyWord 或 "斗破苍穹"）')
  .option('-i, --index <n>', '调试输入文件中的第几个源（0-based），默认 0', '0')
  .option('-f, --format <fmt>', '输出格式: json | detailed | summary', 'detailed')
  .option('--timeout <ms>', '请求超时毫秒', '10000')
  .action(async (input: string, options: Record<string, string>) => {
    const { verifyAllRules } = await import('./core/verify-rules.js');
    const { readBookSources } = await import('./core/parse.js');
    const srcIdx = parseInt(options.index || '0', 10);

    const { sources } = readBookSources(input);
    if (sources.length === 0) {
      console.error('Error: no book sources found in input');
      process.exit(1);
    }

    if (srcIdx >= sources.length) {
      console.error(`Error: index ${srcIdx} out of range (${sources.length} sources)`);
      process.exit(1);
    }

    const source = sources[srcIdx];
    const keyword = options.keyword || undefined;
    const timeout = parseInt(options.timeout || '10000', 10);
    const fmt = options.format || 'detailed';

    console.log(`🐛 Debugging: ${source.bookSourceName || '(unnamed)'}`);
    console.log(`   URL: ${source.bookSourceUrl}`);
    console.log(`   Keyword: ${keyword || '(auto)'}`);
    console.log('');

    const result = await verifyAllRules(source, { keyword, timeout });

    if (fmt === 'summary') {
      console.log(result.summary);
    } else if (fmt === 'detailed') {
      for (const step of result.stages) {
        const icon = step.status === 'RULE_VERIFIED' ? '✅' : step.status === 'RULE_SKIPPED' ? '⏭️ ' : step.status === 'RULE_NOT_CHECKED' ? '⊘' : '❌';
        console.log(`${icon} [${step.stage}] ${step.status}`);
        if (step.url) console.log(`   URL: ${step.url}`);
        if (step.error) console.log(`   Error: ${step.error}`);
        if (step.resultSample) console.log(`   Sample: ${step.resultSample}`);
        if (step.resultCount !== undefined) console.log(`   Count: ${step.resultCount}`);
        if (step.responseSize) console.log(`   Size: ${step.responseSize} bytes`);
        console.log(`   Duration: ${step.duration}ms`);
        console.log('');
      }
      console.log(`⏱ Total: ${result.totalDuration}ms`);
      console.log(`📊 ${result.summary}`);
    } else {
      // JSON format
      console.log(JSON.stringify(result, null, 2));
    }
  });

program.parse();
