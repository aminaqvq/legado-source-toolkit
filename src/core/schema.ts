import { z } from 'zod';

/**
 * Zod schema for a single book source.
 * Uses `.passthrough()` to preserve all unknown fields.
 */
export const RuleSearchSchema = z.object({
  bookList: z.string().optional(),
  name: z.string().optional(),
  author: z.string().optional(),
  kind: z.string().optional(),
  wordCount: z.string().optional(),
  lastChapter: z.string().optional(),
  intro: z.string().optional(),
  coverUrl: z.string().optional(),
  bookUrl: z.string().optional(),
  checkKeyWord: z.string().optional(),
}).passthrough();

export const RuleBookInfoSchema = z.object({
  name: z.string().optional(),
  author: z.string().optional(),
  kind: z.string().optional(),
  wordCount: z.string().optional(),
  lastChapter: z.string().optional(),
  intro: z.string().optional(),
  coverUrl: z.string().optional(),
  tocUrl: z.string().optional(),
}).passthrough();

export const RuleTocSchema = z.object({
  chapterList: z.string().optional(),
  chapterName: z.string().optional(),
  chapterUrl: z.string().optional(),
  isVolume: z.string().optional(),
  updateTime: z.string().optional(),
}).passthrough();

export const RuleContentSchema = z.object({
  content: z.string().optional(),
  nextContentUrl: z.string().optional(),
  webJs: z.string().optional(),
  sourceRegex: z.string().optional(),
  imageStyle: z.string().optional(),
}).passthrough();

export const RuleExploreSchema = z.object({}).passthrough();

export const BookSourceSchema = z.object({
  bookSourceName: z.string().optional(),
  bookSourceUrl: z.string().optional(),
  bookSourceGroup: z.string().optional(),
  bookSourceType: z.number().int().optional().nullable(),
  bookSourceComment: z.string().optional(),
  variableComment: z.string().optional(),

  bookUrlPattern: z.string().optional(),
  searchUrl: z.string().optional(),
  exploreUrl: z.string().optional(),

  ruleSearch: RuleSearchSchema.optional().nullable(),
  ruleExplore: z.unknown().optional(),
  ruleBookInfo: RuleBookInfoSchema.optional().nullable(),
  ruleToc: RuleTocSchema.optional().nullable(),
  ruleContent: RuleContentSchema.optional().nullable(),

  header: z.string().optional(),
  enabled: z.boolean().optional().nullable(),
  enabledExplore: z.boolean().optional().nullable(),
  enabledCookieJar: z.boolean().optional().nullable(),
  respondTime: z.number().optional().nullable(),
  lastUpdateTime: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  concurrentRate: z.string().optional(),

  loginUrl: z.string().optional(),
  loginUi: z.string().optional(),
  loginCheckJs: z.string().optional(),
  jsLib: z.string().optional(),
}).passthrough();

export const BookSourceArraySchema = z.array(BookSourceSchema);

export type ValidatedBookSource = z.infer<typeof BookSourceSchema>;
