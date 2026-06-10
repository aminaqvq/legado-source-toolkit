import type {
  HealthData, InspectData, JobStatus, ProcessFormOptions,
  ProcessSummary, ConsistencyReport, IssuesData, SourceAnalysisItem,
  UploadResult, ResultsListEntry,
} from './api-types';

const API_BASE = '/api';

async function get<T>(url: string): Promise<T> {
  return request<T>(url);
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    ...(options?.body instanceof FormData ? { headers: undefined as unknown as Record<string,string> } : {}),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || '请求失败');
  return json.data as T;
}

// ── Health ──
export async function healthCheck(): Promise<HealthData> { return get('/health'); }

// ── Inspect / Validate ──
export async function inspect(inputPath: string): Promise<InspectData> {
  return post('/inspect', { inputPath });
}
export async function validate(
  inputPath: string, online = false, concurrency = 5, timeout = 8000,
): Promise<{ total: number; ok: number; warn: number; invalid: number }> {
  return post('/validate', { inputPath, online, concurrency, timeout });
}

// ── Process ──
export async function startProcess(inputPath: string, opts: Partial<ProcessFormOptions> = {}): Promise<{ jobId: string }> {
  return post('/process', { inputPath, ...opts });
}
export async function getJob(id: string): Promise<JobStatus> { return get(`/jobs/${id}`); }

// ── Upload ──
export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message);
  return json.data;
}

// ── Results ──
export async function getResultsList(): Promise<{ outputs: ResultsListEntry[] }> { return get('/results'); }
export async function getResultDir(dir: string): Promise<{ dir: string; files: Record<string,unknown> }> {
  return get(`/results/${dir}`);
}

// ── Audit endpoints ──
export async function getSummary(outDir: string): Promise<ProcessSummary> {
  return get(`/results/summary?dir=${encodeURIComponent(outDir)}`);
}
export async function getConsistency(outDir: string): Promise<ConsistencyReport> {
  return get(`/results/consistency?dir=${encodeURIComponent(outDir)}`);
}
export async function getIssues(outDir: string): Promise<IssuesData> {
  return get(`/results/issues?dir=${encodeURIComponent(outDir)}`);
}
export async function getSourceDetail(index: number, outDir: string): Promise<SourceAnalysisItem> {
  return get(`/results/source/${index}?dir=${encodeURIComponent(outDir)}`);
}

// ── Download ──
export function buildDownloadUrl(filePath: string): string {
  return `/api/download?file=${encodeURIComponent(filePath)}`;
}

// ── Aliases ──
export const apiHealth = healthCheck;
export const apiInspect = inspect;
export const apiValidate = validate;
export const apiProcess = startProcess;
export const apiGetJob = getJob;
export const apiGetResults = getResultsList;
