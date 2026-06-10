import type { FastifyInstance } from 'fastify';
import { saveUpload, listUploads, clearUploads } from '../services/upload-store.js';
import fs from 'fs-extra';
import path from 'node:path';

/** Directories allowed for download via /api/download (must exist under project root) */
const ALLOWED_ROOTS = ['output', 'output-ui', 'output-verify', 'output-fixed'];

function isPathSafe(fileParam: string): { safe: boolean; resolved?: string; error?: string } {
  if (!fileParam || typeof fileParam !== 'string') return { safe: false, error: '请指定 file 参数' };
  if (fileParam.includes('\0')) return { safe: false, error: '路径包含非法字符' };

  const resolved = path.resolve(fileParam);
  const cwd = process.cwd();

  // Check the resolved path is under an allowed directory
  for (const root of ALLOWED_ROOTS) {
    const allowedBase = path.join(cwd, root);
    const rel = path.relative(allowedBase, resolved);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return { safe: true, resolved };
    }
  }

  // Also allow if the first component is explicitly an allowed root name
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

export function registerFilesRoutes(app: FastifyInstance): void {
  // Upload file — security hardened
  app.post('/api/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_FILE', message: '请选择要上传的文件' },
      });
    }

    // Only allow .json files
    const ext = path.extname(data.filename).toLowerCase();
    if (ext !== '.json') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TYPE', message: '只允许上传 .json 文件' },
      });
    }

    // Size limit: 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      return reply.status(400).send({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: `文件大小不能超过 ${MAX_SIZE / 1024 / 1024}MB` },
      });
    }

    // Validate content is valid JSON
    try {
      JSON.parse(buffer.toString('utf-8'));
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_JSON', message: '文件内容不是有效的 JSON' },
      });
    }

    const filePath = await saveUpload(data.filename, buffer);
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return { success: true, data: { path: relPath, name: data.filename, size: buffer.length } };
  });

  // List uploads
  app.get('/api/uploads', async () => {
    const files = await listUploads();
    const relFiles = files.map(f => path.relative(process.cwd(), f).replace(/\\/g, '/'));
    return { success: true, data: { files: relFiles } };
  });

  // Download a result file — path-traversal hardened
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

  // Clear uploads
  app.delete('/api/uploads', async () => {
    await clearUploads();
    return { success: true, data: { message: '已清理' } };
  });
}
