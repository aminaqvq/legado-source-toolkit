import { useState } from 'react';
import FilePicker from '../components/FilePicker';
import ProgressLog from '../components/ProgressLog';
import { startProcess, getJob } from '../lib/api-client';

const DEDUPE_OPTIONS = ['none','exact','url','conservative','host','aggressive'];
const GROUP_MODES = ['category-first','preserve','append','overwrite'];

export default function ProcessPage() {
  const [inputPath, setInputPath] = useState('./bookSource.json');
  const [outDir, setOutDir] = useState('./output-ui');
  const [dedupeLevel, setDedupeLevel] = useState('conservative');
  const [groupMode, setGroupMode] = useState('category-first');
  const [online, setOnline] = useState(false);
  const [concurrency, setConcurrency] = useState(5);
  const [timeout, setTimeout_] = useState(8000);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [includeComplex, setIncludeComplex] = useState(false);
  const [includeUnavailable, setIncludeUnavailable] = useState(false);
  const [writeNormalizedUrl, setWriteNormalizedUrl] = useState(false);
  const [strict, setStrict] = useState(true);
  const [riskyConfirm, setRiskyConfirm] = useState(false);

  const [running, setRunning] = useState(false);
  const [jobStatus, setJobStatus] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('');

  const isRisky = dedupeLevel === 'host' || dedupeLevel === 'aggressive';
  const canStart = !isRisky || (isRisky && riskyConfirm);

  const start = async () => {
    if (!canStart) return;
    setRunning(true); setError(''); setLogs([]);
    try {
      addLog('启动处理任务...');
      const { jobId: id } = await startProcess(inputPath, {
        outDir, online, dedupeLevel, groupMode, concurrency, timeout,
        includeUnknown, includeComplex, includeUnavailable, writeNormalizedUrl, strict,
        allowRiskyDedupe: isRisky,
      });
      addLog(`Job ID: ${id}`);
      setPhase('read');

      const poll = setInterval(async () => {
        try {
          const job = await getJob(id);
          setJobStatus(job.status);
          if (job.progress) {
            addLog(job.progress);
            if (job.progress.includes('Phase 1') || job.progress.includes('Reading')) setPhase('read');
            else if (job.progress.includes('Phase 2') || job.progress.includes('cleaning') || job.progress.includes('Name')) setPhase('names');
            else if (job.progress.includes('Phase 3') || job.progress.includes('URL')) setPhase('urls');
            else if (job.progress.includes('Phase 4') || job.progress.includes('Classif')) setPhase('classify');
            else if (job.progress.includes('Phase 5') || job.progress.includes('Structure')) setPhase('structure');
            else if (job.progress.includes('Phase 6') || job.progress.includes('Online')) setPhase('online');
            else if (job.progress.includes('Scoring') || job.progress.includes('Score')) setPhase('score');
            else if (job.progress.includes('Dedup')) setPhase('dedupe');
            else if (job.progress.includes('Generating') || job.progress.includes('Output')) setPhase('output');
            else if (job.progress.includes('consistency') || job.progress.includes('Consistency')) setPhase('consistency');
          }
          if (job.status === 'success') {
            addLog('✅ 处理完成！');
            clearInterval(poll); setRunning(false);
          } else if (job.status === 'failed') {
            addLog(`❌ 失败: ${job.error}`);
            clearInterval(poll); setRunning(false); setError(job.error || '处理失败');
          }
        } catch { clearInterval(poll); setRunning(false); }
      }, 1000);
    } catch (e: any) {
      setError(e.message); setRunning(false);
    }
  };

  const addLog = (msg: string) => setLogs(l => [...l, msg]);

  return (
    <div className="page">
      <h2>⚡ 处理运行</h2>

      <FilePicker value={inputPath} onChange={setInputPath} />

      <div className="config-grid-3" style={{ marginTop: 16 }}>
        <div className="input-group"><label>输出目录</label><input type="text" value={outDir} onChange={e => setOutDir(e.target.value)} /></div>
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
          {running ? '运行中...' : '▶ 开始处理'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {(running || jobStatus) && <ProgressLog logs={logs} status={jobStatus || (running ? 'running' : '')} currentPhase={phase} />}

      {jobStatus === 'success' && !running && (
        <div className="success-msg" style={{ marginTop: 16 }}>
          ✅ 处理完成！结果已保存到 <code>{outDir}</code> — <a href="#" onClick={e => { e.preventDefault(); window.location.hash = 'results'; }}>查看结果</a>
        </div>
      )}
    </div>
  );
}
