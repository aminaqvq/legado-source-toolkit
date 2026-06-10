import { useState, useEffect } from 'react';

interface CheckItem {
  id: string; label: string; pass: boolean; count?: number;
  actual?: number; expected?: number; detail?: string;
}



// ── Audit Center ──

export default function AuditCenter() {
  const [outDir, setOutDir] = useState('output-verify');
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [consistency, setConsistency] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [detailSource, setDetailSource] = useState<any>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadResults(); }, []);

  const loadResults = async () => {
    setLoading(true);
    try {
      const [sumRes, conRes, issRes] = await Promise.all([
        fetch(`/api/results/summary?dir=${encodeURIComponent(outDir)}`).then(r => r.json()),
        fetch(`/api/results/consistency?dir=${encodeURIComponent(outDir)}`).then(r => r.json()),
        fetch(`/api/results/issues?dir=${encodeURIComponent(outDir)}`).then(r => r.json()),
      ]);
      setSummary(sumRes.success ? sumRes.data : null);
      setConsistency(conRes.success ? conRes.data : null);
      setIssues(issRes.success ? issRes.data : null);
      setError('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadSourceDetail = async (index: number) => {
    try {
      const res = await fetch(`/api/results/source/${index}?dir=${encodeURIComponent(outDir)}`).then(r => r.json());
      if (res.success) setDetailSource(res.data);
    } catch { /* ignore fetch errors */ }
  };

  const downloadFile = (file: string) => {
    window.open(`/api/download?file=${encodeURIComponent(outDir + '/' + file)}`, '_blank');
  };

  return (
    <div className="audit-center">
      <div className="audit-header">
        <h2>📋 验收中心</h2>
        <div className="audit-controls">
          <input type="text" value={outDir} onChange={e => setOutDir(e.target.value)} placeholder="output-verify" style={{ width: 160 }} />
          <button onClick={loadResults} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {consistency && (
        <div className={`consistency-banner ${consistency.pass ? 'pass' : 'fail'}`}>
          {consistency.pass ? '✅ 验收通过 — 输出一致性检查全部通过' : '❌ 验收未通过 — cleaned-sources.json 与 groups/*.json 不一致'}
          <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
            dirty names: {consistency.summary?.dirtyNamesInGroups ?? 0} |
            group mismatches: {consistency.summary?.groupFieldMismatches ?? 0} |
            cleaned/groups diffs: {consistency.summary?.cleanedGroupsDiffs ?? 0}
          </div>
        </div>
      )}

      {summary && (
        <div className="summary-cards">
          <div className="card"><strong>{summary.input?.total}</strong><span>输入总数</span></div>
          <div className="card"><strong>{summary.output?.total}</strong><span>输出总数</span></div>
          <div className="card"><strong>{summary.removed?.duplicateCount}</strong><span>去重移除</span></div>
          <div className="card"><strong>{summary.removed?.unavailableCount}</strong><span>不可用排除</span></div>
          <div className="card"><strong>{summary.validation?.invalidCount}</strong><span>结构无效</span></div>
          <div className="card"><strong>{summary.removed?.riskyCount}</strong><span>Risky</span></div>
        </div>
      )}

      <div className="audit-tabs">
        {['overview','consistency','dirtyNames','groupMismatches','diffs','dupRisks','structural','unavailable'].map(tab => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tabLabels[tab] || tab}
          </button>
        ))}
      </div>

      <div className="audit-content">
        {activeTab === 'overview' && <OverviewTab summary={summary} consistency={consistency} issues={issues} downloadFile={downloadFile} />}
        {activeTab === 'consistency' && consistency && (
          <table><thead><tr><th>检查项</th><th>状态</th><th>详情</th></tr></thead><tbody>
            {(consistency.checks || []).map((c: CheckItem) => (
              <tr key={c.id} className={c.pass ? 'pass' : 'fail'}>
                <td>{c.label}</td>
                <td>{c.pass ? '✅' : '❌'}</td>
                <td>{c.count != null ? `数量: ${c.count}` : c.actual != null ? `实际: ${c.actual}, 期望: ${c.expected}` : c.detail || ''}</td>
              </tr>
            ))}
          </tbody></table>
        )}

        {activeTab === 'dirtyNames' && issues?.dirtyNames && (
          <DataTable data={issues.dirtyNames} cols={['file','originalIndex','originalName','currentName','issueType']} onClick={loadSourceDetail} filter={filter} setFilter={setFilter} />
        )}
        {activeTab === 'groupMismatches' && issues?.groupMismatches && (
          <DataTable data={issues.groupMismatches} cols={['file','expectedCategory','originalIndex','bookSourceName','currentBookSourceGroup']} onClick={loadSourceDetail} filter={filter} setFilter={setFilter} />
        )}
        {activeTab === 'diffs' && issues?.cleanedGroupDiffs && (
          <DataTable data={issues.cleanedGroupDiffs} cols={['originalIndex','cleanedName','groupName','cleanedGroup','groupGroup','groupFile']} onClick={loadSourceDetail} filter={filter} setFilter={setFilter} />
        )}
        {activeTab === 'dupRisks' && issues?.duplicateRisks && (
          <table><thead><tr><th>groupKey</th><th>keptName</th><th>removedNames</th><th>reason</th></tr></thead><tbody>
            {(issues.duplicateRisks as any[]).map((g,i) => (
              <tr key={i}><td>{g.groupKey || g.groupId}</td><td>{g.keptName}</td><td>{(g.removedNames||[]).join(', ')}</td><td>{g.reason}</td></tr>
            ))}
          </tbody></table>
        )}
        {activeTab === 'structural' && issues?.structuralInvalid && (
          <DataTable data={issues.structuralInvalid} cols={['index','originalName','validationStatus']} onClick={loadSourceDetail} filter={filter} setFilter={setFilter} />
        )}
        {activeTab === 'unavailable' && issues?.unavailable && (
          <DataTable data={issues.unavailable} cols={['index','originalName','availability','connectivityDetail']} onClick={loadSourceDetail} filter={filter} setFilter={setFilter} />
        )}
      </div>

      {detailSource && (
        <div className="drawer-overlay" onClick={() => setDetailSource(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <h3>源详情 #{(detailSource as any).index}</h3>
            <button className="close-btn" onClick={() => setDetailSource(null)}>✕</button>
            <pre style={{maxHeight:'60vh',overflow:'auto',fontSize:'0.8rem'}}>{JSON.stringify(detailSource, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ summary: _summary, consistency, issues: _issues, downloadFile }: any) {
  return (
    <div>
      <h3>报告下载</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['cleaned-sources.json','all-sources-reviewed.json','reports/summary.json','reports/output-consistency.json',
          'reports/dirty-names.json','reports/group-mismatches.json','reports/cleaned-vs-groups-diff.json',
          'reports/duplicate-risk.csv','reports/structural-invalid.csv','reports/unavailable.csv',
        ].map(f => <button key={f} onClick={() => downloadFile(f)} style={{fontSize:'0.8rem'}}>{f.split('/').pop()}</button>)}
      </div>
      {consistency && (
        <div className={`consistency-inline ${consistency.pass ? 'pass' : 'fail'}`} style={{padding:'1rem',borderRadius:8,marginBottom:16}}>
          <strong>{consistency.pass ? '✅ 通过' : '❌ 失败'}</strong> — dirty names: {consistency.summary?.dirtyNamesInGroups ?? 0},
          group mismatches: {consistency.summary?.groupFieldMismatches ?? 0},
          cleaned/groups diffs: {consistency.summary?.cleanedGroupsDiffs ?? 0}
        </div>
      )}
    </div>
  );
}

function DataTable({ data, cols, onClick, filter, setFilter }: any) {
  if (!data || data.length === 0) return <p style={{color:'#666',fontStyle:'italic'}}>无数据</p>;
  return (
    <div>
      {setFilter && <input type="text" placeholder="搜索..." value={filter} onChange={e=>setFilter(e.target.value)} style={{marginBottom:8,width:200}} />}
      <table><thead><tr>{cols.map((c:string)=><th key={c}>{c}</th>)}</tr></thead><tbody>
        {data.filter((row:any)=>{
          if(!filter) return true;
          return cols.some((c:string)=>String(row[c]||'').includes(filter));
        }).map((row:any,i:number)=>(
          <tr key={i} onClick={()=>onClick?.(row.originalIndex??row.index)} style={{cursor:'pointer'}}>
            {cols.map((c:string)=><td key={c}>{String(row[c]??'')}</td>)}
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

const tabLabels: Record<string, string> = {
  overview: '总览', consistency: '一致性', dirtyNames: '脏名称',
  groupMismatches: '分组冲突', diffs: '差异', dupRisks: '去重风险',
  structural: '结构无效', unavailable: '不可用',
};
