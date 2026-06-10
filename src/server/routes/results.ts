import type { FastifyInstance } from 'fastify';
import fs from 'fs-extra';
import path from 'node:path';

/** Only allow directories whose name starts with "output" and contains no path traversal. */
function checkOutputDir(dirParam: string): { safe: boolean; resolved?: string; error?: string } {
  if (!dirParam || typeof dirParam !== 'string') return { safe: false, error: 'dir 参数不能为空' };
  if (dirParam.includes('\0') || dirParam.includes('..')) return { safe: false, error: 'dir 包含非法字符' };

  // Normalize: strip any leading path separators, only use the first component
  const clean = dirParam.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0];

  if (!clean.startsWith('output')) return { safe: false, error: 'dir 必须以 output 开头' };
  if (clean.length > 80) return { safe: false, error: 'dir 名称过长' };

  const resolved = path.resolve(process.cwd(), clean);
  const rel = path.relative(process.cwd(), resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { safe: false, error: '路径穿越被阻止' };

  return { safe: true, resolved };
}

export function registerResultsRoutes(app: FastifyInstance): void {
  // List output directories
  app.get('/api/results', async () => {
    const cwd = process.cwd();
    const dirs: { name: string; path: string; summary?: unknown }[] = [];
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || !e.name.startsWith('output')) continue;
      const dirPath = path.join(cwd, e.name);
      const relPath = path.relative(cwd, dirPath).replace(/\\/g, '/');
      const summaryPath = path.join(dirPath, 'reports', 'summary.json');
      try {
        const raw = await fs.readFile(summaryPath, 'utf-8');
        dirs.push({ name: e.name, path: relPath, summary: JSON.parse(raw) });
      } catch { dirs.push({ name: e.name, path: relPath }); }
    }
    return { success: true, data: { outputs: dirs } };
  });

  // Load a specific report directory
  app.get('/api/results/:dir', async (request, _reply) => {
    const { dir } = request.params as { dir: string };
    const check = checkOutputDir(dir);
    if (!check.safe) return _reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: check.error } });

    const reportDir = path.join(check.resolved!, 'reports');
    const files: Record<string, unknown> = {};
    for (const file of ['summary.json', 'sources.json', 'structural-invalid.json', 'duplicates.json']) {
      try {
        files[file] = JSON.parse(await fs.readFile(path.join(reportDir, file), 'utf-8'));
      } catch { files[file] = null; }
    }
    return { success: true, data: { dir, files } };
  });

  // ── New audit endpoints ──

  app.get('/api/results/summary', async (request, _reply) => {
    const { dir } = request.query as { dir?: string };
    const outDir = dir || 'output-verify';
    const check = checkOutputDir(outDir);
    if (!check.safe) return _reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: check.error } });

    const filePath = path.join(check.resolved!, 'reports', 'summary.json');
    try {
      return { success: true, data: JSON.parse(await fs.readFile(filePath, 'utf-8')) };
    } catch {
      return _reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'summary.json not found' } });
    }
  });

  app.get('/api/results/consistency', async (request, _reply) => {
    const { dir } = request.query as { dir?: string };
    const outDir = dir || 'output-verify';
    const check = checkOutputDir(outDir);
    if (!check.safe) return _reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: check.error } });

    const filePath = path.join(check.resolved!, 'reports', 'output-consistency.json');
    try {
      return { success: true, data: JSON.parse(await fs.readFile(filePath, 'utf-8')) };
    } catch {
      return _reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'output-consistency.json not found' } });
    }
  });

  app.get('/api/results/issues', async (request, _reply) => {
    const { dir } = request.query as { dir?: string };
    const outDir = dir || 'output-verify';
    const check = checkOutputDir(outDir);
    if (!check.safe) return _reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: check.error } });

    const reportDir = path.join(check.resolved!, 'reports');
    const loadJson = async (name: string) => {
      try { return JSON.parse(await fs.readFile(path.join(reportDir, name), 'utf-8')); } catch { return null; }
    };
    const [consistency, dirtyNames, groupMismatches, cleanedGroupDiffs, duplicates, structuralInvalid, unavailable, risky] =
      await Promise.all([
        loadJson('output-consistency.json'), loadJson('dirty-names.json'), loadJson('group-mismatches.json'),
        loadJson('cleaned-vs-groups-diff.json'), loadJson('duplicates.json'), loadJson('structural-invalid.json'),
        loadJson('unavailable.json'), loadJson('risky.json'),
      ]);
    return {
      success: true,
      data: {
        consistency, dirtyNames: dirtyNames || [], groupMismatches: groupMismatches || [],
        cleanedGroupDiffs: cleanedGroupDiffs || [], duplicateRisks: (duplicates || []).filter((g: { reason?: string }) => g.reason?.includes('RISK')),
        duplicates: duplicates || [], structuralInvalid: structuralInvalid || [], unavailable: unavailable || [], risky: risky || [],
      },
    };
  });

  app.get('/api/results/source/:index', async (request, _reply) => {
    const { index } = request.params as { index: string };
    const { dir } = request.query as { dir?: string };
    const outDir = dir || 'output-verify';
    const check = checkOutputDir(outDir);
    if (!check.safe) return _reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: check.error } });

    const idx = parseInt(index, 10);
    const filePath = path.join(check.resolved!, 'reports', 'sources.json');
    try {
      const sources = JSON.parse(await fs.readFile(filePath, 'utf-8')) as { index: number }[];
      const source = sources.find((s) => s.index === idx);
      if (!source) return _reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Source index ${idx} not found` } });
      return { success: true, data: source };
    } catch {
      return _reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'sources.json not found' } });
    }
  });
}
