import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: 'orange' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'teal';
  change?: string;
  changeDir?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  delay?: number;
}

const COLOR_MAP = {
  orange: {
    iconBg: 'linear-gradient(135deg,#ff9a3c,#F97316)',
    glow: 'rgba(249,115,22,0.25)',
    accent: '#F97316',
    light: '#fff7ed',
  },
  blue: {
    iconBg: 'linear-gradient(135deg,#60a5fa,#3b82f6)',
    glow: 'rgba(59,130,246,0.22)',
    accent: '#3b82f6',
    light: '#eff6ff',
  },
  green: {
    iconBg: 'linear-gradient(135deg,#4ade80,#22c55e)',
    glow: 'rgba(34,197,94,0.22)',
    accent: '#22c55e',
    light: '#f0fdf4',
  },
  red: {
    iconBg: 'linear-gradient(135deg,#f87171,#ef4444)',
    glow: 'rgba(239,68,68,0.22)',
    accent: '#ef4444',
    light: '#fef2f2',
  },
  yellow: {
    iconBg: 'linear-gradient(135deg,#fcd34d,#f59e0b)',
    glow: 'rgba(245,158,11,0.22)',
    accent: '#f59e0b',
    light: '#fffbeb',
  },
  purple: {
    iconBg: 'linear-gradient(135deg,#c084fc,#a855f7)',
    glow: 'rgba(168,85,247,0.22)',
    accent: '#a855f7',
    light: '#faf5ff',
  },
  teal: {
    iconBg: 'linear-gradient(135deg,#2dd4bf,#14b8a6)',
    glow: 'rgba(20,184,166,0.22)',
    accent: '#14b8a6',
    light: '#f0fdfa',
  },
};

export default function StatCard({
  label, value, icon: Icon, color,
  change, changeDir = 'neutral', subtitle, delay = 0,
}: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div
      className="group relative bg-white rounded-2xl p-5 border overflow-hidden animate-fade-in-up hover:shadow-lg transition-all duration-300 cursor-default"
      style={{
        borderColor: 'var(--border)',
        animationDelay: `${delay}ms`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: c.iconBg }} />

      {/* Soft background glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top left, ${c.glow} 0%, transparent 65%)` }} />

      <div className="relative flex items-start justify-between mb-4">
        {/* Icon with gradient background */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.iconBg, boxShadow: `0 4px 12px ${c.glow}` }}>
          <Icon size={19} color="white" strokeWidth={2} />
        </div>

        {/* Change badge */}
        {change && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: changeDir === 'up' ? '#f0fdf4' : changeDir === 'down' ? '#fef2f2' : '#f8fafc',
              color: changeDir === 'up' ? '#16a34a' : changeDir === 'down' ? '#dc2626' : '#64748b',
            }}>
            {changeDir === 'up' ? <TrendingUp size={11} /> : changeDir === 'down' ? <TrendingDown size={11} /> : <Minus size={11} />}
            {change}
          </div>
        )}
      </div>

      <div className="relative">
        <p className="text-[28px] font-extrabold leading-none mb-1"
          style={{ color: 'var(--text)', letterSpacing: '-0.045em' }}>
          {value}
        </p>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        {subtitle && (
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.accent }} />
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
