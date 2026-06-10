import type { BookSource, CategoryLabel, ClassificationConfidence } from '../types/book-source.js';
import type { SourceAnalysis, ClassificationSignal } from '../types/analysis.js';
import {
  AUDIO_KEYWORDS,
  COMIC_KEYWORDS,
  DOWNLOAD_KEYWORDS,
  NOVEL_KEYWORDS,
  VIDEO_KEYWORDS,
} from '../constants/keywords.js';

interface ClassificationResult {
  category: CategoryLabel;
  confidence: ClassificationConfidence;
  tags: string[];
  signals: ClassificationSignal;
}

/**
 * Classify a book source into a category based on multiple signals.
 */
export function classifySource(
  source: BookSource,
  analysis: SourceAnalysis,
): ClassificationResult {
  const signals: Map<CategoryLabel, number> = new Map();
  const tags: string[] = [];

  const name = analysis.cleanedName || source.bookSourceName || '';
  const group = source.bookSourceGroup || '';

  // ── Signal 1: bookSourceType ──
  const typeScore = scoreFromType(source.bookSourceType);
  const typeCategory = categoryFromType(source.bookSourceType);
  for (const [cat, s] of Object.entries(typeScore)) {
    addSignal(signals, cat as CategoryLabel, s);
  }

  // ── Signal 2: Keywords in name ──
  const nameScores: string[] = [];
  const keywordScores = scoreFromKeywords(name, group);
  for (const [cat, s] of Object.entries(keywordScores)) {
    addSignal(signals, cat as CategoryLabel, s);
  }
  // Collect which name keywords matched
  const nameLower = name.toLowerCase();
  if (matchesAny(nameLower, NOVEL_KEYWORDS)) nameScores.push('novel');
  if (matchesAny(nameLower, COMIC_KEYWORDS)) nameScores.push('comic');
  if (matchesAny(nameLower, AUDIO_KEYWORDS)) nameScores.push('audio');
  if (matchesAny(nameLower, VIDEO_KEYWORDS)) nameScores.push('video');
  if (matchesAny(nameLower, DOWNLOAD_KEYWORDS)) nameScores.push('download');

  // ── Signal 3: Media features in ruleContent/searchUrl/exploreUrl ──
  const ruleRules: string[] = [];
  const ruleContent = source.ruleContent;
  const sourceRegex = ruleContent?.sourceRegex || '';
  const searchUrl = source.searchUrl || '';
  const exploreUrl = source.exploreUrl || '';
  const combined = `${sourceRegex} ${searchUrl} ${exploreUrl}`.toLowerCase();

  if (/m3u8|mp4|\.flv|video|vod|\.ts\b/.test(combined)) {
    addSignal(signals, '影视', 20);
    tags.push('video-rule-detected');
    ruleRules.push('video');
  }
  if (/mp3|m4a|\.aac|audio|listen|听/.test(combined)) {
    addSignal(signals, '有声', 20);
    tags.push('audio-rule-detected');
    ruleRules.push('audio');
  }
  if (/img|image|comic|漫画图片|图片章节|\.jpg|\.png|\.webp|插图/.test(combined)) {
    addSignal(signals, '漫画', 12);
    tags.push('image-rule-detected');
    ruleRules.push('comic');
  }
  if (/epub|pdf|azw3|mobi|download|下载|文件/.test(combined)) {
    addSignal(signals, '下载', 15);
    tags.push('download-rule-detected');
    ruleRules.push('download');
  }

  // ── Signal 4: bookSourceGroup contains category keywords ──
  const groupCategory = categoryFromKeywords(group);
  if (groupCategory) {
    addSignal(signals, groupCategory, 10);
  }

  // ── Signal 5: cross-validate type with name ──
  if (source.bookSourceType === 1 && matchesAny(name, AUDIO_KEYWORDS)) {
    addSignal(signals, '有声', 20);
  }
  if (source.bookSourceType === 2 && matchesAny(name, COMIC_KEYWORDS)) {
    addSignal(signals, '漫画', 20);
  }

  // ── Detect type-vs-keyword conflicts ──
  const keywordBasedCategory = topKeywordCategory(keywordScores);
  const conflictTags: string[] = [];
  if (
    typeCategory &&
    keywordBasedCategory &&
    typeCategory !== keywordBasedCategory &&
    typeCategory !== '其他'
  ) {
    conflictTags.push(`type-vs-keyword:${typeCategory}-vs-${keywordBasedCategory}`);
  }

  // ── Determine winner ──
  let bestCat: CategoryLabel = '其他';
  let bestScore = 0;
  let secondScore = 0;

  for (const [cat, score] of signals) {
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestCat = cat;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // ── Confidence — now reflects actual conflicts ──
  let confidence: ClassificationConfidence;
  if (bestScore >= 20) {
    // Check if a close second (within 10 points) disagrees
    if (secondScore > 0 && (bestScore - secondScore) <= 10 && conflictTags.length > 0) {
      confidence = 'conflict';
    } else if (conflictTags.length > 0) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }
  } else if (bestScore >= 10) {
    confidence = conflictTags.length > 0 ? 'low' : 'medium';
  } else {
    confidence = 'low';
  }

  // ── Check for "失效" markers (use original name before cleaning) ──
  const allText = `${analysis.originalName} ${analysis.originalGroup} ${source.bookSourceGroup || ''}`.toLowerCase();
  if (/失效|已死|挂掉|不可用|死了|废弃/.test(allText)) {
    bestCat = '失效';
    tags.push('marked-dead');
    confidence = 'high';
  }

  const classificationSignals: ClassificationSignal = {
    fromType: typeCategory,
    fromName: nameScores,
    fromGroup: groupCategory,
    fromRules: ruleRules,
    finalCategory: bestCat,
    confidence,
    conflictTags,
  };

  return { category: bestCat, confidence, tags, signals: classificationSignals };
}

// ── Helpers ──

function addSignal(map: Map<CategoryLabel, number>, cat: CategoryLabel, score: number): void {
  map.set(cat, (map.get(cat) || 0) + score);
}

function scoreFromType(bookSourceType: number | null | undefined): Partial<Record<CategoryLabel, number>> {
  switch (bookSourceType) {
    case 0: return { '小说': 18 };
    case 1: return { '有声': 18 };
    case 2: return { '漫画': 18 };
    case 3: return { '下载': 18 };
    default: return { '其他': 2 };
  }
}

function scoreFromKeywords(name: string, group: string): Partial<Record<CategoryLabel, number>> {
  const text = `${name} ${group}`.toLowerCase();
  const scores: Partial<Record<CategoryLabel, number>> = {};

  if (matchesAny(text, COMIC_KEYWORDS)) scores['漫画'] = (scores['漫画'] || 0) + 18;
  if (matchesAny(text, NOVEL_KEYWORDS)) scores['小说'] = (scores['小说'] || 0) + 18;
  if (matchesAny(text, AUDIO_KEYWORDS)) scores['有声'] = (scores['有声'] || 0) + 18;
  if (matchesAny(text, VIDEO_KEYWORDS)) scores['影视'] = (scores['影视'] || 0) + 18;
  if (matchesAny(text, DOWNLOAD_KEYWORDS)) scores['下载'] = (scores['下载'] || 0) + 18;

  return scores;
}

function categoryFromKeywords(text: string): CategoryLabel | null {
  const lower = text.toLowerCase();
  if (matchesAny(lower, COMIC_KEYWORDS)) return '漫画';
  if (matchesAny(lower, NOVEL_KEYWORDS)) return '小说';
  if (matchesAny(lower, AUDIO_KEYWORDS)) return '有声';
  if (matchesAny(lower, VIDEO_KEYWORDS)) return '影视';
  if (matchesAny(lower, DOWNLOAD_KEYWORDS)) return '下载';
  return null;
}

function matchesAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function categoryFromType(bookSourceType: number | null | undefined): CategoryLabel | null {
  switch (bookSourceType) {
    case 0: return '小说';
    case 1: return '有声';
    case 2: return '漫画';
    case 3: return '下载';
    default: return null;
  }
}

function topKeywordCategory(
  scores: Partial<Record<CategoryLabel, number>>,
): CategoryLabel | null {
  let best: CategoryLabel | null = null;
  let bestScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if ((score as number) > bestScore) {
      bestScore = score as number;
      best = cat as CategoryLabel;
    }
  }
  return best;
}
