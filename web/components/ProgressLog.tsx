import { useEffect, useRef } from 'react';

const PHASES = [
  { id: 'read', label: '读取输入' },
  { id: 'names', label: '名称清洗' },
  { id: 'urls', label: 'URL 规范化' },
  { id: 'classify', label: '分类' },
  { id: 'structure', label: '结构校验' },
  { id: 'online', label: '在线验证' },
  { id: 'score', label: '评分' },
  { id: 'dedupe', label: '去重' },
  { id: 'output', label: '输出写入' },
  { id: 'consistency', label: '一致性验收' },
];

interface ProgressBlock {
  done: number;
  total: number;
  percent: number;
}

interface Props {
  logs: string[];
  status: string;
  currentPhase?: string;
  totalProgress?: number;
  phaseProgress?: number;
  connProgress?: ProgressBlock | null;
  searchProgress?: ProgressBlock | null;
}

export default function ProgressLog({ logs, status, currentPhase, totalProgress, phaseProgress, connProgress, searchProgress }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);

  return (
    <div className="progress-log">
      {/* ── Overall status bar ── */}
      <div className="log-status">
        <span className={`log-dot ${status}`}></span>
        {status === 'running' ? '处理中...' : status === 'success' ? '✅ 完成' : status === 'failed' ? '❌ 失败' : status}
        {typeof totalProgress === 'number' && totalProgress > 0 && (
          <span style={{ marginLeft: 12, fontSize: '0.85rem' }}>
            总体 {totalProgress}%
            <progress value={totalProgress} max={100} style={{ marginLeft: 6, verticalAlign: 'middle', height: 8, width: 120 }} />
          </span>
        )}
      </div>

      {/* ── Phase progress bar ── */}
      {typeof phaseProgress === 'number' && phaseProgress > 0 && currentPhase && (
        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4, marginLeft: 4 }}>
          当前阶段 {phaseProgress}%
          <progress value={phaseProgress} max={100} style={{ marginLeft: 6, verticalAlign: 'middle', height: 6, width: 80 }} />
        </div>
      )}

      {/* ── Connectivity / Search progress ── */}
      {connProgress && connProgress.total > 0 && (
        <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
          <span>🔗 连通性检查：{connProgress.done} / {connProgress.total}，{connProgress.percent}%</span>
          <progress value={connProgress.percent} max={100} style={{ display: 'block', width: '100%', height: 10, marginTop: 2, borderRadius: 4, accentColor: '#3b82f6' }} />
        </div>
      )}
      {searchProgress && searchProgress.total > 0 && (
        <div style={{ marginTop: 6, fontSize: '0.85rem' }}>
          <span>🔍 搜索检查：{searchProgress.done} / {searchProgress.total}，{searchProgress.percent}%</span>
          <progress value={searchProgress.percent} max={100} style={{ display: 'block', width: '100%', height: 10, marginTop: 2, borderRadius: 4, accentColor: '#8b5cf6' }} />
        </div>
      )}

      {/* ── Phase timeline ── */}
      <div className="timeline" style={{ marginTop: 12 }}>
        {PHASES.map(p => {
          let s: string = 'pending';
          if (p.id === currentPhase) s = 'running';
          if (status === 'success') s = 'success';
          if (status === 'failed' && p.id === currentPhase) s = 'failed';
          return (
            <div key={p.id} className={`tl-step ${s}`}>
              <div className="tl-dot"></div>
              <div className="tl-label">{p.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Log panel ── */}
      {logs.length > 0 && (
        <pre ref={ref} className="log-panel">{logs.join('\n')}</pre>
      )}
    </div>
  );
}
