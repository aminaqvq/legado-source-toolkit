import fs from 'fs-extra';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOADS_DIR = path.resolve('uploads');

export interface UploadMeta {
  uploadId: string;
  absPath: string;
  relPath: string;
  fileName: string;
  size: number;
  createdAt: number;
}

/** In-memory upload registry — lasts until server restart. */
const uploadsById = new Map<string, UploadMeta>();

/**
 * Save an uploaded buffer to disk and register it.
 * Returns the UploadMeta (which includes absPath, relPath, uploadId).
 */
export async function saveUpload(
  filename: string,
  buffer: Buffer,
): Promise<UploadMeta> {
  await fs.ensureDir(UPLOADS_DIR);

  const safeName = sanitizeFilename(filename) || `upload-${randomUUID()}.json`;
  const destPath = path.join(UPLOADS_DIR, safeName);
  const uploadId = randomUUID();

  await fs.writeFile(destPath, buffer);

  const meta: UploadMeta = {
    uploadId,
    absPath: destPath,
    relPath: path.relative(process.cwd(), destPath).replace(/\\/g, '/'),
    fileName: filename,
    size: buffer.length,
    createdAt: Date.now(),
  };
  uploadsById.set(uploadId, meta);

  // Evict oldest entries if too many (max 50)
  if (uploadsById.size > 50) {
    let oldest: { id: string; ts: number } | null = null;
    for (const [id, m] of uploadsById) {
      if (!oldest || m.createdAt < oldest.ts) oldest = { id, ts: m.createdAt };
    }
    if (oldest) uploadsById.delete(oldest.id);
  }

  return meta;
}

/** Look up an uploaded file by its uploadId. Returns null if not found. */
export function getUploadedFile(uploadId: string): UploadMeta | null {
  return uploadsById.get(uploadId) ?? null;
}

/** Remove a single upload record and its file from disk. */
export async function removeUpload(uploadId: string): Promise<void> {
  const meta = uploadsById.get(uploadId);
  if (meta) {
    try { await fs.remove(meta.absPath); } catch { /* ignore */ }
    uploadsById.delete(uploadId);
  }
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
  uploadsById.clear();
}

/**
 * List all registered upload paths (absolute).
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
