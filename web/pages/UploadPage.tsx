import { useState } from 'react';
import FilePicker from '../components/FilePicker';
import { inspect, previewUpload } from '../lib/api-client';
import { useAppStore } from '../store/AppContext';
import type { InspectData, UploadPreview } from '../lib/api-types';

export default function UploadPage() {
  const store = useAppStore();
  const { upload, setUpload } = store;
  const inputPath = upload.filePath || '';
  const setInputPath = (path: string) => setUpload({ filePath: path, uploaded: true });

  const [data, setData] = useState<InspectData | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const handleInspect = async (path: string) => {
    if (!path) return;
    setError(''); setInspecting(true);
    try {
      const d = await inspect(path);
      setData(d);
      setUpload({ filePath: path, uploaded: true });
    } catch (e: any) { setError(e.message); }
    finally { setInspecting(false); }
  };

  const loadPreview = async () => {
    if (!upload.uploadId) {
      setError('上传记录缺少 uploadId，请重新上传');
      return;
    }
    setError(''); setPreviewing(true);
    try {
      const p = await previewUpload(upload.uploadId, 5);
      setPreview(p);
    } catch (e: any) { setError(e.message); }
    finally { setPreviewing(false); }
  };

  return (
    <div className="page">
      <h2>📤 上传书源</h2>
      <FilePicker value={inputPath} onChange={setInputPath} onInspect={setData}
        onUpload={(res) => setUpload({ uploadId: res.uploadId, filePath: res.path, fileName: res.name, fileSize: res.size, uploaded: true })} />

      {upload.uploaded && upload.fileName && (
        <div style={{ marginTop: 8, fontSize: '0.9rem', color: '#2e7d32' }}>
          📄 当前文件: {upload.fileName} ({formatSize(upload.fileSize)})
          {!upload.uploadId && (
            <span style={{ color: '#c5221f', marginLeft: 8, fontSize: '0.8rem' }}>
              ⚠️ 缺少 uploadId，请重新上传
            </span>
          )}
        </div>
      )}
      {upload.filePath && !upload.uploaded && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
          📁 路径: {upload.filePath}
        </div>
      )}
      {!inputPath && (
        <div className="empty-hint" style={{ marginTop: 12, color: '#888', fontSize: '0.85rem' }}>
          ℹ️ 尚未选择文件。请拖拽 JSON 文件到上方区域，或点击"选择文件"上传。
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => handleInspect(inputPath)} disabled={!inputPath || inspecting}>
          {inspecting ? '检查中...' : '审查文件'}
        </button>
        <button onClick={loadPreview} disabled={!upload.uploadId || previewing}>
          {previewing ? '加载中...' : '预览前 5 条'}
        </button>
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
          <h3>前 {preview.preview.length} 条预览（共 {preview.count} 条）</h3>
          <table><thead><tr><th>#</th><th>名称</th><th>URL</th><th>Type</th><th>Group</th></tr></thead><tbody>
            {preview.preview.map((s: any, i: number) => (
              <tr key={i}><td>{i + 1}</td><td>{s.bookSourceName}</td><td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.bookSourceUrl}</td><td>{s.bookSourceType}</td><td>{s.bookSourceGroup}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${(bytes/(1024*1024)).toFixed(1)}MB`;
}
