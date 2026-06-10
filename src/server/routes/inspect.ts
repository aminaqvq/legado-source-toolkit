import type { FastifyInstance } from 'fastify';
import { readBookSources } from '../../core/parse.js';
import { getHostKey } from '../../core/normalize-url.js';
import { resolveSafeInputPath } from '../security/paths.js';

export function registerInspectRoutes(app: FastifyInstance): void {
  app.post('/api/inspect', async (request, reply) => {
    const { inputPath } = request.body as { inputPath?: string };

    if (!inputPath || typeof inputPath !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供有效的 inputPath' },
      });
    }

    try {
      const safePath = resolveSafeInputPath(inputPath, process.cwd());
      const { sources } = readBookSources(safePath);

      // Type distribution
      const typeCounts: Record<string, number> = {};
      for (const s of sources) {
        const t = String(s.bookSourceType ?? 'undefined');
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }

      // Group distribution (top 20)
      const groupCounts: Record<string, number> = {};
      for (const s of sources) {
        const g = s.bookSourceGroup || '(none)';
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      }
      const topGroups = Object.entries(groupCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      // Duplicate hosts
      const hostCounts: Record<string, number> = {};
      for (const s of sources) {
        const host = getHostKey(s.bookSourceUrl) || '(none)';
        hostCounts[host] = (hostCounts[host] || 0) + 1;
      }
      const dupHosts = Object.entries(hostCounts).filter(([, c]) => c > 1);

      // Non-HTTP
      let nonHttpCount = 0;
      for (const s of sources) {
        if (s.bookSourceUrl && !/^https?:\/\//i.test(s.bookSourceUrl)) {
          nonHttpCount++;
        }
      }

      // Complex JS
      let complexJsCount = 0;
      const jsPatterns = [/<js>/i, /@js:/i, /java\.ajax/i, /\beval\b/i, /Reload/i, /WebView/i];
      for (const s of sources) {
        const searchUrl = s.searchUrl || '';
        if (jsPatterns.some((p) => p.test(searchUrl))) {
          complexJsCount++;
        }
      }

      // Emoji names
      let emojiCount = 0;
      for (const s of sources) {
        if (/[\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/u.test(s.bookSourceName ?? '')) {
          emojiCount++;
        }
      }

      return {
        success: true,
        data: {
          total: sources.length,
          typeCounts,
          topGroups: Object.fromEntries(topGroups),
          duplicateHostCount: dupHosts.length,
          nonHttpCount,
          complexJsCount,
          emojiCount,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      return reply.status(500).send({
        success: false,
        error: { code: 'INSPECT_ERROR', message },
      });
    }
  });
}
