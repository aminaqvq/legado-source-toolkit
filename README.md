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

**`clean-name`** — 仅清洗书源名称：

```bash
pnpm dev clean-name samples/sample.json --name-mode zh-only -o ./output/cleaned-names.json
```

**`split`** — 仅按分类拆分：

```bash
pnpm dev split samples/sample.json -o ./output/groups
```

### process 完整参数

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `<input>` | （必填） | 输入 JSON 文件路径 |
| `-o, --out <dir>` | `./output` | 输出目录 |
| `--online` | `false` | 启用在线连通性和搜索校验 |
| `--no-online` | — | 禁用在线校验 |
| `--dedupe <level>` | `conservative` | 去重级别：none \| exact \| url \| conservative \| host \| aggressive |
| `--group-mode <mode>` | `category-first` | 分组模式：overwrite \| append \| preserve \| category-first \| report-only |
| `--name-mode <mode>` | `loose` | 名称模式：zh-only \| loose |
| `--concurrency <n>` | `16` | 并发数 |
| `--timeout <ms>` | `8000` | 请求超时毫秒 |
| `--retry <n>` | `1` | 重试次数 |
| `--dry-run` | `false` | 试运行，不写入文件 |
| `--write-meta` | `false` | 将分析元数据写回书源 JSON |
| `--format <fmt>` | `pretty` | 输出格式：pretty \| minified |
| `--keep-disabled` | `false` | 保留 disabled 的源 |
| `--only-enabled` | `false` | 仅处理 enabled 的源 |
| `--include-non-http` | `true` | 保留非 HTTP 源 |
| `--keep-latin-when-needed` | `false` | zh-only 模式下保留拉丁字母 |
| `--allow-risky-dedupe` | `false` | 允许 host/aggressive 去重时跨分类跨类型删除 |
| `--include-unknown` | `false` | 在输出中包含 unknown 状态源 |
| `--include-complex` | `false` | 在输出中包含 complex_unverified 状态源 |
| `--include-unavailable` | `false` | 在输出中包含 dead/timeout/forbidden 源 |
| `--write-normalized-url` | `false` | 将规范化后的 URL 写回输出 |
| `--strict` | `false` | 输出一致性检查失败时以非零退出码退出 |

---

## 输入文件要求

1. **文件格式**：仅接受 `.json` 文件
2. **内容格式**：Legado 书源 JSON 数组（顶层必须是数组）
3. **文件大小**：最大 50MB
4. **必须包含的关键字段**：
   - `bookSourceName` — 书源名称
   - `bookSourceUrl` — 书源 URL
   - `bookSourceType` — 书源类型（0=小说, 1=有声, 2=漫画, 3=下载）
   - `enabled` — 是否启用
   - `ruleSearch` — 搜索规则
   - `ruleBookInfo` — 详情规则
   - `ruleToc` — 目录规则
   - `ruleContent` — 正文规则

示例文件见 `samples/sample.json`。

### 上传机制说明

- 上传的文件保存在内存注册表中，服务器重启后上传记录会失效
- 上传预览使用专门的 `/api/uploads/preview` 接口（不走下载接口）
- 上传文件和输出文件的下载权限是分开的

---

## 输出目录说明

处理完成后，在指定的输出目录（默认 `./output`）中生成以下内容：

```
output/
├── cleaned-sources.json        ← 清洗、分类、去重后的可导入书源
├── all-sources-reviewed.json   ← 完整审计分析（每条源的全部处理记录）
├── groups/
│   ├── novel.json              ← 小说分类
│   ├── comic.json              ← 漫画分类
│   ├── audio.json              ← 有声分类
│   ├── video.json              ← 影视分类
│   ├── download.json           ← 下载分类
│   └── other.json              ← 其他分类
└── reports/
    ├── summary.json            ← 处理汇总统计数据
    ├── sources.json            ← 所有源的分析数据
    ├── duplicates.json         ← 去重组详情
    ├── output-consistency.json ← 输出一致性检查报告
    ├── dirty-names.json        ← 脏名称报告
    ├── group-mismatches.json   ← 分组冲突报告
    ├── cleaned-vs-groups-diff.json ← cleaned 与 groups 差异报告
    ├── structural-invalid.json ← 结构无效源列表
    ├── unavailable.json        ← 不可用源列表
    ├── risky.json              ← 高风险源列表
    ├── sources.csv             ← 书源 CSV 导出
    ├── duplicates.csv          ← 去重 CSV 导出
    ├── dirty-names.csv         ← 脏名称 CSV
    ├── group-mismatches.csv    ← 分组冲突 CSV
    ├── cleaned-vs-groups-diff.csv ← 差异 CSV
    ├── duplicate-risk.csv      ← 去重风险 CSV
    ├── structural-invalid.csv  ← 结构无效 CSV
    ├── unavailable.csv         ← 不可用 CSV
    └── report.html             ← 自包含的 HTML 报告
```

> **注意**：Web GUI 模式下，输出目录名必须以 `output` 开头，这是 API 的安全限制。

---

## 主要输出文件

| 文件 | 用途 | 生成时机 | 用户如何使用 |
|------|------|---------|------------|
| `cleaned-sources.json` | 清洗、分类、去重后的最终书源列表 | process 命令执行后 | ⭐ 适合导入 Legado 阅读 App |
| `all-sources-reviewed.json` | 每条处理记录的完整审计信息 | process 命令执行后 | 查看每条源的处理状态、评分、可用性等 |
| `groups/*.json` | 按分类拆分后的书源 | process 命令执行后 | 可单独导入特定分类的书源 |
| `reports/summary.json` | 处理汇总统计 | process 命令执行后 | 快速了解处理结果概览 |
| `reports/sources.csv` | 书源列表 CSV | process 命令执行后 | 在电子表格软件中进一步分析 |
| `reports/report.html` | 自包含的 HTML 报告 | process 命令执行后 | 在浏览器中打开查看完整报告 |
| `reports/dirty-names.json` | 脏名称详情 | process 命令执行后 | 审计辅助文件，用于检查名称清洗质量 |
| `reports/duplicate-risk.csv` | 去重风险 CSV | process 命令执行后 | 审计辅助文件 |
| `reports/output-consistency.json` | 一致性检查 | process 命令执行后 | 验证输出正确性 |

---

## 处理流程说明

完整的 `process` 流程按以下步骤执行：

1. **读取输入文件** — 解析 JSON，校验格式合法性
2. **输入过滤** — 根据 `--only-enabled` / `--keep-disabled` 等选项过滤源
3. **名称清洗**（Phase 1/6） — 去除脏数据，支持 `loose` 和 `zh-only` 两种模式
4. **URL 规范化**（Phase 2/6） — 规范化 URL、获取 Host Key、标记非 HTTP 源
5. **自动分类**（Phase 3/6） — 多信号加权投票进行分类
6. **结构校验**（Phase 4/6） — 分类感知的结构完整性检查
7. **在线验证**（Phase 5/6，可选） — 连通性检查 → 搜索 URL 验证
8. **评分**（Phase 6/6） — 综合质量评分
9. **去重** — 按选定级别进行智能去重
10. **应用分组模式** — 处理 bookSourceGroup 字段
11. **输出过滤** — 根据 availability 过滤最终输出
12. **写入输出文件** — 生成 cleaned-sources.json、groups/*.json 等
13. **一致性验收** — 检查输出文件之间的一致性
14. **生成报告** — JSON / CSV / HTML 格式

> 在线验证阶段可能耗时较长，结果受网络状况、目标站点可用性、限流、地区访问限制等因素影响。

---

## 进度显示说明

Web GUI 中的进度显示逻辑：

- 页面显示一个**总体进度条**（0-100%）
- 阶段状态通过**阶段列表**展示（读取输入 → 名称清洗 → URL 规范化 → 分类 → 结构校验 → 在线验证 → 评分 → 去重 → 输出写入 → 一致性验收）
- **没有"当前阶段进度条"**，仅有总体进度条
- 在线验证阶段额外显示：
  - 🔗 连通性检查进度（已完成 / 总数，百分比）
  - 🔍 搜索检查进度（已完成 / 总数，百分比）
- 日志区显示真实处理日志（最多保留 200 条）
- 处理完成后显示摘要卡片（输入总数、输出总数、去重移除、不可用排除、结构无效）

---

## 默认参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 并发数（concurrency） | **16** | 在线验证时的 HTTP 请求并发数 |
| 超时（timeout） | **8000ms** | 单次 HTTP 请求的超时时间 |
| 重试（retry） | **1** | 请求失败后的重试次数 |
| 去重级别（dedupe） | **conservative** | 保守模式，在同分类同类型内去重 |
| 分组模式（group-mode） | **category-first** | 分类优先，保留非分类标签 |
| 名称模式（name-mode） | **loose** | 宽松模式，保留有意义的外文 |
| 在线验证（online） | **false**（不启用） | 需手动启用 `--online` |
| 输出格式（format） | **pretty** | 美化格式输出 |
| 写入审计字段（write-meta） | **false** | 不将分析元数据写回书源 JSON |
| 保留 disabled 源 | **false** | 默认排除禁用的书源 |
| 仅处理 enabled 源 | **false** | 默认不过滤 |
| 包含非 HTTP 源 | **true** | 默认包含 |

---

## 安全设计

本工具在安全方面做了多层次防护：

1. **上传限制**：仅接受 `.json` 文件，大小限制 50MB
2. **上传预览专用接口**：使用 `/api/uploads/preview` 预览上传文件，不走下载接口
3. **下载路径白名单**：下载接口 `/api/download` 仅允许 `output`、`output-ui`、`output-verify`、`output-fixed` 等输出目录
4. **API 路径白名单**：`inputPath` 仅允许 `uploads/`、`samples/` 目录下的文件，以及项目根目录下的 `.json` 文件
5. **路径遍历防护**：禁止 `../`、null 字节、符号链接越权等
6. **SSRF 防护**：阻止对 localhost、私有 IP（10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、169.254.0.0/16）、IPv6 内网地址（::1、fc00::/7）的请求
7. **重定向 SSRF 检查**：跟随重定向后仍会重新检查目标地址
8. **Header 白名单**：自动过滤 Host、Content-Length、Connection、Cookie、Authorization、X-Forwarded-For 等危险 Header
9. **不执行 JS**：本工具不会执行书源中的任何 JavaScript 代码
10. **错误信息安全**：错误信息不返回绝对路径和 stack trace
11. **CORS 限制**：仅允许 `127.0.0.1:5173`、`localhost:5173`、`127.0.0.1:5178`、`localhost:5178` 跨域访问
12. **速率限制**：100 请求/分钟
13. **本地运行**：默认监听 `127.0.0.1`，仅本地可访问
14. **公网安全**：如开放到局域网或公网，需要自行增加认证、访问控制和反向代理安全配置

---

## 项目结构

```
legado-source-toolkit/
├── src/                         后端、CLI 和核心处理逻辑
│   ├── cli.ts                   CLI 入口（commander）
│   ├── index.ts                 公共 API 导出
│   ├── core/                    核心处理模块
│   │   ├── process.ts           主处理管道
│   │   ├── parse.ts             文件解析
│   │   ├── clean-name.ts        名称清洗
│   │   ├── normalize-url.ts     URL 规范化
│   │   ├── classify.ts          自动分类
│   │   ├── validate-structure.ts 结构校验
│   │   ├── validate-online.ts   在线连通性验证（SSRF 防护）
│   │   ├── validate-search.ts   搜索验证
│   │   ├── score.ts             质量评分
│   │   ├── dedupe.ts            去重
│   │   ├── split.ts             分类拆分
│   │   ├── consistency.ts       一致性验收
│   │   └── schema.ts            Zod 校验
│   ├── server/                  后端 API 服务（Fastify）
│   │   ├── app.ts               Fastify 入口
│   │   ├── routes/              API 路由
│   │   ├── services/            服务（任务存储、上传存储、安全路径）
│   │   └── security/            安全边界
│   ├── constants/               常量和默认配置
│   ├── types/                   TypeScript 类型定义
│   └── utils/                   工具函数（文件、CSV、HTML 报告等）
├── web/                         React Web UI
│   ├── App.tsx                  应用入口 + 页面路由
│   ├── pages/                   页面组件（11 个页面）
│   ├── components/              可复用组件
│   ├── store/                   全局状态管理
│   └── lib/                     API 客户端和类型
├── samples/                     示例输入文件
├── tests/                       测试文件
├── docs/                        补充文档
├── .github/workflows/           CI 配置
├── start-ui.bat                 Windows 一键启动脚本
├── package.json                 项目配置
├── tsconfig.json                后端 TypeScript 配置
├── tsconfig.web.json            前端 TypeScript 配置
├── vite.config.ts               Vite 配置
├── vitest.config.ts             测试配置
├── eslint.config.js             ESLint 配置
├── .gitignore                   版本忽略规则
├── .env.example                 环境变量示例
└── LICENSE                      MIT 许可证
```

---

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 运行 CLI（开发模式）
pnpm gui              # 启动 Web GUI 后端 API
pnpm web:dev          # 启动前端开发服务器
pnpm typecheck        # TypeScript 类型检查（后端）
pnpm web:typecheck    # TypeScript 类型检查（前端）
pnpm lint             # ESLint 代码规范检查
pnpm build            # 构建后端 CLI（tsc）
pnpm web:build        # 构建前端（vite build）
pnpm test             # 运行测试（vitest run）
pnpm verify           # 完整验证（typecheck + web:typecheck + lint + build + web:build + test）
pnpm clean            # 清理构建产物（dist、dist-web、coverage、uploads、output-*）
```

---

## 构建方法

```bash
# 构建后端 CLI
pnpm build

# 构建前端 Web UI
pnpm web:build
```

构建完成后：
- 后端 CLI 产物位于 `dist/` 目录
- 前端 Web UI 产物位于 `dist-web/` 目录

构建后可以使用 `pnpm start` 或 `pnpm cli` 直接运行编译后的 CLI。

---

## 测试与验证

```bash
# 完整验证（推荐推送代码前执行）
pnpm verify
```

`pnpm verify` 按顺序执行以下 6 项检查：

1. `pnpm typecheck` —— TypeScript 类型检查（`tsc --noEmit`）
2. `pnpm web:typecheck` —— 前端 TypeScript 类型检查（`tsc -p tsconfig.web.json --noEmit`）
3. `pnpm lint` —— ESLint 代码规范检查（检查 `src/`、`tests/`、`web/`）
4. `pnpm build` —— TypeScript 编译构建（`tsc`）
5. `pnpm web:build` —— Vite 前端生产构建（`vite build`）
6. `pnpm test` —— 运行全部测试（`vitest run`）

GitHub Actions CI 会自动执行：typecheck → lint → build → web:build → test。

---

## 常见问题

**Q: 为什么打开 5178 看到"Web UI 尚未构建"？**
A: 说明你打开的是后端 API 地址（端口 5178），而前端页面尚未构建或未启动。建议使用开发模式：先运行 `pnpm gui` 启动后端，再运行 `pnpm web:dev` 启动前端，然后访问 `http://127.0.0.1:5173`。

**Q: 应该打开 5173 还是 5178？**
A: 主 Web UI 地址是 `http://127.0.0.1:5173`（前端开发服务器）。5178 是后端 API 地址，仅在 API 调试时需要直接访问。

**Q: 为什么在线验证很慢？**
A: 在线验证会对每个书源的 URL 发起 HTTP 请求。几百个源可能需要几分钟到十几分钟。可以降低并发数、减少超时时间，或跳过在线验证（使用 `--no-online` / 不勾选"在线验证"）。

**Q: 为什么某些书源被判不可用？**
A: 可能的原因：网站已下线、屏蔽了非浏览器 UA、触发了限流、需要登录、存在地区访问限制、DNS 解析失败等。这并不代表书源本身无效，只是在本工具当前运行环境下无法验证。

**Q: 为什么上传文件不能通过下载接口下载？**
A: 安全设计使然。上传文件使用 `/api/uploads/preview` 预览，下载接口仅允许输出目录。这是为了防止未授权访问上传数据。

**Q: 为什么结果页面没有数据？**
A: 需要先运行一次处理流程。处理完成后，结果会自动出现在"结果查看"页面。如果还是看不到，检查输出目录是否以 `output` 开头。

**Q: 这个工具会不会执行书源里的 JS？**
A: **不会。** 本工具不会执行书源中的任何 JavaScript 代码（包括 `ruleContent.webJs`、`loginCheckJs`、`jsLib` 等字段）。

**Q: 可以部署到公网吗？**
A: 理论上可以，但**不推荐**。本工具默认无认证和访问控制，仅监听 `127.0.0.1`。如需公网访问，请自行配置反向代理、HTTPS、认证等安全措施。

**Q: 输出文件哪个可以导入 Legado？**
A: `cleaned-sources.json` 是经过清洗、分类、去重后的最终书源列表，适合导入 Legado 阅读 App。按分类拆分的 `groups/*.json` 文件也可以单独导入。

**Q: 默认并发是多少？**
A: 默认并发数为 **16**。可以使用 `--concurrency` 参数调整。

---

## 路线图

- [x] 名称清洗 + URL 规范化
- [x] 自动分类 + 结构校验
- [x] 在线连通性与搜索验证（SSRF 防护）
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

1. **本工具仅用于处理用户自有或有权处理的 Legado 书源 JSON 文件。** 用户应只处理自己有权使用、保存和验证的书源文件。
2. **本工具不提供、托管、分发任何小说内容。** 所有操作均针对书源元数据（URL、规则等），不涉及实际内容。
3. **本工具不保证第三方站点可用。** 在线验证结果受网络状况、目标站点限流、地区访问限制等因素影响。
4. **用户应自行遵守所在地法律法规和目标网站的服务条款。** 使用在线验证功能会向书源中配置的目标网站发起网络请求。
5. **请勿用于侵权、绕过访问控制或滥用第三方服务。** 本工具仅用于合法的书源管理和维护。
6. **本工具按"现状"提供，不提供任何明示或暗示的保证。** 详见 [LICENSE](./LICENSE) 文件。

---

## License

MIT License — 详见 [LICENSE](./LICENSE) 文件。

---

*Legado Source Toolkit v1.2.0 — Built with TypeScript, Fastify, React, and Vite*
