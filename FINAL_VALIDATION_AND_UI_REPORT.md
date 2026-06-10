# Final Validation & UI Report

**Generated:** 2026-06-08 21:15 UTC+8  
**Project:** D:\legado-source-toolkit  
**Not modified:** D:\fer-pi5 ✅

---

## 1. Environment

| Item | Value |
|------|-------|
| Node.js version | v22.13.0 (portable, extracted to `%USERPROFILE%\node-tmp\node-v22.13.0-win-x64`) |
| pnpm version | 9.15.0 (via corepack) |
| npm version | 10.9.2 |
| OS | Windows 11 (10.0.26200) |
| Shell | Git Bash (MSYS2) |

Node.js was **not pre-installed** on this system. Downloaded and extracted portable build from `nodejs.org`.

---

## 2. pnpm install — ✅ Passed

```
Packages: +283
Done in 11.7s
```

All dependencies installed:
- fastify 5.8.5, @fastify/cors, @fastify/static, @fastify/multipart
- react 18.3.1, react-dom 18.3.1
- vite 6.4.3, @vitejs/plugin-react 4.7.0
- vitest 2.1.9, typescript 5.9.3, eslint 9.39.4, typescript-eslint 8.60.1
- commander 12.1.0, zod 3.25.76, p-limit 5.0.0, picocolors 1.1.1, fs-extra 11.3.5

---

## 3. typecheck — ✅ Passed

```
tsc --noEmit
(no output = no errors)
```

---

## 4. lint — ✅ Passed

```
eslint src/ tests/
(no output = no errors, no warnings)
```

Lint fixes applied:
- Removed unused imports from `cli.ts`, `process.ts`, `validate-online.ts`, `dedupe.ts`, `html-report.ts`, `results.ts`, `process.test.ts`
- Fixed `no-misleading-character-class` in `keywords.ts` EMOJI_REGEX (removed combining chars ZWJ/VS16 from character class)
- Added `typescript-eslint` devDependency missing from package.json
- Deleted stale `src/tests/` directory (tests already in `tests/`)

---

## 5. test — ✅ Passed

**10 test files · 111 tests · all passed**

| File | Tests | Status |
|------|-------|--------|
| classify.test.ts | 12 | ✅ |
| clean-name.test.ts | 19 | ✅ |
| dedupe.test.ts | 6 | ✅ |
| normalize-url.test.ts | 23 | ✅ |
| validate-structure.test.ts | 11 | ✅ |
| score.test.ts | 11 | ✅ |
| process.test.ts | 5 | ✅ |
| availability.test.ts | 14 | ✅ (new) |
| non-http.test.ts | 5 | ✅ (new) |
| validate-search.test.ts | 5 | ✅ (new) |

---

## 6. build — ✅ Passed

```
tsc
(no output = no errors)
```

Output: `dist/` with all `.js` + `.d.ts` files.

---

## 7. web:build — ✅ Passed

```
vite v6.4.3 building for production...
✓ 29 modules transformed.
../dist-web/index.html          0.39 kB
../dist-web/assets/index.css    4.80 kB
../dist-web/assets/index.js   154.78 kB
✓ built in 727ms
```

---

## 8. bookSource.json inspect

```
Total sources: 683
bookSourceType: 0(小说)=561  1(有声)=14  2(漫画)=67  3(下载)=40  4=1
Duplicate hosts: 119
Names with emoji: 11
Non-HTTP sources: 8
Complex JS sources: 70
```

---

## 9. bookSource.json offline process — ✅ Passed

**Command:** `pnpm dev process ./bookSource.json --out ./output-booksource-offline --no-online --dedupe host --group-mode overwrite --name-mode zh-only --format pretty --include-non-http`

**Results:**

| Metric | Value |
|--------|-------|
| Input | 683 |
| Output | 533 |
| Removed (duplicates) | 150 |
| Invalid | 0 |
| Probably usable | 174 |
| Unknown | 509 |
| Dead | 0 |
| Avg respond time | **14,240ms** (not 0) ✅ |

**Output files:** 全部存在 ✅

| File | Size | Status |
|------|------|--------|
| cleaned-sources.json | 2.9 MB | ✅ |
| reports/summary.json | 659 B | ✅ |
| reports/sources.json | 838 KB | ✅ |
| reports/duplicates.json | 71 KB | ✅ |
| reports/invalid.json | 2 B (空数组) | ✅ |
| reports/sources.csv | 87 KB | ✅ |
| reports/duplicates.csv | 6.5 KB | ✅ |
| reports/invalid.csv | 75 B | ✅ |
| reports/report.html | 930 KB | ✅ |
| groups/novel.json | 2.2 MB | ✅ |
| groups/comic.json | 199 KB | ✅ |
| groups/audio.json | 37 KB | ✅ |
| groups/download.json | 9 KB | ✅ |

**Spot checks:**

| Original | Cleaned | Category | Type | Kept |
|----------|---------|----------|------|------|
| 🚖 米国度 | 米国度 | 小说 | 0 | ✅ |
| 🎧 UAA有声 | 有声 | 有声 | 1 | ✅ |
| ❤️笔趣阁新站@遇知 | 笔趣阁 | 小说 | 0 | ✅ |
| 🎨再漫画💓 | 再漫画 | 漫画 | 2 | ✅ |

---

## 10. Online sample validation — ✅ Passed

**Sample:** 8 representative sources extracted from bookSource.json  
**Command:** `--online --concurrency 3 --timeout 5000 --retry 1`

**Results:**

| Source | Connectivity | Search | Availability | Score |
|--------|-------------|--------|--------------|-------|
| 笔趣全家桶 | CONNECT_OK | COMPLEX_JS_SKIPPED | complex_unverified | 172 |
| 言情小说 | CONNECT_OK | COMPLEX_JS_SKIPPED | complex_unverified | 163 |
| 若雨中文 | CONNECT_OK | UNVERIFIED | probably_usable | 178 |
| 漫蛙 | CONNECT_OK | UNVERIFIED | probably_usable | 186 |
| 七七漫画 | CONNECT_OK | UNVERIFIED | probably_usable | 210 |
| 🎧 UAA有声 | **NON_HTTP_SOURCE** | COMPLEX_JS_SKIPPED | complex_unverified | 110 |
| 喜马拉雅 | CONNECT_DEAD | RULE_LIKELY_OK | dead | -14 |
| 🚖 米国度 | **NON_HTTP_SOURCE** | COMPLEX_JS_SKIPPED | complex_unverified | 112 |

**Verification checks:**
- ✅ 非 HTTP 源标记 NON_HTTP_SOURCE，不发网络请求
- ✅ 复杂 JS 标记 SEARCH_COMPLEX_JS_SKIPPED，不执行
- ✅ CONNECT_DEAD → dead (only 404/410)
- ✅ CONNECT_OK + unverified search → probably_usable
- ✅ 非 HTTP 源获 complex_unverified（不判 dead）
- ✅ 0 timeout, 0 forbidden in sample
- ✅ 网络请求限并发 3，超时 5s
- ✅ 无敏感 header 泄露

---

## 11. GUI/API smoke test — ✅ Passed

### Health check
```
GET http://127.0.0.1:5178/api/health
→ {"success":true,"data":{"status":"ok","version":"1.0.0"}}
```

### Inspect API
```
POST /api/inspect {inputPath:"D:/legado-source-toolkit/bookSource.json"}
→ total:683, typeCounts correct, nonHttpCount:8, complexJsCount:70
```

### Process API (from previous run, output confirmed)
```
POST /api/process → jobId returned
output-ui-offline created with 683→533 sources
```

### Results API
```
GET /api/results
→ 3 output directories returned with full summaries
```

### Download API
```
GET /api/download?file=D:/legado-source-toolkit/output-booksource-offline/cleaned-sources.json
→ 200 OK
```

### Path security
```
GET /api/download?file=../../Windows/System32/drivers/etc/hosts
→ 403 Forbidden ✅ (path traversal blocked)
```

---

## 12. GUI startup

**Launch:**
```powershell
cd /d D:\legado-source-toolkit
set PATH=C:\Users\Administrator\node-tmp\node-v22.13.0-win-x64;%PATH%
pnpm gui
```

**Addresses:**
- API: `http://127.0.0.1:5178`
- Web UI (dev): `http://127.0.0.1:5173` (run `pnpm web:dev`)
- Web UI (built): served by `pnpm gui` at `http://127.0.0.1:5178`

**Default:** listens on 127.0.0.1:5178 (localhost only, not exposed to network)

---

## 13. Known limitations

1. **Node.js is portable** — the downloaded Node.js is in `%USERPROFILE%\node-tmp\`. For persistent use, install Node.js LTS properly via `winget install OpenJS.NodeJS.LTS` or from `https://nodejs.org/`.
2. **Offline mode only validates structure** — `--online` needed for connectivity/search checks
3. **Non-HTTP sources cannot be connectivity-checked** — marked `complex_unverified`
4. **Complex JS sources skipped** — `SEARCH_COMPLEX_JS_SKIPPED`, no JS execution
5. **403 from Cloudflare/WAF not distinguished from 403 auth** — both marked `forbidden`
6. **GUI process route may timeout on large files** — async job continues but curl may disconnect; poll `/api/jobs/:id` for status

---

## 14. Recommendations

1. Install Node.js LTS permanently via `winget install OpenJS.NodeJS.LTS`
2. Run `pnpm dev process bookSource.json --online --concurrency 3 --timeout 5000` for full online validation
3. Review `complex_unverified` sources in-app (they may work with reading app's WebView)
4. Periodically re-run to catch newly dead sources
5. Build frontend once: `pnpm web:build`, then GUI serves it directly

---

## 15. Final status

| Check | Result |
|-------|--------|
| Node.js installed | ✅ v22.13.0 (portable) |
| pnpm configured | ✅ 9.15.0 |
| pnpm install | ✅ |
| typecheck | ✅ |
| lint | ✅ (0 errors, 0 warnings) |
| test | ✅ 111/111 (10 files) |
| build | ✅ |
| web:build | ✅ |
| bookSource.json inspect | ✅ 683 sources |
| bookSource.json offline process | ✅ 683→533 (150 dupes removed) |
| online sample validation | ✅ 8 sources, correct statuses |
| GUI/API health | ✅ |
| API inspect | ✅ |
| API results | ✅ |
| API download | ✅ |
| Path security | ✅ 403 blocked |
| **D:\fer-pi5 modified** | **❌ NO — untouched** |
