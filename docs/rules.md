# 书源规则说明

## 核心概念

阅读 App 通过 **规则 (Rules)** 从网页提取结构化数据。每条书源包含多组规则。

## 规则字段

### ruleSearch — 搜索规则
定义如何搜索书籍：
- `bookList` — 搜索结果列表的 CSS 选择器
- `name` — 书名的 CSS 选择器
- `author` — 作者的 CSS 选择器
- `kind` — 分类的选择器
- `wordCount` — 字数的选择器
- `lastChapter` — 最新章节的选择器
- `intro` — 简介的选择器
- `coverUrl` — 封面的选择器
- `bookUrl` — 书籍详情链接的选择器
- `checkKeyWord` — 搜索验证关键词

### ruleBookInfo — 书籍详情规则
- `name`, `author`, `kind`, `wordCount`, `lastChapter`, `intro`, `coverUrl`, `tocUrl`

### ruleToc — 目录规则
- `chapterList` — 章节列表选择器
- `chapterName` — 章节名选择器
- `chapterUrl` — 章节链接选择器
- `isVolume` — 是否分卷

### ruleContent — 正文规则
- `content` — 正文内容选择器
- `nextContentUrl` — 下一页链接选择器
- `sourceRegex` — 源内容替换正则
- `webJs` — 页面级 JS
- `imageStyle` — 图片样式

## 特殊取属性语法

| 语法 | 含义 |
|------|------|
| `@text` | 获取元素文本内容 |
| `@textNodes` | 获取所有文本节点 |
| `@href` | 获取 `href` 属性 |
| `@src` | 获取 `src` 属性 |
| `@content` | 获取 `content` 属性 |
| `@html` | 获取内部 HTML |
| `@innerHtml` | 获取内部 HTML（含标签）|
| `@tag` | 获取标签名 |

## JS 表达式

- `<js>...</js>` — 内嵌 JavaScript 表达式
- `@js:...` — JS 简写
- `java.ajax(url)` — 发起 AJAX 请求
- `baseUrl` — 当前书源 URL
- `result` — 上一个规则的结果
- `cookie` / `cache` — Cookie 和缓存操作

> ⚠️ **本工具不执行 JS 表达式**，仅检测并标记为 `complex_unverified`。

## 去重规则说明

本工具支持 4 级去重：

| 级别 | 规则 | 适用场景 |
|------|------|----------|
| `none` | 不去重 | 保留所有源，仅清洗分类 |
| `exact` | `bookSourceUrl` 完全相同 | 精确去重 |
| `url` | 规范化 URL 相同（去协议差异/尾部斜杠） | 常规去重 |
| `host` | 相同 host（去 www/m/wap 前缀） | **推荐默认值** |
| `aggressive` | 相同 host + 清洗后名称 | 激进去重，可能过度 |

对于非 HTTP 源（自定义标识 URL），host/aggressive 级别会使用 `非HTTP:TYPE:NAME` 分组，防止误伤。
