import fs from 'fs-extra';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOADS_DIR = path.resolve('uploads');

/**
 * Save an uploaded buffer to disk and return the stored path.
 */
export async function saveUpload(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  await fs.ensureDir(UPLOADS_DIR);

  const safeName = sanitizeFilename(filename) || `upload-${randomUUID()}.json`;
  const destPath = path.join(UPLOADS_DIR, safeName);

  await fs.writeFile(destPath, buffer);
  return destPath;
}

/**
 * Remove all uploaded files (on process exit or explicit cleanup).
 */
export async function clearUploads(): Promise<void> {
  try {
    await fs.remove(UPLOADS_DIR);
  } catch {
    // ignore
  }
}

/**
 * List all uploaded file paths.
 */
export async function listUploads(): Promise<string[]> {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    return files.map((f) => path.join(UPLOADS_DIR, f));
  } catch {
    return [];
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
}
