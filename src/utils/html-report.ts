import type { ProcessReport, SourceAnalysis } from '../types/analysis.js';

export function renderHtmlReport(report: ProcessReport): string {
  const { summary, sources, duplicates } = report;
  const sourcesJson = JSON.stringify(sources).replace(/</g, '\\u003c');
  const duplicatesJson = JSON.stringify(duplicates).replace(/</g, '\\u003c');
  const keptSources = sources.filter((s) => s.kept);
  const removedSources = sources.filter((s) => !s.kept);

  const batchSection = summary.batchValidation ? `
<h2>🔬 批量深度校验结果</h2>
<div class="cards">
  <div class="card"><div class="num">${summary.batchValidation.total}</div><div class="label">校验总数</div></div>
  <div class="card good"><div class="num">${summary.batchValidation.pass}</div><div class="label">PASS</div></div>
  <div class="card ok"><div class="num">${summary.batchValidation.partialPass}</div><div class="label">Partial Pass</div></div>
  <div class="card bad"><div class="num">${summary.batchValidation.fail}</div><div class="label">Fail</div></div>
  <div class="card bad"><div class="num">${summary.batchValidation.blocked}</div><div class="label">Blocked</div></div>
  <div class="card ok"><div class="num">${summary.batchValidation.unsupported}</div><div class="label">Unsupported</div></div>
  <div class="card ok"><div class="num">${summary.batchValidation.needsLogin}</div><div class="label">Needs Login</div></div>
  <div class="card warn"><div class="num">${summary.batchValidation.risky}</div><div class="label">Risky</div></div>
  <div class="card warn"><div class="num">${summary.batchValidation.unknown}</div><div class="label">Unknown</div></div>
</div>` : '';

  const failureSection = (summary.batchValidation && Object.keys(summary.batchValidation.byFailureReason).length > 0) ? `
<h3>⚠ 失败原因分布 (Top 10)</h3>
<div class="cards">
  ${Object.entries(summary.batchValidation!.byFailureReason)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 10)
    .map(([reason, count]) => `<div class="card warn"><div class="num">${count}</div><div class="label">${escHtml(reason)}</div></div>`).join('')}
</div>` : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Legado Source Toolkit - 处理报告</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f2f5;color:#333;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:20px}
h1{color:#1a73e8;margin-bottom:8px}
h2{color:#444;margin:24px 0 12px;border-bottom:2px solid #1a73e8;padding-bottom:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
.card{background:#fff;border-radius:8px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.1);text-align:center}
.card .num{font-size:32px;font-weight:700;color:#1a73e8}
.card .label{font-size:14px;color:#666;margin-top:4px}
.card.good .num{color:#0d904f}
.card.warn .num{color:#e37400}
.card.bad .num{color:#c5221f}
.card.ok .num{color:#1a73e8}
table{width:100%;border-collapse:collapse;background:#fff;margin-bottom:16px;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
th,td{padding:10px 12px;text-align:left;font-size:13px}
th{background:#1a73e8;color:#fff;font-weight:600;cursor:pointer;position:sticky;top:0}
th:hover{background:#1557b0}
tr:nth-child(even){background:#f8f9fa}
tr:hover{background:#e8f0fe}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600}
.badge-usable{background:#e6f4ea;color:#0d904f}
.badge-probably{background:#fef7e0;color:#e37400}
.badge-dead{background:#fce8e6;color:#c5221f}
.badge-invalid{background:#fce8e6;color:#c5221f}
.badge-timeout{background:#fef7e0;color:#e37400}
.badge-forbidden{background:#fce8e6;color:#c5221f}
.badge-unknown{background:#f1f3f4;color:#5f6368}
.badge-needs-login{background:#e8f0fe;color:#1a73e8}
.badge-complex{background:#f3e8fd;color:#7627c0}
.search-box{width:100%;padding:10px 16px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px}
.filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.filter-bar button{padding:6px 14px;border:1px solid #ddd;border-radius:16px;background:#fff;cursor:pointer;font-size:13px}
.filter-bar button.active{background:#1a73e8;color:#fff;border-color:#1a73e8}
.tabs{display:flex;gap:0;margin-bottom:0}
.tabs button{padding:8px 20px;border:none;background:#e8eaed;cursor:pointer;font-size:14px;border-radius:8px 8px 0 0;margin-right:4px}
.tabs button.active{background:#fff;font-weight:600;color:#1a73e8}
.tab-content{display:none;background:#fff;padding:16px 0}
.tab-content.active{display:block}
.table-wrap{max-height:500px;overflow-y:auto}
.pagination{display:flex;justify-content:center;gap:4px;margin-top:8px}
.pagination button{padding:4px 10px;border:1px solid #ddd;background:#fff;cursor:pointer;border-radius:4px}
.pagination button.active{background:#1a73e8;color:#fff}
.pagination button:disabled{opacity:.4;cursor:default}
</style>
</head>
<body>
<div class="container">
<h1>📖 Legado Source Toolkit - 处理报告</h1>
<p style="color:#666;margin-bottom:16px">生成时间: ${summary.generatedAt}</p>
<h2>📊 总览</h2>
<div class="cards">
  <div class="card"><div class="num">${summary.input.total}</div><div class="label">输入总数</div></div>
  <div class="card good"><div class="num">${summary.output.total}</div><div class="label">输出总数</div></div>
  <div class="card warn"><div class="num">${summary.removed.duplicateCount}</div><div class="label">去重移除</div></div>
  <div class="card good"><div class="num">${summary.input.availabilityCounts['usable'] || 0}</div><div class="label">可用</div></div>
  <div class="card ok"><div class="num">${summary.input.availabilityCounts['probably_usable'] || 0}</div><div class="label">可能可用</div></div>
  <div class="card ok"><div class="num">${summary.input.availabilityCounts['complex_unverified'] || 0}</div><div class="label">复杂未验证</div></div>
  <div class="card bad"><div class="num">${summary.input.availabilityCounts['dead'] || 0}</div><div class="label">已失效</div></div>
  <div class="card warn"><div class="num">${summary.input.availabilityCounts['timeout'] || 0}</div><div class="label">超时</div></div>
  <div class="card bad"><div class="num">${summary.validation.invalidCount}</div><div class="label">无效</div></div>
</div>
<h2>📂 分类统计</h2>
<div class="cards">${Object.entries(summary.input.categoryCounts).map(([cat, count]) => `<div class="card"><div class="num">${count}</div><div class="label">${cat}</div></div>`).join('')}</div>
<h2>🔍 可用性统计</h2>
<div class="cards">
  <div class="card good"><div class="num">${summary.input.availabilityCounts['usable'] || 0}</div><div class="label">usable</div></div>
  <div class="card ok"><div class="num">${summary.input.availabilityCounts['probably_usable'] || 0}</div><div class="label">probably_usable</div></div>
  <div class="card ok"><div class="num">${summary.input.availabilityCounts['complex_unverified'] || 0}</div><div class="label">complex_unverified</div></div>
  <div class="card ok"><div class="num">${(summary.input.availabilityCounts['login_related'] || 0) + (summary.input.availabilityCounts['needs_login'] || 0)}</div><div class="label">needs_login</div></div>
  <div class="card bad"><div class="num">${summary.input.availabilityCounts['forbidden'] || 0}</div><div class="label">forbidden</div></div>
  <div class="card warn"><div class="num">${summary.input.availabilityCounts['timeout'] || 0}</div><div class="label">timeout</div></div>
  <div class="card bad"><div class="num">${summary.input.availabilityCounts['dead'] || 0}</div><div class="label">dead</div></div>
  <div class="card bad"><div class="num">${summary.validation.invalidCount}</div><div class="label">invalid</div></div>
  <div class="card warn"><div class="num">${summary.input.availabilityCounts['unknown'] || 0}</div><div class="label">unknown</div></div>
</div>
${batchSection}
${failureSection}
${renderSourceSection(keptSources, removedSources, duplicates, sources)}
</div>
<script>
const sourcesData = ${sourcesJson};
const duplicatesData = ${duplicatesJson};
function escHtml(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function filterTable(tableId,searchId){const q=document.getElementById(searchId).value.toLowerCase();document.getElementById(tableId).querySelectorAll('tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'})}
function filterDupTable(){const q=document.getElementById('dupSearch').value.toLowerCase();document.querySelectorAll('#dupTable tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(q)?'':'none'})}
function switchTab(tabId,btn){btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));document.getElementById(tabId).classList.add('active')}
function filterAvailability(status,btn){document.querySelectorAll('#availabilityFilter button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');['keptTable','removedTable'].forEach(tid=>{const rows=document.getElementById(tid)?.querySelectorAll('tbody tr');if(!rows)return;rows.forEach(r=>{if(status==='all'){r.style.display='';return}r.style.display=r.textContent.toLowerCase().includes(status)?'':'none'})})}
</script>
</body>
</html>`;
}

function renderSourceSection(keptSources: SourceAnalysis[], removedSources: SourceAnalysis[], duplicates: any[], sources: SourceAnalysis[]): string {
  return `
<h2>🔄 重复源 (${duplicates.length} 组)</h2>
<input type="text" class="search-box" id="dupSearch" placeholder="搜索重复组..." oninput="filterDupTable()">
<div class="table-wrap">
<table id="dupTable">
<thead><tr><th>组ID</th><th>分组依据</th><th>保留源</th><th>移除源</th><th>原因</th></tr></thead>
<tbody>
${duplicates.map((d: any) => {
  const kept = sources[d.keptIndex];
  const removedNames = d.removedIndices.map((i: number) => sources[i]?.originalName || '?').join(', ');
  return `<tr><td>${d.groupId}</td><td>${escHtml(d.groupKey)}</td><td>${escHtml(kept?.originalName || `#${d.keptIndex}`)} (score: ${kept?.score ?? '?'})</td><td>${escHtml(removedNames)}</td><td>${escHtml(d.reason)}</td></tr>`;
}).join('')}
</tbody>
</table>
</div>
<h2>📋 保留源 (${keptSources.length})</h2>
<div class="tabs">
  <button class="active" onclick="switchTab('kept-tab', this)">保留源</button>
  <button onclick="switchTab('removed-tab', this)">移除源</button>
</div>
<div class="filter-bar" id="availabilityFilter">
  <button class="active" onclick="filterAvailability('all', this)">全部</button>
  <button onclick="filterAvailability('usable', this)">可用</button>
  <button onclick="filterAvailability('probably_usable', this)">可能可用</button>
  <button onclick="filterAvailability('complex_unverified', this)">复杂未验证</button>
  <button onclick="filterAvailability('dead', this)">失效</button>
  <button onclick="filterAvailability('timeout', this)">超时</button>
  <button onclick="filterAvailability('forbidden', this)">被禁</button>
  <button onclick="filterAvailability('invalid', this)">无效</button>
</div>
<div id="kept-tab" class="tab-content active">
  <input type="text" class="search-box" id="keptSearch" placeholder="搜索保留源..." oninput="filterTable('keptTable', 'keptSearch')">
  <div class="table-wrap">${renderSourceTable(keptSources)}</div>
</div>
<div id="removed-tab" class="tab-content">
  <input type="text" class="search-box" id="removedSearch" placeholder="搜索移除源..." oninput="filterTable('removedTable', 'removedSearch')">
  <div class="table-wrap">${renderSourceTable(removedSources)}</div>
</div>`;
}

function renderSourceTable(sources: SourceAnalysis[]): string {
  const hasBatch = sources.some((s) => s.batchValidationStatus);
  const batchHeader = hasBatch ? '<th>校验模式</th><th>最终状态</th><th>首次失败</th><th>失败原因</th><th>耗时</th>' : '';
  return `<table id="${sources.length > 0 && sources[0].kept ? 'keptTable' : 'removedTable'}">
<thead><tr>
  <th>序号</th><th>原名</th><th>清洗名</th><th>分类</th><th>URL</th>
  <th>可用性</th><th>分数</th>${batchHeader}<th>保留</th><th>移除原因</th>
</tr></thead>
<tbody>
${sources.map((s) => {
  const availClass = getAvailClass(s.availability);
  const batchCols = hasBatch
    ? `<td>${escHtml(s.batchValidationMode)}</td><td><span class="badge badge-${getBatchClass(s.batchValidationStatus)}">${escHtml(s.batchValidationStatus)}</span></td><td>${escHtml(s.firstFailureStage)}</td><td>${escHtml((s.batchFailureReasons ?? []).join(', '))}</td><td>${s.batchDurationMs ?? ''}</td>`
    : '';
  return `<tr>
    <td>${s.index}</td>
    <td>${escHtml(s.originalName)}</td>
    <td>${escHtml(s.cleanedName)}</td>
    <td>${escHtml(s.inferredGroup)}</td>
    <td title="${escHtml(s.normalizedUrl || '')}">${escHtml(s.normalizedHost || 'N/A')}</td>
    <td><span class="badge badge-${availClass}">${s.availability}</span></td>
    <td>${s.score}</td>${batchCols}
    <td>${s.kept ? '✅' : '❌'}</td>
    <td>${escHtml(s.removedReason || '')}</td>
  </tr>`;
}).join('')}
</tbody></table>`;
}

function getAvailClass(a: string): string {
  if (a === 'usable') return 'usable';
  if (a === 'probably_usable') return 'probably';
  if (a === 'needs_login') return 'needs-login';
  if (a === 'complex_unverified') return 'complex';
  if (a === 'dead') return 'dead';
  if (a === 'invalid') return 'invalid';
  if (a === 'timeout') return 'timeout';
  if (a === 'forbidden') return 'forbidden';
  return 'unknown';
}

function getBatchClass(s: string | undefined): string {
  if (!s) return 'unknown';
  switch (s) {
    case 'PASS': return 'usable';
    case 'PARTIAL_PASS': return 'probably';
    case 'FAIL': return 'dead';
    case 'BLOCKED': return 'forbidden';
    case 'NEEDS_LOGIN': return 'needs-login';
    case 'UNSUPPORTED': return 'complex';
    case 'RISKY': return 'timeout';
    default: return 'unknown';
  }
}

function escHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
