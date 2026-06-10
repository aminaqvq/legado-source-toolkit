interface Props { label: string; value: string | number; color?: string; icon?: string; subtitle?: string; }
export default function StatCard({ label, value, color, icon, subtitle }: Props) {
  const bg = color ? `var(--stat-${color}-bg, #f0fdf4)` : 'var(--card-bg)';
  const border = color ? `var(--stat-${color}-border, #10b981)` : 'var(--border)';
  return (
    <div className="stat-card" style={{ background: bg, borderColor: border }}>
      {icon && <span className="stat-icon">{icon}</span>}
      <strong>{value}</strong>
      <span>{label}</span>
      {subtitle && <small>{subtitle}</small>}
    </div>
  );
}
