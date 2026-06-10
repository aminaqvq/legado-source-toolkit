import type { BookSource, CategoryLabel } from '../types/book-source.js';

/**
 * Split book sources by their category.
 * `sources` must be the CLEANED final sources — each carrying
 * `finalCategory` and `originalIndex` tracking fields.
 */
export function splitByCategory(
  sources: BookSource[],
): Record<string, BookSource[]> {
  const groups: Record<string, BookSource[]> = {
    'novel': [],
    'comic': [],
    'audio': [],
    'video': [],
    'download': [],
    'other': [],
    'invalid': [],
    'risky': [],
  };

  for (const source of sources) {
    const category = getCategory(source);
    const key = categoryToFileKey(category);
    if (!groups[key]) groups[key] = [];
    groups[key].push(source);
  }

  // Remove empty groups
  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key];
  }

  return groups;
}

/** Extract the category from a final source (tracking field or group). */
function getCategory(source: BookSource): CategoryLabel {
  const fc = (source as Record<string, unknown>)['finalCategory'];
  if (fc && typeof fc === 'string' && isCategory(fc)) return fc as CategoryLabel;
  // Fallback: use bookSourceGroup
  const g = source.bookSourceGroup || '';
  const firstTag = g.split(',')[0].trim();
  if (isCategory(firstTag)) return firstTag as CategoryLabel;
  return '其他';
}

function isCategory(s: string): s is CategoryLabel {
  return ['小说', '漫画', '有声', '影视', '下载', '其他', '失效'].includes(s);
}

function categoryToFileKey(cat: CategoryLabel): string {
  switch (cat) {
    case '小说': return 'novel';
    case '漫画': return 'comic';
    case '有声': return 'audio';
    case '影视': return 'video';
    case '下载': return 'download';
    case '其他': return 'other';
    case '失效': return 'invalid';
    default: return 'other';
  }
}
