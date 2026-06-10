const COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#e0f2fe', text: '#0369a1' },
  medium: { bg: '#fef3c7', text: '#92400e' },
  high: { bg: '#fee2e2', text: '#991b1b' },
  critical: { bg: '#fecaca', text: '#7f1d1d' },
};
interface Props { level: string; }
export default function RiskBadge({ level }: Props) {
  const c = COLORS[level] || COLORS.low;
  return <span className="risk-badge" style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>{level}</span>;
}
