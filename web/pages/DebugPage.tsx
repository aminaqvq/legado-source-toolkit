import { useState } from 'react';
import { debugSource } from '../lib/api-client';
import StatCard from '../components/StatCard';

interface SearchItem {
  name?: string;
  author?: string;
  bookUrl?: string;
  confidence: number;
  error?: string;
}

interface ChapterItem {
  chapterName?: string;
  chapterUrl?: string;
}

interface NetworkTrace {
  url: string;
  method: string;
  status?: number;
  finalUrl?: string;
  contentType?: string;
  responseSize?: number;
  bodyPreview?: string;
  durationMs: number;
  error?: string;
}

interface StageExtracted {
  items?: SearchItem[];
  chapters?: ChapterItem[];
  contentLength?: number;
  contentPreview?: string;
  isTooShort?: boolean;
  name?: string;
  author?: string;
  intro?: string;
  coverUrl?: string;
  tocUrl?: string;
}

interface StageData {
  status: string;
  stage: string;
  url?: string;
  responseSize?: number;
  resultCount?: number;
  resultSample?: string;
  duration: number;
  error?: string;
  logs: string[];
  extracted?: StageExtracted;
  request?: NetworkTrace;
  errors?: string[];
  suggestions?: string[];
  rules?: Array<{ ruleName: string; rule: string; outputPreview: string; status: string }>;
}

interface DebugResult {
  sourceName: string;
  sourceUrl: string;
  allPassed: boolean;
  totalDuration: number;
  summary: string;
  stages: StageData[];
}

const STAGE_LABELS: Record<string, string> = {
  search: '搜索验证',
  bookInfo: '详情验证',
  toc: '目录验证',
  content: '正文验证',
};

const STAGE_ICONS: Record<string, string> = {
  RULE_VERIFIED: '✅',
  RULE_EMPTY_RESULT: '❌',
  RULE_PARSE_ERROR: '❌',
  RULE_SKIPPED: '⏭️',
  RULE_NOT_CHECKED: '⊘',
};

const PLACEHOLDER_SOURCE = `{
  "bookSourceName": "示例书源",
  "bookSourceUrl": "https://example.com",
  "bookSourceType": 0,
  "searchUrl": "/search?q={{key}}",
  "ruleSearch": {
    "bookList": ".result-list .book-item",
    "name": ".book-name",
    "author": ".author",
    "bookUrl": ".book-name@href"
  },
  "ruleBookInfo": {
    "name": ".book-title",
    "author": ".book-author",
    "tocUrl": ".read-btn@href"
  },
  "ruleToc": {
    "chapterList": ".chapter-list li",
    "chapterName": "a",
    "chapterUrl": "a@href"
  },
  "ruleContent": {
    "content": "#content"
  }
}`;

export default function DebugPage() {
  const [sourceJson, setSourceJson] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState('');
  const [parseError, setParseError] = useState('');

  const handleRun = async () => {
    setError('');
    setParseError('');
    setResult(null);

    let source: Record<string, unknown>;
    try {
      source = JSON.parse(sourceJson || PLACEHOLDER_SOURCE);
    } catch {
      setParseError('JSON 格式错误，请检查输入');
      return;
    }

    setLoading(true);
    try {
      const data = await debugSource(source, keyword || undefined);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '调试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSourceJson('');
    setResult(null);
    setError('');
    setParseError('');
  };

  const handleLoadExample = () => {
    setSourceJson(PLACEHOLDER_SOURCE);
    setResult(null);
  };

  const thStyle: React.CSSProperties = { padding: '4px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' };
  const tdStyle: React.CSSProperties = { padding: '4px 8px', whiteSpace: 'nowrap' };

  return (
    <div className="page">
      <h2>🐛 单源调试</h2>
      <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 16 }}>
        将一个书源的 JSON 粘贴在下方编辑器，点击"开始调试"即可依次验证搜索→详情→目录→正文规则的执行结果。
      </p>

      {/* Source editor */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ fontWeight: 600 }}>书源 JSON</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-small btn-ghost"
              onClick={handleLoadExample}
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              加载示例
            </button>
            <button
              type="button"
              className="btn-small btn-ghost"
              onClick={handleClear}
              style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--danger, #e74c3c)' }}
            >
              清空
            </button>
          </div>
        </div>
        <textarea
          value={sourceJson}
          onChange={(e) => setSourceJson(e.target.value)}
          placeholder={PLACEHOLDER_SOURCE}
          rows={15}
          style={{
            width: '100%',
            fontFamily: 'ui-monospace, "Cascadia Code", "JetBrains Mono", monospace',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            padding: 10,
            border: '1px solid var(--border, #ccc)',
            borderRadius: 6,
            background: 'var(--bg-secondary, #fafafa)',
            color: 'var(--text, #333)',
            resize: 'vertical',
          }}
        />
        {parseError && <div className="error" style={{ marginTop: 4 }}>{parseError}</div>}
      </div>

      {/* Keyword input */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>搜索关键词</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="留空使用 checkKeyWord 或默认"
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--border, #ccc)',
              borderRadius: 6,
              fontSize: '0.9rem',
            }}
          />
        </div>
        <button onClick={handleRun} disabled={loading} style={{ height: 36 }}>
          {loading ? '⏳ 验证中...' : '▶ 开始调试'}
        </button>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 16 }}>
          {/* Summary cards */}
          <div className="summary-cards" style={{ marginBottom: 16 }}>
            <StatCard
              label="最终结果"
              value={result.allPassed ? '✅ 全部通过' : '❌ 未全部通过'}
              color={result.allPassed ? 'green' : 'red'}
            />
            <StatCard label="总耗时" value={`${result.totalDuration}ms`} color="gray" />
            <StatCard
              label="通过/总计"
              value={`${result.stages.filter((s) => s.status === 'RULE_VERIFIED').length}/${result.stages.length}`}
              color="blue"
            />
          </div>

          {/* Stage details */}
          {result.stages.map((stage) => (
            <div
              key={stage.stage}
              className="card"
              style={{
                padding: 16,
                marginBottom: 12,
                borderLeft: `4px solid ${
                  stage.status === 'RULE_VERIFIED'
                    ? 'var(--success, #27ae60)'
                    : stage.status === 'RULE_NOT_CHECKED'
                    ? '#ccc'
                    : stage.status === 'RULE_SKIPPED'
                    ? '#f39c12'
                    : 'var(--danger, #e74c3c)'
                }`,
                borderRadius: 8,
                background: 'var(--bg-card, white)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{STAGE_ICONS[stage.status] || '❓'}</span>
                  <span>{STAGE_LABELS[stage.stage] || stage.stage}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background:
                        stage.status === 'RULE_VERIFIED'
                          ? 'var(--success-bg, #d4edda)'
                          : stage.status === 'RULE_SKIPPED'
                          ? 'var(--warning-bg, #fff3cd)'
                          : 'var(--danger-bg, #f8d7da)',
                      color:
                        stage.status === 'RULE_VERIFIED'
                          ? 'var(--success, #155724)'
                          : stage.status === 'RULE_SKIPPED'
                          ? 'var(--warning, #856404)'
                          : 'var(--danger, #721c24)',
                    }}
                  >
                    {stage.status}
                  </span>
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>{stage.duration}ms</span>
              </div>

              {stage.url && (
                <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: 6, wordBreak: 'break-all' }}>
                  <strong>URL:</strong> {stage.url}
                </div>
              )}

              {stage.error && (
                <div style={{ fontSize: '0.82rem', color: 'var(--danger, #e74c3c)', marginBottom: 6 }}>
                  <strong>错误:</strong> {stage.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', marginBottom: 8 }}>
                {stage.responseSize !== undefined && (
                  <span><strong>响应大小:</strong> {(stage.responseSize / 1024).toFixed(1)} KB</span>
                )}
                {stage.resultCount !== undefined && (
                  <span><strong>结果数:</strong> {stage.resultCount}</span>
                )}
              </div>

              {stage.resultSample && (
                <div
                  style={{
                    fontSize: '0.82rem',
                    padding: 10,
                    background: 'var(--bg-secondary, #f5f5f5)',
                    borderRadius: 4,
                    border: '1px solid var(--border, #e0e0e0)',
                    maxHeight: 120,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {stage.resultSample}
                </div>
              )}

              {/* v1.5: Network trace */}
              {stage.request && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#4a90d9' }}>
                    🌐 网络请求 ({stage.request.method} {stage.request.status ?? '?'} — {stage.request.durationMs}ms)
                  </summary>
                  <div style={{ marginTop: 4, fontSize: '0.75rem', padding: 8, background: '#f0f4f8', borderRadius: 4 }}>
                    <div><strong>URL:</strong> <span style={{ wordBreak: 'break-all' }}>{stage.request.url}</span></div>
                    {stage.request.finalUrl && stage.request.finalUrl !== stage.request.url && (
                      <div><strong>→ 最终:</strong> <span style={{ wordBreak: 'break-all' }}>{stage.request.finalUrl}</span></div>
                    )}
                    <div><strong>方法:</strong> {stage.request.method} | <strong>状态:</strong> {stage.request.status ?? 'N/A'} | <strong>大小:</strong> {((stage.request.responseSize ?? 0) / 1024).toFixed(1)} KB</div>
                    {stage.request.contentType && <div><strong>类型:</strong> {stage.request.contentType}</div>}
                    {stage.request.bodyPreview && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.7rem' }}>响应体预览</summary>
                        <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: '0.65rem', whiteSpace: 'pre-wrap' }}>{stage.request.bodyPreview}</pre>
                      </details>
                    )}
                  </div>
                </details>
              )}

              {/* v1.5: Search results table */}
              {stage.extracted?.items && stage.extracted.items.length > 0 && (
                <details style={{ marginTop: 8 }} open>
                  <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#27ae60' }}>
                    📋 搜索结果 ({stage.extracted.items.length} 条)
                  </summary>
                  <div style={{ marginTop: 4, overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                          <th style={thStyle}>书名</th>
                          <th style={thStyle}>作者</th>
                          <th style={thStyle}>详情 URL</th>
                          <th style={thStyle}>置信度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.extracted.items.slice(0, 20).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{item.name || '-'}</td>
                            <td style={tdStyle}>{item.author || '-'}</td>
                            <td style={{ ...tdStyle, wordBreak: 'break-all', maxWidth: 200 }}>{item.bookUrl || '-'}</td>
                            <td style={tdStyle}>{(item.confidence * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {/* v1.5: Chapter list table */}
              {stage.extracted?.chapters && stage.extracted.chapters.length > 0 && (
                <details style={{ marginTop: 8 }} open>
                  <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#27ae60' }}>
                    📑 目录 ({stage.extracted.chapters.length} 章)
                  </summary>
                  <div style={{ marginTop: 4, overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>章节名</th>
                          <th style={thStyle}>章节 URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.extracted.chapters.slice(0, 50).map((ch, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={tdStyle}>{idx + 1}</td>
                            <td style={tdStyle}>{ch.chapterName || '-'}</td>
                            <td style={{ ...tdStyle, wordBreak: 'break-all', maxWidth: 250 }}>{ch.chapterUrl || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {/* v1.5: Content preview */}
              {stage.extracted?.contentLength !== undefined && (
                <div style={{ marginTop: 8, fontSize: '0.75rem' }}>
                  <strong>📖 正文长度:</strong> {stage.extracted.contentLength} 字符
                  {stage.extracted.isTooShort && (
                    <span style={{ color: 'var(--danger, #e74c3c)', marginLeft: 8 }}>⚠️ 过短!</span>
                  )}
                  {stage.extracted.contentPreview && (
                    <pre style={{ marginTop: 4, padding: 8, background: '#f5f5f5', borderRadius: 4, fontSize: '0.7rem', maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {stage.extracted.contentPreview}
                    </pre>
                  )}
                </div>
              )}

              {/* v1.5: BookInfo extracted details */}
              {stage.stage === 'bookInfo' && stage.extracted?.name && (
                <div style={{ marginTop: 8, fontSize: '0.75rem' }}>
                  <div><strong>书名:</strong> {stage.extracted.name}</div>
                  {stage.extracted.author && <div><strong>作者:</strong> {stage.extracted.author}</div>}
                  {stage.extracted.tocUrl && <div><strong>目录 URL:</strong> <span style={{ wordBreak: 'break-all' }}>{stage.extracted.tocUrl}</span></div>}
                  {stage.extracted.coverUrl && <div><strong>封面:</strong> <span style={{ wordBreak: 'break-all' }}>{stage.extracted.coverUrl}</span></div>}
                  {stage.extracted.intro && <div><strong>简介:</strong> {stage.extracted.intro.slice(0, 100)}</div>}
                </div>
              )}

              {/* v1.5: Errors and suggestions */}
              {(stage.errors && stage.errors.length > 0 || stage.suggestions && stage.suggestions.length > 0) && (
                <div style={{ marginTop: 8 }}>
                  {stage.errors && stage.errors.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger, #e74c3c)', marginBottom: 4 }}>
                      <strong>⚠ 问题:</strong>
                      {stage.errors.map((e, i) => (
                        <span key={i} style={{ display: 'inline-block', marginLeft: 6, padding: '1px 6px', background: '#fce4e4', borderRadius: 3 }}>{e}</span>
                      ))}
                    </div>
                  )}
                  {stage.suggestions && stage.suggestions.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#856404' }}>
                      <strong>💡 建议:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {stage.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Logs (collapsible) */}
              {stage.logs && stage.logs.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#888' }}>
                    查看日志 ({stage.logs.length} 条)
                  </summary>
                  <div
                    style={{
                      marginTop: 4,
                      padding: 8,
                      background: '#1e1e1e',
                      color: '#d4d4d4',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontFamily: 'ui-monospace, monospace',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {stage.logs.map((log, idx) => (
                      <div key={idx} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}


          {/* Summary */}
          <div className="card" style={{ padding: 12, marginTop: 8, background: 'var(--bg-active, #f0f7ff)' }}>
            <strong>📋 总结：</strong>
            {result.summary}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="empty-hint" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#999' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 1rem' }}>🐛</p>
          <p>粘贴书源 JSON，点击"开始调试"查看规则验证结果</p>
          <p style={{ fontSize: '0.75rem' }}>
            也可直接使用上方示例体验各阶段验证流程
          </p>
        </div>
      )}
    </div>
  );
}
