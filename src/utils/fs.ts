import fs from 'fs-extra';
import path from 'node:path';

/**
 * Read and parse a JSON file.
 */
export function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Write a JSON file. Creates parent directories as needed.
 */
export function writeJsonFile<T>(
  filePath: string,
  data: T,
  pretty = true,
): void {
  fs.ensureDirSync(path.dirname(filePath));
  const content = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Ensure an output directory exists (creates if needed).
 */
export function ensureOutputDir(dir: string): void {
  fs.ensureDirSync(dir);
}

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Write a text file (non-JSON). Creates parent directories as needed.
 */
export function writeTextFile(filePath: string, content: string): void {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}
