const STATUS_COLORS: Record<string, string> = {
  pass: 'green', ok: 'green', usable: 'green', 'STRUCTURE_OK': 'green', CONNECT_OK: 'green',
  SEARCH_HTTP_OK: 'green', SEARCH_PARSE_OK: 'green', 'high': 'green',
  success: 'green', running: 'green',

  warn: 'yellow', 'STRUCTURE_WARN': 'yellow', probably_usable: 'yellow', unknown: 'yellow',
  NOT_CHECKED: 'gray', SEARCH_UNVERIFIED: 'gray', medium: 'yellow',
  pending: 'gray', SEARCH_RULE_LIKELY_OK: 'yellow',

  complex_unverified: 'orange', risky: 'orange', conflict: 'orange',
  login_related: 'orange', needs_login: 'orange', 'SEARCH_TEMPLATE_COMPLEX': 'orange',

  fail: 'red', failed: 'red', dead: 'red', timeout: 'red', forbidden: 'red',
  invalid: 'red', 'STRUCTURE_INVALID': 'red', CONNECT_DEAD: 'red', CONNECT_TIMEOUT: 'red',
  CONNECT_ERROR: 'red', CONNECT_FORBIDDEN: 'red', SEARCH_FAILED: 'red',
  'SEARCH_SKIPPED_JS': 'orange', 'SEARCH_COMPLEX_JS_SKIPPED': 'orange',
  NON_HTTP_SOURCE: 'yellow', INVALID_URL: 'red', VALID_HTTP: 'green',
};

interface Props { status: string; size?: 'sm' | 'md'; }
export default function StatusBadge({ status, size = 'md' }: Props) {
  const color = STATUS_COLORS[status] || 'gray';
  const cls = `status-badge ${color} ${size}`;
  return <span className={cls}>{status}</span>;
}
