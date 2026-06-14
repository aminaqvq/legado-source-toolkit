# Online Validation Limitations

## Overview

The `--online` flag enables HTTP connectivity and search validation. While useful, it has inherent limitations:

## Connectivity Checks

- Only the root URL (`bookSourceUrl`) is probed
- A 200/301/302 is treated as "OK" — the server may still return garbage
- 403 (Forbidden) is marked as `forbidden`, not `dead` — some sites block non-browser UAs
- 404/410 are the only codes treated as `dead`
- Timeouts (> configured ms) are marked as `timeout`
- DNS failures and connection errors are marked as `unknown`, not `dead`

## Search Validation

- Only one keyword per category is tested; may miss search bugs
- Complex JavaScript patterns (`<js>`, `@js:`, `java.ajax`, `eval`, `WebView`) are **skipped** (never executed)
- `SEARCH_RULE_LIKELY_OK` indicates the request succeeded but response analysis is heuristic

## False Positives

| Scenario | Result | Why |
|----------|--------|-----|
| Site down temporarily | `dead` | Always re-check later |
| CDN / WAF blocks datacenter IP | `forbidden` or `timeout` | Try from a residential IP |
| Non-standard search response | `SEARCH_FAILED` | Rule may still work in-app |
| Complex JS required | `SEARCH_COMPLEX_JS_SKIPPED` | Source may be perfectly usable |

## Non-HTTP Sources

Sources with non-HTTP `bookSourceUrl` (custom identifiers) are marked as `NON_HTTP_SOURCE` and given `complex_unverified` availability. They receive a different deduplication key to prevent false grouping.

## Recommendations

1. Run `--online` periodically (not just once) to catch transient failures
2. Review `forbidden` sources manually — they often work with app's WebView
3. `complex_unverified` sources may be fine; test in-app
4. Use `--concurrency 3` for conservative checking to avoid rate-limiting

---

## Single Source Lab Limitations (v1.5)

The Single Source Lab (`verifyAllRules` / Web GUI "单源调试") provides deeper validation than `--online`, but still has important limitations:

### Unsupported Runtime Features

| Feature | Status | Why |
|---------|--------|-----|
| **`webView:true`** | Not supported | Requires Android WebView to render JS-rendered pages; no Node.js equivalent available |
| **`java.ajax`** | Blocked by default | Opens arbitrary HTTP connections from within JS rules; security risk in automated tools |
| **`java.getCookie`** | Not supported | Requires browser session state / cookie jar |
| **`java.put` / `java.get`** | Partially supported | `@put` / `@get` variable mapping works; `java.put` / `java.get` in JS blocks are not executed |
| **`Packages.*` imports** | Not supported | Requires Android JVM classpath (e.g., `Packages.java.security`) |
| **Rhino engine** | Not simulated | Node.js uses `vm.Script` sandbox with limited globals; many Legado-specific Rhino APIs are absent |

### Unsupported Network Behavior

| Scenario | Handling |
|----------|----------|
| **Cloudflare / CAPTCHA** | Detected and reported as `cloudflare_detected`; no bypass attempted |
| **Login-gated content** | Detected via error page patterns; reported as `needs_login` or `empty_response` |
| **Dynamic JS-rendered content** | Not accessible — page must be server-rendered HTML or pure JSON API |
| **Rate limiting (HTTP 429)** | Detected as `http_timeout` or `network_error` depending on status code |

### Not Implemented Yet

- **Browser Runner**: full Playwright/Puppeteer integration for JS-rendered pages
- **Android Runner**: running rules inside the actual Android Legado runtime
- **Login session manager**: automated cookie / token management for protected sources
- **Full Rhino compatibility mode**: safe emulation of all Legado Java APIs

### What Works Well

- Simple HTML sources with CSS/XPath/JSONPath rules
- JSON API sources with JSONPath selectors
- `selector@href` / `@text` scoped pipeline patterns
- POST search requests
- Redirect chains with SSRF protection
- Content length validation (detecting too-short responses)
- Structured error classification and suggestions
