import { useState } from 'react';
import SourceTable from '../components/SourceTable';
import JsonViewer from '../components/JsonViewer';
import StatusBadge from '../components/StatusBadge';
import { getResultDir, getSourceDetail } from '../lib/api-client';

export default function SourcesPage() {
  const [dir, setDir] = useState('output-verify');
  const [sources, setSources] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Record<string,unknown> | null>(null);
  const [detailTab, setDetailTab] = useState<'json'|'steps'|'signals'|'score'>('json');
  const [filters, setFilters] = useState({ search: '', cat: '', avail: '', kept: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await getResultDir(dir);
      const raw = (res.files as any)['sources.json'];
      const arr = Array.isArray(raw) ? raw : [];
      setSources(arr);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadDetail = async (s: Record<string,unknown>) => {
    try {
      const idx = s.index as number;
      const d = await getSourceDetail(idx, dir);
      setDetail(d as unknown as Record<string,unknown>);
    } catch { setDetail(s); }
  };

  const filtered = sources.filter(s => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!String(s.originalName||'').toLowerCase().includes(q) && !String(s.originalUrl||'').toLowerCase().includes(q)) return false;
    }
    if (filters.cat && s.inferredGroup !== filters.cat) return false;
    if (filters.avail && s.availability !== filters.avail) return false;
    if (filters.kept === 'kept' && !s.kept) return false;
    if (filters.kept === 'removed' && s.kept) return false;
    return true;
  });

  return (
    <div className="page">
      <h2>📋 书源列表</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={dir} onChange={e => setDir(e.target.value)} placeholder="output-verify" style={{ width: 140 }} />
        <button onClick={load} disabled={loading}>{loading ? '加载中...' : '加载'}</button>
        <input value={filters.search} onChange={e => setFilters(f => ({...f, search: e.target.value}))} placeholder="搜索名称/URL" style={{ width: 160 }} />
        <select value={filters.cat} onChange={e => setFilters(f => ({...f, cat: e.target.value}))}>
          <option value="">全部分类</option>
          {['小说','漫画','有声','影视','下载','其他','失效'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.avail} onChange={e => setFilters(f => ({...f, avail: e.target.value}))}>
          <option value="">全部可用性</option>
          {['usable','probably_usable','complex_unverified','unknown','dead','timeout','forbidden','invalid'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filters.kept} onChange={e => setFilters(f => ({...f, kept: e.target.value}))}>
          <option value="">全部</option>
          <option value="kept">仅保留</option>
          <option value="removed">仅移除</option>
        </select>
      </div>
      {error && <div className="error">{error}</div>}

      <SourceTable sources={filtered} onSelect={loadDetail} loading={loading} />

      {detail && (
        <div className="drawer-overlay" onClick={() => setDetail(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3>#{String(detail.index ?? '')} {String(detail.originalName || '')}</h3>
              <button className="close-btn" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="detail-meta">
              <StatusBadge status={String(detail.availability||'')} />{' '}
              <StatusBadge status={String(detail.validationStatus||'')} />{' '}
              分数: {String(detail.score)} | {(detail.kept as boolean) ? '✅ 保留' : '❌ 移除'}
              {Boolean(detail.removedReason) && <div style={{color:'#ef4444',fontSize:'0.8rem'}}>{String(detail.removedReason)}</div>}
            </div>
            <div className="detail-tabs">
              {[{k:'json',l:'源 JSON'},{k:'steps',l:'清洗步骤'},{k:'signals',l:'分类依据'},{k:'score',l:'评分'}].map(t => (
                <button key={t.k} className={detailTab===t.k?'active':''} onClick={()=>setDetailTab(t.k as any)}>{t.l}</button>
              ))}
            </div>
            <div style={{marginTop:12}}>
              {detailTab==='json' && <JsonViewer data={detail} />}
              {detailTab==='steps' && <JsonViewer data={(detail.cleanNameSteps||[]) as any} />}
              {detailTab==='signals' && <JsonViewer data={(detail.classificationSignals||{}) as any} />}
              {detailTab==='score' && <JsonViewer data={(detail.scoreBreakdown||{}) as any} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
