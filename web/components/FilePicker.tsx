import { useState, useRef } from 'react';
import { uploadFile, inspect } from '../lib/api-client';
import type { InspectData, UploadResult } from '../lib/api-types';

interface Props {
  value: string;
  onChange: (path: string) => void;
  onInspect?: (data: InspectData) => void;
  onUpload?: (res: UploadResult) => void;
}

export default function FilePicker({ value, onChange, onInspect, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const result = await uploadFile(file);
      setFileInfo({ name: result.name, size: result.size });
      onChange(result.path);
      if (onUpload) onUpload(result);
      if (onInspect) {
        try {
          const data = await inspect(result.path);
          onInspect(data);
        } catch { /* inspect is optional */ }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-picker">
      <div className="input-group">
        <label>文件路径</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="./bookSource.json" />
      </div>

      <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}>
        <p>📂 拖拽 JSON 文件到此处上传</p>
        <p className="or">或</p>
        <button onClick={() => ref.current?.click()} disabled={uploading}>
          {uploading ? '上传中...' : '选择文件'}
        </button>
        <input ref={ref} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>

      {fileInfo && <div className="file-info">📄 {fileInfo.name} ({formatSize(fileInfo.size)})</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)}KB`;
  return `${(bytes/(1024*1024)).toFixed(1)}MB`;
}
