type BadgeProps = { value: string | null | undefined };

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; dot?: string }> = {
  // Job statuses
  scheduled:    { label: 'Scheduled',    bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
  in_progress:  { label: 'In Progress',  bg: '#fff7ed', color: '#c2410c', dot: '#F97316' },
  completed:    { label: 'Completed',    bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  cancelled:    { label: 'Cancelled',    bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
  // Defect statuses
  open:         { label: 'Open',         bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  quoted:       { label: 'Quoted',       bg: '#faf5ff', color: '#7e22ce', dot: '#a855f7' },
  repaired:     { label: 'Repaired',     bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  monitoring:   { label: 'Monitoring',   bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  // Severity
  critical:     { label: 'Critical',     bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  major:        { label: 'Major',        bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  minor:        { label: 'Minor',        bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  // Compliance
  compliant:     { label: 'Compliant',    bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  non_compliant: { label: 'Non-Compliant',bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  overdue:       { label: 'Overdue',      bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  pending:       { label: 'Pending',      bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
  // Quote
  draft:         { label: 'Draft',        bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  approved:      { label: 'Approved',     bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  rejected:      { label: 'Rejected',     bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  // Asset
  active:        { label: 'Active',       bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  decommissioned:{ label: 'Decommissioned',bg:'#f8fafc', color: '#64748b', dot: '#94a3b8' },
  // Priority
  urgent:        { label: 'Urgent',       bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  high:          { label: 'High',         bg: '#fff7ed', color: '#c2410c', dot: '#f97316' },
  normal:        { label: 'Normal',       bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  low:           { label: 'Low',          bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
};

export default function Badge({ value }: BadgeProps) {
  if (!value) return null;
  const key = value.toLowerCase().replace(/ /g, '_');
  const map = STATUS_MAP[key] ?? {
    label: value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    bg: '#f1f5f9', color: '#475569', dot: '#94a3b8',
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-semibold whitespace-nowrap"
      style={{
        background: map.bg,
        color: map.color,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11.5,
        lineHeight: 1.65,
        letterSpacing: '0.01em',
      }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: map.dot ?? map.color }} />
      {map.label}
    </span>
  );
}
