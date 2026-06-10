#!/usr/bin/env node
/**
 * verify-output.mjs — External verification of legado-source-toolkit output.
 *
 * Usage: node scripts/verify-output.mjs <bookSource.json> <output-dir>
 *
 * Checks:
 *   1. cleaned-sources.json and groups/*.json come from the same final objects
 *   2. No dirty names in groups
 *   3. No bookSourceGroup mismatches with file category
 *   4. originalIndex sets match
 *   5. Field consistency between cleaned and groups
 *
 * Exit code 0 = all checks pass, exit code 1 = errors found.
 */

import fs from 'fs';
import path from 'path';

const inputPath = process.argv[2];
const outDir = process.argv[3];

if (!inputPath || !outDir) {
  console.error('Usage: node scripts/verify-output.mjs <bookSource.json> <output-dir>');
  process.exit(2);
}

// ── Helpers ──

const DIRTY_PATTERNS = [
  { name: 'emoji', regex: /\p{Extended_Pictographic}/u },
  { name: 'quality-brackets', regex: /[（(]\s*(?:优\+*|可用|修复|推荐|新站|备用|失效|需登录)\s*[）)]/ },
  { name: 'quality-fullwidth', regex: /[【]\s*(?:优\+*|可用|修复|推荐)\s*[】]/ },
  { name: 'maintainer-at', regex: /@[^\s,，]+/ },
];

const CAT_MAP = { 'novel': '小说', 'comic': '漫画', 'audio': '有声', 'video': '影视', 'download': '下载', 'other': '其他' };

function isDirtyName(name) {
  for (const p of DIRTY_PATTERNS) { if (p.regex.test(name)) return true; }
  return false;
}

// ── Load data ──

const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const cleaned = JSON.parse(fs.readFileSync(path.join(outDir, 'cleaned-sources.json'), 'utf-8'));

const groups = {};
const groupsDir = path.join(outDir, 'groups');
let groupTotal = 0;
if (fs.existsSync(groupsDir)) {
  for (const f of fs.readdirSync(groupsDir)) {
    if (f.endsWith('.json')) {
      groups[f] = JSON.parse(fs.readFileSync(path.join(groupsDir, f), 'utf-8'));
      groupTotal += groups[f].length;
    }
  }
}

const consistency = JSON.parse(fs.readFileSync(path.join(outDir, 'reports', 'output-consistency.json'), 'utf-8'));
const summary = JSON.parse(fs.readFileSync(path.join(outDir, 'reports', 'summary.json'), 'utf-8'));

// ── Checks ──

let errors = 0;
let dirtyNamesInGroups = 0;
let groupFieldMismatches = 0;

console.log('=== verify-output.mjs ===');
console.log(`input total: ${input.length}`);
console.log(`cleaned-sources total: ${cleaned.length}`);
console.log(`groups total: ${groupTotal}`);
console.log();

// Check 1: cleaned and groups from same objects
console.log('--- Check 1: cleaned vs groups object consistency ---');
const csByOix = new Map();
cleaned.forEach(s => { csByOix.set(s.originalIndex, s); });

const groupOixSet = new Set();
for (const [file, list] of Object.entries(groups)) {
  for (const s of list) groupOixSet.add(s.originalIndex);
}

const missingFromGroups = [...csByOix.keys()].filter(i => !groupOixSet.has(i));
const extraInGroups = [...groupOixSet].filter(i => !csByOix.has(i));

if (missingFromGroups.length === 0 && extraInGroups.length === 0) {
  console.log('  ✅ originalIndex sets match');
} else {
  console.log(`  ❌ missing from groups: ${missingFromGroups.length}, extra in groups: ${extraInGroups.length}`);
  errors++;
}

// Check 2: Same originalIndex → same key fields
let fieldMismatchCount = 0;
for (const [file, list] of Object.entries(groups)) {
  for (const s of list) {
    const cs = csByOix.get(s.originalIndex);
    if (!cs) continue;
    if (s.bookSourceName !== cs.bookSourceName ||
        s.bookSourceGroup !== cs.bookSourceGroup ||
        s.bookSourceUrl !== cs.bookSourceUrl) {
      fieldMismatchCount++;
      if (fieldMismatchCount <= 5) {
        console.log(`  ❌ field mismatch: idx ${s.originalIndex}`);
        console.log(`     cleaned: name="${cs.bookSourceName}" group="${cs.bookSourceGroup}" url="${cs.bookSourceUrl}"`);
        console.log(`     group(${file}): name="${s.bookSourceName}" group="${s.bookSourceGroup}" url="${s.bookSourceUrl}"`);
      }
    }
  }
}
if (fieldMismatchCount === 0) {
  console.log('  ✅ cleaned-vs-groups fields consistent');
} else {
  console.log(`  ❌ field mismatches: ${fieldMismatchCount}`);
  errors++;
}

// Check 3: Dirty names in groups
console.log('--- Check 2: dirty names in groups ---');
let dirtyCount = 0;
for (const [file, list] of Object.entries(groups)) {
  for (const s of list) {
    if (isDirtyName(s.bookSourceName || '')) {
      dirtyCount++;
      if (dirtyCount <= 5) console.log(`  ❌ ${file}: "${s.bookSourceName}" (idx ${s.originalIndex})`);
    }
  }
}
dirtyNamesInGroups = dirtyCount;
if (dirtyCount === 0) {
  console.log('  ✅ no dirty names in groups');
} else {
  console.log(`  ❌ dirty names in groups: ${dirtyCount}`);
  errors++;
}

// Check 4: Group field (bookSourceGroup) matches file category
console.log('--- Check 3: group field mismatches ---');
let gmCount = 0;
for (const [file, list] of Object.entries(groups)) {
  const expectedCat = CAT_MAP[file.replace('.json', '')] || '';
  if (!expectedCat) continue;
  for (const s of list) {
    const firstTag = (s.bookSourceGroup || '').split(',')[0].trim();
    if (firstTag && firstTag !== expectedCat) {
      gmCount++;
      if (gmCount <= 5) console.log(`  ❌ ${file}: expected "${expectedCat}" but bookSourceGroup starts with "${firstTag}" (idx ${s.originalIndex}, name="${s.bookSourceName}")`);
    }
  }
}
groupFieldMismatches = gmCount;
if (gmCount === 0) {
  console.log('  ✅ group field matches file category');
} else {
  console.log(`  ❌ group field mismatches: ${gmCount}`);
  errors++;
}

// Check 5: Summary consistency
console.log('--- Check 4: summary consistency ---');
const consistencyPass = consistency.pass === true;
const summaryMatch = summary.input.total === input.length && summary.output.total === cleaned.length;
if (consistencyPass && summaryMatch) {
  console.log('  ✅ summary and consistency reports consistent');
} else {
  if (!consistencyPass) console.log('  ❌ consistency check failed');
  if (!summaryMatch) console.log(`  ❌ summary mismatch: input.total=${summary.input.total} vs ${input.length}, output.total=${summary.output.total} vs ${cleaned.length}`);
  errors++;
}

console.log();
console.log('=======================================');
console.log(`  verify-output.mjs Errors: ${errors}`);
console.log(`  dirty names in groups: ${dirtyNamesInGroups}`);
console.log(`  group field mismatches: ${groupFieldMismatches}`);
console.log('=======================================');

if (errors > 0) {
  process.exitCode = 1;
} else {
  console.log('✅ All checks passed.');
}
