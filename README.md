# Legado Source Toolkit / LS-Toolkit

[English](#english) | [中文](#chinese)

---

<h2 id="chinese">📖 Legado Source Toolkit — 书源处理工具</h2>

这是一个用于 [Legado / 开源阅读](https://github.com/gedoor/legado) 书源 JSON 文件的本地清洗、校验、分类、去重、评分、审计和导出工具。

> **⚠️ 这不是阅读器本体**  
> 本工具不提供小说阅读功能，不内置任何书源内容，不保证第三方网站的可访问性。  
> 它仅处理用户自己提供的 JSON 书源文件。

---

## 📑 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [适用场景](#适用场景)
- [安全说明](#安全说明)
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [Windows 一键启动](#windows-一键启动)
- [Web GUI 说明](#web-gui-说明)
- [CLI 使用说明](#cli-使用说明)
- [输入与输出](#输入与输出)
- [主要报告文件](#主要报告文件)
- [常见工作流](#常见工作流)
- [配置选项](#配置选项)
- [安全边界](#安全边界)
- [开发命令](#开发命令)
- [测试与验证](#测试与验证)
- [GitHub 上传](#github-上传)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [免责声明](#免责声明)
- [License](#license)

---

## 项目简介

LS-Toolkit 是一个本地运行的工具集，帮助 Legado 阅读 App 的用户管理大规模书源 JSON 文件。它可以清洗脏名称、规范化 URL、自动分类、校验结构、在线验证连通性、智能去重、质量评分，并输出结构化报告。

所有操作均在本地完成，不上传数据到第三方服务器。在线验证仅发送轻量 HTTP 请求。

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 📤 **书源 JSON 上传** | 拖拽或选择文件上传，支持 50MB 以内 JSON |
| 🔍 **书源概览审查** | 快速统计类型分布、分组分布、重复 Host、复杂 JS 等 |
| 🏷️ **名称清洗** | 去除 Emoji、质量标记、维护者后缀、注释等脏数据 |
| 🔗 **URL 规范化** | HTTPS 升级、去除 www/m/wap 前缀、规范化 Host |
| 🏷️ **自动分类** | 多信号加权投票（类型 + 关键词 + 规则特征 + 分组） |
| ✅ **结构校验** | 检查必填字段：名称、URL、搜索规则、详情规则、目录规则、正文规则 |
| 🌐 **在线验证** | 连通性检查 + 搜索 URL 验证（可选，有 SSRF 防护） |
| ⭐ **质量评分** | 正负分系统，覆盖可用性、规则完整性、响应速度等 |
| 🔄 **多级去重** | exact → url → conservative → host → aggressive 五级去重 |
| ⚠️ **风险审计** | 脏名称、分组冲突、cleaned/groups 差异、结构性无效等 |
| ✅ **输出一致性验收** | 自动校验 cleaned-sources.json 与 groups/*.json 一致性 |
| 📊 **结果报告** | JSON / CSV / HTML 报告 |
| 🖥️ **Web GUI** | 11 个功能页面，实时进度展示，处理摘要 |
| ⌨️ **CLI** | 5 个命令行子命令，适合脚本集成 |

---

## 适用场景

- 维护大规模书源集合（几百到几千条）
- 定期清理和去重书源
- 书源分类重组
- 书源质量评估
- 分享书源前审查和清理
- 自动化和 CI/CD 集成

---

## 安全说明

- 上传文件仅接受 `.json`，最大 50MB
- 下载接口仅允许结果输出目录
- 上传预览使用专用接口，不走下载接口
- SSRF 防护会阻止：localhost / 127.0.0.0/8、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、169.254.0.0/16、IPv6 ::1、fc00::/7
- Header 白名单会过滤 Host, Cookie, Authorization, X-Forwarded-For 等危险头
- 错误信息不暴露绝对路径
- 本工具不执行书源中的任何 JavaScript 代码
- 默认监听 127.0.0.1，不暴露公网
- 如开放到局域网/公网，请自行加认证和访问控制
- 用户应确保使用的书源合法合规

---

## 系统要求

- **Node.js** >= 20.0.0
- **pnpm**（推荐）或 npm
- **操作系统**：Windows / macOS / Linux
- 推荐 Windows 用户使用 `start-ui.bat` 一键启动
- 首次使用需要安装依赖：`pnpm install`
- 不要直接提交 `node_modules` 到仓库

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 验证项目完整性
pnpm verify

# 3. 启动 Web GUI（后端 API + 静态前端）
pnpm gui
# 访问 http://127.0.0.1:5178
```

或使用 CLI 模式：

```bash
# 检查书源文件概况
pnpm dev inspect samples/sample.json

# 完整离线处理
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative

# 带在线验证的处理
pnpm dev process samples/sample.json --out ./output --online --dedupe conservative

# 仅结构校验
pnpm dev validate samples/sample.json

# 仅名称清洗
pnpm dev clean-name samples/sample.json

# 仅分类拆分
pnpm dev split samples/sample.json
```

---

## Windows 一键启动

项目根目录下的 `start-ui.bat` 提供一键启动体验。

**使用方法**：在 `D:\legado-source-toolkit\` 目录中双击 `start-ui.bat`。

**脚本自动完成**：

1. 检测 Node.js 和 pnpm 是否安装
2. 如未安装 pnpm，自动尝试启用 Corepack
3. 如 `node_modules` 不存在，提示是否自动安装依赖
4. 启动 `pnpm gui`（后端 API + 静态前端）
5. 等待约 3 秒后自动在浏览器中打开 `http://127.0.0.1:5178`

> ⚠️ 启动后不要关闭命令窗口，关闭窗口会停止服务。
> 如果浏览器未自动打开，请手动访问 `http://127.0.0.1:5178`。

---

## Web GUI 说明

### 端口说明

| 命令 | 作用 | 访问地址 |
|------|------|----------|
| `pnpm gui` | 后端 API + 静态前端 | `http://127.0.0.1:5178` |
| `pnpm web:dev` | 前端开发服务器（热更新） | `http://127.0.0.1:5173` |
| API 健康检查 | 后端状态 | `http://127.0.0.1:5178/api/health` |

### GUI 页面

| 页面 | 用途 |
|------|------|
| 🏠 **首页** | API 状态、快捷入口、最近处理结果 |
| 📤 **上传书源** | 上传 JSON 文件，审查文件概况，预览前 5 条 |
| 🔍 **概览审查** | 快速统计书源类型/分组/Host/JS 分布 |
| ⚡ **处理运行** | 配置参数并执行完整处理流程，实时查看进度和摘要 |
| 📊 **结果查看** | 查看所有处理结果目录，下载输出文件 |
| 📋 **书源列表** | 浏览处理后书源，筛选、搜索、查看详情 |
| 🔄 **去重风险** | 查看去重组和潜在冲突 |
| 🏷️ **名称清洗** | 查看名称清洗前后的变化和步骤 |
| 🔗 **URL 规范化** | 查看 URL 规范化状态和警告 |
| ✅ **验收中心** | 输出一致性检查结果 |
| 📋 **审计中心** | 综合审计报告，下载所有报告文件 |

### 开发模式（前端热更新）

后端 API（终端 1）：

```bash
pnpm gui
```

前端开发服务器（终端 2）：

```bash
pnpm web:dev
```

然后访问 `http://127.0.0.1:5173`，前端会通过 Vite proxy 自动将 API 请求转发到 5178。

---

## CLI 使用说明

```bash
# 处理流程
pnpm dev process <input.json> [options]

# 快速概览
pnpm dev inspect <input.json>

# 仅校验
pnpm dev validate <input.json>

# 仅名称清洗
pnpm dev clean-name <input.json> [options]

# 仅分类拆分
pnpm dev split <input.json> [options]

# 查看完整帮助
pnpm dev --help
pnpm dev process --help
```

---

## 输入与输出

### 输入

- Legado 阅读 App 导出的书源 JSON 文件
- 必须是合法的 JSON 数组
- 最大 50MB
- 仅接受 `.json` 文件

示例见 `samples/sample.json`。

### 输出文件

处理完成后在输出目录中生成以下文件：

| 文件 | 说明 |
|------|------|
| `cleaned-sources.json` | 清洗、分类、去重后的最终书源列表 |
| `all-sources-reviewed.json` | 完整审计分析（含每条源的处理记录） |
| `reports/summary.json` | 处理汇总统计数据 |
| `reports/output-consistency.json` | 输出一致性检查报告 |
| `reports/dirty-names.json` | 脏名称报告 |
| `reports/group-mismatches.json` | 分组冲突报告 |
| `reports/cleaned-vs-groups-diff.json` | cleaned 与 groups 差异报告 |
| `reports/duplicates.json` | 去重组详情 |
| `reports/risky.json` | 高风险源列表 |
| `reports/structural-invalid.json` | 结构无效源列表 |
| `reports/unavailable.json` | 不可用源列表 |
| `reports/sources.csv` | 书源 CSV 导出 |
| `reports/duplicates.csv` | 去重 CSV 导出 |
| `reports/report.html` | 自包含的 HTML 报告 |
| `groups/novel.json` | 小说分类输出 |
| `groups/comic.json` | 漫画分类输出 |
| `groups/audio.json` | 有声分类输出 |
| `groups/video.json` | 影视分类输出 |
| `groups/download.json` | 下载分类输出 |
| `groups/other.json` | 其他分类输出 |

---

## 配置选项

### 处理选项（`pnpm dev process`）

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `-o, --out <dir>` | `./output` | 输出目录 |
| `--online` | `false` | 启用在线连通性和搜索校验 |
| `--dedupe <level>` | `conservative` | 去重级别：none \| exact \| url \| conservative \| host \| aggressive |
| `--group-mode <mode>` | `category-first` | 分组模式：category-first \| overwrite \| append \| preserve \| report-only |
| `--name-mode <mode>` | `loose` | 名称清洗模式：loose \| zh-only |
| `--concurrency <n>` | `16` | 并发 HTTP 请求数 |
| `--timeout <ms>` | `8000` | 请求超时毫秒 |
| `--retry <n>` | `1` | 重试次数 |
| `--dry-run` | — | 试运行，不写入文件 |
| `--format <fmt>` | `pretty` | 输出格式：pretty \| minified |
| `--strict` | `false` | 一致性检查失败时以非零退出码退出 |

---

## 安全边界

| 边界 | 策略 |
|------|------|
| 上传文件类型 | 仅 `.json` |
| 上传文件大小 | 限制 50MB |
| 上传预览 | 专用 preview API，不走 download |
| 结果下载 | 仅允许 output 目录 |
| API 路径白名单 | inputPath 仅允许 `samples/`、`uploads/` |
| SSRF | 阻止私有 IP / localhost / 内网 / DNS rebinding |
| 危险 Header | 自动过滤 Host, Cookie, Authorization 等 |
| 错误信息 | 不暴露绝对路径和 stack trace |
| CORS | 仅允许 localhost:5173/5178 |
| 速率限制 | 100 请求/分钟 |
| JS 执行 | 不执行书源中的任何 JavaScript |
| 鉴权 | 本地工具，默认无鉴权（开放公网需自加） |

---

## 开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 开发运行 CLI
pnpm typecheck        # TypeScript 类型检查
pnpm web:typecheck    # 前端类型检查
pnpm lint             # ESLint 检查
pnpm build            # 构建 CLI
pnpm web:build        # 构建前端
pnpm gui              # 启动 Web GUI（后端 API + 静态前端）
pnpm web:dev          # 启动前端开发服务器（热更新）
pnpm test             # 运行测试
pnpm verify           # 完整验证
pnpm clean            # 清理构建产物和运行时目录
```

---

## 测试与验证

```bash
# 完整验证（推荐推送前执行）
pnpm verify

# `pnpm verify` 实际依次执行以下 6 项检查：
# 1. pnpm typecheck     — TypeScript 类型检查（tsc --noEmit）
# 2. pnpm web:typecheck — 前端类型检查（tsc -p tsconfig.web.json --noEmit）
# 3. pnpm lint          — ESLint 代码规范检查（eslint src/ tests/ web/）
# 4. pnpm build         — TypeScript 编译构建（tsc）
# 5. pnpm web:build     — Vite 前端生产构建（vite build）
# 6. pnpm test          — 运行全部测试（vitest run，126+ 测试用例）
```

---

## GitHub 上传

### 上传前检查

```bash
# 1. 运行完整验证
pnpm verify

# 2. 检查 git 状态
git status

# 3. 确认不存在以下文件/目录（.gitignore 已排除）：
#    - node_modules/
#    - output-*/
#    - uploads/
#    - .env / .env.*
#    - dist/ 和 dist-web/（可选重建）
#    - coverage/
#    - *.log
#    - .codegraph/ / .reasonix/
```

### 上传步骤

```bash
git init
git add .
git commit -m "Initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/<your-username>/legado-source-toolkit.git
git push -u origin main
```

### `.gitignore` 已排除

| 模式 | 说明 |
|------|------|
| `node_modules/` | 依赖目录 |
| `.pnpm-store/` | pnpm 缓存 |
| `dist/` | CLI 构建产物 |
| `dist-web/` | 前端构建产物 |
| `coverage/` | 测试覆盖率报告 |
| `output-*/` | 运行时输出目录 |
| `uploads/` | 上传文件 |
| `.env` / `.env.*` | 环境配置文件（保留 `.env.example`） |
| `*.log` | 日志文件 |
| `reports/tmp/` | 临时报告 |
| `.codegraph/` / `.reasonix/` | IDE / 工具配置 |

---

## 常见问题

**Q: 提示"pnpm 未安装"怎么办？**
A: 可启用 Corepack：`corepack enable`，或使用 `npm install -g pnpm` 安装。

**Q: 启动后页面空白？**
A: 确认 `dist-web/` 已构建（运行 `pnpm web:build`），或使用开发模式 `pnpm web:dev` 并访问 `http://127.0.0.1:5173`。

**Q: 上传文件报错"仅限输出目录"？**
A: 这是已修复的已知问题。预览按钮现在使用专用的 upload preview API，不再走 download 接口。

**Q: 可以处理多少条书源？**
A: 可处理数百到数千条。实测 5000+ 条书源处理正常，具体取决于机器性能和是否启用在线验证。

**Q: 在线验证一直超时？**
A: 部分站点可能屏蔽非浏览器 UA 或数据中心 IP。可适当调高 `--timeout`（如 15000ms）或跳过在线验证（使用 `--no-online`）。

**Q: 输出目录不存在？**
A: 处理完成后系统会自动记录当前结果目录。也可在结果页面手动输入目录名（如 `output`）并点击加载。

**Q: 为什么需要区分 5178 和 5173？**
A: `pnpm gui` 启动后端 API 服务（端口 5178），直接提供 Web 页面访问。`pnpm web:dev` 启动 Vite 开发服务器（端口 5173），支持前端热更新，通过代理转发 API 请求到 5178。

---

## 路线图

- [x] 名称清洗 + URL 规范化
- [x] 自动分类 + 结构校验
- [x] 在线连通性与搜索验证
- [x] 质量评分 + 多级去重
- [x] Web GUI + CLI
- [x] 路径安全与 SSRF 防护
- [x] 输出一致性验收
- [x] 实时处理进度与日志
- [x] 统一全局状态管理
- [x] 文件上传预览（uploadId 方案）
- [ ] 书源批量导入导出
- [ ] 自定义分类规则
- [ ] 书源规则对比工具
- [ ] 国际版英文 UI 支持

---

## 免责声明

1. 本工具仅用于处理用户自己提供的书源 JSON 数据。
2. 本工具不提供、不推荐、不内置任何书源内容。
3. 用户应自行确保所使用的书源符合相关法律法规。
4. 第三方网站的可访问性和内容合法性不在本工具责任范围内。
5. 本工具不保证所有处理后的书源在任意版本的阅读 App 中均能正常工作。
6. 本工具按"现状"提供，不提供任何明示或暗示的保证。

---

## License

MIT License — 详见 [LICENSE](./LICENSE) 文件。

---

<h2 id="english">📖 Legado Source Toolkit — Book Source Processor</h2>

A local toolkit for cleaning, validating, classifying, deduplicating, scoring, auditing, and exporting [Legado (开源阅读)](https://github.com/gedoor/legado) book source JSON files.

> **⚠️ This is NOT a reader app**
> This tool does not provide reading functionality, does not bundle any book sources, and does not guarantee third-party site accessibility.
> It only processes JSON book source files provided by the user.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Use Cases](#use-cases)
- [Security Notes](#security-notes)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Windows One-click UI](#windows-one-click-ui)
- [Web GUI Guide](#web-gui-guide)
- [CLI Guide](#cli-guide)
- [Input and Output](#input-and-output)
- [Report Files](#report-files)
- [Options](#options)
- [Security Boundaries](#security-boundaries)
- [Development Commands](#development-commands)
- [Testing and Verification](#testing-and-verification)
- [Publish to GitHub](#publish-to-github)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)
- [License](#license-1)

---

## Overview

LS-Toolkit is a local toolkit for Legado reader users to manage large book source JSON collections. It cleans dirty names, normalizes URLs, auto-classifies, validates structure, checks online connectivity, intelligently deduplicates, scores quality, and exports structured reports.

All operations run locally — no data is uploaded to third-party servers. Online validation only sends lightweight HTTP requests.

---

## Features

| Feature | Description |
|---------|-------------|
| 📤 **JSON Upload** | Drag & drop or select file, up to 50MB |
| 🔍 **Quick Inspect** | Type/group distribution, duplicate hosts, complex JS stats |
| 🏷️ **Name Cleaning** | Remove emoji, quality markers, maintainer suffixes, comments |
| 🔗 **URL Normalization** | HTTPS upgrade, strip www/m/wap prefixes |
| 🏷️ **Auto Classification** | Multi-signal weighted voting (type + keywords + rules + group) |
| ✅ **Structure Validation** | Check required fields: name, URL, search/bookinfo/toc/content rules |
| 🌐 **Online Validation** | Connectivity check + search URL verification (opt-in, SSRF protected) |
| ⭐ **Quality Scoring** | +/- scoring system covering availability, rule completeness, performance |
| 🔄 **Multi-level Dedup** | exact → url → conservative → host → aggressive |
| ⚠️ **Risk Auditing** | Dirty names, group conflicts, cleaned/groups diffs, structural invalids |
| ✅ **Output Consistency Check** | Auto-verify cleaned-sources vs groups/\*.json consistency |
| 📊 **Reports** | JSON / CSV / HTML reports |
| 🖥️ **Web GUI** | 11 pages with real-time progress and summary |
| ⌨️ **CLI** | 5 subcommands, suitable for scripting |

---

## Use Cases

- Maintaining large book source collections (hundreds to thousands)
- Periodic source cleaning and deduplication
- Source category reorganization
- Quality assessment
- Pre-sharing review and cleanup
- Automation and CI/CD integration

---

## Security Notes

- Upload accepts `.json` only, max 50MB
- Download API allows output directories only
- Upload preview uses a dedicated API, not the download endpoint
- SSRF protection blocks: localhost, private IP ranges, IPv6 ULA, DNS to private IPs, redirect to private IPs
- Dangerous headers (Host, Cookie, Authorization, etc.) are filtered automatically
- Error messages never expose absolute paths or stack traces
- No JavaScript execution from book sources
- Default listener: 127.0.0.1 (localhost only)
- If exposed to LAN/public, add authentication and access control

---

## Requirements

- **Node.js** >= 20.0.0
- **pnpm** (recommended) or npm
- **OS**: Windows / macOS / Linux
- Windows users: double-click `start-ui.bat` to launch GUI
- First run: `pnpm install`
- Do **not** commit `node_modules`

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Verify project integrity
pnpm verify

# 3. Start Web GUI (backend API + static frontend)
pnpm gui
# Open http://127.0.0.1:5178
```

Or use CLI:

```bash
# Inspect a book source file
pnpm dev inspect samples/sample.json

# Full offline processing
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative

# Online processing
pnpm dev process samples/sample.json --out ./output --online --dedupe conservative
```

---

## Windows One-click UI

Double-click `start-ui.bat` in the project root (`D:\legado-source-toolkit\`) to launch the Web GUI.

**What it does**:

1. Checks Node.js and pnpm availability
2. Enables Corepack if pnpm is not found
3. Prompts to install dependencies if `node_modules` is missing
4. Starts `pnpm gui` (backend API + static frontend)
5. After ~3 seconds, opens `http://127.0.0.1:5178` in your browser

> ⚠️ Keep the terminal window open — closing it stops the server.
> If the browser does not open automatically, manually navigate to `http://127.0.0.1:5178`.

---

## Web GUI Guide

### Port Overview

| Command | Purpose | Address |
|---------|---------|---------|
| `pnpm gui` | Backend API + static frontend | `http://127.0.0.1:5178` |
| `pnpm web:dev` | Frontend dev server (HMR) | `http://127.0.0.1:5173` |
| API Health | Backend status | `http://127.0.0.1:5178/api/health` |

### GUI Pages

| Page | Purpose |
|------|---------|
| 🏠 **Dashboard** | API status, quick actions, recent results |
| 📤 **Upload** | Upload JSON, inspect summary, preview first 5 items |
| 🔍 **Inspect** | Quick statistics on type/group/host/JS distribution |
| ⚡ **Process** | Configure and run full pipeline, real-time progress |
| 📊 **Results** | Browse all output directories, download files |
| 📋 **Sources** | Browse processed sources, filter, search, details |
| 🔄 **Duplicates** | Dedup groups and potential conflicts |
| 🏷️ **Name Cleaning** | View name changes and cleaning steps |
| 🔗 **URL Normalization** | View URL status and warnings |
| ✅ **Consistency** | Output consistency check results |
| 📋 **Audit** | Full audit report, download all reports |

### Development Mode (Hot Reload)

Backend API (Terminal 1):

```bash
pnpm gui
```

Frontend dev server (Terminal 2):

```bash
pnpm web:dev
```

Then visit `http://127.0.0.1:5173`. Vite proxy forwards `/api/*` requests to port 5178.

---

## CLI Guide

```bash
# Full pipeline
pnpm dev process <input.json> [options]

# Quick overview
pnpm dev inspect <input.json>

# Validation only
pnpm dev validate <input.json>

# Name cleaning only
pnpm dev clean-name <input.json> [options]

# Category split only
pnpm dev split <input.json> [options]

# Full help
pnpm dev --help
pnpm dev process --help
```

---

## Input and Output

### Input

- Legado reader book source JSON export
- Must be a valid JSON array
- Max 50MB
- `.json` files only

### Output Files

| File | Description |
|------|-------------|
| `cleaned-sources.json` | Final cleaned, classified, deduplicated sources |
| `all-sources-reviewed.json` | Complete audit trail for every source |
| `reports/summary.json` | Processing summary statistics |
| `reports/output-consistency.json` | Output consistency check report |
| `reports/dirty-names.json` | Dirty name report |
| `reports/group-mismatches.json` | Group mismatch report |
| `reports/cleaned-vs-groups-diff.json` | Cleaned vs groups diff report |
| `reports/duplicates.json` | Dedup group details |
| `reports/risky.json` | High-risk sources list |
| `reports/structural-invalid.json` | Structurally invalid sources |
| `reports/unavailable.json` | Unavailable sources |
| `reports/sources.csv` | CSV export |
| `reports/report.html` | Self-contained HTML report |
| `groups/novel.json` | Novel category output |
| `groups/comic.json` | Comic category output |
| `groups/audio.json` | Audio category output |
| `groups/video.json` | Video category output |
| `groups/download.json` | Download category output |
| `groups/other.json` | Other category output |

---

## Options

### Process Options (`pnpm dev process`)

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --out <dir>` | `./output` | Output directory |
| `--online` | `false` | Enable online connectivity & search checks |
| `--dedupe <level>` | `conservative` | none \| exact \| url \| conservative \| host \| aggressive |
| `--group-mode <mode>` | `category-first` | category-first \| overwrite \| append \| preserve \| report-only |
| `--name-mode <mode>` | `loose` | loose \| zh-only |
| `--concurrency <n>` | `16` | Concurrent HTTP requests |
| `--timeout <ms>` | `8000` | Request timeout in ms |
| `--retry <n>` | `1` | Retry count |
| `--dry-run` | — | Run without writing files |
| `--strict` | `false` | Non-zero exit on consistency failure |

---

## Security Boundaries

| Boundary | Policy |
|----------|--------|
| Upload file type | `.json` only |
| Upload size | 50MB limit |
| Upload preview | Dedicated preview API, not via download |
| Result download | Output directories only |
| API path whitelist | `samples/`, `uploads/` only |
| SSRF | Blocks private IP / localhost / internal / DNS rebinding |
| Dangerous headers | Auto-filters Host, Cookie, Authorization, etc. |
| Error messages | No absolute paths, no stack traces |
| CORS | localhost:5173/5178 only |
| Rate limit | 100 requests/minute |
| JS execution | Never executes book source JavaScript |
| Auth | None by default (add if exposing to network) |

---

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run CLI in dev mode
pnpm typecheck        # TypeScript type check
pnpm web:typecheck    # Frontend type check
pnpm lint             # ESLint
pnpm build            # Build CLI
pnpm web:build        # Build frontend
pnpm gui              # Start Web GUI (backend API + static frontend)
pnpm web:dev          # Start frontend dev server (hot reload)
pnpm test             # Run tests
pnpm verify           # Full verification
pnpm clean            # Clean build artifacts
```

---

## Testing and Verification

```bash
# Full verification (recommended before push)
pnpm verify

# `pnpm verify` executes these 6 checks sequentially:
# 1. pnpm typecheck     — TypeScript type checking (tsc --noEmit)
# 2. pnpm web:typecheck — Frontend type checking (tsc -p tsconfig.web.json --noEmit)
# 3. pnpm lint          — ESLint code style check (eslint src/ tests/ web/)
# 4. pnpm build         — TypeScript compilation (tsc)
# 5. pnpm web:build     — Vite frontend production build (vite build)
# 6. pnpm test          — Run all tests (vitest run, 126+ test cases)
```

---

## Publish to GitHub

### Pre-push Checklist

```bash
# 1. Run full verification
pnpm verify

# 2. Check git status
git status

# 3. Confirm the following are NOT present (.gitignore already handles them):
#    - node_modules/
#    - output-*/
#    - uploads/
#    - .env / .env.*
#    - dist/ and dist-web/ (rebuilt on demand)
#    - coverage/
#    - *.log
#    - .codegraph/ / .reasonix/
```

### Commands

```bash
git init
git add .
git commit -m "Initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/<your-username>/legado-source-toolkit.git
git push -u origin main
```

### `.gitignore` coverage

| Pattern | Description |
|---------|-------------|
| `node_modules/` | Dependency directory |
| `.pnpm-store/` | pnpm store |
| `dist/` | CLI build output |
| `dist-web/` | Frontend build output |
| `coverage/` | Test coverage reports |
| `output-*/` | Runtime output directories |
| `uploads/` | Uploaded files |
| `.env` / `.env.*` | Environment files (`.env.example` kept) |
| `*.log` | Log files |
| `reports/tmp/` | Temporary reports |
| `.codegraph/` / `.reasonix/` | IDE / tool configs |

---

## FAQ

**Q: pnpm not found?**
A: Run `corepack enable`, or install with `npm install -g pnpm`.

**Q: Blank page on start?**
A: Ensure `dist-web/` is built via `pnpm web:build`, or use dev mode: `pnpm web:dev` → visit `http://127.0.0.1:5173`.

**Q: "Forbidden" on preview?**
A: This was fixed — the preview button now uses the dedicated upload preview API, not the download endpoint.

**Q: How many sources can be processed?**
A: Works with hundreds to thousands. 5000+ sources tested successfully.

**Q: Online validation keeps timing out?**
A: Some sites block non-browser UAs. Try increasing `--timeout` (e.g., 15000ms) or skip online checks with `--no-online`.

**Q: Output directory not found?**
A: The system automatically records the result directory after processing. You can also manually type the directory name (e.g., `output`) in result pages.

**Q: Why 5178 vs 5173?**
A: `pnpm gui` starts the backend API server (port 5178), serving both API and static frontend. `pnpm web:dev` starts the Vite dev server (port 5173) for hot reload development, proxying API requests to 5178.

---

## Roadmap

- [x] Name cleaning + URL normalization
- [x] Auto classification + structure validation
- [x] Online connectivity & search verification
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

1. This tool only processes user-provided book source JSON data.
2. It does not provide, recommend, or bundle any book source content.
3. Users are responsible for ensuring their sources comply with applicable laws.
4. Third-party site accessibility and content legality are beyond this tool's scope.
5. This tool does not guarantee that all processed sources work in every version of the reading app.
6. This software is provided "as is" without warranty of any kind.

---

## License

MIT License — see [LICENSE](./LICENSE) file.

---

*Legado Source Toolkit v1.0.0 — Built with TypeScript, Fastify, React, and Vite*
