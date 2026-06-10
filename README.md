# Legado Source Toolkit

A local toolkit for cleaning, validating, classifying, and deduplicating [Legado (开源阅读)](https://github.com/gedoor/legado) book source JSON exports.

## Features

- **Name cleaning** — remove emoji, quality markers, maintainer suffixes
- **URL normalization** — HTTPS upgrade, strip www/m/wap prefixes
- **Classification** — multi-signal weighted voting (bookSourceType + keywords + rules + group)
- **Structure validation** — required field checks (name, URL, rules)
- **Online validation** — HTTP connectivity + search URL verification (opt-in)
- **Quality scoring** — +/- point system covering availability, rule completeness, performance
- **Deduplication** — 4 levels: exact URL, normalized URL, host, aggressive (host+name)
- **Output** — cleaned JSON, per-category splits, CSV reports, self-contained HTML report

## Quick Start

```bash
# Install dependencies
pnpm install

# Inspect a book source JSON
pnpm dev inspect bookSource.json

# Full offline processing
pnpm dev process bookSource.json --out ./output --no-online --dedupe conservative

# Full processing with online checks
pnpm dev process bookSource.json --out ./output --online --dedupe conservative --group-mode overwrite
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `process <input>` | Full pipeline: clean → classify → validate → dedupe → output |
| `inspect <input>` | Quick overview: counts, type/group distribution, duplicate hosts |
| `validate <input>` | Structure validation only |
| `clean-name <input>` | Name cleaning only |
| `split <input>` | Split by category only |

### Process Options

```
--online            Enable online connectivity & search checks
--dedupe <level>    none | exact | url | conservative (default) | host | aggressive
--group-mode <mode> overwrite (default) | append | report-only
--name-mode <mode>  loose (default) | zh-only
--concurrency <n>   Concurrent HTTP requests (default: 5)
--timeout <ms>      Request timeout in ms (default: 8000)
--retry <n>         Retry count (default: 1)
--dry-run           Run without writing files
--format <fmt>      pretty (default) | minified
```

## Project Structure

```
legado-source-toolkit/
├── src/
│   ├── cli.ts                 # CLI entry point (commander)
│   ├── index.ts               # Public API exports
│   ├── core/
│   │   ├── process.ts         # Main pipeline
│   │   ├── parse.ts           # JSON read + Zod validation
│   │   ├── clean-name.ts      # Name cleaning
│   │   ├── normalize-url.ts   # URL normalization
│   │   ├── classify.ts        # Multi-signal classification
│   │   ├── validate-structure.ts  # Structure checks
│   │   ├── validate-online.ts     # HTTP connectivity
│   │   ├── validate-search.ts     # Search URL verification
│   │   ├── score.ts           # Quality scoring
│   │   ├── dedupe.ts          # Deduplication (4 levels)
│   │   ├── split.ts           # Per-category output
│   │   └── schema.ts          # Zod schemas
│   ├── constants/
│   │   ├── keywords.ts        # Emoji patterns, category keywords
│   │   └── defaults.ts        # Default parameters, scoring weights
│   ├── types/
│   │   ├── book-source.ts     # BookSource + status enums
│   │   └── analysis.ts        # Analysis types, report types
│   └── utils/
│       ├── fs.ts              # File I/O
│       ├── logger.ts          # Console logging
│       ├── csv.ts             # CSV generation
│       ├── html-report.ts     # Self-contained HTML report
│       ├── safe-json.ts       # Safe JSON parse + header sanitize
│       └── time.ts            # Date formatting
├── tests/                     # Vitest tests
├── constants/                 # (legacy — moved to src/constants/)
├── cli.ts                     # (legacy — moved to src/cli.ts)
└── index.ts                   # (legacy — moved to src/index.ts)
```

## Scoring System

Bonuses: usability (+100), connectivity (+30), search (+30), rule completeness (+8–10 each), respond time (up to +20), recent updates (up to +20), weight (up to +10)

Penalties: dead (-100), invalid (-100), timeout (-30), forbidden (-10), missing rules (-20 each), complex JS (-5 to -15)

## Safety

- **No JavaScript execution** — `<js>` / `@js:` patterns are detected but never executed
- **No credentials** — HTTP headers are sanitized in output (passwords, API keys, cookies stripped)
- **Read-only by default** — input file is never modified

## Requirements

- Node.js >= 20.0.0
- pnpm (recommended) or npm

## License

MIT
