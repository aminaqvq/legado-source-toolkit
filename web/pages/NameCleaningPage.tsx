import { useState, useEffect } from 'react';
import type { SourceAnalysisItem } from '../lib/api-types';

export default function NameCleaningPage() {
  const [dir, setDir] = useState('output-verify');
  const [changed, setChanged] = useState<SourceAnalysisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      // Load all sources from reports — we need the ones with cleanNameSteps
      const res = await fetch(`/api/results/${encodeURIComponent(dir)}`).then(r => r.json());
      const sources = (res.data?.files?.['sources.json'] || []) as SourceAnalysisItem[];
      const filtered = sources.filter(s => !onlyChanged || s.cleanNameSteps?.length > 0);
      setChanged(filtered);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dir]);

  const filtered = changed.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.originalName||'').toLowerCase().includes(q) || (s.cleanedName||'').toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <h2>🏷️ 名称清洗</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={dir} onChange={e => setDir(e.target.value)} style={{ width: 140 }} />
        <button onClick={load} disabled={loading}>{loading ? '加载中...' : '加载'}</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称" style={{ width: 160 }} />
        <label><input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> 仅显示有变化</label>
      </div>
      {error && <div className="error">{error}</div>}

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
