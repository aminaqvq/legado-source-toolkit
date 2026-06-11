import type { FastifyInstance } from 'fastify';
import { jobStore } from '../services/job-store.js';

function buildProgressBlock(done: number, total: number) {
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function registerJobsRoutes(app: FastifyInstance): void {
  app.get('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = jobStore.get(id);

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '任务不存在' },
      });
    }

    return {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        result: job.status === 'success' ? job.result : undefined,
        error: job.status === 'failed' ? job.error : undefined,
        // ── Structured progress ──
        logs: job.logs,
        phase: job.phase,
        totalProgress: job.totalProgress,
        phaseProgress: job.phaseProgress,
        connProgress: buildProgressBlock(job.connDone, job.connTotal),
        searchProgress: buildProgressBlock(job.searchDone, job.searchTotal),
        resultDir: job.displayResultDir || job.resultDir,
        displayResultDir: job.displayResultDir,
        inputPath: job.inputPath,
      },
    };
  });

  app.get('/api/jobs/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendEvent = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const interval = setInterval(() => {
      const job = jobStore.get(id);
      if (!job) {
        sendEvent({ type: 'error', message: '任务不存在' });
        clearInterval(interval);
        reply.raw.end();
        return;
      }

      sendEvent({
        type: 'progress', id: job.id, status: job.status,
        phase: job.phase, totalProgress: job.totalProgress,
        connProgress: buildProgressBlock(job.connDone, job.connTotal),
        searchProgress: buildProgressBlock(job.searchDone, job.searchTotal),
        logs: job.logs, resultDir: job.displayResultDir || job.resultDir,
      });

      if (job.status === 'success' || job.status === 'failed') {
        sendEvent({
          type: job.status, id: job.id, status: job.status,
          result: job.result, error: job.error,
          resultDir: job.displayResultDir || job.resultDir,
        });
        clearInterval(interval);
        reply.raw.end();
      }
    }, 500);

    request.raw.on('close', () => { clearInterval(interval); });
  });
}
