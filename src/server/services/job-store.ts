interface Job {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: string;
  completedAt?: string;
  progress?: string;
  result?: unknown;
  error?: string;
}

class JobStore {
  private jobs = new Map<string, Job>();
  private maxConcurrent = 1;
  private maxTotal = 20;
  private ttlMs = 60 * 60 * 1000; // 1 hour TTL after completion

  create(id: string): Job | null {
    // Enforce max total jobs
    if (this.jobs.size >= this.maxTotal) {
      this.evictOldest();
    }
    // Enforce max concurrent
    const running = [...this.jobs.values()].filter(j => j.status === 'running').length;
    if (running >= this.maxConcurrent) return null;

    const job: Job = { id, status: 'pending', createdAt: new Date().toISOString() };
    this.jobs.set(id, job);
    this.expireOld();
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  start(id: string): void {
    const job = this.jobs.get(id);
    if (job) { job.status = 'running'; job.progress = 'Processing...'; }
  }

  progress(id: string, message: string): void {
    const job = this.jobs.get(id);
    if (job) job.progress = message;
  }

  complete(id: string, result: unknown): void {
    const job = this.jobs.get(id);
    if (job) { job.status = 'success'; job.completedAt = new Date().toISOString(); job.result = result; }
  }

  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) { job.status = 'failed'; job.completedAt = new Date().toISOString(); job.error = error; }
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = 'Cancelled by user';
      return true;
    }
    return false;
  }

  /** Remove completed/failed jobs older than TTL. */
  private expireOld(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if ((job.status === 'success' || job.status === 'failed') && job.completedAt) {
        const age = now - new Date(job.completedAt).getTime();
        if (age > this.ttlMs) this.jobs.delete(id);
      }
    }
  }

  /** Evict the oldest completed/failed job to make room. */
  private evictOldest(): void {
    let oldest: { id: string; ts: number } | null = null;
    for (const [id, job] of this.jobs) {
      if (job.status === 'success' || job.status === 'failed') {
        const ts = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        if (!oldest || ts < oldest.ts) oldest = { id, ts };
      }
    }
    if (oldest) this.jobs.delete(oldest.id);
  }
}

export const jobStore = new JobStore();
