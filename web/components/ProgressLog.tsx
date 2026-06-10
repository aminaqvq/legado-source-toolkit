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

interface Props {
  logs: string[];
  status: string;
  currentPhase?: string;
}

export default function ProgressLog({ logs, status, currentPhase }: Props) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);

  return (
    <div className="progress-log">
      <div className="log-status">
        <span className={`log-dot ${status}`}></span>
        {status === 'running' ? '处理中...' : status === 'success' ? '✅ 完成' : status === 'failed' ? '❌ 失败' : status}
      </div>

      <div className="timeline">
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

      {logs.length > 0 && (
        <pre ref={ref} className="log-panel">{logs.join('\n')}</pre>
      )}
    </div>
  );
}
