import type { FastifyInstance } from 'fastify';
import { processSources } from '../../core/process.js';
import { jobStore } from '../services/job-store.js';
import type { ProcessOptions } from '../../types/analysis.js';
import { resolveSafeInputPath, resolveSafeOutputDir } from '../security/paths.js';

export function registerProcessRoutes(app: FastifyInstance): void {
  app.post('/api/process', async (request, reply) => {
    const body = request.body as Partial<ProcessOptions> & { inputPath: string };

    if (!body.inputPath) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: '请提供 inputPath' },
      });
    }

    // Validate inputPath synchronously before spawning async job
    let safeInputPath: string;
    try {
      safeInputPath = resolveSafeInputPath(body.inputPath, process.cwd());
    } catch (err: unknown) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FORBIDDEN', message: err instanceof Error ? err.message : '输入路径不合法' },
      });
    }

    // Validate outDir
    const outDir = body.outDir || './output-ui';
    let safeOutDir: string;
    try {
      safeOutDir = resolveSafeOutputDir(outDir, process.cwd());
    } catch (err: unknown) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FORBIDDEN', message: err instanceof Error ? err.message : '输出目录不合法' },
      });
    }

    // Get relative display dir from the user-provided value
    const displayDir = (() => {
      const raw = body.outDir || 'output-ui';
      const cleaned = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
      const first = cleaned.split('/')[0];
      return first || 'output-ui';
    })();

    const jobId = crypto.randomUUID();
    jobStore.create(jobId);
    jobStore.setInputPath(jobId, safeInputPath);
    jobStore.setResultDir(jobId, safeOutDir);
    jobStore.setDisplayResultDir(jobId, displayDir);

    // Run async — don't await
    processSources({
      inputPath: safeInputPath,
      outDir: safeOutDir,
      online: body.online ?? false,
      dedupeLevel: body.dedupeLevel ?? 'conservative',
      groupMode: body.groupMode ?? 'category-first',
      nameMode: body.nameMode ?? 'loose',
      concurrency: body.concurrency ?? 16,
      timeout: body.timeout ?? 8000,
      retry: body.retry ?? 1,
      dryRun: body.dryRun ?? false,
      writeMeta: body.writeMeta ?? false,
      outputFormat: body.outputFormat ?? 'pretty',
      keepDisabled: body.keepDisabled ?? false,
      onlyEnabled: body.onlyEnabled ?? false,
      includeNonHttp: body.includeNonHttp ?? true,
      keepLatinWhenNeeded: body.keepLatinWhenNeeded ?? false,
      allowRiskyDedupe: body.allowRiskyDedupe ?? false,
      includeUnknown: body.includeUnknown ?? false,
      includeComplex: body.includeComplex ?? false,
      includeUnavailable: body.includeUnavailable ?? false,
      writeNormalizedUrl: body.writeNormalizedUrl ?? false,
      strict: body.strict ?? false,
      // ── GUI progress callbacks ──
      onPhaseChange: (phase: string) => jobStore.setPhase(jobId, phase),
      onLog: (message: string) => jobStore.addLog(jobId, message),
      onProgress: (label, done, total) => jobStore.updateProgress(jobId, label, done, total),
    })
      .then((report) => {
        jobStore.complete(jobId, report);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '处理失败';
        jobStore.fail(jobId, message);
      });

    // Start status
    jobStore.start(jobId);

    return {
      success: true,
      data: { jobId },
    };
  });
}
