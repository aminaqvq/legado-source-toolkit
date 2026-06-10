import { useState, useEffect } from 'react';
import { getResultsList, buildDownloadUrl } from '../lib/api-client';
import StatCard from '../components/StatCard';
import type { ResultsListEntry } from '../lib/api-types';
import type { ProcessSummary } from '../lib/api-types';

export default function ResultsPage() {
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

  return (
    <div className="page">
      <h2>📊 结果查看</h2>
      <button onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
      {error && <div className="error">{error}</div>}

      {outputs.map(o => {
        const s = o.summary as ProcessSummary | undefined;
        return (
          <div key={o.name} className="result-item" style={{ marginTop: 16, padding: 16, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>{o.name}</h3>
            {s && (
              <div className="summary-cards" style={{ margin: '12px 0' }}>
                <StatCard label="输入总数" value={s.input?.total ?? '-'} color="gray" />
                <StatCard label="输出总数" value={s.output?.total ?? '-'} color="green" />
                <StatCard label="去重移除" value={s.removed?.duplicateCount ?? 0} color="yellow" />
                <StatCard label="不可用排除" value={s.removed?.unavailableCount ?? 0} color="orange" />
                <StatCard label="结构无效" value={s.validation?.invalidCount ?? 0} color="red" />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['cleaned-sources.json','all-sources-reviewed.json'].map(f => (
                <button key={f} onClick={() => window.open(buildDownloadUrl(`${o.name}/${f}`))}>{f}</button>
              ))}
              {['groups/novel.json','groups/comic.json','groups/audio.json','groups/video.json','groups/download.json','groups/other.json'].map(f => (
                <button key={f} onClick={() => window.open(buildDownloadUrl(`${o.name}/${f}`))} style={{ fontSize: '0.8rem' }}>{f}</button>
              ))}
              {['reports/summary.json','reports/sources.json','reports/duplicates.json','reports/output-consistency.json'].map(f => (
                <button key={f} onClick={() => window.open(buildDownloadUrl(`${o.name}/${f}`))} style={{ fontSize: '0.8rem' }}>{f.split('/').pop()}</button>
              ))}
            </div>
          </div>
        );
      })}
      {!loading && outputs.length === 0 && <div className="empty">暂无处理结果</div>}
    </div>
  );
}
