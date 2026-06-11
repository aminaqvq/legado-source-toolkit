import { useState, useEffect } from 'react';
import { getResultDir } from '../lib/api-client';
import StatusBadge from '../components/StatusBadge';
import { useAppStore } from '../store/AppContext';
import { normalizeDisplayDir } from '../utils/dirs';
import type { SourceAnalysisItem } from '../lib/api-types';

export default function UrlNormalizationPage() {
  const store = useAppStore();
  const activeDir = normalizeDisplayDir(store.activeResultDir);
  const [dir, setDir] = useState(activeDir || '');
  const [sources, setSources] = useState<SourceAnalysisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const useCurrent = () => { if (activeDir) { setDir(activeDir); } };

  useEffect(() => { if (activeDir && !dir) setDir(activeDir); }, [activeDir]);

  const load = async () => {
    if (!dir) return;
    setLoading(true); setError('');
    try {
      const res = await getResultDir(dir);
      setSources((res.files as any)['sources.json'] || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dir]);

  const filtered = sources.filter(s => {
    if (filter === 'danger') return s.urlStatus === 'INVALID_URL' || s.urlStatus === 'NON_HTTP_SOURCE';
    if (filter === 'warnings') return (s.urlWarnings || []).length > 0;
    return true;
  });

  return (
    <div className="page">
      <h2>🔗 URL 规范化</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={dir} onChange={e => setDir(e.target.value)} placeholder={activeDir || '结果目录'} style={{ width: 140 }} />
        <button onClick={load} disabled={loading || !dir}>{loading ? '加载中...' : '加载'}</button>
        {activeDir && activeDir !== dir && (
          <button onClick={useCurrent} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>▶ 使用当前结果</button>
        )}
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">全部</option>
          <option value="danger">⚠️ 危险 (INVALID / NON_HTTP)</option>
          <option value="warnings">有警告</option>
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      {!dir && !loading && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>
          📭 请先在处理运行页执行处理，结果目录会自动填到这里。
        </div>
      )}
      {!loading && dir && filtered.length === 0 && !error && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>没有 URL 数据</div>
      )}
      <table>
        <thead><tr><th>原 URL</th><th>规范后 URL</th><th>状态</th><th>警告</th></tr></thead>
        <tbody>
          {filtered.slice(0, 200).map((s, i) => (
            <tr key={i} className={s.urlStatus === 'INVALID_URL' ? 'row-danger' : s.urlStatus === 'NON_HTTP_SOURCE' ? 'row-warning' : ''}>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.originalUrl}>{s.originalUrl}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.normalizedUrl || '-'}</td>
              <td><StatusBadge status={s.urlStatus} size="sm" /></td>
              <td style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{(s.urlWarnings || []).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
