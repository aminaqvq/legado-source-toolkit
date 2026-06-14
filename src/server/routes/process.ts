import type { FastifyInstance } from 'fastify';
import { processSources } from '../../core/process.js';
import { jobStore } from '../services/job-store.js';
import type { ProcessOptions } from '../../types/analysis.js';
import { resolveSafeInputPath, resolveSafeOutputDir } from '../security/paths.js';
import { normalizeValidateMode } from '../../core/batch-validate.js';
import type { BatchValidationMode } from '../../types/book-source.js';

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

    // Validate validateMode
    const rawValidateMode: unknown = body.validateMode;
    let resolvedValidateMode: BatchValidationMode | undefined;
    if (rawValidateMode !== undefined && rawValidateMode !== null) {
      const mode = normalizeValidateMode(rawValidateMode);
      if (!mode) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_VALIDATE_MODE',
            message: `Invalid validateMode "${String(rawValidateMode)}". Expected one of: fast, standard, deep.`,
          },
        });
      }
      resolvedValidateMode = mode;
    }

    // Validate batchConcurrency
    const rawBatchConcurrency: unknown = body.batchConcurrency;
    let batchConcurrency: number;
    if (rawBatchConcurrency === undefined || rawBatchConcurrency === null) {
      batchConcurrency = 8;
    } else {
      const n = Number(rawBatchConcurrency);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_BATCH_CONCURRENCY',
            message: `batchConcurrency must be an integer between 1 and 100, got: ${JSON.stringify(rawBatchConcurrency)}`,
          },
        });
      }
      batchConcurrency = n;
    }

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
      validateMode: resolvedValidateMode,
      batchConcurrency,
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
