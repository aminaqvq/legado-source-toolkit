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
