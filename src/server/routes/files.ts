import type { FastifyInstance } from 'fastify';
import { saveUpload, listUploads, clearUploads, getUploadedFile } from '../services/upload-store.js';
import fs from 'fs-extra';
import path from 'node:path';

/** Directories allowed for download via /api/download (must exist under project root) */
const ALLOWED_ROOTS = ['output', 'output-ui', 'output-verify', 'output-fixed'];

function isPathSafe(fileParam: string): { safe: boolean; resolved?: string; error?: string } {
  if (!fileParam || typeof fileParam !== 'string') return { safe: false, error: '请指定 file 参数' };
  if (fileParam.includes('\0')) return { safe: false, error: '路径包含非法字符' };

  const resolved = path.resolve(fileParam);
  const cwd = process.cwd();

  for (const root of ALLOWED_ROOTS) {
    const allowedBase = path.join(cwd, root);
    const rel = path.relative(allowedBase, resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return { safe: true, resolved };
    }
  }

  const parts = fileParam.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length > 0 && ALLOWED_ROOTS.includes(parts[0])) {
    const allowedBase = path.join(cwd, parts[0]);
    const rel = path.relative(allowedBase, resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return { safe: true, resolved };
    }
  }

  return { safe: false, error: '不允许下载该路径文件 (仅限输出目录)' };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function registerFilesRoutes(app: FastifyInstance): void {
  // ── Upload file ──
  app.post('/api/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: '请选择要上传的文件' },
      });
    }

    const ext = path.extname(data.filename).toLowerCase();
    if (ext !== '.json') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TYPE', message: '只允许上传 .json 文件' },
      });
    }

    const MAX_SIZE = 50 * 1024 * 1024;
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: `文件大小不能超过 ${MAX_SIZE / 1024 / 1024}MB` },
      });
    }

    try {
      JSON.parse(buffer.toString('utf-8'));
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_JSON', message: '文件内容不是有效的 JSON' },
      });
    }

    const meta = await saveUpload(data.filename, buffer);
    return {
      success: true,
      data: {
        uploadId: meta.uploadId,
        path: meta.relPath,
        name: meta.fileName,
        size: meta.size,
      },
    };
  });

  // ── List uploads ──
  app.get('/api/uploads', async () => {
    const files = await listUploads();
    const relFiles = files.map(f => path.relative(process.cwd(), f).replace(/\\/g, '/'));
    return { success: true, data: { files: relFiles } };
  });

  // ── Preview uploaded file (first N items) ──
  app.get('/api/uploads/preview', async (request, reply) => {
    const { uploadId, limit: limitRaw } = request.query as { uploadId?: string; limit?: string };
    const limit = clamp(Number(limitRaw) || 5, 1, 50);

    if (!uploadId || typeof uploadId !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: '请提供 uploadId' },
      });
    }

    const meta = getUploadedFile(uploadId);
    if (!meta) {
      return reply.status(404).send({
        success: false,
        error: { code: 'UPLOAD_EXPIRED', message: '上传记录已失效，请重新上传' },
      });
    }

    // ── Secondary path validation ──
    const uploadsDir = path.resolve('uploads');
    const resolved = path.resolve(meta.absPath);
    const rel = path.relative(uploadsDir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: '不允许访问该文件' },
      });
    }
    if (!resolved.toLowerCase().endsWith('.json')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TYPE', message: '只允许预览 JSON 文件' },
      });
    }
    try {
      const real = fs.realpathSync(resolved);
      const realRel = path.relative(uploadsDir, real);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: '不允许访问该文件' },
        });
      }
    } catch {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在，请重新上传' },
      });
    }

    if (!(await fs.pathExists(resolved))) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在，请重新上传' },
      });
    }

    // ── Read and validate JSON ──
    let parsed: unknown;
    try {
      const raw = await fs.readFile(resolved, 'utf-8');
      parsed = JSON.parse(raw);
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_JSON', message: '文件不是有效的 JSON' },
      });
    }

    if (!Array.isArray(parsed)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_ARRAY', message: '文件不是 JSON 数组' },
      });
    }

    const count = parsed.length;
    const preview = parsed.slice(0, limit);

    return {
      success: true,
      data: {
        uploadId: meta.uploadId,
        fileName: meta.fileName,
        path: meta.relPath,
        count,
        limit,
        preview,
      },
    };
  });

  // ── Download a result file ──
  app.get('/api/download', async (request, reply) => {
    const { file } = request.query as { file?: string };
    const check = isPathSafe(file ?? '');
    if (!check.safe || !check.resolved) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: check.error || '不允许下载该路径文件' },
      });
    }

    if (!(await fs.pathExists(check.resolved))) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件不存在' },
      });
    }

    const filename = path.basename(check.resolved);
    return reply
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(fs.createReadStream(check.resolved));
  });

  // ── Clear uploads ──
  app.delete('/api/uploads', async () => {
    await clearUploads();
    return { success: true, data: { message: '已清理' } };
  });
}
