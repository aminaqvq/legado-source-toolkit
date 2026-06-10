import { useState, useEffect } from 'react';
import { healthCheck, getResultsList } from '../lib/api-client';
import StatCard from '../components/StatCard';
import type { ResultsListEntry } from '../lib/api-types';

interface Props { onNavigate: (page: string) => void; }
export default function DashboardPage({ onNavigate }: Props) {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [recent, setRecent] = useState<ResultsListEntry[]>([]);

  useEffect(() => {
    healthCheck().then(() => setApiStatus('online')).catch(() => setApiStatus('offline'));
    getResultsList().then(r => setRecent(r.outputs || [])).catch(() => {});
  }, []);

  const latest = recent[0];

  return (
    <div className="dashboard-page">
      <div className="hero">
        <h1>📖 Legado Source Toolkit</h1>
        <p className="subtitle">开源阅读书源 JSON 的本地清洗、校验、分类、去重、评分工具集</p>
        <div className="api-badge">
          <span className={`dot ${apiStatus}`}></span>
          API: {apiStatus === 'checking' ? '检查中...' : apiStatus === 'online' ? '在线' : '离线'}
        </div>
      </div>

      <div className="quick-actions">
        <button className="action-card" onClick={() => onNavigate('upload')}>📤 上传书源</button>
        <button className="action-card" onClick={() => onNavigate('inspect')}>🔍 概览审查</button>
        <button className="action-card" onClick={() => onNavigate('process')}>⚡ 处理运行</button>
        <button className="action-card" onClick={() => onNavigate('results')}>📊 结果查看</button>
        <button className="action-card" onClick={() => onNavigate('sources')}>📋 书源列表</button>
        <button className="action-card" onClick={() => onNavigate('duplicates')}>🔄 去重风险</button>
        <button className="action-card" onClick={() => onNavigate('consistency')}>✅ 验收中心</button>
      </div>

      {latest?.summary && (
        <div className="recent-section">
          <h3>最近处理结果 — {latest.name}</h3>
          <div className="summary-cards">
            <StatCard label="输入总数" value={(latest.summary as any).input?.total ?? '-'} color="gray" />
            <StatCard label="输出总数" value={(latest.summary as any).output?.total ?? '-'} color="green" />
            <StatCard label="去重移除" value={(latest.summary as any).removed?.duplicateCount ?? 0} color="yellow" />
            <StatCard label="不可用排除" value={(latest.summary as any).removed?.unavailableCount ?? 0} color="orange" />
            <StatCard label="结构无效" value={(latest.summary as any).validation?.invalidCount ?? 0} color="red" />
          </div>
        </div>
      )}

      <div className="info-box">
        <strong>⚠️ 安全提醒</strong>
        <ul>
          <li>本工具不执行书源中的任何 JavaScript 代码</li>
          <li>所有操作均在本地完成，不上传数据</li>
          <li>在线校验仅发送简单 HTTP 请求</li>
          <li>GUI 仅监听 127.0.0.1，不暴露公网</li>
        </ul>
      </div>
    </div>
  );
}
