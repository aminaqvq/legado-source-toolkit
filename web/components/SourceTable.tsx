import { useState } from 'react';
import StatusBadge from './StatusBadge';

interface Column {
  key: string; label: string; sortable?: boolean;
}
interface Props {
  sources: Record<string, unknown>[];
  onSelect: (source: Record<string, unknown>) => void;
  loading?: boolean;
}

const DEFAULT_COLS: Column[] = [
  { key: 'index', label: '#', sortable: true },
  { key: 'originalName', label: '原名称', sortable: true },
  { key: 'cleanedName', label: '清洗后' },
  { key: 'inferredGroup', label: '分类' },
  { key: 'availability', label: '可用性' },
  { key: 'validationStatus', label: '结构' },
  { key: 'score', label: '分数', sortable: true },
  { key: 'kept', label: '保留' },
];

const BATCH_COLS: Column[] = [
  { key: 'batchValidationMode', label: '校验模式' },
  { key: 'batchValidationStatus', label: '最终状态' },
  { key: 'firstFailureStage', label: '首次失败' },
];

export default function SourceTable({ sources, onSelect, loading }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const sorted = [...sources].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey], vb = b[sortKey];
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return cmp * sortDir;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageSlice = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const hasBatch = sources.some((s) => s.batchValidationStatus != null);
  const cols = hasBatch ? [...DEFAULT_COLS, ...BATCH_COLS] : DEFAULT_COLS;

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d * -1) as 1 | -1);
    else { setSortKey(key); setSortDir(1); }
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (!sources.length) return <div className="empty">无数据</div>;

  return (
    <div>
      <div className="table-info">{sources.length} 条，第 {page+1}/{totalPages} 页</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  style={c.sortable ? { cursor: 'pointer' } : {}}>
                  {c.label} {sortKey === c.key ? (sortDir === 1 ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((s, i) => (
              <tr key={i} onClick={() => onSelect(s)} style={{ cursor: 'pointer' }}>
                <td>{String(s.index ?? '')}</td>
                <td title={String(s.originalName || '')}>{truncate(String(s.originalName || ''), 24)}</td>
                <td>{truncate(String(s.cleanedName || ''), 24)}</td>
                <td>{String(s.inferredGroup || '')}</td>
                <td><StatusBadge status={String(s.availability || '')} size="sm" /></td>
                <td><StatusBadge status={String(s.validationStatus || '')} size="sm" /></td>
                <td>{String(s.score ?? '')}</td>
                <td><StatusBadge status={s.kept ? 'ok' : 'fail'} size="sm" /></td>
                {hasBatch && (
                  <>
                    <td>{String(s.batchValidationMode || '')}</td>
                    <td><StatusBadge status={String(s.batchValidationStatus || '')} size="sm" /></td>
                    <td>{truncate(String(s.firstFailureStage || ''), 20)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage(0)}>««</button>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>«</button>
        <span>第 {page + 1} / {totalPages} 页</span>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>»</button>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»»</button>
      </div>
    </div>
  );
}

function truncate(s: string, max: number) { return s.length > max ? s.slice(0, max) + '…' : s; }
