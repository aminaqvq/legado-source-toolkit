import { useState, useEffect } from 'react';
import { getIssues } from '../lib/api-client';
import RiskBadge from '../components/RiskBadge';
import { useAppStore } from '../store/AppContext';
import { normalizeDisplayDir } from '../utils/dirs';
import type { DuplicateGroup, FieldDiffSummary } from '../lib/api-types';

export default function DuplicatesPage() {
  const store = useAppStore();
  const activeDir = normalizeDisplayDir(store.activeResultDir);
  const [dir, setDir] = useState(activeDir || '');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const useCurrent = () => { if (activeDir) { setDir(activeDir); } };

  useEffect(() => { if (activeDir && !dir) setDir(activeDir); }, [activeDir]);

  const load = async () => {
    if (!dir) return;
    setLoading(true); setError('');
    try {
      const data = await getIssues(dir);
      setGroups(data.duplicateRisks || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dir]);

  return (
    <div className="page">
      <h2>🔄 去重风险</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={dir} onChange={e => setDir(e.target.value)} placeholder={activeDir || '结果目录'} style={{ width: 140 }} />
        <button onClick={load} disabled={loading || !dir}>{loading ? '加载中...' : '加载'}</button>
        {activeDir && activeDir !== dir && (
          <button onClick={useCurrent} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>▶ 使用当前结果</button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {!dir && !loading && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>
          📭 请先在处理运行页执行处理，结果目录会自动填到这里。
        </div>
      )}
      {!loading && dir && groups.length === 0 && !error && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>没有去重风险项</div>
      )}

      {groups.length > 0 && <div className="table-info">{groups.length} 个去重组</div>}
      {groups.slice(0, 100).map(g => (
        <div key={g.groupId} className="dup-group" style={{ marginBottom: 12, padding: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpanded(s => { const ns = new Set(s); void (ns.has(g.groupId) ? ns.delete(g.groupId) : ns.add(g.groupId)); return ns; })}>
            <strong>组 {g.groupId}: {g.groupKey}</strong>
            <RiskBadge level={g.reason.includes('RISK') ? 'high' : 'low'} />
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
            保留: {g.keptName} {(g as any).keptIndex !== undefined ? `(idx ${(g as any).keptIndex})` : ''} | 移除: {g.removedIndices?.length ?? 0} 个
          </div>
          {expanded.has(g.groupId) && g.fieldDiffSummaries && g.fieldDiffSummaries.map((fd: FieldDiffSummary, fi: number) => (
            <div key={fi} style={{ marginTop: 8, padding: 8, background: '#f9fafb', borderRadius: 4, fontSize: '0.8rem' }}>
              <div>类型冲突: {fd.typeConflict ? '是' : '否'} | 分类冲突: {fd.categoryConflict ? '是' : '否'}</div>
              <div>{fd.whyKept} | {fd.whyRemoved}</div>
              {fd.ruleDifferences.length > 0 && <div>规则差异: {fd.ruleDifferences.join(', ')}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
