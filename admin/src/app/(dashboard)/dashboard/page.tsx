'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Briefcase, Building2, ShieldAlert, Users,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight,
} from 'lucide-react';
import { adminRead } from '@/lib/admin-api';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatDate, formatCurrency, timeAgo } from '@/lib/utils';
import type { Job, Defect } from '@/types';
import Link from 'next/link';

const SEV_COLORS = { minor: '#f59e0b', major: '#f97316', critical: '#ef4444' };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl border p-3 shadow-xl text-xs" style={{ borderColor: 'var(--border)' }}>
      <p className="font-bold mb-2" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}: </span>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalJobs: 0, todayJobs: 0, completedJobs: 0, inProgressJobs: 0,
    totalProperties: 0, overdueProperties: 0,
    openDefects: 0, criticalDefects: 0,
    activeTechs: 0, pendingQuotes: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentDefects, setRecentDefects] = useState<Defect[]>([]);
  const [defectSeverityData, setDefectSeverityData] = useState<{ name: string; value: number }[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; completed: number; scheduled: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];

      // Parallel counts via service-role key (bypasses RLS = sees ALL data)
      const [
        totalJobs, todayJobs, completedJobs, inProgressJobs,
        totalProperties, overdueProperties, openDefects,
        criticalDefects, activeTechs, pendingQuotes,
        jobsResult, defectsResult, allDefectsResult,
      ] = await Promise.all([
        adminRead('jobs',       { count: true, limit: 0 }),
        adminRead('jobs',       { count: true, limit: 0, filters: { scheduled_date: today } }),
        adminRead('jobs',       { count: true, limit: 0, filters: { status: 'completed' } }),
        adminRead('jobs',       { count: true, limit: 0, filters: { status: 'in_progress' } }),
        adminRead('properties', { count: true, limit: 0 }),
        adminRead('properties', { count: true, limit: 0, filters: { compliance_status: 'overdue' } }),
        adminRead('defects',    { count: true, limit: 0, filters: { status: 'open' } }),
        adminRead('defects',    { count: true, limit: 0, filters: { severity: 'critical', status: 'open' } }),
        adminRead('users',      { count: true, limit: 0, filters: { is_active: true } }),
        adminRead('quotes',     { count: true, limit: 0, filters: { status: 'draft' } }),
        adminRead<any>('jobs',    { select: '*, property:properties(name), assigned_user:users(full_name)', order: { column: 'created_at', ascending: false }, limit: 6 }),
        adminRead<any>('defects', { select: '*, property:properties(name), asset:assets(asset_type)', order: { column: 'created_at', ascending: false }, limit: 5 }),
        adminRead<any>('defects', { select: 'severity' }),
      ]);

      setStats({
        totalJobs:          totalJobs.count          ?? 0,
        todayJobs:          todayJobs.count          ?? 0,
        completedJobs:      completedJobs.count      ?? 0,
        inProgressJobs:     inProgressJobs.count     ?? 0,
        totalProperties:    totalProperties.count    ?? 0,
        overdueProperties:  overdueProperties.count  ?? 0,
        openDefects:        openDefects.count        ?? 0,
        criticalDefects:    criticalDefects.count    ?? 0,
        activeTechs:        activeTechs.count        ?? 0,
        pendingQuotes:      pendingQuotes.count       ?? 0,
      });
      setRecentJobs((jobsResult.data as Job[]) ?? []);
      setRecentDefects((defectsResult.data as Defect[]) ?? []);

      const sevCounts: Record<string, number> = { minor: 0, major: 0, critical: 0 };
      (allDefectsResult.data ?? []).forEach((d: any) => { sevCounts[d.severity] = (sevCounts[d.severity] ?? 0) + 1; });
      setDefectSeverityData([{ name: 'Minor', value: sevCounts.minor }, { name: 'Major', value: sevCounts.major }, { name: 'Critical', value: sevCounts.critical }]);

      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0]; });
      const weekResult = await adminRead<any>('jobs', { select: 'scheduled_date,status', in: { column: 'scheduled_date', values: days } });
      setWeeklyData(days.map(date => ({
        day: new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' }),
        scheduled: (weekResult.data ?? []).filter((j: any) => j.scheduled_date === date).length,
        completed: (weekResult.data ?? []).filter((j: any) => j.scheduled_date === date && j.status === 'completed').length,
      })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#ff9a3c,#F97316)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" /></svg>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--accent)', animationDelay: `${i * 130}ms` }} />
          ))}
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading dashboard…</p>
      </div>
    </div>
  );

  const completionRate = stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero Banner ── */}
      <div className="relative rounded-2xl overflow-hidden p-6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 60%, #1e3560 100%)', minHeight: 100 }}>
        {/* Decorative blobs */}
        <div className="absolute w-56 h-56 rounded-full -top-16 -right-8 opacity-10" style={{ background: '#F97316' }} />
        <div className="absolute w-32 h-32 rounded-full -bottom-10 right-32 opacity-5" style={{ background: '#F97316' }} />
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">Overview</p>
          <h2 className="text-white text-2xl font-extrabold leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
          </h2>
          <p className="text-white/50 text-sm mt-1">Here's what's happening across your operations today.</p>
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
        <StatCard label="Total Jobs" value={stats.totalJobs} icon={Briefcase} color="blue" subtitle={`${stats.todayJobs} scheduled today`} delay={0} />
        <StatCard label="In Progress" value={stats.inProgressJobs} icon={Clock} color="orange" subtitle="Active right now" delay={60} />
        <StatCard label="Open Defects" value={stats.openDefects} icon={ShieldAlert} color={stats.criticalDefects > 0 ? 'red' : 'yellow'} subtitle={`${stats.criticalDefects} critical`} delay={120} />
        <StatCard label="Properties" value={stats.totalProperties} icon={Building2} color="purple" subtitle={`${stats.overdueProperties} overdue`} delay={180} />
        <StatCard label="Completed" value={stats.completedJobs} icon={CheckCircle2} color="green" subtitle={`${completionRate}% completion rate`} delay={240} />
        <StatCard label="Technicians" value={stats.activeTechs} icon={Users} color="teal" subtitle="Active field staff" delay={300} />
        <StatCard label="Pending Quotes" value={stats.pendingQuotes} icon={TrendingUp} color="yellow" subtitle="Awaiting approval" delay={360} />
        <StatCard label="Overdue Sites" value={stats.overdueProperties} icon={AlertTriangle} color="red" subtitle="Need attention" delay={420} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 animate-fade-in-up"
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 6 }} />
              <Bar dataKey="scheduled" name="Scheduled" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#1B2D4F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl border p-6 animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '150ms' }}>
          <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text)' }}>Defects by Severity</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>All open defects</p>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={defectSeverityData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                {defectSeverityData.map((_, i) => <Cell key={i} fill={Object.values(SEV_COLORS)[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          {/* Summary rows */}
          <div className="mt-1 space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {defectSeverityData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: Object.values(SEV_COLORS)[i] }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Jobs */}
        <div className="bg-white rounded-2xl border animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '200ms' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Jobs</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Latest scheduled work orders</p>
            </div>
            <Link href="/jobs" className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-orange-50"
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
            ) : recentJobs.map((job: any, i) => (
              <Link href={`/jobs/${job.id}`} key={job.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50 group"
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#eff6ff' }}>
                  <Briefcase size={14} style={{ color: '#3b82f6' }} />
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
        <div className="bg-white rounded-2xl border animate-fade-in-up"
          style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animationDelay: '250ms' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Defects</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Latest defects requiring action</p>
            </div>
            <Link href="/defects" className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-orange-50"
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
            ) : recentDefects.map((defect: any, i) => {
              const sevColor = defect.severity === 'critical' ? '#ef4444' : defect.severity === 'major' ? '#f97316' : '#f59e0b';
              const sevBg = defect.severity === 'critical' ? '#fef2f2' : defect.severity === 'major' ? '#fff7ed' : '#fffbeb';
              return (
                <div key={defect.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sevBg }}>
                    <ShieldAlert size={14} style={{ color: sevColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{defect.description}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {(defect as any).property?.name ?? '—'} · {timeAgo(defect.created_at)}
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
