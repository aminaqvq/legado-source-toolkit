/**
 * Debug API routes — single book source rule verification.
 *
 * POST /api/debug   — run full verification on a single source
 * POST /api/debug/stage — run one specific verification stage
 */

import type { FastifyInstance } from 'fastify';
import { verifyAllRules, verifyRuleSearch, verifyRuleBookInfo, verifyRuleToc, verifyRuleContent } from '../../core/verify-rules.js';
import type { BookSource } from '../../types/book-source.js';

export function registerDebugRoutes(app: FastifyInstance): void {
  /** Full debug: run all 4 stages and return the consolidated result */
  app.post('/api/debug', async (request, reply) => {
    const body = request.body as {
      source?: Partial<BookSource>;
      keyword?: string;
      timeout?: number;
    };

    if (!body.source) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 source（书源 JSON 对象）' },
      });
    }

    // Sanitize: remove potentially huge or sensitive fields
    const source: BookSource = {
      bookSourceName: body.source.bookSourceName ?? '(unnamed)',
      bookSourceUrl: body.source.bookSourceUrl ?? '',
      bookSourceGroup: body.source.bookSourceGroup ?? '',
      bookSourceType: body.source.bookSourceType,
      searchUrl: body.source.searchUrl ?? '',
      exploreUrl: body.source.exploreUrl ?? '',
      header: body.source.header ?? '',
      ruleSearch: body.source.ruleSearch,
      ruleBookInfo: body.source.ruleBookInfo,
      ruleToc: body.source.ruleToc,
      ruleContent: body.source.ruleContent,
      enabled: body.source.enabled ?? true,
    };

    try {
      const result = await verifyAllRules(source, {
        keyword: body.keyword,
        timeout: body.timeout ?? 10000,
      });
      return { success: true, data: result };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DEBUG_ERROR',
          message: err instanceof Error ? err.message : '调试过程出错',
        },
      });
    }
  });

  /** Single-stage debug: verify just one stage */
  app.post('/api/debug/stage', async (request, reply) => {
    const body = request.body as {
      source?: Partial<BookSource>;
      stage?: 'search' | 'bookInfo' | 'toc' | 'content';
      keyword?: string;
      url?: string;
      timeout?: number;
    };

    if (!body.source || !body.stage) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 source 和 stage' },
      });
    }

    const source: BookSource = {
      bookSourceName: body.source.bookSourceName ?? '(unnamed)',
      bookSourceUrl: body.source.bookSourceUrl ?? '',
      searchUrl: body.source.searchUrl ?? '',
      header: body.source.header ?? '',
      ruleSearch: body.source.ruleSearch,
      ruleBookInfo: body.source.ruleBookInfo,
      ruleToc: body.source.ruleToc,
      ruleContent: body.source.ruleContent,
    };

    try {
      let result;
      const opts = { keyword: body.keyword, timeout: body.timeout ?? 10000 };

      switch (body.stage) {
        case 'search':
          result = await verifyRuleSearch(source, opts);
          break;
        case 'bookInfo':
          result = await verifyRuleBookInfo(source, body.url ?? source.bookSourceUrl ?? '', opts);
          break;
        case 'toc':
          result = await verifyRuleToc(source, body.url ?? source.bookSourceUrl ?? '', opts);
          break;
        case 'content':
          result = await verifyRuleContent(source, body.url ?? source.bookSourceUrl ?? '', opts);
          break;
        default:
          return reply.status(400).send({
            success: false,
            error: { code: 'INVALID_INPUT', message: 'stage 必须为 search | bookInfo | toc | content' },
          });
      }

      return { success: true, data: result };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'DEBUG_ERROR',
          message: err instanceof Error ? err.message : '调试过程出错',
        },
      });
    }
  });
}
