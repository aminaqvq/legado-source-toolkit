interface Job {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: string;
  completedAt?: string;
  progress?: string;
  // ── Structured progress fields ──
  logs: string[];
  phase: string;
  /** Absolute output directory (internal use only) */
  resultDir: string;
  /** Relative output directory for frontend display */
  displayResultDir: string;
  inputPath: string;
  // ── Progress tracking ──
  totalProgress: number;
  phaseProgress: number;
  connDone: number;
  connTotal: number;
  searchDone: number;
  searchTotal: number;
  result?: unknown;
  error?: string;
}

class JobStore {
  private jobs = new Map<string, Job>();
  private maxConcurrent = 1;
  private maxTotal = 20;
  private ttlMs = 60 * 60 * 1000;

  create(id: string): Job | null {
    if (this.jobs.size >= this.maxTotal) this.evictOldest();
    const running = [...this.jobs.values()].filter(j => j.status === 'running').length;
    if (running >= this.maxConcurrent) return null;

    const job: Job = {
      id, status: 'pending', createdAt: new Date().toISOString(),
      logs: [], phase: '', resultDir: '', displayResultDir: '', inputPath: '',
      totalProgress: 0, phaseProgress: 0,
      connDone: 0, connTotal: 0, searchDone: 0, searchTotal: 0,
    };
    this.jobs.set(id, job);
    this.expireOld();
    return job;
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }

  start(id: string): void {
    const job = this.jobs.get(id);
    if (job) { job.status = 'running'; job.phase = '启动中'; job.logs.push('启动处理任务'); }
  }

  addLog(id: string, message: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.logs.push(message);
    if (job.logs.length > 200) job.logs = job.logs.slice(-200);
    job.progress = message;
  }

  setPhase(id: string, phase: string): void {
    const job = this.jobs.get(id);
    if (job) { job.phase = phase; job.progress = phase; job.logs.push(`▶ ${phase}`); }
  }

  /** Update structured progress — called by onProgress callback. */
  updateProgress(id: string, label: 'connectivity' | 'search', done: number, total: number): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    if (label === 'connectivity') { job.connDone = done; job.connTotal = total; }
    else { job.searchDone = done; job.searchTotal = total; }
    // Estimate totalProgress: conn+search together are ~40% of overall when online
    job.phaseProgress = percent;
    job.totalProgress = Math.min(99, 50 + Math.round(percent * 0.4));
  }

  setResultDir(id: string, absDir: string): void {
    const job = this.jobs.get(id);
    if (job) job.resultDir = absDir;
  }

  setDisplayResultDir(id: string, relDir: string): void {
    const job = this.jobs.get(id);
    if (job) job.displayResultDir = relDir;
  }

  setInputPath(id: string, inputPath: string): void {
    const job = this.jobs.get(id);
    if (job) job.inputPath = inputPath;
  }

  progress(id: string, message: string): void { this.addLog(id, message); }

  complete(id: string, result: unknown): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'success';
      job.completedAt = new Date().toISOString();
      job.result = result;
      job.totalProgress = 100;
      job.phaseProgress = 100;
      job.phase = '完成';
      job.logs.push('✅ 处理完成');
    }
  }

  fail(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed'; job.completedAt = new Date().toISOString();
      job.error = error; job.logs.push(`❌ 失败: ${error}`);
    }
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      job.status = 'failed'; job.completedAt = new Date().toISOString(); job.error = 'Cancelled by user';
      return true;
    }
    return false;
  }

  private expireOld(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if ((job.status === 'success' || job.status === 'failed') && job.completedAt) {
        if (now - new Date(job.completedAt).getTime() > this.ttlMs) this.jobs.delete(id);
      }
    }
  }

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
