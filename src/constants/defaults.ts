import type { CategoryLabel, NameMode } from '../types/book-source.js';

// ── Online check defaults ──

export const DEFAULT_TIMEOUT = 8000;
export const DEFAULT_CONCURRENCY = 5;
export const DEFAULT_RETRY = 1;

// ── Default search keywords per category ──

export const DEFAULT_SEARCH_KEYWORDS: Record<CategoryLabel, string> = {
  '小说': '斗破苍穹',
  '漫画': '鬼灭之刃',
  '有声': '凡人修仙传',
  '影视': '庆余年',
  '下载': '三体',
  '其他': '斗破苍穹',
  '失效': '斗破苍穹',
};

// ── Default User-Agent (standard browser, NOT a bypass tool) ──

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── Scoring weights ──

export const SCORE = {
  // Bonuses
  AVAILABILITY_USABLE: 100,
  AVAILABILITY_PROBABLY_USABLE: 70,
  AVAILABILITY_COMPLEX_UNVERIFIED: 40,
  CONNECT_OK: 30,
  SEARCH_HTTP_OK: 30,
  SEARCH_RULE_LIKELY_OK: 20,
  ENABLED: 10,
  ENABLED_EXPLORE: 5,
  HAS_SEARCH_URL: 10,
  HAS_RULE_SEARCH_BOOKLIST: 10,
  HAS_RULE_SEARCH_NAME: 8,
  HAS_RULE_SEARCH_BOOKURL: 8,
  HAS_RULE_BOOKINFO_NAME: 8,
  HAS_RULE_TOC_CHAPTERLIST: 8,
  HAS_RULE_CONTENT_CONTENT: 8,
  CLASSIFICATION_HIGH: 5,

  // Penalties
  AVAILABILITY_DEAD: -100,
  AVAILABILITY_INVALID: -100,
  AVAILABILITY_TIMEOUT: -30,
  AVAILABILITY_FORBIDDEN: -10,
  NAME_CONTAINS_DEAD: -40,
  GROUP_CONTAINS_DEAD: -40,
  MISSING_SEARCH_URL: -20,
  MISSING_RULE_SEARCH: -20,
  MISSING_RULE_CONTENT: -20,
  RESPOND_TIME_HIGH: -20,       // > 30000ms
  LAST_UPDATE_OLD: -10,
  NEEDS_LOGIN: -10,
  COMPLEX_JS_PENALTY_MIN: -5,
  COMPLEX_JS_PENALTY_MAX: -15,
} as const;

// ── Respond time bonus brackets ──

export const RESPOND_TIME_BONUS: { max: number; bonus: number }[] = [
  { max: 500, bonus: 20 },
  { max: 1000, bonus: 18 },
  { max: 2000, bonus: 15 },
  { max: 3000, bonus: 12 },
  { max: 5000, bonus: 8 },
  { max: 10000, bonus: 4 },
  { max: 20000, bonus: 2 },
  { max: Infinity, bonus: 0 },
];

// ── Last update time bonus brackets (days) ──

export const LAST_UPDATE_BONUS: { max: number; bonus: number }[] = [
  { max: 7, bonus: 20 },
  { max: 30, bonus: 15 },
  { max: 90, bonus: 10 },
  { max: 180, bonus: 5 },
  { max: 365, bonus: 2 },
  { max: Infinity, bonus: 0 },
];

// ── Weight bonus brackets ──

export const WEIGHT_BONUS: { min: number; bonus: number }[] = [
  { min: 10000, bonus: 10 },
  { min: 5000, bonus: 8 },
  { min: 1000, bonus: 5 },
  { min: 100, bonus: 2 },
  { min: 0, bonus: 0 },
];

// ── Default name mode ──

export const DEFAULT_NAME_MODE: NameMode = 'loose';

// ── Default dedupe level (conservative to avoid false grouping) ──

export const DEFAULT_DEDUPE_LEVEL = 'conservative';
