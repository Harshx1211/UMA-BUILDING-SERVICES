'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi, adminRead } from '@/lib/admin-api';
import { formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  Search, Plus, X, ChevronLeft, ChevronRight,
  Briefcase, Calendar, MapPin, ArrowUpRight, Clock,
  CheckCircle2, AlertTriangle, Trash2, FileText, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CreateJobModal from './CreateJobModal';

const STATUSES   = ['', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const JOB_TYPES  = ['', 'routine_service', 'defect_repair', 'installation', 'emergency', 'quote'];
const PRIORITIES = ['', 'urgent', 'high', 'normal', 'low'];
const PAGE_SIZE  = 12;

const JOB_TYPE_LABELS: Record<string, string> = {
  routine_service: 'Routine Service', defect_repair: 'Defect Repair',
  installation: 'Installation', emergency: 'Emergency', quote: 'Quote',
};

export default function JobsPage() {
  const [jobs,         setJobs]         = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusF,      setStatusF]      = useState('');
  const [typeF,        setTypeF]        = useState('');
  const [priorityF,    setPriorityF]    = useState('');
  const [reportF,      setReportF]      = useState('');   // 'yes' | 'no' | ''
  const [page,         setPage]         = useState(0);
  const [showCreate,   setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [stats, setStats] = useState({ scheduled: 0, in_progress: 0, completed: 0, urgent: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const { data, count } = await adminRead<any>('jobs', {
      select: '*, property:properties(name,suburb,state), assigned_user:users(full_name)',
      filters: {
        ...(statusF   ? { status:   statusF   } : {}),
        ...(typeF     ? { job_type: typeF     } : {}),
        ...(priorityF ? { priority: priorityF } : {}),
      },
      ...(search ? { ilike: { column: 'notes', pattern: `%${search}%` } } : {}),
      order: { column: 'scheduled_date', ascending: false },
      range: [from, to],
      count: true,
    });

    // Client-side report filter (adminRead doesn't support IS NULL / IS NOT NULL)
    let rows = data ?? [];
    if (reportF === 'yes') rows = rows.filter((j: any) => !!j.report_url);
    if (reportF === 'no')  rows = rows.filter((j: any) => !j.report_url);

    setJobs(rows);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, statusF, typeF, priorityF, reportF, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadStats() {
      const [s, ip, c, u] = await Promise.all([
        adminRead('jobs', { filters: { status: 'scheduled'  }, count: true, limit: 0 }),
        adminRead('jobs', { filters: { status: 'in_progress' }, count: true, limit: 0 }),
        adminRead('jobs', { filters: { status: 'completed'  }, count: true, limit: 0 }),
        adminRead('jobs', { filters: { priority: 'urgent'   }, count: true, limit: 0 }),
      ]);
      setStats({ scheduled: s.count ?? 0, in_progress: ip.count ?? 0, completed: c.count ?? 0, urgent: u.count ?? 0 });
    }
    loadStats();
  }, []);

  const deleteJob = async () => {
    if (!deleteTarget) return;
    const { error } = await adminApi.delete('jobs', deleteTarget.id);
    if (error) toast.error(error);
    else { toast.success('Job deleted'); load(); }
    setDeleteTarget(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(statusF || typeF || priorityF || reportF || search);

  const QUICK_STATS = [
    { label: 'Scheduled',   value: stats.scheduled,   color: '#3b82f6', bg: '#eff6ff', icon: Calendar     },
    { label: 'In Progress', value: stats.in_progress,  color: '#F97316', bg: '#fff7ed', icon: Clock         },
    { label: 'Completed',   value: stats.completed,    color: '#22c55e', bg: '#f0fdf4', icon: CheckCircle2  },
    { label: 'Urgent',      value: stats.urgent,       color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Jobs"
        subtitle={`${total.toLocaleString()} total work orders`}
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-95"
            style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.3)' }}>
            <Plus size={15} strokeWidth={2.5} /> New Job
          </button>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_STATS.map((s, i) => (
          <div key={s.label}
            className="bg-white rounded-2xl border p-4 flex items-center gap-3 animate-fade-in-up"
            style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animationDelay: `${i * 50}ms` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-extrabold leading-none" style={{ color: 'var(--text)' }}>{s.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3 items-center"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search jobs…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#f8fafc' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
            onBlur={e =>  { e.target.style.borderColor = 'var(--border)';  e.target.style.background = '#f8fafc'; }}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: statusF,   set: (v: string) => { setStatusF(v);   setPage(0); }, options: STATUSES,   placeholder: 'Status'   },
            { value: typeF,     set: (v: string) => { setTypeF(v);     setPage(0); }, options: JOB_TYPES,  placeholder: 'Type'     },
            { value: priorityF, set: (v: string) => { setPriorityF(v); setPage(0); }, options: PRIORITIES, placeholder: 'Priority' },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
              className="px-3 py-2.5 rounded-xl border text-sm outline-none transition-all cursor-pointer"
              style={{
                borderColor: f.value ? 'var(--primary)' : 'var(--border)',
                color: 'var(--text)',
                background: f.value ? '#f0f4ff' : '#f8fafc',
                fontWeight: f.value ? 600 : 400,
              }}>
              <option value="">{f.placeholder}: All</option>
              {f.options.filter(Boolean).map(o => (
                <option key={o} value={o}>
                  {JOB_TYPE_LABELS[o] ?? o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          ))}

          {/* PDF / Report filter */}
          <select value={reportF} onChange={e => { setReportF(e.target.value); setPage(0); }}
            className="px-3 py-2.5 rounded-xl border text-sm outline-none transition-all cursor-pointer"
            style={{
              borderColor: reportF ? 'var(--primary)' : 'var(--border)',
              color: 'var(--text)',
              background: reportF ? '#f0f4ff' : '#f8fafc',
              fontWeight: reportF ? 600 : 400,
            }}>
            <option value="">Report: All</option>
            <option value="yes">Has PDF</option>
            <option value="no">No PDF yet</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => { setStatusF(''); setTypeF(''); setPriorityF(''); setReportF(''); setSearch(''); setPage(0); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: 'var(--error)', background: '#fef2f2' }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading jobs…</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg)' }}>
              <Briefcase size={24} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>No jobs found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {hasFilters ? 'Try adjusting your filters' : 'Create your first job to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                    {['Property', 'Type', 'Technician', 'Date', 'Priority', 'Status', 'Report', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <tr key={job.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group animate-fade-in"
                      style={{ borderColor: 'var(--border)', animationDelay: `${i * 20}ms` }}
                      onClick={() => window.location.href = `/jobs/${job.id}`}>

                      {/* Property */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
                            <MapPin size={13} style={{ color: '#3b82f6' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate max-w-[160px]" style={{ color: 'var(--text)' }}>
                              {job.property?.name ?? '—'}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                              {[job.property?.suburb, job.property?.state].filter(Boolean).join(', ') || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg"
                          style={{ background: '#f1f5f9', color: 'var(--text-secondary)' }}>
                          {JOB_TYPE_LABELS[job.job_type] ?? job.job_type}
                        </span>
                      </td>

                      {/* Technician */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: 'var(--primary)' }}>
                            {job.assigned_user?.full_name?.charAt(0) ?? '?'}
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {job.assigned_user?.full_name ?? '—'}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{formatDate(job.scheduled_date)}</p>
                        {job.scheduled_time && (
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{job.scheduled_time}</p>
                        )}
                      </td>

                      {/* Priority / Status */}
                      <td className="px-4 py-3.5"><Badge value={job.priority} /></td>
                      <td className="px-4 py-3.5"><Badge value={job.status} /></td>

                      {/* ── PDF Report indicator — click opens PDF without navigating into the job ── */}
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        {job.report_url ? (
                          <a
                            href={job.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open PDF report"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 active:scale-95"
                            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                            <FileText size={11} />
                            PDF
                            <Download size={10} />
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(job); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                            title="Delete job">
                            <Trash2 size={13} style={{ color: '#ef4444' }} />
                          </button>
                          <ArrowUpRight size={15} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t"
                style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40 hover:bg-white"
                    style={{ borderColor: 'var(--border)' }}>
                    <ChevronLeft size={14} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className="w-8 h-8 rounded-lg border text-xs font-semibold transition-all"
                        style={{
                          borderColor: page === p ? 'var(--primary)' : 'var(--border)',
                          background:  page === p ? 'var(--primary)' : 'transparent',
                          color:       page === p ? '#fff' : 'var(--text-secondary)',
                        }}>
                        {p + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                    className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40 hover:bg-white"
                    style={{ borderColor: 'var(--border)' }}>
                    <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Job?"
          message={`This will permanently delete the job at "${deleteTarget.property?.name ?? 'this property'}" scheduled for ${formatDate(deleteTarget.scheduled_date)}. This action cannot be undone.`}
          onConfirm={deleteJob}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
