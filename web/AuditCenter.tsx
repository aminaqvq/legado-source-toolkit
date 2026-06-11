import { useState, useEffect } from 'react';
import { useAppStore } from './store/AppContext';
import { normalizeDisplayDir } from './utils/dirs';

// ── Audit Center ──

export default function AuditCenter() {
  const store = useAppStore();
  const activeDir = normalizeDisplayDir(store.activeResultDir);
  const [outDir, setOutDir] = useState(activeDir || '');
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [consistency, setConsistency] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('');

  useEffect(() => { if (activeDir && !outDir) setOutDir(activeDir); }, [activeDir]);
  const useCurrent = () => { if (activeDir) { setOutDir(activeDir); } };
  useEffect(() => { if (outDir) loadResults(); }, [outDir]);

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

  const downloadFile = (file: string) => {
    window.open(`/api/download?file=${encodeURIComponent(`${outDir}/${file}`)}`);
  };

  return (
    <div className="page">
      <h2>📋 审计中心</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={outDir} onChange={e => setOutDir(e.target.value)} placeholder={activeDir || '结果目录'} style={{ width: 140 }} />
        <button onClick={loadResults} disabled={loading}>{loading ? '加载中...' : '刷新'}</button>
        {activeDir && activeDir !== outDir && (
          <button onClick={useCurrent} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>▶ 使用当前结果</button>
        )}
        {['overview','consistency','dirtyNames','groupMismatches','diffs','dupRisks','structural','unavailable'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? 'active' : ''} style={{ fontSize: '0.8rem', padding: '2px 10px' }}>
            {({overview:'总览',consistency:'一致性',dirtyNames:'脏名称',groupMismatches:'分组冲突',diffs:'差异',dupRisks:'去重风险',structural:'结构无效',unavailable:'不可用'} as any)[t]}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      {!outDir && !loading && (
        <div className="empty-hint" style={{ color: '#888', marginTop: 12 }}>
          📭 请先在处理运行页执行处理，结果目录会自动填到这里。
        </div>
      )}
      {loading && <div style={{ color: '#888' }}>加载中...</div>}

      {!loading && outDir && (
        <>
          {activeTab === 'overview' && <OverviewTab summary={summary} consistency={consistency} issues={issues} downloadFile={downloadFile} />}
          {activeTab === 'consistency' && <DataTable data={consistency?.checks} cols={['id','label','pass','count','actual','expected','detail']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'dirtyNames' && <DataTable data={issues?.dirtyNames} cols={['file','originalIndex','originalName','currentName','cleanedName','issueType']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'groupMismatches' && <DataTable data={issues?.groupMismatches} cols={['file','expectedCategory','originalIndex','bookSourceName','currentBookSourceGroup']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'diffs' && <DataTable data={issues?.cleanedGroupDiffs} cols={['originalIndex','cleanedName','groupName','cleanedGroup','groupGroup','groupFile']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'dupRisks' && <DataTable data={issues?.duplicateRisks} cols={['groupKey','keptIndex','keptName','removedNames']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'structural' && <DataTable data={issues?.structuralInvalid} cols={['originalIndex','name','url','validationStatus','missingFields']} filter={filter} setFilter={setFilter} />}
          {activeTab === 'unavailable' && <DataTable data={issues?.unavailable} cols={['originalIndex','name','url','availability','reason']} filter={filter} setFilter={setFilter} />}
        </>
      )}
    </div>
  );
}

interface TabProps { summary: any; consistency: any; issues: any; downloadFile: (f: string) => void }
function OverviewTab({ summary: _summary, consistency, issues: _issues, downloadFile }: TabProps) {
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

interface DataTableProps { data: any[]; cols: string[]; filter: string; setFilter: (v: string) => void }
function DataTable({ data, cols, filter, setFilter }: DataTableProps) {
  if (!data || data.length === 0) return <p style={{color:'#666',fontStyle:'italic'}}>无数据</p>;
  return (
    <div>
      {setFilter && <input type="text" placeholder="搜索..." value={filter} onChange={e=>setFilter(e.target.value)} style={{marginBottom:8,width:200}} />}
      <table><thead><tr>{cols.map((c:string)=><th key={c}>{c}</th>)}</tr></thead><tbody>
        {data.filter((row:any)=>{
          if(!filter) return true;
          return cols.some((c:string)=>String(row[c]||'').includes(filter));
        }).map((row:any,i:number)=>(
          <tr key={i} style={{cursor:'default'}}>
            {cols.map((c:string)=><td key={c}>{String(row[c]??'')}</td>)}
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
