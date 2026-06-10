import { useState } from 'react';
import FilePicker from '../components/FilePicker';
import { inspect } from '../lib/api-client';
import type { InspectData } from '../lib/api-types';

export default function UploadPage() {
  const [inputPath, setInputPath] = useState('./bookSource.json');
  const [data, setData] = useState<InspectData | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<unknown[] | null>(null);

  const handleInspect = async (path: string) => {
    setError('');
    try {
      const d = await inspect(path);
      setData(d);
    } catch (e: any) { setError(e.message); }
  };

  const loadPreview = async () => {
    try {
      const res = await fetch('/api/download?file=' + encodeURIComponent(inputPath));
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];
      setPreview(arr.slice(0, 5));
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="page">
      <h2>📤 上传书源</h2>
      <FilePicker value={inputPath} onChange={setInputPath} onInspect={setData} />
      <div style={{ marginTop: 12 }}>
        <button onClick={() => handleInspect(inputPath)}>审查文件</button>
        <button onClick={loadPreview} style={{ marginLeft: 8 }}>预览前 5 条</button>
      </div>
      {error && <div className="error">{error}</div>}

      {data && (
        <div className="inspect-results" style={{ marginTop: 16 }}>
          <h3>文件概况</h3>
          <div className="summary-cards">
            <div className="card"><strong>{data.total}</strong><span>总书源数</span></div>
            <div className="card"><strong>{data.duplicateHostCount}</strong><span>重复 Host</span></div>
            <div className="card"><strong>{data.nonHttpCount}</strong><span>非 HTTP</span></div>
            <div className="card"><strong>{data.complexJsCount}</strong><span>复杂 JS</span></div>
            <div className="card"><strong>{data.emojiCount}</strong><span>含 Emoji</span></div>
          </div>
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 16 }}>
          <h3>前 5 条预览</h3>
          <table><thead><tr><th>#</th><th>名称</th><th>URL</th><th>Type</th><th>Group</th></tr></thead><tbody>
            {preview.map((s: any, i: number) => (
              <tr key={i}><td>{i}</td><td>{s.bookSourceName}</td><td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.bookSourceUrl}</td><td>{s.bookSourceType}</td><td>{s.bookSourceGroup}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
