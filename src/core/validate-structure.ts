import type { BookSource, CategoryLabel, ValidationStatus } from '../types/book-source.js';

interface StructureResult {
  status: ValidationStatus;
  reasons: string[];
}

/**
 * Validate the structural integrity of a book source.
 * Category-aware: different expectations for novels, comics, audio, downloads.
 */
export function validateStructure(
  source: BookSource,
  category?: CategoryLabel,
): StructureResult {
  const reasons: string[] = [];
  let criticalMissing = 0;
  let warnMissing = 0;

  // ── Critical fields (always required) ──
  if (!source.bookSourceName || source.bookSourceName.trim() === '') {
    reasons.push('Missing bookSourceName');
    criticalMissing++;
  }

  if (!source.bookSourceUrl || source.bookSourceUrl.trim() === '') {
    reasons.push('Missing bookSourceUrl');
    criticalMissing++;
  }

  if (source.bookSourceType == null) {
    reasons.push('Missing bookSourceType');
    warnMissing++;
  } else if (typeof source.bookSourceType !== 'number') {
    reasons.push('bookSourceType is not a number');
    warnMissing++;
  }

  if (!source.searchUrl || source.searchUrl.trim() === '') {
    reasons.push('Missing searchUrl');
    warnMissing++;
  }

  // ── Rule search fields ──
  const ruleSearch = source.ruleSearch;
  if (!ruleSearch || Object.keys(ruleSearch).length === 0) {
    reasons.push('Missing ruleSearch');
    criticalMissing++;
  } else {
    if (!isNonEmpty(ruleSearch.bookList)) {
      reasons.push('Missing ruleSearch.bookList');
      warnMissing++;
    }
    if (!isNonEmpty(ruleSearch.name)) {
      reasons.push('Missing ruleSearch.name');
      warnMissing++;
    }
    if (!isNonEmpty(ruleSearch.bookUrl)) {
      reasons.push('Missing ruleSearch.bookUrl');
      warnMissing++;
    }
  }

  // ── Rule book info ──
  const ruleBookInfo = source.ruleBookInfo;
  if (!ruleBookInfo || Object.keys(ruleBookInfo).length === 0) {
    reasons.push('Missing ruleBookInfo');
    warnMissing++;
  } else {
    if (!isNonEmpty(ruleBookInfo.name)) {
      reasons.push('Missing ruleBookInfo.name');
      warnMissing++;
    }
  }

  // ── Rule TOC ──
  const ruleToc = source.ruleToc;
  if (!ruleToc || Object.keys(ruleToc).length === 0) {
    reasons.push('Missing ruleToc');
    warnMissing++;
  } else {
    if (!isNonEmpty(ruleToc.chapterList)) {
      reasons.push('Missing ruleToc.chapterList');
      // For novels: missing chapterList is more severe
      if (category === '小说') {
        warnMissing++;
      } else {
        warnMissing++;
      }
    }
  }

  // ── Rule content (category-aware) ──
  const ruleContent = source.ruleContent;
  if (!ruleContent || Object.keys(ruleContent).length === 0) {
    reasons.push('Missing ruleContent');
    if (category === '小说') {
      criticalMissing++; // Critical for novels
    } else {
      warnMissing++;
    }
  } else {
    const hasContent = isNonEmpty(ruleContent.content);
    const hasImages = isNonEmpty(ruleContent.imageStyle);

    switch (category) {
      case '小说':
        // Novels MUST have content rule
        if (!hasContent) {
          reasons.push('Missing ruleContent.content');
          criticalMissing++;
        }
        break;
      case '漫画':
        // Comics can have content OR imageStyle
        if (!hasContent && !hasImages) {
          reasons.push('Missing ruleContent.content (novel) or imageStyle (comic)');
          warnMissing++;
        }
        break;
      case '有声':
        // Audio should have content rule
        if (!hasContent) {
          reasons.push('Missing ruleContent.content');
          warnMissing++;
        }
        break;
      case '下载':
        // Downloads should have content rule (download link)
        if (!hasContent) {
          reasons.push('Missing ruleContent.content (download link)');
          warnMissing++;
        }
        break;
      default:
        // Generic: warn on missing content
        if (!hasContent && !hasImages) {
          reasons.push('Missing ruleContent.content');
          warnMissing++;
        }
        break;
    }
  }

  // ── Determine status ──
  if (criticalMissing > 0) {
    return { status: 'STRUCTURE_INVALID', reasons };
  }
  if (warnMissing > 0) {
    return { status: 'STRUCTURE_WARN', reasons };
  }
  return { status: 'STRUCTURE_OK', reasons: [] };
}

/**
 * Check if a value is non-empty (not undefined, null, empty string, or whitespace-only).
 */
function isNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return true;
}
