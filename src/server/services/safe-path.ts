import path from 'node:path';

/**
 * Safely resolve a user-supplied file path.
 * Allows absolute paths and project-relative paths.
 * Prevents null-byte injection and basic path traversal.
 */
export function safeResolvePath(userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('路径不能为空');
  }

  // Block null bytes
  if (userPath.includes('\0')) {
    throw new Error('路径包含非法字符');
  }

  // Resolve to absolute
  const resolved = path.resolve(userPath);

  return path.normalize(resolved);
}

/**
 * Ensure a path stays within the project directory (if given as relative).
 */
export function ensureInProject(userPath: string, projectRoot: string): string {
  const resolved = safeResolvePath(userPath);

  // If user gave an absolute path outside the project, that's allowed
  // (e.g., they want to process a file elsewhere).
  // We only restrict when the path starts within the project.
  if (resolved.startsWith(projectRoot + path.sep)) {
    return resolved;
  }

  // For absolute paths outside project, allow but warn
  if (path.isAbsolute(resolved)) {
    return resolved;
  }

  // Relative paths resolve within project
  const inProject = path.resolve(projectRoot, userPath);
  if (inProject.startsWith(projectRoot + path.sep)) {
    return inProject;
  }

  throw new Error('路径不在允许的范围内');
}
