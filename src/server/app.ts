#!/usr/bin/env node
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerInspectRoutes } from './routes/inspect.js';
import { registerValidateRoutes } from './routes/validate.js';
import { registerProcessRoutes } from './routes/process.js';
import { registerFilesRoutes } from './routes/files.js';
import { registerJobsRoutes } from './routes/jobs.js';
import { registerResultsRoutes } from './routes/results.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5178', 10);
const HOST = process.env.HOST || '127.0.0.1';

const app = Fastify({ logger: false });

// Rate limiting — local tool, generous limits
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: (_request, context) => ({
    success: false,
    error: { code: 'RATE_LIMIT', message: `请求过于频繁，请稍后再试 (限制: ${context.max}/分钟)` },
  }),
});

// CORS — restrict to local dev server origins
await app.register(cors, {
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5178', 'http://localhost:5178'],
});

// Static files — serve built web UI
const webDistPath = path.resolve(__dirname, '../../dist-web');
try {
  const { stat } = await import('fs-extra');
  await stat(path.join(webDistPath, 'index.html'));
  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/',
    wildcard: false,
  });
} catch {
  // dist-web not built yet — serve a fallback note
  app.get('/', async (_req, reply) => {
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Legado Source Toolkit</title>
        <style>
          body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 500px; text-align: center; }
          h1 { margin: 0 0 1rem; } code { background: #eee; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📖 Legado Source Toolkit</h1>
          <p>Web UI 尚未构建。</p>
          <p>启动开发服务器：</p>
          <code>pnpm web:dev</code>
          <p style="margin-top:1rem">然后访问 <code>http://127.0.0.1:5173</code></p>
          <p style="color:#666;font-size:0.85rem;margin-top:1.5rem">
            API 已就绪 — <a href="/api/health">/api/health</a>
          </p>
        </div>
      </body>
      </html>
    `);
  });
}

// Multipart (file uploads, 100MB limit)
await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });

// API routes
app.get('/api/health', async () => ({
  success: true,
  data: { status: 'ok', version: '1.0.0' },
}));

registerInspectRoutes(app);
registerValidateRoutes(app);
registerProcessRoutes(app);
registerFilesRoutes(app);
registerJobsRoutes(app);
registerResultsRoutes(app);

// Start
try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n  🚀 Legado Source Toolkit GUI`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Local:   http://${HOST}:${PORT}`);
  console.log(`  API:     http://${HOST}:${PORT}/api/health`);
  console.log();
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
