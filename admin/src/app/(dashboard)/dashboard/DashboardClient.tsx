'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Briefcase, Building2, ShieldAlert, Users,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight,
} from 'lucide-react';

import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatDate, timeAgo } from '@/lib/utils';
import Link from 'next/link';

const SEV_COLORS = { minor: '#f59e0b', major: 'var(--accent)', critical: '#ef4444' };

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; fill: string; value: string | number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--card)] rounded-xl border p-3 shadow-xl text-xs" style={{ borderColor: 'var(--border)' }}>
      <p className="font-bold mb-2" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}: </span>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export interface DashboardData {
  stats: {
    totalJobs: number; todayJobs: number; completedJobs: number; inProgressJobs: number;
    totalProperties: number; overdueProperties: number;
    openDefects: number; criticalDefects: number;
    activeTechs: number; pendingQuotes: number;
  };
  recentJobs: { id: string; property?: { name: string }; assigned_user?: { full_name: string }; scheduled_date: string; status: string }[];
  recentDefects: { id: string; severity: string; description: string; property?: { name: string }; created_at: string }[];
  defectSeverityData: { name: string; value: number }[];
  weeklyData: { day: string; scheduled: number; completed: number }[];
}

export default function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const { stats, recentJobs, recentDefects, defectSeverityData, weeklyData } = initialData;
  const completionRate = stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0;
  const loading = false; // Server rendered, data is already present

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Hero Banner ── */}
      <div className="relative rounded-2xl overflow-hidden p-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 60%, #1e3560 100%)', minHeight: 100 }}>
        {/* Decorative blobs */}
        <div className="absolute w-56 h-56 rounded-full -top-16 -right-8 opacity-10" style={{ background: 'var(--accent)' }} />
        <div className="absolute w-32 h-32 rounded-full -bottom-10 right-32 opacity-5" style={{ background: 'var(--accent)' }} />
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Overview</p>
          <h2 className="text-white text-2xl font-extrabold leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </h2>
          <p className="text-white/50 text-sm mt-1">
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} · Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="relative z-10 hidden md:flex gap-5 text-center">
          {[
            { label: 'Today\'s Jobs', value: stats.todayJobs },
            { label: 'In Progress', value: stats.inProgressJobs },
            { label: 'Pending Quotes', value: stats.pendingQuotes },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <p className="text-white text-2xl font-extrabold leading-none">{s.value}</p>
              <p className="text-white/45 text-xs mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard isLoading={loading} label="Total Jobs" value={stats.totalJobs} icon={Briefcase} color="blue" subtitle={`${stats.todayJobs} scheduled today`} delay={0} />
        <StatCard isLoading={loading} label="In Progress" value={stats.inProgressJobs} icon={Clock} color="orange" subtitle="Active right now" delay={60} />
        <StatCard isLoading={loading} label="Open Defects" value={stats.openDefects} icon={ShieldAlert} color={stats.criticalDefects > 0 ? 'red' : 'yellow'} subtitle={`${stats.criticalDefects} critical`} delay={120} />
        <StatCard isLoading={loading} label="Properties" value={stats.totalProperties} icon={Building2} color="purple" subtitle={`${stats.overdueProperties} overdue`} delay={180} />
        <StatCard isLoading={loading} label="Completed" value={stats.completedJobs} icon={CheckCircle2} color="green" subtitle={`${completionRate}% completion rate`} delay={240} />
        <StatCard isLoading={loading} label="Technicians" value={stats.activeTechs} icon={Users} color="teal" subtitle="Active field staff" delay={300} />
        <StatCard isLoading={loading} label="Pending Quotes" value={stats.pendingQuotes} icon={TrendingUp} color="yellow" subtitle="Awaiting approval" delay={360} />
        <StatCard isLoading={loading} label="Overdue Sites" value={stats.overdueProperties} icon={AlertTriangle} color="red" subtitle="Need attention" delay={420} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Bar Chart */}
        <div className="lg:col-span-2 bg-[var(--card)] rounded-2xl border p-6 animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '100ms' }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Weekly Job Activity</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Scheduled vs completed — last 7 days</p>
            </div>
            <div className="flex gap-3">
              {[{ color: '#e2e8f0', label: 'Scheduled' }, { color: '#1B2D4F', label: 'Completed' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={weeklyData} barSize={11} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--primary-light)', radius: 6 }} />
              <Bar dataKey="scheduled" name="Scheduled" fill="var(--border-strong)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-[var(--card)] rounded-2xl border p-6 animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '150ms' }}>
          <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text)' }}>Defects by Severity</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>All open defects</p>
          {defectSeverityData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[170px] mt-4" style={{ color: 'var(--text-tertiary)' }}>
              <ShieldAlert size={28} className="mb-2 opacity-50" />
              <p className="text-xs font-medium">No open defects</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={defectSeverityData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                    {defectSeverityData.map((_: { name: string; value: number }, i: number) => <Cell key={i} fill={Object.values(SEV_COLORS)[i]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Summary rows */}
              <div className="mt-1 space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {defectSeverityData.map((d: { name: string; value: number }, i: number) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: Object.values(SEV_COLORS)[i] }} />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Jobs */}
        <div className="bg-[var(--card)] rounded-2xl border animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '200ms' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Jobs</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Latest scheduled work orders</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--primary-light)]"
              style={{ color: 'var(--accent)' }}>
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="px-3 pb-3">
            {recentJobs.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase size={28} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No jobs yet</p>
              </div>
            ) : recentJobs.map((job: { id: string; property?: { name: string }; assigned_user?: { full_name: string }; scheduled_date: string; status: string }, i: number) => (
              <Link href={`/jobs/${job.id}`} key={job.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--primary-light)] group"
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--primary-light)' }}>
                  <Briefcase size={14} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{job.property?.name ?? '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {job.assigned_user?.full_name ?? '—'} · {formatDate(job.scheduled_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge value={job.status} />
                  <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Defects */}
        <div className="bg-[var(--card)] rounded-2xl border animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '250ms' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Defects</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Latest defects requiring action</p>
            </div>
            <Link href="/defects" className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--primary-light)]"
              style={{ color: 'var(--accent)' }}>
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="px-3 pb-3">
            {recentDefects.length === 0 ? (
              <div className="text-center py-8">
                <ShieldAlert size={28} className="mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No defects recorded</p>
              </div>
            ) : recentDefects.map((defect: { id: string; severity: string; description: string; property?: { name: string }; created_at: string }, i: number) => {
              const sevColor = defect.severity === 'critical' ? '#ef4444' : defect.severity === 'major' ? 'var(--accent)' : '#f59e0b';
              const sevBg = defect.severity === 'critical' ? 'var(--error-dark)' : defect.severity === 'major' ? 'var(--warning-dark)' : 'var(--warning-dark)';
              return (
                <div key={defect.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--primary-light)] transition-colors"
                  style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sevBg }}>
                    <ShieldAlert size={14} style={{ color: sevColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{defect.description}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {defect.property?.name ?? '—'} · {timeAgo(defect.created_at)}
                    </p>
                  </div>
                  <Badge value={defect.severity} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
