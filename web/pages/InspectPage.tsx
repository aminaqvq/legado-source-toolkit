import { useState } from 'react';
import FilePicker from '../components/FilePicker';
import StatCard from '../components/StatCard';
import { inspect } from '../lib/api-client';
import type { InspectData } from '../lib/api-types';

export default function InspectPage() {
  const [inputPath, setInputPath] = useState('./bookSource.json');
  const [data, setData] = useState<InspectData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError('');
    try { setData(await inspect(inputPath)); } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <h2>🔍 概览审查</h2>
      <FilePicker value={inputPath} onChange={setInputPath} />
      <button onClick={run} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? '检查中...' : '开始检查'}
      </button>
      {error && <div className="error">{error}</div>}

      {data && (
        <div style={{ marginTop: 16 }}>
          <div className="summary-cards">
            <StatCard label="总书源数" value={data.total} color="gray" />
            <StatCard label="重复 Host" value={data.duplicateHostCount} color="yellow" />
            <StatCard label="非 HTTP 源" value={data.nonHttpCount} color="yellow" />
            <StatCard label="含 Emoji 名" value={data.emojiCount} color="orange" />
            <StatCard label="复杂 JS 源" value={data.complexJsCount} color="orange" />
          </div>

          <h3 style={{ marginTop: 20 }}>bookSourceType 分布</h3>
          <div className="bar-chart">
            {Object.entries(data.typeCounts).map(([t, c]) => (
              <div key={t} className="bar-row">
                <span className="bar-label">{typeLabel(t)}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(Number(c)/data.total*100).toFixed(1)}%`, background: '#3b82f6' }}></div></div>
                <span className="bar-count">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function typeLabel(t: string) {
  const m: Record<string,string> = { '0':'小说','1':'有声','2':'漫画','3':'下载','4':'影视' };
  return `${t} (${m[t] || '未知'})`;
}
