import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}
export default function EmptyState({ icon, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--bg)' }}>
          {icon}
        </div>
      )}
      <p className="font-semibold text-base" style={{ color: 'var(--text)' }}>{title}</p>
      {subtitle && <p className="text-sm mt-1.5 max-w-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
