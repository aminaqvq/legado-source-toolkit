import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ProcessSummary } from '../lib/api-types';
import { normalizeDisplayDir } from '../utils/dirs';

// ── Shared state shape ──

export interface UploadState {
  uploadId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  uploaded: boolean;
}

export interface ProcessOptionsState {
  outDir: string;
  dedupe: string;
  groupMode: string;
  concurrency: number;
  timeout: number;
  online: boolean;
  includeUnknown: boolean;
  includeComplex: boolean;
  includeUnavailable: boolean;
  writeNormalizedUrl: boolean;
  strict: boolean;
}

export interface ProgressBlock {
  done: number;
  total: number;
  percent: number;
}

export interface ProcessTaskState {
  jobId: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  phase: string;
  logs: string[];
  summary: ProcessSummary | null;
  resultDir: string;
  inputPath: string;
  totalProgress: number;
  phaseProgress: number;
  connProgress: ProgressBlock | null;
  searchProgress: ProgressBlock | null;
}

export interface AppState {
  upload: UploadState;
  processOptions: ProcessOptionsState;
  processTask: ProcessTaskState;
  activeResultDir: string;
  lastSuccessfulResultDir: string;
}

interface AppContextValue extends AppState {
  setUpload: (u: Partial<UploadState>) => void;
  setProcessOptions: (opts: Partial<ProcessOptionsState>) => void;
  setProcessTask: (task: Partial<ProcessTaskState>) => void;
  appendLog: (msg: string) => void;
  appendLogs: (msgs: string[]) => void;
  finishProcessTask: (summary: ProcessSummary) => void;
  failProcessTask: (error: string) => void;
  clearProcessTask: () => void;
  resetSession: () => void;
}

// ── Defaults ──

const defaultUpload: UploadState = { uploadId: '', filePath: '', fileName: '', fileSize: 0, uploaded: false };
const defaultProcessOptions: ProcessOptionsState = {
  outDir: '', dedupe: 'conservative', groupMode: 'category-first',
  concurrency: 16, timeout: 8000, online: false,
  includeUnknown: false, includeComplex: false, includeUnavailable: false,
  writeNormalizedUrl: false, strict: true,
};
const defaultProcessTask: ProcessTaskState = {
  jobId: '', status: 'idle', phase: '', logs: [], summary: null, resultDir: '', inputPath: '',
  totalProgress: 0, phaseProgress: 0, connProgress: null, searchProgress: null,
};

// ── localStorage keys ──

const LS_UPLOAD = 'lstk_upload';
const LS_OPTS = 'lstk_processOptions';
const LS_RESULTDIR = 'lstk_activeResultDir';
const LS_LASTRESULTDIR = 'lstk_lastResultDir';

function loadJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota exceeded */ }
}

// ── Initial state with localStorage recovery + migration ──

function initialState(): AppState {
  const upload = loadJSON<UploadState>(LS_UPLOAD, defaultUpload);
  // Migrate: if filePath is an absolute path, try to keep basename
  if (upload.filePath) upload.filePath = normalizeDisplayDir(upload.filePath) || upload.filePath;
  // If stale upload without uploadId, reset uploaded status
  if (upload.uploaded && !upload.uploadId) {
    upload.uploaded = false;
    upload.uploadId = '';
  }

  const rawOpts = loadJSON<Partial<ProcessOptionsState>>(LS_OPTS, {});
  // Migrate outDir
  if (rawOpts.outDir) rawOpts.outDir = normalizeDisplayDir(rawOpts.outDir) || '';
  const processOptions = Object.assign({}, defaultProcessOptions, rawOpts);

  let activeResultDir = loadJSON<string>(LS_RESULTDIR, '');
  activeResultDir = normalizeDisplayDir(activeResultDir) || activeResultDir;

  let lastSuccessfulResultDir = loadJSON<string>(LS_LASTRESULTDIR, '');
  lastSuccessfulResultDir = normalizeDisplayDir(lastSuccessfulResultDir) || lastSuccessfulResultDir;

  return {
    upload, processOptions, processTask: defaultProcessTask,
    activeResultDir, lastSuccessfulResultDir,
  };
}

// ── Context ──

const AppContext = createContext<AppContextValue>(null as unknown as AppContextValue);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);

  const setStateAndPersist = useCallback((key: string, updater: (s: AppState) => Partial<AppState>) => {
    setState(s => {
      const patch = updater(s);
      if (key === LS_UPLOAD && patch.upload) saveJSON(LS_UPLOAD, patch.upload);
      if (key === LS_OPTS && patch.processOptions) saveJSON(LS_OPTS, patch.processOptions);
      if (key === LS_RESULTDIR && patch.activeResultDir !== undefined) {
        saveJSON(LS_RESULTDIR, normalizeDisplayDir(patch.activeResultDir));
      }
      if (key === LS_LASTRESULTDIR && patch.lastSuccessfulResultDir !== undefined) {
        saveJSON(LS_LASTRESULTDIR, normalizeDisplayDir(patch.lastSuccessfulResultDir));
      }
      return { ...s, ...patch };
    });
  }, []);

  const setUpload = useCallback((u: Partial<UploadState>) => {
    setStateAndPersist(LS_UPLOAD, s => ({ upload: { ...s.upload, ...u } }));
  }, [setStateAndPersist]);

  const setProcessOptions = useCallback((opts: Partial<ProcessOptionsState>) => {
    const normalized: Partial<ProcessOptionsState> = {};
    for (const [k, v] of Object.entries(opts)) {
      if (k === 'outDir' && typeof v === 'string') (normalized as any)[k] = normalizeDisplayDir(v);
      else (normalized as any)[k] = v;
    }
    setStateAndPersist(LS_OPTS, s => ({ processOptions: { ...s.processOptions, ...normalized } }));
  }, [setStateAndPersist]);

  const setProcessTask = useCallback((task: Partial<ProcessTaskState>) => {
    setState(s => ({ ...s, processTask: { ...s.processTask, ...task } }));
  }, []);

  const appendLog = useCallback((msg: string) => {
    setState(s => ({ ...s, processTask: { ...s.processTask, logs: [...s.processTask.logs, msg] } }));
  }, []);

  const appendLogs = useCallback((msgs: string[]) => {
    setState(s => ({ ...s, processTask: { ...s.processTask, logs: [...s.processTask.logs, ...msgs] } }));
  }, []);

  const finishProcessTask = useCallback((summary: ProcessSummary) => {
    setState(s => {
      const resultDir = normalizeDisplayDir(s.processTask.resultDir || '');
      saveJSON(LS_RESULTDIR, resultDir);
      saveJSON(LS_LASTRESULTDIR, resultDir);
      return {
        ...s,
        processTask: {
          ...s.processTask,
          status: 'success', summary, phase: '', totalProgress: 100, phaseProgress: 100,
          logs: s.processTask.logs.length > 0 ? s.processTask.logs : ['✅ 处理完成'],
        },
        activeResultDir: resultDir || s.activeResultDir,
        lastSuccessfulResultDir: resultDir || s.lastSuccessfulResultDir,
      };
    });
  }, []);

  const failProcessTask = useCallback((error: string) => {
    setState(s => ({
      ...s,
      processTask: { ...s.processTask, status: 'failed', logs: [...s.processTask.logs, `❌ 失败: ${error}`] },
    }));
  }, []);

  const clearProcessTask = useCallback(() => {
    setState(s => ({ ...s, processTask: { ...defaultProcessTask } }));
  }, []);

  const resetSession = useCallback(() => {
    localStorage.removeItem(LS_UPLOAD);
    localStorage.removeItem(LS_OPTS);
    localStorage.removeItem(LS_RESULTDIR);
    localStorage.removeItem(LS_LASTRESULTDIR);
    setState({
      upload: defaultUpload,
      processOptions: defaultProcessOptions,
      processTask: defaultProcessTask,
      activeResultDir: '',
      lastSuccessfulResultDir: '',
    });
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      setUpload, setProcessOptions, setProcessTask,
      appendLog, appendLogs, finishProcessTask, failProcessTask,
      clearProcessTask, resetSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  return useContext(AppContext);
}
