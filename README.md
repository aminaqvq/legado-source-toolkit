# Legado Source Toolkit / LS-Toolkit

语言 / Language: **中文** | [English](./README.en.md)

---

## 项目简介

LS-Toolkit 是一个本地运行的工具集，用于处理 [Legado / 开源阅读](https://github.com/gedoor/legado) App 导出的书源 JSON 文件。它可以完成书源的清洗、校验、自动分类、去重、质量评分、在线连通性检查、审计和导出。

所有操作均在本地完成，不会将数据上传到第三方服务器。在线验证仅发送轻量级 HTTP 请求，并包含 SSRF 防护。

> **⚠️ 这不是阅读器本体**
> 本工具不提供小说阅读功能，不内置任何书源内容，不保证第三方网站的可访问性。它仅处理用户自己提供的 JSON 书源文件。

---

## 这个项目不是做什么的

- **不是阅读器本体** — 不能阅读小说、听有声书、看漫画
- **不提供小说内容** — 不托管、不分发任何文字、图片或音频内容
- **不内置第三方书源** — 不附带任何现成可用的书源
- **不绕过网站限制** — 不破解付费墙、不绕过 Cloudflare 等保护机制
- **不保证第三方站点可用** — 第三方网站可能屏蔽、限流或下线，本工具无法控制
- **不鼓励或协助侵权** — 用户应只处理自己有权使用、保存和验证的书源
- **不替用户承担法律责任** — 使用在线验证功能时，会向书源中配置的目标网站发起网络请求，用户需自行遵守所在地法律法规和目标网站的服务条款

---

## 功能特性

| 功能 | 说明 |
|------|------|
| 📤 **书源 JSON 上传** | 拖拽或选择文件上传，支持 50MB 以内 JSON 文件 |
| 🔍 **书源概览审查** | 快速统计类型分布、分组分布、重复 Host、复杂 JS 等 |
| 🏷️ **名称清洗** | 去除 Emoji、质量标记、维护者后缀、注释等脏数据 |
| 🔗 **URL 规范化** | HTTPS 升级、去除 www/m/wap 前缀、规范化 Host |
| 🏷️ **自动分类** | 多信号加权投票（类型 + 关键词 + 规则特征 + 分组），支持小说/漫画/有声/影视/下载/其他 |
| ✅ **结构校验** | 检查必填字段是否完整：名称、URL、搜索规则、详情规则、目录规则、正文规则 |
| 🌐 **在线验证** | 可选启用。包含连通性检查 + 搜索 URL 验证，全部带有 SSRF 防护 |
| ⭐ **质量评分** | 正负分系统，覆盖可用性、规则完整性、响应速度、更新时间等 |
| 🔄 **多级去重** | 支持六种级别：none → exact → url → conservative → host → aggressive |
| ⚠️ **风险审计** | 脏名称、分组冲突、cleaned/groups 差异、结构性无效、不可用源等 |
| ✅ **输出一致性验收** | 自动校验 cleaned-sources.json 与 groups/*.json 之间的一致性 |
| 📊 **结果报告** | JSON / CSV / HTML 三种格式的处理报告 |
| 🖥️ **Web GUI** | 11 个功能页面，实时处理进度展示，摘要卡片 |
| ⌨️ **CLI** | 5 个命令行子命令（inspect / validate / process / clean-name / split），适合脚本集成 |

---

## v1.5 Single Source Lab

v1.5 新增单源链式校验能力，用于验证 Legado / 开源阅读书源的完整访问链路：

```
search → bookInfo → toc → content
```

### 新增能力

| 能力 | 说明 |
|------|------|
| **单源链式验证** | 从搜索结果自动提取真实 bookUrl → 详情页 → 目录 → 正文，全程真实 URL 串联 |
| **Item scope 执行** | 在搜索结果列表和目录章节列表的每个元素内执行子规则 |
| **Scoped pipeline** | 支持 `.name@href`、`a@href`、`img@src`、`.title@text`、`@href`、`@text` 等组合规则 |
| **JSON 搜索结果** | 支持 JSONPath bookList（如 `$.data[*]`）和简写字段名（如 `name` → `$.name`） |
| **POST searchUrl** | 支持 `url,{"method":"POST","body":"searchkey={{key}}"}` 格式 |
| **手动 redirect** | 逐跳重定向，每跳重新执行 SSRF 检查（最多 5 跳） |
| **失败原因分类** | `ssrf_blocked` / `http_timeout` / `network_error` / `http_403` / `cloudflare_detected` / `empty_response` |
| **结构化 trace** | 每阶段输出 `NetworkTrace`（URL / method / status / responseSize / bodyPreview / error）和 `RuleTrace` |
| **Debug UI** | Web GUI「单源调试」页面，显示搜索结果表格、目录表格、正文预览、网络请求详情 |

### 使用入口

单源调试通过 **Web GUI** 的「🐛 单源调试」页面访问：

1. 启动后端和前端（`pnpm gui` + `pnpm web:dev`）
2. 打开 `http://127.0.0.1:5173`，点击左侧导航「🐛 单源调试」
3. 粘贴一个书源 JSON，可选填搜索关键词，点击「开始调试」

> ⚠️ v1.5 CLI 未新增单源调试命令。`process --online` 仍为批量处理入口，单源深度调试请使用 Web GUI。

### 当前限制

| 限制 | 说明 |
|------|------|
| `webView:true` | 不支持，需要 Browser Runner |
| `java.ajax` | 安全模式下不执行 |
| `java.getCookie` | 不支持 |
| `Packages.*` | 不支持 |
| Rhino 兼容 | 不支持；仅 Node vm 沙箱 |
| 登录流程 | 不处理 |
| Cloudflare / CAPTCHA | 不尝试绕过 |
| 复杂 Legado 特有语法 | 可能需要人工复核 |

### 正确定位

> v1.5 不是完整替代 Legado app 的阅读环境，而是用于批量维护和单源调试的自动化校验工具。它适合先筛出结构错误、连接失败、规则断链和明显不可用书源，再对复杂源进行人工复核。

---
## v1.6 Batch Deep Validate

v1.6 将 v1.5 的单源链式校验能力接入批量处理流程，支持对多个书源进行批量深度校验。

### 三种校验模式

| 模式 | 说明 | 执行内容 |
|------|------|---------|
| **fast** | 快速摘要模式（需显式启用 `--validate-mode fast`） | structure + connectivity + 轻量 search URL 验证，不调用规则引擎 |
| **standard** | 标准深度 | search → bookInfo → toc（停止在目录，不请求正文） |
| **deep** | 完整深度 | search → bookInfo → toc → content（完整链路） |

### 使用方式

```bash
# Standard 模式：搜索 → 详情 → 目录
pnpm dev process samples/sample.json --online --validate-mode standard --batch-concurrency 8

# Deep 模式：完整链路（谨慎使用）
pnpm dev process samples/sample.json --online --validate-mode deep --batch-concurrency 4
```

> ⚠️ **deep 模式** 会对每个源的目标站点发出 search / bookInfo / toc / content 共 4 次请求。建议使用低并发（默认 8，建议 4）以避免对目标站点造成压力。
>
> `--validate-mode` 默认不启用，保持 v1.5 及更早版本的批量处理行为不变。
>
> CLI/API 是启用 v1.6 batch validation 的主要入口；Web UI 当前主要展示 batch validation 结果摘要和 source table 状态列。
>
> ⚠️ batch validation 建议与 `--online` 搭配使用。如果不启用 `--online`，且未设置 `--include-unknown`，unknown availability 源可能会在 batch validation 前被过滤，导致 batch target 为 0。

### 新增内容

| 新增 | 说明 |
|------|------|
| **批量校验模式** | fast / standard / deep 三级模式 |
| **状态分类** | PASS / PARTIAL_PASS / FAIL / BLOCKED / NEEDS_LOGIN / UNSUPPORTED / RISKY / UNKNOWN |
| **总结摘要** | 按失败原因、Host、分组、类型的聚合统计 |
| **HTML 报告增强** | 批量校验结果摘要卡片、失败原因分布 |
| **Web UI 增强** | 结果页显示批量校验卡片、书源列表增加校验模式/状态/失败阶段列 |
| **CSV 增强** | 新增 validationMode / finalStatus / firstFailureStage / failureReasons / warnings / durationMs 列 |

### 当前限制（v1.5 + v1.6 共同）

| 限制 | 说明 |
|------|------|
| Browser Runner | 不支持 |
| Android Runner | 不支持 |
| Rhino 兼容 | 不支持；仅 Node vm 沙箱 |
| `java.ajax` | 不执行 |
| 登录 / Cookie / Session | 不处理 |
| Cloudflare / CAPTCHA 绕过 | 不尝试 |
| `webView:true` | 不支持 |

---

## 适用场景

- 维护大规模书源集合（几百到几千条）
- 定期清理和去重书源
- 书源分类重组（小说、漫画、有声等）
- 书源质量评估和审计
- 分享书源前进行审查和清理
- 自动化和 CI/CD 集成

---

## 系统要求

- **Node.js** >= 20.0.0
- **pnpm**（推荐，项目使用 pnpm 9.15.0）
- **操作系统**：Windows / macOS / Linux
- Windows 用户推荐使用 `start-ui.bat` 一键启动
- 首次使用需安装依赖：`pnpm install`

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 验证项目完整性（类型检查 + 代码规范 + 构建 + 测试）
pnpm verify

# 3. 启动开发模式（推荐）
#    打开两个终端：
#    终端 1 — 后端 API（端口 5178）
pnpm gui

#    终端 2 — 前端 Web UI（端口 5173）
pnpm web:dev

# 4. 在浏览器中打开
#    http://127.0.0.1:5173
```

或使用 CLI 直接处理：

```bash
# 检查书源文件概况
pnpm dev inspect samples/sample.json

# 完整离线处理
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative

# 带在线验证的处理
pnpm dev process samples/sample.json --out ./output --online --dedupe conservative
```

---

## Windows 一键启动

项目根目录下的 `start-ui.bat` 提供一键启动体验。

**使用方法**：在项目目录中双击 `start-ui.bat`。

**脚本自动完成**：

1. 检测 Node.js 和 pnpm 是否安装
2. 如未安装 pnpm，自动尝试启用 Corepack
3. 如 `node_modules` 不存在，提示是否自动安装依赖
4. 同时启动两个服务：
   - **后端 API**：`pnpm.cmd gui`，监听 `http://127.0.0.1:5178`
   - **前端 Web UI**：`pnpm.cmd web:dev`，监听 `http://127.0.0.1:5173`
5. 等待约 5 秒后自动在浏览器中打开 `http://127.0.0.1:5173`

> ⚠️ 启动后不要关闭两个命令窗口，关闭窗口会停止服务。
>
> ⚠️ 如果你访问 5178 看到"Web UI 尚未构建"，说明你打开的是后端地址。请访问 5173。

---

## 开发模式启动

后端 API（终端 1）：

```bash
pnpm gui
```

默认地址：`http://127.0.0.1:5178`

前端 Web UI（终端 2）：

```bash
pnpm web:dev
```

默认地址：`http://127.0.0.1:5173`

前端开发服务器支持热更新（HMR），并通过 Vite proxy 将 `/api/*` 请求自动转发到后端 5178 端口。

---

## Web GUI 使用说明

### 端口一览

| 命令 | 作用 | 地址 |
|------|------|------|
| `pnpm gui` | 后端 API 服务 | `http://127.0.0.1:5178` |
| `pnpm web:dev` | 前端开发服务器（热更新） | `http://127.0.0.1:5173` |
| API 健康检查 | 后端状态 | `http://127.0.0.1:5178/api/health` |

> **注意**：Web UI 主地址是 **5173**，不是 5178。5178 是后端 API 地址。

### 页面说明

Web GUI 包含以下 11 个页面：

| 页面 | 用途 | 用户何时使用 | 需要输入 | 输出内容 |
|------|------|-------------|---------|---------|
| 🏠 **首页** | API 状态检查、快捷入口、最近处理结果摘要 | 启动后首先看到 | 无 | API 在线状态、快速操作按钮 |
| 📤 **上传书源** | 上传 JSON 文件，审查文件概况，预览前 N 条数据 | 开始处理之前 | 选择或拖拽 JSON 文件（最大 50MB） | 文件概况卡片（总数、重复 Host、非 HTTP 源等）、前 5 条预览表格 |
| 🔍 **概览审查** | 快速统计书源类型/分组/Host/JS 分布 | 上传后了解文件构成 | 已上传或输入的本地文件路径 | 统计分析数据 |
| ⚡ **处理运行** | 配置参数并执行完整处理流程，实时查看进度 | 核心操作页面 | 输入文件路径、输出目录、处理参数 | 实时日志、阶段时间线、进度条、摘要卡片、下载链接 |
| 📊 **结果查看** | 查看所有处理结果目录，下载输出文件 | 处理完成后 | 无（自动列出 output-* 目录） | 处理摘要、文件下载链接 |
| 📋 **书源列表** | 浏览处理后书源，筛选、搜索、查看详情 | 查看处理后的书源 | 结果目录 | 书源表格（可搜索、筛选） |
| 🔄 **去重风险** | 查看去重组和潜在冲突 | 了解去重结果 | 结果目录 | 去重组详情、字段差异 |
| 🏷️ **名称清洗** | 查看名称清洗前后的变化和步骤 | 审查名称清洗效果 | 结果目录 | 清洗前后对比、清洗步骤 |
| 🔗 **URL 规范化** | 查看 URL 规范化状态和警告 | 审查 URL 处理结果 | 结果目录 | URL 状态、规范化警告 |
| ✅ **验收中心** | 输出一致性检查结果 | 验证输出是否正确 | 结果目录 | 一致性检查通过/失败详情 |
| 📋 **审计中心** | 综合审计报告，多标签页查看各项问题 | 深度审计 | 结果目录 | 总览、一致性、脏名称、分组冲突、差异、去重风险、结构无效、不可用源 |

> **注意事项**：
> - 上传预览只会读取文件的前 N 条（默认 5 条，最多 50 条），不会下载整个文件
> - 上传记录在服务器重启后失效，需重新上传
> - 处理完成后可以在结果页面或处理运行页面下载输出文件

---

## CLI 使用说明

```bash
# 全局帮助
pnpm dev --help

# 查看子命令帮助
pnpm dev process --help

# 完整处理流程
pnpm dev process <input.json> [options]

# 快速概览
pnpm dev inspect <input.json>

# 仅校验（结构校验 + 可选在线）
pnpm dev validate <input.json> [options]

# 仅名称清洗
pnpm dev clean-name <input.json> [options]

# 仅分类拆分
pnpm dev split <input.json> [options]
```

### 命令详解

**`inspect`** — 快速查看书源文件概况：

```bash
pnpm dev inspect samples/sample.json
```

输出内容：书源总数、bookSourceType 分布、top 分组分布、重复 Host 数、含 Emoji 名称数、非 HTTP 源数、复杂 JS 源数。

**`validate`** — 仅做结构校验（可选在线验证）：

```bash
pnpm dev validate samples/sample.json
pnpm dev validate samples/sample.json --online --concurrency 16 --timeout 8000
```

> 注意：`validate --online` 仅做连通性检查。完整的在线处理（含搜索验证）请使用 `process --online`。

**`process`** — 完整处理流程（核心命令）：

```bash
pnpm dev process samples/sample.json --out ./output --no-online --dedupe conservative --group-mode category-first --concurrency 16
```
