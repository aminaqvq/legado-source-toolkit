import { useState, useEffect, useRef } from 'react';
import FilePicker from '../components/FilePicker';
import ProgressLog from '../components/ProgressLog';
import { startProcess, getJob } from '../lib/api-client';
import { useAppStore } from '../store/AppContext';
import { normalizeDisplayDir } from '../utils/dirs';
import StatCard from '../components/StatCard';

const DEDUPE_OPTIONS = ['none','exact','url','conservative','host','aggressive'];
const GROUP_MODES = ['category-first','preserve','append','overwrite'];

export default function ProcessPage() {
  const store = useAppStore();
  const {
    upload, processOptions, processTask,
    setProcessOptions, setProcessTask, appendLog, appendLogs,
    finishProcessTask, failProcessTask, setUpload,
  } = store;

  const inputPath = upload.filePath || '';
  const setInputPath = (path: string) => setUpload({ filePath: path, uploaded: true });

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [outDirEmptyMsg, setOutDirEmptyMsg] = useState('');
  const [consistency, setConsistency] = useState<{ pass: boolean; summary: { dirtyNamesInGroups: number; groupFieldMismatches: number; cleanedGroupsDiffs: number } } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const outDir = processOptions.outDir;
  const dedupeLevel = processOptions.dedupe;
  const groupMode = processOptions.groupMode;
  const [online, setOnline] = useState(processOptions.online);
  const [concurrency, setConcurrency] = useState(processOptions.concurrency);
  const [timeout, setTimeout_] = useState(processOptions.timeout);
  const [includeUnknown, setIncludeUnknown] = useState(processOptions.includeUnknown);
  const [includeComplex, setIncludeComplex] = useState(processOptions.includeComplex);
  const [includeUnavailable, setIncludeUnavailable] = useState(processOptions.includeUnavailable);
  const [writeNormalizedUrl, setWriteNormalizedUrl] = useState(processOptions.writeNormalizedUrl);
  const [strict, setStrict] = useState(processOptions.strict);
  const [riskyConfirm, setRiskyConfirm] = useState(false);

  const setOutDir = (v: string) => setProcessOptions({ outDir: normalizeDisplayDir(v) });
  const setDedupeLevel = (v: string) => setProcessOptions({ dedupe: v });
  const setGroupMode = (v: string) => setProcessOptions({ groupMode: v });

  const saveOptions = () => setProcessOptions({
    online, concurrency, timeout, includeUnknown, includeComplex,
    includeUnavailable, writeNormalizedUrl, strict,
  });

  const isRisky = dedupeLevel === 'host' || dedupeLevel === 'aggressive';
  const canStart = (!isRisky || (isRisky && riskyConfirm)) && inputPath.length > 0 && outDir.length > 0;
  const hasTask = processTask.jobId && processTask.status !== 'idle';

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Load consistency on success
  useEffect(() => {
    if (processTask.status === 'success' && processTask.resultDir) {
      const dir = normalizeDisplayDir(processTask.resultDir) || processTask.resultDir;
      fetch(`/api/results/consistency?dir=${encodeURIComponent(dir)}`)
        .then(r => r.json())
        .then(d => { if (d.success) setConsistency(d.data); })
        .catch(() => {});
    }
  }, [processTask.status, processTask.resultDir]);

  const start = async () => {
    if (!canStart) return;
    if (!outDir) { setOutDirEmptyMsg('请填写输出目录，例如 output'); return; }
    setOutDirEmptyMsg('');
    setRunning(true); setError(''); setConsistency(null);
    const cleanOutDir = normalizeDisplayDir(outDir) || outDir;
    setProcessTask({
      jobId: '', status: 'running', phase: '启动中', logs: [], summary: null,
      resultDir: cleanOutDir, inputPath, totalProgress: 0, phaseProgress: 0,
      connProgress: null, searchProgress: null,
    });
    saveOptions();

    try {
      appendLog('▶ 启动处理任务');
      const { jobId: id } = await startProcess(inputPath, {
        outDir: cleanOutDir, online, dedupeLevel, groupMode, concurrency, timeout,
        includeUnknown, includeComplex, includeUnavailable, writeNormalizedUrl, strict,
        allowRiskyDedupe: isRisky,
      });
      setProcessTask({ jobId: id });
      appendLog(`Job ID: ${id}`);

      let seenLogCount = 0;
      intervalRef.current = setInterval(async () => {
        try {
          const job = await getJob(id);
          if (!job) return;
          if (job.logs && job.logs.length > seenLogCount) {
            appendLogs(job.logs.slice(seenLogCount));
            seenLogCount = job.logs.length;
          }
          if (job.phase) setProcessTask({ phase: job.phase });
          // Progress
          setProcessTask({
            totalProgress: job.totalProgress ?? 0,
            phaseProgress: job.phaseProgress ?? 0,
            connProgress: job.connProgress ?? null,
            searchProgress: job.searchProgress ?? null,
          });
          // Directory
          const displayDir = job.displayResultDir || job.resultDir || '';
          if (displayDir) setProcessTask({ resultDir: displayDir });

          if (job.status === 'success') {
            if (job.result) finishProcessTask(job.result as any);
            else finishProcessTask(makeEmptySummary());
            clearInterval(intervalRef.current!);
            setRunning(false);
          } else if (job.status === 'failed') {
            failProcessTask(job.error || '处理失败');
            clearInterval(intervalRef.current!);
            setRunning(false);
            setError(job.error || '处理失败');
          }
        } catch { /* ignore polling errors */ }
      }, 1000);
    } catch (e: any) {
      setError(e.message); setRunning(false);
      failProcessTask(e.message);
    }
  };

  const taskPhase = processTask.status === 'success' || processTask.status === 'failed' ? processTask.status : (running ? processTask.phase : '');
  const resultDir = normalizeDisplayDir(processTask.resultDir) || processTask.resultDir;

  return (
    <div className="page">
      <h2>⚡ 处理运行</h2>

      <FilePicker value={inputPath} onChange={setInputPath} />

      {!inputPath && (
        <div className="empty-hint" style={{ marginTop: 8, color: '#888', fontSize: '0.85rem' }}>
          ℹ️ 请先在上传书源页选择文件，或输入本地 JSON 文件路径后再开始处理。
        </div>
      )}

      <div className="config-grid-3" style={{ marginTop: 16 }}>
        <div className="input-group">
          <label>输出目录</label>
          <input type="text" value={outDir} onChange={e => setOutDir(e.target.value)} placeholder="例如: output" />
          {outDirEmptyMsg && <div style={{ color: '#c5221f', fontSize: '0.8rem', marginTop: 2 }}>{outDirEmptyMsg}</div>}
        </div>
        <div className="input-group"><label>去重级别</label><select value={dedupeLevel} onChange={e => setDedupeLevel(e.target.value)}>{DEDUPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        <div className="input-group"><label>分组模式</label><select value={groupMode} onChange={e => setGroupMode(e.target.value)}>{GROUP_MODES.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        <div className="input-group"><label>并发数</label><input type="number" value={concurrency} onChange={e => setConcurrency(+e.target.value)} min={1} max={20} /></div>
        <div className="input-group"><label>超时 (ms)</label><input type="number" value={timeout} onChange={e => setTimeout_(+e.target.value)} min={1000} step={1000} /></div>
        <div className="input-group checkbox-group">
          <label><input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} /> 在线验证</label>
          <label><input type="checkbox" checked={includeUnknown} onChange={e => setIncludeUnknown(e.target.checked)} /> 包含 unknown</label>
          <label><input type="checkbox" checked={includeComplex} onChange={e => setIncludeComplex(e.target.checked)} /> 包含 complex_unverified</label>
          <label><input type="checkbox" checked={includeUnavailable} onChange={e => setIncludeUnavailable(e.target.checked)} /> 包含 unavailable</label>
          <label><input type="checkbox" checked={writeNormalizedUrl} onChange={e => setWriteNormalizedUrl(e.target.checked)} /> 写回 normalizedUrl</label>
          <label><input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} /> strict 一致性检查</label>
        </div>
      </div>

      {isRisky && (
        <div className="warning-banner">
          ⚠️ <strong>危险操作</strong>: {dedupeLevel} 级去重可能误删不同分类/不同类型的源。
          <label style={{ display: 'block', marginTop: 8 }}>
            <input type="checkbox" checked={riskyConfirm} onChange={e => setRiskyConfirm(e.target.checked)} />
            我理解这可能误删不同源，确认使用 {dedupeLevel} 去重
          </label>
        </div>
      )}

      <div style={{ margin: '16px 0' }}>
        <button className="btn-primary" onClick={start} disabled={running || !canStart}>
          {running ? '运行中...' : hasTask ? '▶ 重新处理' : '▶ 开始处理'}
        </button>
        {!outDir && !running && (
          <span style={{ marginLeft: 12, color: '#c5221f', fontSize: '0.85rem' }}>请先填写输出目录</span>
        )}
        {!inputPath && !running && (
          <span style={{ marginLeft: 12, color: '#c5221f', fontSize: '0.85rem' }}>请先选择输入文件</span>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {(running || hasTask) && (
        <ProgressLog
          logs={processTask.logs}
          status={running ? 'running' : processTask.status}
          currentPhase={taskPhase}
          totalProgress={processTask.totalProgress}
          phaseProgress={processTask.phaseProgress}
          connProgress={processTask.connProgress}
          searchProgress={processTask.searchProgress}
        />
      )}

      {/* ── Success summary ── */}
      {processTask.status === 'success' && !running && processTask.summary && (
        <div style={{ marginTop: 16 }}>
          <h3>📊 处理摘要</h3>
          <div className="summary-cards">
            <StatCard label="输入总数" value={processTask.summary.input?.total ?? '-'} color="gray" />
            <StatCard label="输出总数" value={processTask.summary.output?.total ?? '-'} color="green" />
            <StatCard label="去重移除" value={processTask.summary.removed?.duplicateCount ?? 0} color="yellow" />
            <StatCard label="不可用排除" value={processTask.summary.removed?.unavailableCount ?? 0} color="orange" />
            <StatCard label="结构无效" value={processTask.summary.validation?.invalidCount ?? 0} color="red" />
            <StatCard label="Risky" value={processTask.summary.removed?.riskyCount ?? 0} color="purple" />
          </div>

          {consistency && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: consistency.pass ? '#e6f4ea' : '#fce8e6', fontSize: '0.85rem' }}>
              <strong>{consistency.pass ? '✅ 一致性验收通过' : '❌ 一致性验收未通过'}</strong>
              <span style={{ marginLeft: 8 }}>
                dirty: {consistency.summary.dirtyNamesInGroups} | group mismatch: {consistency.summary.groupFieldMismatches} | diffs: {consistency.summary.cleanedGroupsDiffs}
              </span>
            </div>
          )}

          <div className="success-msg" style={{ marginTop: 12 }}>
            ✅ 处理完成！结果已保存到 <code>{resultDir}</code>
          </div>

          {/* ── Actions ── */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { window.location.hash = '#results'; }} style={{ fontSize: '0.8rem' }}>📊 查看结果</button>
            <button onClick={() => { window.location.hash = '#sources'; }} style={{ fontSize: '0.8rem' }}>📋 书源列表</button>
            <button onClick={() => { window.location.hash = '#audit'; }} style={{ fontSize: '0.8rem' }}>📋 审计中心</button>
            <button onClick={() => window.open(`/api/download?file=${encodeURIComponent(resultDir + '/cleaned-sources.json')}`)} style={{ fontSize: '0.8rem' }}>⬇ cleaned-sources.json</button>
            <button onClick={() => window.open(`/api/download?file=${encodeURIComponent(resultDir + '/reports/summary.json')}`)} style={{ fontSize: '0.8rem' }}>⬇ summary.json</button>
          </div>
        </div>
      )}
    </div>
  );
}

function makeEmptySummary() {
  return {
    generatedAt: new Date().toISOString(),
    input: { total: 0, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0 },
    output: { total: 0, categoryCounts: {}, availabilityCounts: {}, typeCounts: {}, averageRespondTime: 0, measuredAverageRespondTime: null },
    removed: { duplicateCount: 0, unavailableCount: 0, riskyCount: 0 },
    validation: { okCount: 0, warnCount: 0, invalidCount: 0 },
  };
}
