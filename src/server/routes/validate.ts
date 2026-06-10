import type { FastifyInstance } from 'fastify';
import { readBookSources } from '../../core/parse.js';
import { validateStructure } from '../../core/validate-structure.js';
import { checkConnectivity } from '../../core/validate-online.js';
import { checkSearchUrl } from '../../core/validate-search.js';
import { cleanBookSourceName } from '../../core/clean-name.js';
import { normalizeUrl } from '../../core/normalize-url.js';
import { classifySource } from '../../core/classify.js';
import { progress, success, info } from '../../utils/logger.js';
import { resolveSafeInputPath } from '../security/paths.js';

export function registerValidateRoutes(app: FastifyInstance): void {
  app.post('/api/validate', async (request, reply) => {
    const body = request.body as {
      inputPath: string;
      online?: boolean;
      concurrency?: number;
      timeout?: number;
    };

    if (!body.inputPath) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 inputPath' },
      });
    }

    try {
      const safePath = resolveSafeInputPath(body.inputPath, process.cwd());
      const { sources, analyses } = readBookSources(safePath);

      // Structure validation
      for (let i = 0; i < sources.length; i++) {
        const struct = validateStructure(sources[i]);
        analyses[i].validationStatus = struct.status;
        analyses[i].validationReason = struct.reasons;
      }

      // Name cleaning
      for (let i = 0; i < sources.length; i++) {
        const r = cleanBookSourceName(sources[i].bookSourceName ?? '', {
          mode: 'zh-only',
          keepLatinWhenNeeded: false,
        });
        analyses[i].cleanedName = r.cleaned;
      }

      // URL normalization
      for (let i = 0; i < sources.length; i++) {
        const norm = normalizeUrl(sources[i].bookSourceUrl);
        analyses[i].normalizedUrl = norm.url;
        analyses[i].normalizedHost = norm.normalizedHost;
      }

      // Classification
      for (let i = 0; i < sources.length; i++) {
        const cls = classifySource(sources[i], analyses[i]);
        analyses[i].inferredGroup = cls.category;
      }

      // Online validation
      if (body.online) {
        const pLimit = (await import('p-limit')).default;
        const limit = pLimit(body.concurrency || 5);
        const timeout = body.timeout || 8000;

        // Connectivity
        info('Checking connectivity...');
        const connTasks = analyses.map((a, i) =>
          limit(async () => {
            const r = await checkConnectivity(sources[i], { timeout, retry: 1 });
            a.connectivityStatus = r.status;
            a.connectivityDetail = r.detail;
            progress(i + 1, analyses.length, 'Connectivity');
          }),
        );
        await Promise.all(connTasks);
        success('Connectivity checks complete');

        // Search
        info('Checking search...');
        const searchTasks = analyses.map((a, i) =>
          limit(async () => {
            const r = await checkSearchUrl(sources[i], a.inferredGroup, { timeout });
            a.searchStatus = r.status;
            a.searchDetail = r.detail;
            progress(i + 1, analyses.length, 'Search');
          }),
        );
        await Promise.all(searchTasks);
        success('Search checks complete');
      }

      // Build results
      const ok = analyses.filter((a) => a.validationStatus === 'STRUCTURE_OK').length;
      const warn = analyses.filter((a) => a.validationStatus === 'STRUCTURE_WARN').length;
      const invalid = analyses.filter((a) => a.validationStatus === 'STRUCTURE_INVALID').length;

      const categoryCounts: Record<string, number> = {};
      for (const a of analyses) {
        categoryCounts[a.inferredGroup] = (categoryCounts[a.inferredGroup] || 0) + 1;
      }

      return {
        success: true,
        data: {
          total: analyses.length,
          ok,
          warn,
          invalid,
          categoryCounts,
          analyses: analyses.slice(0, 500), // Limit for UI response
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      return reply.status(500).send({
        success: false,
        error: { code: 'VALIDATE_ERROR', message },
      });
    }
  });
}
