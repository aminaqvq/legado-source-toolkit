# 规则引擎设计文档 — Phase 1

## 1. 概述

本规则引擎将 Legado（开源阅读）的书源规则系统移植到 TypeScript/Node.js 环境,
使得 LS-Toolkit 能够**实际执行书源规则**而不仅仅是检查 HTTP 可达性。

### 目标

- 解析 Legado 书源规则字符串为可执行的规则管道 (RulePipeline)
- 支持 4 种选择器模式: CSS (Jsoup), JSONPath, XPath, 正则
- 支持 JS 沙箱执行 `{{js表达式}}`
- 支持 URL 模板解析: `{{key}}`, `{{page}}`, `url,{method,body,headers}`
- 支持逻辑组合: `&&`(与), `||`(或), `%%`(交叉合并)
- 支持替换规则: `##pattern##replacement##`
- 支持结果后处理: `@text`, `@href`, `@tag:xxx`, `!index`, 转义

## 2. 架构图

```
┌─────────────┐
│  规则字符串   │  e.g. "class.bookList@tag:li!0@@tag:a@text"
└──────┬──────┘
       │
       ▼
┌──────────────┐     ┌─────────────────────────────┐
│  rule-parser  │ ──▶ │        RulePipeline          │
│ (分词 + 模式   │     │ [RuleSegment, RuleSegment..] │
│  识别)        │     │ 每个: { mode, rule,          │
└──────────────┘     │         replaceRegex, ... }  │
                     └────────────┬────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌────────────────┐       ┌────────────────┐
│ CSS Selector   │       │  JSONPath       │       │   XPath         │
│ (cheerio)      │       │  (jsonpath-plus)│       │   (xpath+dom)   │
├───────────────┤       ├────────────────┤       ├────────────────┤
│ .class, #id,  │       │ $.store.book   │       │ /html/body/div  │
│ tag, [attr],  │       │ $..author      │       │ //div[@class]   │
│ :contains()   │       │ $[0].title     │       │                 │
└───────────────┘       └────────────────┘       └────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │  Pipeline 执行器  │
                        │ (逐段链式输出)     │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  最终结果         │
                        │ (string | list)  │
                        └─────────────────┘
```

## 3. 核心类型 (`types.ts`)

### 3.1 选择器模式

```typescript
export type SelectorMode = 'css' | 'jsonpath' | 'xpath' | 'regex' | 'js' | 'text';
```

### 3.2 规则段

```typescript
export interface RuleSegment {
  /** 选择器模式 */
  mode: SelectorMode;
  /** 原始规则文本（去掉前缀标记后的） */
  rule: string;
  /** 替换正则 ##pattern##replacement## */
  replaceRegex?: string;
  replacement?: string;
  replaceFirst?: boolean;
  /** @get:key 引用变量 */
  getVariable?: string;
  /** putMap 键值对 */
  putMap?: Record<string, string>;
}

export type RulePipeline = RuleSegment[];
```

### 3.3 逻辑组合

```typescript
export type LogicOp = '&&' | '||' | '%%';

export interface RuleGroup {
  pipeline: RulePipeline;
  logicOp: LogicOp;
}
```

### 3.4 执行选项

```typescript
export interface RuleExecuteOptions {
  /** 当前页面内容（HTML/JSON 字符串） */
  content: string;
  /** base URL 用于解析相对路径 */
  baseUrl?: string;
  /** 搜索关键词 */
  key?: string;
  /** 页码 */
  page?: number;
  /** 书源 headers */
  headers?: Record<string, string>;
  /** JS 沙箱额外上下文 */
  jsContext?: Record<string, unknown>;
  /** JS 执行超时 ms */
  jsTimeout?: number;
}
```

### 3.5 执行结果

```typescript
export interface RuleResult {
  /** 提取的字符串（单值模式） */
  text: string | null;
  /** 提取的字符串列表（列表模式） */
  list: string[];
  /** 提取的原始对象列表 */
  elements: unknown[];
  /** 执行耗时 ms */
  duration: number;
  /** 每步执行日志 */
  logs: string[];
}
```

## 4. 规则解析器 (`rule-parser.ts`)

### 输入 → 输出

```
输入: "class.bookList@tag:li!0@@tag:a@text"
输出:
[
  { mode: 'css',    rule: '.bookList' },
  { mode: 'css',    rule: 'li' },
  { mode: 'text',   rule: '!0' },       // 取索引 0
  { mode: 'css',    rule: 'a' },
  { mode: 'text',   rule: '@text' },     // 获取文本
]
```

### 解析步骤

1. **预处理**: 处理 `@@` 双 at 标记 → 分隔列表中的每个元素
2. **模式检测** (对每个 `@` 分段):

| 规则前缀/模式 | 检测逻辑 | 对应 Mode |
|-------------|---------|----------|
| `@@` | 双 at → 拆到下一个元素列表 | - |
| `@CSS:` | 大小写不敏感前缀 | `css` |
| `@XPath:` | 大小写不敏感前缀 | `xpath` |
| `@Json:` | 大小写不敏感前缀 | `jsonpath` |
| `$.` 或 `$[` | JSONPath 特征开头 | `jsonpath` |
| `/` 开头 | XPath 特征 | `xpath` |
| `{{...}}` | JS 表达式 | `js` |
| `##...##` | 替换规则 | `regex` (实际是替换操作符) |
| `@get:key` | 变量引用 | 根据变量内容决定 |
| `!数字` | 索引选择器 | `text` |
| `@text` / `@href` / `@html` / `@tag:xxx` | 属性/文本获取器 | `css` 模式下的后处理 |
| 其他 | 默认 CSS 选择器 | `css` |

3. **替换规则分离**: 从规则文本中提取 `##pattern##replacement##flags##`

### 逻辑组合解析

```
"ruleA && ruleB || ruleC %% ruleD"
→ [{pipeline: [ruleA], logicOp: '&&'},
   {pipeline: [ruleB], logicOp: '||'},
   {pipeline: [ruleC], logicOp: '%%'},
   {pipeline: [ruleD], logicOp: null}]
```

`&&` = 合并两个列表
`||` = 第一个非空结果即返回
`%%` = 按索引交叉合并

## 5. CSS 选择器 (`selector-css.ts`)

使用 `cheerio` 实现 Jsoup 风格的 CSS 选择。

### 支持的选择器

| 类型 | 示例 | 说明 |
|------|------|------|
| CSS 类 | `.bookName` | class 选择 |
| ID | `#content` | id 选择 |
| 标签 | `div`, `li` | 标签选择 |
| 属性 | `[class=book]`, `[href]` | 属性选择 |
| 伪类 | `:contains(斗破)` | 包含文本 |
| 组合 | `ul.list > li`, `div + span` | 关系选择 |
| 多类 | `.list.class2` | 多类交集 |
| 属性/文本获取 | `@text`, `@href`, `@html`, `@tag:a` | 后处理 |

### 特殊后处理器

| 指令 | 功能 | 说明 |
|------|------|------|
| `@text` | 获取文本 | `element.text()` |
| `@href` | 获取 href | `element.attr('href')` |
| `@src` | 获取图片地址 | `element.attr('src')` |
| `@html` | 获取内部 HTML | `element.html()` |
| `@outerHtml` | 获取外部 HTML | `$.html(element)` |
| `@tag:xxx` | 获取标签内的 xxx 子元素 | 与 CSS 选择器等价 |
| `@val` | 获取 value | `element.val()` |
| `!n` | 取第 n 个索引 | 从 0 开始 |
| `-n` | 倒数第 n 个 | 从 -1 开始 |

## 6. JSONPath 选择器 (`selector-jsonpath.ts`)

使用 `jsonpath-plus` 包。

### 支持的路径

| 路径 | 说明 |
|------|------|
| `$.store.book` | 根路径下的 store.book |
| `$..author` | 递归查找所有 author |
| `$[0].title` | 数组第一个元素的 title |
| `$.store.book[?(@.price<10)]` | 带过滤条件 |
| `{$.rule}` | 内嵌 JSONPath（从字符串中提取） |

## 7. XPath 选择器 (`selector-xpath.ts`)

使用 `xpath` + `xmldom` 包。

### 自动修复

- 遇到 `</td>` 结尾自动包裹 `<tr>...</tr>`
- 遇到 `</tr>` 结尾自动包裹 `<table>...</table>`

## 8. JS 沙箱 (`sandbox.ts`)

使用 Node.js `vm` 模块创建隔离上下文。

### 安全措施

- 使用 `vm.Script` + `vm.createContext` 创建隔离执行环境
- 限制可用全局对象: 仅暴露 `Math`, `JSON`, `Array`, `String`, `Object`, `RegExp`
- 执行超时: 默认 5 秒，可配置
- **不暴露** `require`, `process`, `global`, `Buffer`, `setTimeout` 等

### 扩展 API（模拟 Legado 的 JsExtensions）

| 方法 | 说明 |
|------|------|
| `java.ajax(url)` | 发送 HTTP GET 请求 (通过 fetch) |
| `java.base64Decode(str)` | Base64 解码 |
| `result.text()` | 当前上下文的文本 |
| `result.html()` | 当前上下文的 HTML |
| `baseUrl` | 当前 base URL |
| `key` | 搜索关键词 |

## 9. URL 解析器 (`url-resolver.ts`)

### 支持的模板格式

```
// 搜索 URL 模板
"{{key}}" / "{{keyword}}"
  → 替换为 URL 编码后的搜索词
  
"{{page}}"
  → 替换为页码

"{{source.bookSourceUrl}}"
  → 替换为书源 URL

"{{js(...)}}" / "@js:..."
  → 执行 JS 表达式

"<page1,page2,page3>"
  → 按页码索引替换

"url,{method:'POST',body:'...'}"
  → 解析为 {url, method, body, headers}
  
"search?keyword={{key}}&page={{page}}"
  → 完整替换后的 URL
```

### 处理步骤

1. 检测 `url,{...}` 格式 → 提取 method/body/headers
2. 检测 JS 模式 `{{...}}` → 执行并替换
3. 替换 `{{key}}`/`{{keyword}}`/`{{page}}`/`{{source.bookSourceUrl}}`
4. 处理 `<page1,page2>` 页数占位
5. 解析相对 URL 为绝对 URL
6. 返回 `{ url, method, body?, headers? }`

## 10. 管道执行器 (`executor.ts`)

### 执行流程

```
1. 解析完整规则字符串为 RuleGroup[]
2. 对每个 RuleGroup:
   a. 对 RulePipeline 中的每个 RuleSegment:
      - 如果 mode='js': 在 JS 沙箱中执行
      - 如果 mode='css': 在 cheerio 中执行选择器
      - 如果 mode='jsonpath': 在 JSONPath 中解析
      - 如果 mode='xpath': 在 XPath 中解析
      - 如果 mode='regex': 执行正则替换
      - 如果 mode='text': 执行索引/文本获取
      - 应用 replaceRegex 替换
   b. 根据 LogicOp 合并/短路
3. 返回最终结果
```

### 特殊处理

- `@@` 分隔符: 将前一条规则的结果作为基础，对每个元素逐条应用后线规则
  - `class.book@@tag:a`: 先选 `.book` 元素，在每个元素内选 `a` 标签
- `!n` 索引: 如果当前结果是列表，取第 n 个元素作为后续的上下文
- 隐式正则: 如果规则字符串包含 `$1`/`$2` 引用，自动切换为 regex 模式

## 11. 集成计划

### 安装依赖

```bash
pnpm add cheerio jsonpath-plus xpath xmldom
```

### 文件修改清单

| 文件 | 操作 |
|------|------|
| `src/core/rule-engine/types.ts` | 新建 |
| `src/core/rule-engine/rule-parser.ts` | 新建 |
| `src/core/rule-engine/selector-css.ts` | 新建 |
| `src/core/rule-engine/selector-jsonpath.ts` | 新建 |
| `src/core/rule-engine/selector-xpath.ts` | 新建 |
| `src/core/rule-engine/selector-regex.ts` | 新建 |
| `src/core/rule-engine/sandbox.ts` | 新建 |
| `src/core/rule-engine/url-resolver.ts` | 新建 |
| `src/core/rule-engine/executor.ts` | 新建 |
| `src/core/rule-engine/index.ts` | 新建 |
| `tests/unit/rule-engine/` | 测试目录 |
| `src/types/book-source.ts` | 扩展 `RuleVerifyStatus` 类型 |
| `src/types/analysis.ts` | 扩展 `SourceAnalysis` 字段 |
| `package.json` | 添加依赖 |

## 12. 测试策略

| 测试场景 | 输入 | 预期 |
|---------|------|------|
| CSS 选择 | `.bookName@text` | 提取书名文本 |
| JSONPath | `$.data.list` | 提取 JSON 数组 |
| XPath | `//div[@class='book']` | 提取 div 列表 |
| 逻辑 OR | `ruleA || ruleB` | ruleA 为空时用 ruleB |
| JS 内嵌 | `{{key.toUpperCase()}}` | 转为大写 |
| URL 模板 | `search?q={{key}}&p={{page}}` | 正确替换 |
| 索引选择 | `class.list!0@tag:a` | 取第一个元素 |
| 替换规则 | `##旧##新##` | 替换文本 |
| 空结果 | 不存在的选择器 | 返回空列表 |

## 13. 安全考虑

- JS 沙箱不暴露文件系统、网络、进程等 API
- 所有网络请求通过现有 `validate-online.ts` 的 SSRF 防护
- 响应体大小限制（复用现有的 256KB 限制）
- 执行超时防止无限循环
- Cheerio/XPath 解析有内存保护
