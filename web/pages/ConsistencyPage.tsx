import { useState, useEffect } from 'react';
import { getConsistency } from '../lib/api-client';
import type { ConsistencyReport, ConsistencyCheck } from '../lib/api-types';

export default function ConsistencyPage() {
  const [dir, setDir] = useState('output-verify');
  const [data, setData] = useState<ConsistencyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await getConsistency(dir)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <h2>✅ 验收中心</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={dir} onChange={e => setDir(e.target.value)} style={{ width: 140 }} />
        <button onClick={load} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
      </div>
      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <div className={`consistency-banner ${data.pass ? 'pass' : 'fail'}`}>
            {data.pass ? '✅ 验收通过 — 输出一致性正常' : '❌ 验收未通过 — cleaned-sources.json 与 groups/*.json 不一致'}
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
              dirty names: {data.summary.dirtyNamesInGroups} |
              group mismatches: {data.summary.groupFieldMismatches} |
              cleaned/groups diffs: {data.summary.cleanedGroupsDiffs}
            </div>
          </div>

          <h3 style={{ marginTop: 20 }}>检查明细</h3>
          <table>
            <thead><tr><th>检查项</th><th>状态</th><th>详情</th></tr></thead>
            <tbody>
              {(data.checks || []).map((c: ConsistencyCheck) => (
                <tr key={c.id} className={c.pass ? 'row-pass' : 'row-fail'}>
                  <td>{c.label}</td>
                  <td>{c.pass ? '✅' : '❌'}</td>
                  <td>
                    {c.count != null ? `发现 ${c.count} 个问题` : ''}
                    {c.actual != null ? `实际: ${c.actual}, 期望: ${c.expected}` : ''}
                    {c.detail ? ` — ${c.detail}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!data.pass && (
            <div className="info-box" style={{ marginTop: 16 }}>
              <strong>🔧 建议修复方向</strong>
              <ul>
                {data.summary.dirtyNamesInGroups > 0 && <li>groups 中存在脏名称残留 — 确认 splitByCategory 使用了 finalSources 而非原始 sources</li>}
                {data.summary.groupFieldMismatches > 0 && <li>groups 中 bookSourceGroup 第一标签与文件分类不一致 — 检查 group mode 和 finalGroup 写入</li>}
                {data.summary.cleanedGroupsDiffs > 0 && <li>cleaned-sources 与 groups 中同 originalIndex 的对象字段不一致 — 确保两者来自同一批 finalSources</li>}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
