import fs from 'fs-extra';
import path from 'node:path';

/**
 * Allowed top-level directories for API inputPath.
 * Subdirectories under these are also allowed.
 */
const ALLOWED_INPUT_ROOTS = ['uploads', 'samples'];

/**
 * Patterns for files/directories that are explicitly forbidden.
 */
const FORBIDDEN_PATTERNS = [
  /^\.env/,          // .env, .env.local, etc.
  /^src[\\/]/,       // src/
  /^web[\\/]/,       // web/
  /^dist[\\/]/,      // dist/
  /^dist-web[\\/]/,  // dist-web/
  /^reports[\\/]/,   // reports/
  /^output-/,        // output-* directories
  /^node_modules[\\/]/, // node_modules/
  /^uploads[\\/]\.\./, // uploads/../ traversal
  /^samples[\\/]\.\./, // samples/../ traversal
];

/**
 * Safely resolve and validate an input file path provided via API.
 *
 * Rules:
 * 1. Only allows files under ALLOWED_INPUT_ROOTS (uploads/, samples/)
 * 2. Also allows a project-root JSON file explicitly (e.g., bookSource.json)
 * 3. Rejects path traversal (../), null bytes, absolute paths outside project
 * 4. File must exist and have .json extension
 * 5. Uses path.resolve() + path.relative() for canonical boundary checks
 *
 * @returns Resolved absolute path if safe
 * @throws Error with a generic message on validation failure
 */
export function resolveSafeInputPath(userPath: string, projectRoot: string): string {
  // ── Basic input validation ──
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('路径不能为空');
  }
  if (userPath.includes('\0')) {
    throw new Error('路径包含非法字符');
  }

  // ── Resolve to canonical absolute path ──
  const resolved = path.resolve(projectRoot, userPath);
  const normalized = path.normalize(resolved);

  // ── Ensure it resolves to a path within the project ──
  const rel = path.relative(projectRoot, normalized);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('不允许的路径（越权访问）');
  }

  // ── Normalize path for pattern matching ──
  const normalizedRel = rel.replace(/\\/g, '/');

  // ── Check forbidden patterns first ──
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalizedRel)) {
      throw new Error('不允许读取该路径下的文件');
    }
  }

  // ── Check allowed roots ──
  let allowed = false;

  // Check if path is under an allowed root
  for (const root of ALLOWED_INPUT_ROOTS) {
    const rootRel = path.relative(root, normalizedRel);
    if (!rootRel.startsWith('..') && !path.isAbsolute(rootRel)) {
      allowed = true;
      break;
    }
    // Also match top-level: "uploads/somefile.json" itself
    if (normalizedRel.startsWith(root + '/') || normalizedRel === root) {
      allowed = true;
      break;
    }
  }

  // Also allow a single .json file at the project root
  if (!allowed) {
    const topFile = normalizedRel.split('/')[0];
    if (topFile === normalizedRel && topFile.endsWith('.json') && !topFile.startsWith('.')) {
      allowed = true;
    }
  }

  if (!allowed) {
    throw new Error('不允许读取该路径下的文件');
  }

  // ── File must exist ──
  if (!fs.existsSync(normalized)) {
    throw new Error('文件不存在');
  }

  // ── Must be a file, not a directory ──
  const stat = fs.statSync(normalized);
  if (!stat.isFile()) {
    throw new Error('路径指向的不是文件');
  }

  // ── Extension must be .json ──
  const ext = path.extname(normalized).toLowerCase();
  if (ext !== '.json') {
    throw new Error('只允许读取 JSON 文件');
  }

  // ── Extra safety: verify resolved path is still within project after realpath ──
  // This catches symlink-based bypass attempts
  try {
    const real = fs.realpathSync(normalized);
    const realRel = path.relative(projectRoot, real);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
      throw new Error('不允许的路径（符号链接越权）');
    }
  } catch {
    throw new Error('不允许的路径（解析失败）');
  }

  return normalized;
}

/**
 * Validate an output directory parameter.
 * Only allows directories starting with "output" under project root.
 */
export function resolveSafeOutputDir(dirParam: string, projectRoot: string): string {
  if (!dirParam || typeof dirParam !== 'string') {
    throw new Error('输出目录参数不能为空');
  }
  if (dirParam.includes('\0') || dirParam.includes('..')) {
    throw new Error('输出目录包含非法字符');
  }

  // Only use the first path component to prevent nested traversal
  const clean = dirParam.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0];

  if (!clean.startsWith('output')) {
    throw new Error('输出目录必须以 output 开头');
  }
  if (clean.length > 80) {
    throw new Error('输出目录名称过长');
  }

  const resolved = path.resolve(projectRoot, clean);
  const rel = path.relative(projectRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('输出目录路径越权');
  }

  return resolved;
}
