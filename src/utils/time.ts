/**
 * Format a date for display, handling both number timestamps and date strings.
 */
export function formatDate(input: number | string | null | undefined): string {
  if (input == null) return 'N/A';
  if (typeof input === 'string' && input === '') return 'N/A';

  const date = typeof input === 'number' ? new Date(input) : new Date(input);
  if (isNaN(date.getTime())) return String(input);

  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Calculate time ago string from a timestamp (in ms).
 */
export function timeAgo(timestamp: number | null | undefined): string {
  if (timestamp == null || timestamp <= 0) return '未知';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 365) return `${Math.floor(days / 365)}年前`;
  if (days > 30) return `${Math.floor(days / 30)}个月前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

/**
 * Check if a timestamp is considered "old" (> 365 days).
 */
export function isOldTimestamp(timestamp: number | null | undefined): boolean {
  if (timestamp == null || timestamp <= 0) return true;
  const diff = Date.now() - timestamp;
  return diff > 365 * 24 * 60 * 60 * 1000;
}
