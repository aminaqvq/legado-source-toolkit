import { Component, useState, useEffect, type ReactNode, type ErrorInfo } from 'react';
import { healthCheck } from './lib/api-client';
import { AppProvider, useAppStore } from './store/AppContext';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import InspectPage from './pages/InspectPage';
import ProcessPage from './pages/ProcessPage';
import ResultsPage from './pages/ResultsPage';
import SourcesPage from './pages/SourcesPage';
import DuplicatesPage from './pages/DuplicatesPage';
import NameCleaningPage from './pages/NameCleaningPage';
import UrlNormalizationPage from './pages/UrlNormalizationPage';
import ConsistencyPage from './pages/ConsistencyPage';
import AuditCenter from './AuditCenter';

type Page = 'dashboard'|'upload'|'inspect'|'process'|'results'|'sources'|'duplicates'|'namecleaning'|'urlnormalization'|'consistency'|'audit';

const NAV_ITEMS: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: '首页', icon: '🏠' },
  { page: 'upload', label: '上传书源', icon: '📤' },
  { page: 'inspect', label: '概览审查', icon: '🔍' },
  { page: 'process', label: '处理运行', icon: '⚡' },
  { page: 'results', label: '结果查看', icon: '📊' },
  { page: 'sources', label: '书源列表', icon: '📋' },
  { page: 'duplicates', label: '去重风险', icon: '🔄' },
  { page: 'namecleaning', label: '名称清洗', icon: '🏷️' },
  { page: 'urlnormalization', label: 'URL 规范化', icon: '🔗' },
  { page: 'consistency', label: '验收中心', icon: '✅' },
  { page: 'audit', label: '审计中心', icon: '📋' },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Legado Source Toolkit — page error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2.5rem', fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '2rem auto' }}>
          <h1 style={{ marginBottom: '0.75rem' }}>⚠️ 页面加载异常</h1>
          <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.2rem', cursor: 'pointer' }}>重新加载</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [backendStatus, setBackendStatus] = useState<'checking'|'online'|'offline'>('checking');

  useEffect(() => {
    healthCheck().then(() => setBackendStatus('online')).catch(() => setBackendStatus('offline'));
  }, []);

  const nav = (page: Page) => setCurrentPage(page);

  const store = useAppStore();

  return (
    <div className="app">
      <nav className="sidebar">
        <h1>📖 LS-Toolkit</h1>
        <div className="backend-status">
          <span className={`dot ${backendStatus}`}></span>
          {backendStatus === 'checking' ? '检查中...' : backendStatus === 'online' ? 'API 在线' : 'API 离线'}
        </div>
        {NAV_ITEMS.map(item => (
          <button key={item.page} className={currentPage === item.page ? 'active' : ''} onClick={() => nav(item.page)}>
            {item.icon} {item.label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border, #333)' }}>
          <button style={{ fontSize: '0.75rem', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '4px 8px' }}
            onClick={store.resetSession}>🗑 重置状态</button>
        </div>
      </nav>
      <main className="content">
        {currentPage === 'dashboard' && <DashboardPage onNavigate={(p: string) => nav(p as Page)} />}
        {currentPage === 'upload' && <UploadPage />}
        {currentPage === 'inspect' && <InspectPage />}
        {currentPage === 'process' && <ProcessPage />}
        {currentPage === 'results' && <ResultsPage />}
        {currentPage === 'sources' && <SourcesPage />}
        {currentPage === 'duplicates' && <DuplicatesPage />}
        {currentPage === 'namecleaning' && <NameCleaningPage />}
        {currentPage === 'urlnormalization' && <UrlNormalizationPage />}
        {currentPage === 'consistency' && <ConsistencyPage />}
        {currentPage === 'audit' && <AuditCenter />}
      </main>
    </div>
  );
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  );
}
