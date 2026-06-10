interface Props { data: unknown; maxHeight?: string; }
export default function JsonViewer({ data, maxHeight = '60vh' }: Props) {
  const copy = () => navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  return (
    <div className="json-viewer">
      <button className="copy-btn" onClick={copy}>📋 复制</button>
      <pre style={{ maxHeight, overflow: 'auto', fontSize: '0.8rem', background: '#1e293b', color: '#e2e8f0', padding: '0.75rem', borderRadius: 6 }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
