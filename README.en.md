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
| Rhino compatibility | Not fully simulated |
| Login flow | Not handled |
| Cloudflare / CAPTCHA | No bypass attempted |
| Complex Legado-specific syntax | May require manual review |

### Correct Positioning

> v1.5 is not a full replacement for the Legado Android runtime. It is an automated validation tool for batch maintenance and single-source debugging. It is designed to catch structural errors, connection failures, rule breakage, and obviously broken sources — then defer complex sources for manual review.

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
pnpm dev clean-name samples/sample.json --name-mode zh-only -o ./output/cleaned-names.json
```

**`split`** — Category split only:

```bash
pnpm dev split samples/sample.json -o ./output/groups
```

### Full process Options

| Option | Default | Description |
|--------|---------|-------------|
| `<input>` | (required) | Input JSON file path |
| `-o, --out <dir>` | `./output` | Output directory |
| `--online` | `false` | Enable online connectivity & search checks |
| `--no-online` | — | Disable online validation |
| `--dedupe <level>` | `conservative` | none \| exact \| url \| conservative \| host \| aggressive |
| `--group-mode <mode>` | `category-first` | overwrite \| append \| preserve \| category-first \| report-only |
| `--name-mode <mode>` | `loose` | zh-only \| loose |
| `--concurrency <n>` | `16` | Concurrent HTTP requests |
| `--timeout <ms>` | `8000` | Request timeout in ms |
| `--retry <n>` | `1` | Retry count |
| `--dry-run` | `false` | Run without writing files |
| `--write-meta` | `false` | Write analysis metadata back to source JSON |
| `--format <fmt>` | `pretty` | pretty \| minified |
| `--keep-disabled` | `false` | Keep disabled sources |
| `--only-enabled` | `false` | Process enabled sources only |
| `--include-non-http` | `true` | Keep non-HTTP sources |
| `--keep-latin-when-needed` | `false` | Keep Latin characters in zh-only mode |
| `--allow-risky-dedupe` | `false` | Allow cross-category/type deletion in host/aggressive dedup |
| `--include-unknown` | `false` | Include unknown status sources in output |
| `--include-complex` | `false` | Include complex_unverified status sources in output |
| `--include-unavailable` | `false` | Include dead/timeout/forbidden sources in output |
| `--write-normalized-url` | `false` | Write normalized URL back to output |
| `--strict` | `false` | Non-zero exit on consistency check failure |

---

## Input File Requirements

1. **File format**: `.json` only
2. **Content format**: Legado bookSource JSON array (top-level must be an array)
3. **File size**: max 50MB
4. **Required fields**:
   - `bookSourceName` — source name
   - `bookSourceUrl` — source URL
   - `bookSourceType` — type (0=novel, 1=audio, 2=comic, 3=download)
   - `enabled` — whether enabled
   - `ruleSearch` — search rules
   - `ruleBookInfo` — book info rules
   - `ruleToc` — table of contents rules
   - `ruleContent` — content rules

See `samples/sample.json` for an example.

### Upload Mechanism

- Uploaded files are stored in an in-memory registry; records expire on server restart
- Upload preview uses a dedicated `/api/uploads/preview` endpoint (not the download endpoint)
- Upload and download permissions are separate for security

---

## Output Directory

After processing, the following structure is generated in the output directory (default `./output`):

```
output/
├── cleaned-sources.json        ← Cleaned, classified, deduplicated sources (importable)
├── all-sources-reviewed.json   ← Full audit trail for every source
├── groups/
│   ├── novel.json              ← Novel category
│   ├── comic.json              ← Comic category
│   ├── audio.json              ← Audio category
│   ├── video.json              ← Video category
│   ├── download.json           ← Download category
│   └── other.json              ← Other category
└── reports/
    ├── summary.json            ← Processing summary statistics
    ├── sources.json            ← All source analysis data
    ├── duplicates.json         ← Dedup group details
    ├── output-consistency.json ← Output consistency check report
    ├── dirty-names.json        ← Dirty name report
    ├── group-mismatches.json   ← Group conflict report
    ├── cleaned-vs-groups-diff.json ← Cleaned vs groups diff report
    ├── structural-invalid.json ← Structurally invalid sources list
    ├── unavailable.json        ← Unavailable sources list
    ├── risky.json              ← High-risk sources list
    ├── sources.csv             ← CSV export
    ├── duplicates.csv          ← Dedup CSV
    ├── dirty-names.csv         ← Dirty names CSV
    ├── group-mismatches.csv    ← Group conflicts CSV
    ├── cleaned-vs-groups-diff.csv ← Diffs CSV
    ├── duplicate-risk.csv      ← Dedup risk CSV
    ├── structural-invalid.csv  ← Structural invalid CSV
    ├── unavailable.csv         ← Unavailable CSV
    └── report.html             ← Self-contained HTML report
```

> **Note**: In Web GUI mode, the output directory name must start with `output` (API security restriction).

---

## Main Output Files

| File | Purpose | Generated | How to Use |
|------|---------|-----------|------------|
| `cleaned-sources.json` | Final cleaned, classified, deduplicated sources | After `process` | ⭐ Import into Legado reader |
| `all-sources-reviewed.json` | Full audit trail for every source | After `process` | Review processing status, scores, availability |
| `groups/*.json` | Category-split sources | After `process` | Import specific categories individually |
| `reports/summary.json` | Processing summary statistics | After `process` | Quick overview of results |
| `reports/sources.csv` | CSV export of all sources | After `process` | Further analysis in spreadsheet software |
| `reports/report.html` | Self-contained HTML report | After `process` | Open in browser for a complete report |
| `reports/dirty-names.json` | Dirty name details | After `process` | Audit: check name cleaning quality |
| `reports/duplicate-risk.csv` | Dedup risk CSV | After `process` | Audit: review dedup decisions |
| `reports/output-consistency.json` | Consistency check | After `process` | Verify output correctness |

---

## Processing Pipeline

The complete `process` pipeline executes the following steps:

1. **Read input file** — Parse JSON, validate format
2. **Input filtering** — Apply `--only-enabled` / `--keep-disabled` options
3. **Name cleaning** (Phase 1/6) — Remove dirty data (loose or zh-only mode)
4. **URL normalization** (Phase 2/6) — Normalize URLs, extract host keys, mark non-HTTP sources
5. **Auto classification** (Phase 3/6) — Multi-signal weighted voting
6. **Structure validation** (Phase 4/6) — Category-aware structural completeness check
7. **Online validation** (Phase 5/6, optional) — Connectivity check → Search URL verification
8. **Scoring** (Phase 6/6) — Comprehensive quality scoring
9. **Deduplication** — Intelligent dedup at the selected level
10. **Group mode application** — Process the bookSourceGroup field
11. **Output filtering** — Filter based on availability status
12. **Write output files** — Generate cleaned-sources.json, groups/*.json, etc.
13. **Consistency check** — Verify consistency across output files
14. **Generate reports** — JSON / CSV / HTML format reports

> Online validation can be time-consuming. Results depend on network conditions, target site availability, rate limiting, and regional access restrictions.

---

## Progress Display

The Web GUI progress display works as follows:

- A single **overall progress bar** (0-100%) is shown
- Phase status is visualized through a **phase timeline** (Read → Name Cleaning → URL Normalization → Classification → Structure Validation → Online Validation → Scoring → Dedup → Output → Consistency)
- **No per-phase progress bar** — only the overall bar
- During the online validation phase, two additional progress indicators are shown:
  - 🔗 Connectivity check progress (done / total, percentage)
  - 🔍 Search check progress (done / total, percentage)
- A **log panel** displays real-time processing logs (capped at 200 entries)
- **Summary cards** are displayed upon completion (total input, total output, duplicates removed, unavailable excluded, structural invalids)

---

## Default Options

| Option | Default | Description |
|--------|---------|-------------|
| Concurrency | **16** | HTTP request concurrency for online validation |
| Timeout | **8000ms** | Single HTTP request timeout |
| Retry | **1** | Number of retries on failure |
| Dedupe level | **conservative** | Conservative — dedup within same category and type |
| Group mode | **category-first** | Category first, preserving non-category tags |
| Name mode | **loose** | Lenient mode, keeps meaningful foreign text |
| Online | **false** (disabled) | Must be enabled with `--online` |
| Output format | **pretty** | Pretty-printed JSON |
| Write meta | **false** | Do not write analysis metadata back to source JSON |
| Keep disabled | **false** | Exclude disabled sources by default |
| Only enabled | **false** | Do not filter by default |
| Include non-HTTP | **true** | Include non-HTTP sources by default |

---

## Security Design

The tool implements multi-layered security protections:

1. **Upload restriction**: Only `.json` files, max 50MB
2. **Dedicated preview API**: Uses `/api/uploads/preview` — not the download endpoint
3. **Download path whitelist**: `/api/download` only allows `output`, `output-ui`, `output-verify`, `output-fixed` directories
4. **API path whitelist**: `inputPath` only allows files under `uploads/`, `samples/`, or root `.json` files
5. **Path traversal protection**: Blocks `../`, null bytes, symlink-based bypasses
6. **SSRF protection**: Blocks requests to localhost, private IPs (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16), IPv6 loopback (::1), and ULA addresses (fc00::/7)
7. **Redirect SSRF check**: Re-validates target after each redirect hop
8. **Header whitelist**: Filters dangerous headers (Host, Cookie, Authorization, X-Forwarded-For, etc.)
9. **No JS execution**: Does not execute any JavaScript from book sources
10. **Error message safety**: Error messages never expose absolute paths or stack traces
11. **CORS restriction**: Only allows `127.0.0.1:5173`, `localhost:5173`, `127.0.0.1:5178`, `localhost:5178`
12. **Rate limiting**: 100 requests/minute
13. **Local-only listener**: Defaults to `127.0.0.1`
14. **Network exposure safety**: If exposing to LAN/public, add authentication, access control, and reverse proxy security

---

## Project Structure

```
legado-source-toolkit/
├── src/                         Backend, CLI, and core logic
│   ├── cli.ts                   CLI entry point (commander)
│   ├── index.ts                 Public API exports
│   ├── core/                    Core processing modules
│   │   ├── process.ts           Main processing pipeline
│   │   ├── parse.ts             File parsing
│   │   ├── clean-name.ts        Name cleaning
│   │   ├── normalize-url.ts     URL normalization
│   │   ├── classify.ts          Auto classification
│   │   ├── validate-structure.ts Structure validation
│   │   ├── validate-online.ts   Online connectivity check (SSRF protected)
│   │   ├── validate-search.ts   Search validation
│   │   ├── score.ts             Quality scoring
│   │   ├── dedupe.ts            Deduplication
│   │   ├── split.ts             Category splitting
│   │   ├── consistency.ts       Output consistency check
│   │   └── schema.ts            Zod schema validation
│   ├── server/                  Backend API server (Fastify)
│   │   ├── app.ts               Fastify entry point
│   │   ├── routes/              API route handlers
│   │   ├── services/            Services (job store, upload store, safe path)
│   │   └── security/            Security boundary enforcement
│   ├── constants/               Constants and default configuration
│   ├── types/                   TypeScript type definitions
│   └── utils/                   Utility functions (fs, CSV, HTML report, etc.)
├── web/                         React Web UI
│   ├── App.tsx                  App entry + page routing
│   ├── pages/                   11 page components
│   ├── components/              Reusable UI components
│   ├── store/                   Global state management
│   └── lib/                     API client and types
├── samples/                     Sample input files
├── tests/                       Test files
├── docs/                        Supplementary documentation
├── .github/workflows/           CI configuration
├── start-ui.bat                 Windows one-click launcher
├── package.json                 Project configuration
├── tsconfig.json                Backend TypeScript config
├── tsconfig.web.json            Frontend TypeScript config
├── vite.config.ts               Vite configuration
├── vitest.config.ts             Test configuration
├── eslint.config.js             ESLint configuration
├── .gitignore                   Git ignore rules
├── .env.example                 Environment variable example
└── LICENSE                      MIT License
```

---

## Common Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run CLI in dev mode
pnpm gui              # Start Web GUI backend API
pnpm web:dev          # Start frontend dev server
pnpm typecheck        # TypeScript type check (backend)
pnpm web:typecheck    # TypeScript type check (frontend)
pnpm lint             # ESLint code style check
pnpm build            # Build backend CLI (tsc)
pnpm web:build        # Build frontend (vite build)
pnpm test             # Run tests (vitest run)
pnpm verify           # Full verification (typecheck + web:typecheck + lint + build + web:build + test)
pnpm clean            # Clean build artifacts (dist, dist-web, coverage, uploads, output-*)
```

---

## Build

```bash
# Build backend CLI
pnpm build

# Build frontend Web UI
pnpm web:build
```

After building:
- Backend CLI output: `dist/`
- Frontend Web UI output: `dist-web/`

Use `pnpm start` or `pnpm cli` to run the compiled CLI.

---

## Testing and Verification

```bash
# Full verification (recommended before pushing)
pnpm verify
```

`pnpm verify` executes these 6 checks sequentially:

1. `pnpm typecheck` — TypeScript type checking (`tsc --noEmit`)
2. `pnpm web:typecheck` — Frontend type checking (`tsc -p tsconfig.web.json --noEmit`)
3. `pnpm lint` — ESLint code style check (checks `src/`, `tests/`, `web/`)
4. `pnpm build` — TypeScript compilation (`tsc`)
5. `pnpm web:build` — Vite frontend production build (`vite build`)
6. `pnpm test` — Run all tests (`vitest run`)

GitHub Actions CI automatically runs: typecheck → lint → build → web:build → test.

---

## FAQ

**Q: Why do I see "Web UI has not been built" when I open port 5178?**
A: You're opening the backend API address (port 5178). The frontend hasn't been built or started. Use development mode: run `pnpm gui` for the backend, then `pnpm web:dev` for the frontend, and visit `http://127.0.0.1:5173`.

**Q: Should I open 5173 or 5178?**
A: The main Web UI address is `http://127.0.0.1:5173` (frontend dev server). Port 5178 is the backend API.

**Q: Why is online validation slow?**
A: Online validation sends HTTP requests to every source URL. Hundreds of sources can take minutes. Reduce concurrency, decrease timeout, or skip online validation (`--no-online`).

**Q: Why are some sources marked as unavailable?**
A: Possible reasons: site is down, blocks non-browser UA, rate-limited, requires login, regional restrictions, DNS failure. This does not mean the source is invalid — it simply couldn't be verified from your current environment.

**Q: Why can't I download uploaded files via the download API?**
A: This is a security design choice. Uploaded files are previewed via `/api/uploads/preview`. The download endpoint only allows output directories. This prevents unauthorized access to uploaded data.

**Q: Why is the results page empty?**
A: You need to run a processing job first. After processing completes, results appear on the Results page. Make sure the output directory starts with `output`.

**Q: Does this tool execute JavaScript from book sources?**
A: **No.** This tool does not execute any JavaScript from book sources (including `ruleContent.webJs`, `loginCheckJs`, `jsLib` fields).

**Q: Can I deploy this to a public server?**
A: Technically yes, but **not recommended**. The tool has no authentication or access control by default and listens only on `127.0.0.1`. For public access, configure a reverse proxy, HTTPS, and authentication.

**Q: Which output file can I import into Legado?**
A: `cleaned-sources.json` is the final cleaned, classified, deduplicated source list suitable for importing into Legado. Category-split `groups/*.json` files can also be imported individually.

**Q: What is the default concurrency?**
A: The default concurrency is **16**. Adjust with the `--concurrency` option.

---

## Roadmap

- [x] Name cleaning + URL normalization
- [x] Auto classification + structure validation
- [x] Online connectivity & search verification (SSRF protected)
- [x] Quality scoring + multi-level dedup
- [x] Web GUI + CLI
- [x] Path security & SSRF protection
- [x] Output consistency check
- [x] Real-time processing progress & logs
- [x] Unified global state management
- [x] File upload preview (uploadId approach)
- [ ] Batch import/export
- [ ] Custom classification rules
- [ ] Rule comparison tool
- [ ] English UI support

---

## Disclaimer

1. **This tool is for processing user-owned or authorized Legado book source JSON files only.** Users should only process sources they have the right to use, store, and verify.
2. **This tool does not provide, host, or distribute any novel content.** All operations target book source metadata (URLs, rules, etc.), not actual content.
3. **This tool does not guarantee third-party site availability.** Online validation results depend on network conditions, rate limiting, and regional access restrictions.
4. **Users must comply with applicable laws and the target sites' terms of service.** Online validation sends HTTP requests to the URLs configured in book sources.
5. **Do not use for infringement, bypassing access controls, or abusing third-party services.** This tool is intended for legitimate book source management and maintenance only.
6. **This software is provided "as is" without warranty of any kind.** See [LICENSE](./LICENSE) for details.

---

## License

MIT License — see [LICENSE](./LICENSE) file.

---

*Legado Source Toolkit v1.2.0 — Built with TypeScript, Fastify, React, and Vite*
