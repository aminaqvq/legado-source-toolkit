export interface BookSource {
  bookSourceName?: string;
  bookSourceUrl?: string;
  bookSourceGroup?: string;
  bookSourceType?: number;
  bookSourceComment?: string;
  variableComment?: string;
  bookUrlPattern?: string;
  searchUrl?: string;
  exploreUrl?: string;
  ruleSearch?: RuleSearch;
  ruleExplore?: unknown;
  ruleBookInfo?: RuleBookInfo;
  ruleToc?: RuleToc;
  ruleContent?: RuleContent;
  header?: string;
  enabled?: boolean;
  enabledExplore?: boolean;
  enabledCookieJar?: boolean;
  respondTime?: number;
  lastUpdateTime?: number;
  weight?: number;
  concurrentRate?: string;
  loginUrl?: string;
  loginUi?: string;
  loginCheckJs?: string;
  jsLib?: string;
  [key: string]: unknown;
}

export interface RuleSearch {
  bookList?: string;
  name?: string;
  author?: string;
  kind?: string;
  wordCount?: string;
  lastChapter?: string;
  intro?: string;
  coverUrl?: string;
  bookUrl?: string;
  checkKeyWord?: string;
  [key: string]: unknown;
}

export interface RuleBookInfo {
  name?: string;
  author?: string;
  kind?: string;
  wordCount?: string;
  lastChapter?: string;
  intro?: string;
  coverUrl?: string;
  tocUrl?: string;
  [key: string]: unknown;
}

export interface RuleToc {
  chapterList?: string;
  chapterName?: string;
  chapterUrl?: string;
  isVolume?: string;
  updateTime?: string;
  [key: string]: unknown;
}

export interface RuleContent {
  content?: string;
  nextContentUrl?: string;
  webJs?: string;
  sourceRegex?: string;
  imageStyle?: string;
  [key: string]: unknown;
}

export type ValidationStatus = 'STRUCTURE_OK' | 'STRUCTURE_WARN' | 'STRUCTURE_INVALID';
export type ConnectivityStatus = 'CONNECT_OK' | 'CONNECT_FORBIDDEN' | 'CONNECT_DEAD' | 'CONNECT_TIMEOUT' | 'CONNECT_ERROR' | 'NON_HTTP_SOURCE' | 'NOT_CHECKED';
export type SearchStatus = 'SEARCH_HTTP_OK' | 'SEARCH_PARSE_OK' | 'SEARCH_RULE_LIKELY_OK' | 'SEARCH_TEMPLATE_COMPLEX' | 'SEARCH_COMPLEX_JS_SKIPPED' | 'SEARCH_SKIPPED_NON_HTTP' | 'SEARCH_SKIPPED_JS' | 'SEARCH_UNVERIFIED' | 'SEARCH_FAILED' | 'NOT_CHECKED';
export type AvailabilityStatus = 'usable' | 'probably_usable' | 'needs_login' | 'login_related' | 'complex_unverified' | 'forbidden' | 'timeout' | 'dead' | 'invalid' | 'unknown';
export type ClassificationConfidence = 'high' | 'medium' | 'low' | 'conflict';
export type NameMode = 'zh-only' | 'loose';
export type DedupeLevel = 'none' | 'exact' | 'url' | 'conservative' | 'host' | 'aggressive';
export type GroupMode = 'overwrite' | 'append' | 'report-only' | 'preserve' | 'category-first';
export type OutputFormat = 'pretty' | 'minified';
export type WriteUrlMode = 'safe-only' | 'always' | 'never';
export type CategoryLabel = '小说' | '漫画' | '有声' | '影视' | '下载' | '其他' | '失效';
export type UrlStatus = 'VALID_HTTP' | 'NON_HTTP_SOURCE' | 'NON_HTTP_LOOKS_LIKE_DOMAIN' | 'INVALID_URL';
export type BatchValidationMode = 'fast' | 'standard' | 'deep';
