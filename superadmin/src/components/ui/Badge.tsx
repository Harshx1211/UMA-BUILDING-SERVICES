type BadgeProps = { value: string | null | undefined };

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; dot?: string }> = {
  // Job statuses
  scheduled:    { label: 'Scheduled',    bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', dot: '#3b82f6' },
  in_progress:  { label: 'In Progress',  bg: 'rgba(249,115,22,0.15)', color: '#fb923c', dot: '#F97316' },
  completed:    { label: 'Completed',    bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  cancelled:    { label: 'Cancelled',    bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b' },
  // Defect statuses
  open:         { label: 'Open',         bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
  quoted:       { label: 'Quoted',       bg: 'rgba(168,85,247,0.15)', color: '#c084fc', dot: '#a855f7' },
  repaired:     { label: 'Repaired',     bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  monitoring:   { label: 'Monitoring',   bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b' },
  // Severity
  critical:     { label: 'Critical',     bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
  major:        { label: 'Major',        bg: 'rgba(249,115,22,0.15)', color: '#fb923c', dot: '#f97316' },
  minor:        { label: 'Minor',        bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b' },
  // Compliance
  compliant:     { label: 'Compliant',    bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  non_compliant: { label: 'Non-Compliant',bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
  overdue:       { label: 'Overdue',      bg: 'rgba(249,115,22,0.15)', color: '#fb923c', dot: '#f97316' },
  pending:       { label: 'Pending',      bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b' },
  // Quote
  draft:         { label: 'Draft',        bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b' },
  approved:      { label: 'Approved',     bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  rejected:      { label: 'Rejected',     bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
  // Asset
  active:        { label: 'Active',       bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  decommissioned:{ label: 'Decommissioned',bg:'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b' },
  // Priority
  urgent:        { label: 'Urgent',       bg: 'rgba(239,68,68,0.15)', color: '#f87171', dot: '#ef4444' },
  high:          { label: 'High',         bg: 'rgba(249,115,22,0.15)', color: '#fb923c', dot: '#f97316' },
  normal:        { label: 'Normal',       bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', dot: '#3b82f6' },
  low:           { label: 'Low',          bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b' },
  // Enquiry statuses
  new:           { label: 'New',          bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', dot: '#3b82f6' },
  contacted:     { label: 'Contacted',    bg: 'rgba(249,115,22,0.15)', color: '#fb923c', dot: '#F97316' },
  converted:     { label: 'Converted',   bg: 'rgba(34,197,94,0.15)', color: '#4ade80', dot: '#22c55e' },
  closed:        { label: 'Closed',       bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b' },
};

export default function Badge({ value }: BadgeProps) {
  if (!value) return null;
  const key = value.toLowerCase().replace(/ /g, '_');
  const map = STATUS_MAP[key] ?? {
    label: value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', dot: '#64748b',
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
