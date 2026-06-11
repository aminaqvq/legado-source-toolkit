import { useState, useEffect } from 'react';
import { getResultsList, buildDownloadUrl } from '../lib/api-client';
import StatCard from '../components/StatCard';
import { useAppStore } from '../store/AppContext';
import { normalizeDisplayDir } from '../utils/dirs';
import type { ResultsListEntry, ProcessSummary } from '../lib/api-types';

export default function ResultsPage() {
  const store = useAppStore();
  const activeDir = normalizeDisplayDir(store.activeResultDir);

  const [outputs, setOutputs] = useState<ResultsListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setOutputs((await getResultsList()).outputs || []); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const activeOutput = activeDir ? outputs.find(o => o.name === activeDir) : undefined;

  return (
    <div className="page">
      <h2>📊 结果查看</h2>
      <button onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
      {error && <div className="error">{error}</div>}

      {activeDir && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#2e7d32' }}>
          📂 当前结果目录: <code>{activeDir}</code>
        </div>
      )}

      {/* Show current result first if available */}
      {activeOutput && (
        <div key={activeOutput.name} className="result-item" style={{ marginTop: 16, padding: 16, background: 'var(--card-bg)', border: '2px solid #3b82f6', borderRadius: 8 }}>
          <h3>⭐ {activeOutput.name} (当前)</h3>
          <ResultSummary summary={activeOutput.summary as ProcessSummary | undefined} />
          <DownloadButtons name={activeOutput.name} />
        </div>
      )}

      {outputs.filter(o => o.name !== activeDir).map(o => {
        const s = o.summary as ProcessSummary | undefined;
        return (
          <div key={o.name} className="result-item" style={{ marginTop: 16, padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>{o.name}</h3>
            <ResultSummary summary={s} />
            <DownloadButtons name={o.name} />
          </div>
        );
      })}
      {!loading && outputs.length === 0 && (
        <div className="empty-hint" style={{ marginTop: 20, color: '#888' }}>
          📭 暂无处理结果。请先在"处理运行"页执行一次处理。
        </div>
      )}
    </div>
  );
}

function ResultSummary({ summary }: { summary: ProcessSummary | undefined }) {
  if (!summary) return null;
  return (
    <div className="summary-cards" style={{ margin: '12px 0' }}>
      <StatCard label="输入总数" value={summary.input?.total ?? '-'} color="gray" />
      <StatCard label="输出总数" value={summary.output?.total ?? '-'} color="green" />
      <StatCard label="去重移除" value={summary.removed?.duplicateCount ?? 0} color="yellow" />
      <StatCard label="不可用排除" value={summary.removed?.unavailableCount ?? 0} color="orange" />
      <StatCard label="结构无效" value={summary.validation?.invalidCount ?? 0} color="red" />
    </div>
  );
}

function DownloadButtons({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {['cleaned-sources.json','all-sources-reviewed.json'].map(f => (
        <button key={f} onClick={() => window.open(buildDownloadUrl(`${name}/${f}`))}>{f}</button>
      ))}
      {['groups/novel.json','groups/comic.json','groups/audio.json','groups/video.json','groups/download.json','groups/other.json'].map(f => (
        <button key={f} onClick={() => window.open(buildDownloadUrl(`${name}/${f}`))} style={{ fontSize: '0.8rem' }}>{f}</button>
      ))}
      {['reports/summary.json','reports/sources.json','reports/duplicates.json','reports/output-consistency.json'].map(f => (
        <button key={f} onClick={() => window.open(buildDownloadUrl(`${name}/${f}`))} style={{ fontSize: '0.8rem' }}>{f.split('/').pop()}</button>
      ))}
    </div>
  );
}
