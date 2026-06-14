# Legado Source Toolkit / LS-Toolkit

Language / 语言: [中文](./README.md) | **English**

---

## Overview

**LS-Toolkit** is a local toolkit for processing [Legado (开源阅读)](https://github.com/gedoor/legado) book source JSON files. It provides cleaning, validation, auto-classification, deduplication, quality scoring, online connectivity checking, auditing, and export capabilities.

All operations run locally — no data is uploaded to third-party servers. Online validation only sends lightweight HTTP requests and is fully protected against SSRF attacks.

> **⚠️ This is NOT a reader app**
> This tool does not provide reading functionality, does not bundle any book sources, and does not guarantee third-party site accessibility. It only processes JSON book source files provided by the user.

---

## What This Project Is Not

- **Not a reader app** — cannot read novels, listen to audiobooks, or view comics
- **Does not provide content** — does not host or distribute any text, images, or audio
- **Does not bundle third-party sources** — no pre-packaged book sources are included
- **Does not bypass website restrictions** — does not crack paywalls or bypass Cloudflare
- **Does not guarantee third-party sites** — external sites may block, rate-limit, or go offline
- **Does not encourage or facilitate infringement** — users should only process sources they have the right to use
- **Does not assume legal responsibility** — when using online validation, the tool sends HTTP requests to the URLs configured in the book sources; users must comply with applicable laws and the target sites' terms of service

---

## Features

| Feature | Description |
|---------|-------------|
| 📤 **JSON Upload** | Drag & drop or select a file, up to 50MB |
| 🔍 **Quick Inspect** | Type distribution, group distribution, duplicate hosts, complex JS stats |
| 🏷️ **Name Cleaning** | Removes emoji, quality markers, maintainer suffixes, comments |
| 🔗 **URL Normalization** | HTTPS upgrade, strip www/m/wap prefixes, host normalization |
| 🏷️ **Auto Classification** | Multi-signal weighted voting (type + keywords + rules + group) |
| ✅ **Structure Validation** | Checks required fields: name, URL, search, book info, TOC, content rules |
| 🌐 **Online Validation** | Opt-in connectivity check + search URL verification (SSRF protected) |
| ⭐ **Quality Scoring** | +/- scoring system covering availability, rule completeness, response time |
| 🔄 **Multi-level Dedup** | none → exact → url → conservative → host → aggressive |
| ⚠️ **Risk Auditing** | Dirty names, group conflicts, cleaned/groups diffs, structural invalids |
| ✅ **Output Consistency Check** | Auto-verifies cleaned-sources.json against groups/*.json |
| 📊 **Reports** | JSON / CSV / HTML format reports |
| 🖥️ **Web GUI** | 11 pages with real-time progress and summary cards |
| ⌨️ **CLI** | 5 subcommands (inspect / validate / process / clean-name / split) |

---

## v1.5 Single Source Lab

v1.5 adds staged single-source validation to verify the complete Legado / ReadEra book source access chain:

```
search → bookInfo → toc → content
```

### New Capabilities

| Capability | Description |
|-----------|-------------|
| **Staged chain validation** | Automatically extracts real bookUrl from search results → fetches book info → TOC → content with real URL linking |
| **Item-scope rule execution** | Executes sub-rules inside each search result and TOC chapter element |
| **Scoped pipeline** | Supports `.name@href`, `a@href`, `img@src`, `.title@text`, `@href`, `@text` and other selector+getter combinations |
| **JSON search results** | Supports JSONPath bookList (e.g., `$.data[*]`) and shorthand field names (e.g., `name` → `$.name`) |
| **POST searchUrl** | Supports `url,{"method":"POST","body":"searchkey={{key}}"}` format |
| **Manual redirect handling** | Follows redirects hop-by-hop with per-hop SSRF re-check (max 5 hops) |
| **Failure classification** | `ssrf_blocked` / `http_timeout` / `network_error` / `http_403` / `cloudflare_detected` / `empty_response` |
| **Structured traces** | Per-stage `NetworkTrace` (URL / method / status / responseSize / bodyPreview / error) and `RuleTrace` |
| **Debug UI** | Web GUI "🐛 Single Source Debug" page showing search results table, TOC table, content preview, and network request details |

### How to Use

Single-source debugging is accessed through the **Web GUI** "🐛 Single Source Debug" page:

1. Start backend and frontend (`pnpm gui` + `pnpm web:dev`)
2. Open `http://127.0.0.1:5173`, click "🐛 单源调试" in the left nav
3. Paste a book source JSON, optionally enter a search keyword, and click "开始调试"

> ⚠️ v1.5 does not add new CLI commands for single-source debugging. `process --online` remains the batch processing entry point. For deep single-source debugging, use the Web GUI.

### Current Limitations

| Limitation | Description |
|-----------|-------------|
| `webView:true` | Not supported — requires Browser Runner |
| `java.ajax` | Not executed in safe mode |
| `java.getCookie` | Not supported |
| `Packages.*` | Not supported |
| Rhino compatibility | Not supported; Node vm sandbox only |
| Login flow | Not handled |
| Cloudflare / CAPTCHA | No bypass attempted |
| Complex Legado-specific syntax | May require manual review |

### Correct Positioning

> v1.5 is not a full replacement for the Legado Android runtime. It is an automated validation tool for batch maintenance and single-source debugging. It is designed to catch structural errors, connection failures, rule breakage, and obviously broken sources — then defer complex sources for manual review.

---

## v1.6 Batch Deep Validate

v1.6 extends v1.5's single-source validation chain into the batch processing pipeline, supporting batch deep validation across multiple sources.

### Three Validation Modes

| Mode | Description | What It Does |
|------|-------------|--------------|
| **fast** | Quick summary mode, explicitly enabled with `--validate-mode fast` | structure + connectivity + lightweight search URL only. No rule engine. |
| **standard** | Standard depth | search → bookInfo → toc (stops at TOC, no content requests) |
| **deep** | Full depth | search → bookInfo → toc → content (complete chain) |

### Usage

```bash
# Standard mode: search → bookInfo → toc
pnpm dev process samples/sample.json --online --validate-mode standard --batch-concurrency 8

# Deep mode: full chain (use with caution)
pnpm dev process samples/sample.json --online --validate-mode deep --batch-concurrency 4
```

> ⚠️ **deep mode** sends 4 requests per source (search / bookInfo / toc / content). Use low concurrency (default 8, recommended 4) to avoid pressure on target sites.
>
> `--validate-mode` is off by default. Existing v1.5 behavior is preserved when not specified.
>
> CLI/API 是启用 v1.6 batch validation 的主要入口；Web UI 当前主要展示 batch validation 结果摘要和 source table 状态列。
>
> ⚠️ Batch validation recommends `--online`. Without `--online` and without `--include-unknown`, unknown-availability sources may be filtered before batch validation, resulting in 0 batch targets.

### New Content

| Addition | Description |
|----------|-------------|
| **Batch validation modes** | fast / standard / deep three levels |
| **Status classification** | PASS / PARTIAL_PASS / FAIL / BLOCKED / NEEDS_LOGIN / UNSUPPORTED / RISKY / UNKNOWN |
| **Summary aggregation** | By failure reason, host, group, source type |
| **HTML report enhancement** | Batch validation summary cards, failure reason distribution |
| **Web UI enhancement** | Result page batch validation cards, source table validation columns |
| **CSV enhancement** | New columns: validationMode / finalStatus / firstFailureStage / failureReasons / warnings / durationMs |

### Current Limitations (v1.5 + v1.6 combined)

| Limitation | Description |
|------------|-------------|
| Browser Runner | Not supported |
| Android Runner | Not supported |
| Rhino compatibility | Not supported; Node vm sandbox only |
| `java.ajax` | Not executed |
| Login / Cookie / Session | Not handled |
| Cloudflare / CAPTCHA bypass | Not attempted |
| `webView:true` | Not supported |

---

- Maintaining large book source collections (hundreds to thousands)
- Periodic source cleaning and deduplication
- Reorganizing sources by category (novel, comic, audio, etc.)
- Quality assessment and auditing
- Pre-sharing review and cleanup
- Automation and CI/CD integration

---

## Requirements

- **Node.js** >= 20.0.0
- **pnpm** (recommended, project uses pnpm 9.15.0)
- **OS**: Windows / macOS / Linux
- Windows users: double-click `start-ui.bat` for one-click launch
- First run: `pnpm install`

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Verify project integrity (typecheck + lint + build + test)
pnpm verify

# 3. Start development mode (recommended)
#    Terminal 1 — Backend API (port 5178)
pnpm gui

#    Terminal 2 — Frontend Web UI (port 5173)
pnpm web:dev

# 4. Open in browser
#    http://127.0.0.1:5173
```

Or use the CLI directly:

```bash
# Inspect a book source file
pnpm dev inspect samples/sample.json

# Full offline processing
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative

# Processing with online validation
pnpm dev process samples/sample.json --out ./output --online --dedupe conservative
```

---

## Windows One-click Start

Double-click `start-ui.bat` in the project root directory.

**What the script does**:

1. Checks Node.js and pnpm availability
2. Enables Corepack if pnpm is not found
3. Prompts to install dependencies if `node_modules` is missing
4. Starts two services simultaneously:
   - **Backend API**: `pnpm.cmd gui`, listening on `http://127.0.0.1:5178`
   - **Frontend Web UI**: `pnpm.cmd web:dev`, listening on `http://127.0.0.1:5173`
5. After ~5 seconds, opens `http://127.0.0.1:5173` in your browser

> ⚠️ Keep both terminal windows open — closing them stops the services.
>
> ⚠️ If you open 5178 and see "Web UI has not been built", you are opening the backend address. Use 5173 for the Web UI.

---

## Development Mode

Backend API (Terminal 1):

```bash
pnpm gui
```

Default address: `http://127.0.0.1:5178`

Frontend Web UI (Terminal 2):

```bash
pnpm web:dev
```

Default address: `http://127.0.0.1:5173`

The frontend dev server supports HMR (hot module replacement) and proxies `/api/*` requests to the backend on port 5178 via Vite.

---

## Web GUI Guide

### Port Overview

| Command | Purpose | Address |
|---------|---------|---------|
| `pnpm gui` | Backend API service | `http://127.0.0.1:5178` |
| `pnpm web:dev` | Frontend dev server (HMR) | `http://127.0.0.1:5173` |
| API Health | Backend status | `http://127.0.0.1:5178/api/health` |

> **Note**: The main Web UI address is **5173**, not 5178. Port 5178 is the backend API.

### GUI Pages (11 pages)

| Page | Purpose | When to Use | Input Required | Output |
|------|---------|-------------|---------------|--------|
| 🏠 **Dashboard** | API status, quick actions, recent results | First page you see | None | API status, action buttons |
| 📤 **Upload** | Upload JSON files, inspect overview, preview first N items | Before processing | JSON file (max 50MB) | Summary cards, preview table |
| 🔍 **Inspect** | Quick stats on type/group/host/JS distribution | After upload | File path | Analysis data |
| ⚡ **Process** | Configure and run full pipeline with live progress | Core operation | File path, output dir, options | Logs, timeline, progress bars, summary, download links |
| 📊 **Results** | Browse output directories, download files | After processing | None (lists output-* dirs automatically) | Summary, download links |
| 📋 **Sources** | Browse processed sources, filter, search, view details | Reviewing sources | Result directory | Source table (searchable) |
| 🔄 **Duplicates** | View dedup groups and potential conflicts | Reviewing dedup | Result directory | Group details, field diffs |
| 🏷️ **Name Cleaning** | View name changes and cleaning steps | Reviewing names | Result directory | Before/after comparison |
| 🔗 **URL Normalization** | View URL status and warnings | Reviewing URLs | Result directory | URL statuses, warnings |
| ✅ **Consistency** | Output consistency check results | Verifying output | Result directory | Pass/fail details |
| 📋 **Audit Center** | Full audit report with multiple tabs | Deep auditing | Result directory | Overview, consistency, dirty names, group mismatches, diffs, dup risks, structural invalids, unavailable |

> **Notes**:
> - Upload preview only reads the first N items (default 5, max 50) — it does not download the full file
> - Upload records expire on server restart
> - Output files can be downloaded from the Results or Process page after processing

---

## CLI Guide

```bash
# Global help
pnpm dev --help

# Subcommand help
pnpm dev process --help

# Full processing pipeline
pnpm dev process <input.json> [options]

# Quick overview
pnpm dev inspect <input.json>

# Validation only (structural + optional online)
pnpm dev validate <input.json> [options]

# Name cleaning only
pnpm dev clean-name <input.json> [options]

# Category split only
pnpm dev split <input.json> [options]
```

### Command Details

**`inspect`** — Quick overview of a book source file:

```bash
pnpm dev inspect samples/sample.json
```

Output: total sources, bookSourceType distribution, top groups, duplicate hosts, emoji count, non-HTTP count, complex JS count.

**`validate`** — Structure validation only (optional online check):

```bash
pnpm dev validate samples/sample.json
pnpm dev validate samples/sample.json --online --concurrency 16 --timeout 8000
```

> Note: `validate --online` only performs connectivity checks. For full online processing (including search validation), use `process --online`.

**`process`** — Full processing pipeline (core command):

```bash
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative --group-mode category-first --concurrency 16
```

**`clean-name`** — Name cleaning only:

```bash
pnpm dev clean-name samples/sample.json --name-mode zh
