'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi, adminReadBatch } from '@/lib/admin-api';
import { formatDate, getInitials } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import {
  ArrowLeft, User, Mail, Phone, Briefcase, Check, X,
  Award, Edit3, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getCached } from '@/lib/pageCache';

const ROLES = ['technician', 'admin']; // Subcontractor removed per user request

interface TechnicianRecord {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
  fpas_number?: string;
  fpas_class?: string;
  fpas_expiry?: string;
  state_license?: string;
  state_license_expiry?: string;
  [key: string]: unknown;
}

interface JobRecord {
  id: string;
  status: string;
  scheduled_date: string;
  job_type: string;
  priority: string;
  property?: { name: string };
  [key: string]: unknown;
}

interface TimeLogRecord {
  id: string;
  clock_in: string;
  clock_out?: string;
  duration_minutes?: number;
  job?: { scheduled_date?: string; property?: { name?: string } };
  [key: string]: unknown;
}

export default function TechnicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cachedUsers = getCached<TechnicianRecord[]>('technicians_list');
  const initialUser = cachedUsers?.find(u => u.id === id) || null;

  const [user, setUser] = useState<TechnicianRecord | null>(initialUser);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogRecord[]>([]);
  const [loading, setLoading] = useState(!initialUser);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TechnicianRecord>(initialUser || { id });

  const load = useCallback(async () => {
    setLoading(true);
    const results = await adminReadBatch([
      { table: 'users', options: { filters: { id }, limit: 1 } },
      { table: 'jobs', options: { select: '*, property:properties(name)', filters: { assigned_to: id }, order: { column: 'scheduled_date', ascending: false } } },
      { table: 'time_logs', options: { select: '*, job:jobs(scheduled_date, property:properties(name))', filters: { user_id: id }, order: { column: 'clock_in', ascending: false } } },
    ]);
    const [{ data: u }, { data: j }, { data: tl }] = results;
    
    if (u && u[0]) {
      setUser(u[0] as TechnicianRecord);
      if (!editing) setForm(u[0] as TechnicianRecord);
    }
    setJobs((j as JobRecord[]) ?? []);
    setTimeLogs((tl as TimeLogRecord[]) ?? []);
    setLoading(false);
  }, [id, editing]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      load(); 
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await adminApi.update('users', {
      full_name: form.full_name,
      phone: form.phone,
      role: form.role,
      is_active: form.is_active,
      fpas_number: form.fpas_number,
      fpas_class: form.fpas_class,
      fpas_expiry: form.fpas_expiry || null,
      state_license: form.state_license,
      state_license_expiry: form.state_license_expiry || null,
    }, id);
    setSaving(false);
    if (error) toast.error(typeof error === 'string' ? error : 'Failed to update user');
    else { toast.success('Profile updated!'); setUser(form); setEditing(false); }
  };

  if (loading) return (
    <div className="animate-fade-in space-y-4 max-w-6xl">
      <div className="h-6 w-32 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="rounded-3xl p-6 h-40 animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl h-64 animate-pulse" style={{ background: 'var(--card)' }} />
      </div>
    </div>
  );
  
  if (!user) return <p className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>User not found.</p>;

  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const isFpasOverdue = user.fpas_expiry && user.fpas_expiry < new Date().toISOString().split('T')[0];

  const TABS = [
    { id: 'overview', label: 'Profile & Access', icon: User },
    { id: 'jobs',     label: `Assigned Jobs (${jobs.length})`, icon: Briefcase },
    { id: 'logs',     label: `Time Logs (${timeLogs.length})`, icon: Clock },
  ];

  const renderField = (label: string, field: string, type = 'text', width = 'full') => (
    <div className={width === 'full' ? 'col-span-full' : ''}>
      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {editing ? (
        <input
          type={type}
          value={(form[field] as string) ?? ''}
          onChange={e => setForm((f: TechnicianRecord) => ({ ...f, [field]: e.target.value }))}
          className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--text)',
            background: 'var(--bg)',
            colorScheme: 'dark',
          }}
        />
      ) : (
        <p className="text-sm font-medium" style={{ color: form[field] ? 'var(--text)' : 'var(--text-tertiary)' }}>
          {type === 'date' && form[field] ? formatDate(form[field] as string) : (form[field] as string) || '—'}
        </p>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <button onClick={() => router.push('/technicians')} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
          <ArrowLeft size={14} /> Team
        </button>
        <span className="mx-1">/</span>
        <span style={{ color: 'var(--text)' }} className="font-medium truncate">{user.full_name}</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg,#1B2D4F 0%,#243a65 100%)', boxShadow: '0 8px 32px rgba(27,45,79,0.35)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, var(--accent) 0%, transparent 60%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white" 
              style={{ background: user.is_active ? 'var(--primary-light)' : '#64748b', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}>
              {getInitials(user.full_name || '')}
            </div>
            <div className="pt-1">
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
                {user.full_name}
                {!user.is_active && <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-slate-500/30 text-slate-200">INACTIVE</span>}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="flex items-center gap-1.5"><Mail size={12} /> {user.email}</span>
                {user.phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {user.phone}</span>}
              </div>
              <div className="mt-3"><Badge value={user.role} /></div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Total Jobs', value: jobs.length, color: 'rgba(255,255,255,0.9)' },
            { label: 'Completed Jobs', value: completedJobs, color: '#86efac' },
            { label: 'Total Hours', value: Math.round(timeLogs.reduce((acc, tl) => acc + (tl.duration_minutes || 0), 0) / 60) + 'h', color: 'rgba(255,255,255,0.9)' },
            { label: 'FPAS Status', value: user.fpas_number ? (isFpasOverdue ? 'Expired' : 'Valid') : 'No FPAS', color: user.fpas_number ? (isFpasOverdue ? '#fca5a5' : '#86efac') : 'rgba(255,255,255,0.5)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl border bg-[var(--card)] w-fit overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={tab === t.id ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Identity & Access */}
          <div className="bg-[var(--card)] rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}><User size={16} className="text-orange-500" /> Identity & Access</p>
              <div className="flex gap-2">
                {editing && (
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold text-white disabled:opacity-60 transition-all hover:opacity-90"
                    style={{ background: 'var(--primary)' }}>
                    {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={11} />} Save
                  </button>
                )}
                <button onClick={() => { setEditing(!editing); setForm(user); }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-black/5"
                  style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                  {editing ? <><X size={11} />Cancel</> : <><Edit3 size={11} />Edit Profile</>}
                </button>
              </div>
            </div>
            
            {renderField("Full Name", "full_name")}
            {renderField("Phone Number", "phone", "tel")}
            
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Email Address</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{user.email} <span className="text-xs text-gray-400 ml-2 font-normal">(Login managed via Supabase)</span></p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>System Role</p>
                {editing ? (
                  <select value={(form.role as string) ?? 'technician'} onChange={e => setForm((f: TechnicianRecord) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-orange-500" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                ) : <Badge value={user.role} />}
              </div>
              
              <div>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Account Status</p>
                {editing ? (
                  <button onClick={() => setForm((f: TechnicianRecord) => ({ ...f, is_active: !f.is_active }))} type="button"
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl border text-sm font-medium transition-colors`}
                    style={{ borderColor: 'var(--border)', background: form.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg)', color: form.is_active ? '#16a34a' : 'var(--text-secondary)' }}>
                    {form.is_active ? 'Active' : 'Suspended'}
                    <div className={`w-3 h-3 rounded-full ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </button>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user.is_active ? 'Active User' : 'Suspended'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Compliance & Licensing */}
          <div className="bg-[var(--card)] rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}><Award size={16} className="text-blue-500" /> Compliance & Licensing</p>
            </div>
            
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {renderField("FPAS Number", "fpas_number", "text", "half")}
              {renderField("FPAS Class", "fpas_class", "text", "half")}
              {renderField("FPAS Expiry Date", "fpas_expiry", "date", "full")}
              
              <div className="col-span-full h-px my-1" style={{ background: 'var(--border)' }} />
              
              {renderField("State Licence", "state_license", "text", "full")}
              {renderField("Licence Expiry Date", "state_license_expiry", "date", "full")}
            </div>
          </div>
        </div>
      )}

      {/* JOBS TAB */}
      {tab === 'jobs' && (
        <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {jobs.length === 0
            ? <div className="flex flex-col items-center py-16"><Briefcase size={24} style={{ color: 'var(--text-tertiary)' }} /><p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>No assigned jobs</p></div>
            : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                      {['Date','Property','Type','Priority','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr key={j.id} className="border-b last:border-0 hover:bg-white/5 transition-colors cursor-pointer group"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => router.push(`/jobs/${j.id}`)}>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text)' }}>{formatDate(j.scheduled_date)}</td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>{j.property?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{j.job_type.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</td>
                        <td className="px-4 py-3"><Badge value={j.priority} /></td>
                        <td className="px-4 py-3"><Badge value={j.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && (
        <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {timeLogs.length === 0
            ? <div className="flex flex-col items-center py-16"><Clock size={24} style={{ color: 'var(--text-tertiary)' }} /><p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>No time logs recorded</p></div>
            : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                      {['Date','Property','Clock In','Clock Out','Duration','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeLogs.map(tl => {
                      const isActive = !tl.clock_out;
                      return (
                        <tr key={tl.id} className="border-b last:border-0 transition-colors"
                          style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text)' }}>{formatDate(tl.clock_in.split('T')[0])}</td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>{tl.job?.property?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{new Date(tl.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{tl.clock_out ? new Date(tl.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td className="px-4 py-3 text-sm font-mono font-medium" style={{ color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                            {tl.duration_minutes ? `${Math.floor(tl.duration_minutes / 60)}h ${tl.duration_minutes % 60}m` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {isActive ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-600">Active Now</span> : <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">Completed</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
        </div>
      )}
    </div>
  );
}
