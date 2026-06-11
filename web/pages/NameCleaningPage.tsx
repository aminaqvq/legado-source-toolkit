import { useState, useEffect } from 'react';
import { useAppStore } from '../store/AppContext';
import { normalizeDisplayDir } from '../utils/dirs';
import type { SourceAnalysisItem } from '../lib/api-types';

export default function NameCleaningPage() {
  const store = useAppStore();
  const activeDir = normalizeDisplayDir(store.activeResultDir);
  const [dir, setDir] = useState(activeDir || '');
  const useCurrent = () => { if (activeDir) { setDir(activeDir); } };
  const [changed, setChanged] = useState<SourceAnalysisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => { if (activeDir && !dir) setDir(activeDir); }, [activeDir]);

  const load = async () => {
    if (!dir) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/results/${encodeURIComponent(dir)}`).then(r => r.json());
      if (!res.success && res.error) { setError(res.error.message); return; }
      const sources = (res.data?.files?.['sources.json'] || []) as SourceAnalysisItem[];
      const filtered = sources.filter(s => !onlyChanged || s.cleanNameSteps?.length > 0);
      setChanged(filtered);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dir, onlyChanged]);

  const filtered = changed.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.originalName||'').toLowerCase().includes(q) || (s.cleanedName||'').toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <h2>🏷️ 名称清洗</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={dir} onChange={e => setDir(e.target.value)} placeholder={activeDir || '结果目录'} style={{ width: 140 }} />
        <button onClick={load} disabled={loading || !dir}>{loading ? '加载中...' : '加载'}</button>
        {activeDir && activeDir !== dir && (
          <button onClick={useCurrent} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>▶ 使用当前结果</button>
        )}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称" style={{ width: 160 }} />
        <label><input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> 仅显示有变化</label>
      </div>
      {error && <div className="error">{error}</div>}
      {!dir && !loading && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>
          📭 请先在处理运行页执行处理，结果目录会自动填到这里。
        </div>
      )}
      {!loading && dir && filtered.length === 0 && !error && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>没有需要清洗的名称</div>
      )}
      <div className="table-info">{filtered.length} 条</div>
      <table>
        <thead><tr><th>原名称</th><th>清洗后</th><th>步骤数</th></tr></thead>
        <tbody>
          {filtered.slice(0, 200).map((s, i) => (
            <tr key={i} onClick={() => setExpandedIdx(expandedIdx === i ? null : i)} style={{ cursor: 'pointer' }}>
              <td>{s.originalName}</td>
              <td>{s.cleanedName}</td>
              <td>{s.cleanNameSteps?.length || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
