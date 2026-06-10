import { useState, useEffect } from 'react';
import { getIssues } from '../lib/api-client';
import RiskBadge from '../components/RiskBadge';
import type { DuplicateGroup, FieldDiffSummary } from '../lib/api-types';

export default function DuplicatesPage() {
  const [dir, setDir] = useState('output-verify');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true); setError('');
    try {
      const iss = await getIssues(dir);
      setGroups((iss.duplicates || []) as DuplicateGroup[]);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="page">
      <h2>🔄 去重风险</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={dir} onChange={e => setDir(e.target.value)} style={{ width: 140 }} />
        <button onClick={load} disabled={loading}>{loading ? '加载中...' : '加载'}</button>
      </div>
      {error && <div className="error">{error}</div>}

      {groups.map(g => {
        const isRisk = g.reason.includes('RISK');
        return (
          <div key={g.groupId} className={`dup-group ${isRisk ? 'risk' : ''}`} style={{ marginBottom: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: isRisk ? '#fef2f2' : 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => toggle(g.groupId)}>
              <div>
                <strong>Group #{g.groupId}</strong>{' '}
                <code style={{ fontSize: '0.8rem' }}>{g.groupKey}</code>{' '}
                {isRisk && <RiskBadge level="high" />}
              </div>
              <span style={{ color: '#666' }}>{expanded.has(g.groupId) ? '▲' : '▼'}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div>✅ <strong>保留</strong>: #{g.keptIndex} {g.keptName || ''} (score: {(g as any).scoreBreakdown ? Object.values(g.scoreBreakdown as Record<string,number>).reduce((a,b)=>a+b,0) : '-'})</div>
              <div>❌ <strong>移除</strong>: {(g.removedNames || []).join(', ')} (diffs: {(g.scoreDiffs || []).join(', ')})</div>
            </div>
            {expanded.has(g.groupId) && g.fieldDiffSummaries && (
              <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
                <h4>Field Diffs</h4>
                {g.fieldDiffSummaries.map((d: FieldDiffSummary, i: number) => (
                  <div key={i} style={{ marginBottom: 8, padding: 8, border: '1px solid #eee', borderRadius: 4 }}>
                    <div><strong>类型冲突</strong>: {d.typeConflict ? '⚠️ yes' : '✅ no'} | <strong>分类冲突</strong>: {d.categoryConflict ? '⚠️ yes' : '✅ no'}</div>
                    {d.ruleDifferences.length > 0 && <div><strong>规则差异</strong>: {d.ruleDifferences.join(', ')}</div>}
                    <div><strong>时效</strong>: {d.freshnessComparison}</div>
                    <div><strong>响应时间</strong>: {d.respondTimeComparison}</div>
                    <div style={{ color: 'green' }}>{d.whyKept}</div>
                    <div style={{ color: 'red' }}>{d.whyRemoved}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {!loading && groups.length === 0 && <div className="empty">无去重记录</div>}
    </div>
  );
}
