'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/adminFetch';
import { getCached, setCached } from '@/lib/pageCache';
import Badge from '@/components/ui/Badge';
import { getInitials, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Building2, Users, Settings,
  Check, X, Edit3, ShieldCheck, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

const FieldDisplay = ({ label, field, type = 'text', editing, form, setForm }: { label: string; field: string; type?: string; editing: boolean; form: Record<string, any>; setForm: (val: any) => void }) => (
  <div>
    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
    {editing ? (
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={e => setForm((f: Record<string, any>) => ({ ...f, [field]: e.target.value }))}
        className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
        style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
      />
    ) : (
      <p className="text-sm font-medium" style={{ color: form[field] ? 'var(--text)' : 'var(--text-tertiary)' }}>
        {form[field] || '—'}
      </p>
    )}
  </div>
);

export default function SuperadminCompanyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  // Instant render from list cache
  const cachedList = getCached<Record<string, any>[]>('superadmin_companies');
  const initialCompany = cachedList?.find(c => c.id === id) || null;

  const [company, setCompany] = useState<Record<string, any> | null>(initialCompany);
  const [users, setUsers] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(!initialCompany);
  const [usersLoading, setUsersLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(initialCompany || {});

  const load = async () => {
    if (!id) return;
    try {
      const res = await adminFetch(`/api/superadmin/companies/${id}`);
      const json = await res.json();
      if (json.data) {
        setCompany(json.data);
        setForm(json.data);
        setUsers(json.data.users ?? []);
        // Refresh list cache entry
        if (cachedList) {
          setCached('superadmin_companies', cachedList.map(c => c.id === id ? { ...c, ...json.data } : c));
        }
      } else {
        toast.error(json.error || 'Failed to load company');
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to load company details');
    } finally {
      setLoading(false);
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/superadmin/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name, abn: form.abn, subscription_status: form.subscription_status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success('Tenant updated!');
      setCompany({ ...company, ...form });
      setEditing(false);
      if (cachedList) {
        setCached('superadmin_companies', cachedList.map(c => c.id === id ? { ...c, ...form } : c));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="animate-fade-in space-y-4 max-w-6xl">
      <div className="h-6 w-32 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="rounded-3xl p-6 h-40 animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl h-64 animate-pulse" style={{ background: 'var(--card)' }} />
        <div className="rounded-2xl h-64 animate-pulse" style={{ background: 'var(--card)' }} />
      </div>
    </div>
  );

  if (!company) return (
    <p className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>Company not found.</p>
  );

  const isActive = company.subscription_status === 'active';
  const admins = users.filter(u => u.role === 'admin');
  const techs  = users.filter(u => u.role === 'technician');

  const TABS = [
    { id: 'overview', label: 'Tenant Overview',                                       icon: Building2 },
    { id: 'users',    label: `Registered Users (${usersLoading ? '…' : users.length})`, icon: Users },
  ];



  return (
    <div className="animate-fade-in space-y-4 max-w-6xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <button onClick={() => router.push('/companies')} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
          <ArrowLeft size={14} /> Tenants
        </button>
        <span className="mx-1">/</span>
        <span style={{ color: 'var(--text)' }} className="font-medium truncate">{company.name}</span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg,#1B2D4F 0%,#243a65 100%)', boxShadow: '0 8px 32px rgba(27,45,79,0.35)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, var(--accent) 0%, transparent 60%)' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white"
              style={{ background: isActive ? 'var(--primary-light)' : '#64748b', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}>
              {company.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="pt-1">
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
                {company.name}
                {!isActive && <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-slate-500/30 text-slate-200">SUSPENDED</span>}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> ABN: {company.abn || 'Not provided'}</span>
                <span className="flex items-center gap-1.5"><Calendar size={12} /> Joined: {formatDate(company.created_at)}</span>
              </div>
              <div className="mt-3"><Badge value={isActive ? 'active' : 'suspended'} /></div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Total Users',       value: usersLoading ? '…' : users.length,  color: 'rgba(255,255,255,0.9)' },
            { label: 'Platform Admins',   value: usersLoading ? '…' : admins.length, color: 'rgba(255,255,255,0.9)' },
            { label: 'Field Technicians', value: usersLoading ? '…' : techs.length,  color: 'rgba(255,255,255,0.9)' },
            { label: 'Total Jobs',        value: company.jobs_count ?? 0,            color: '#86efac' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl border bg-[var(--card)] w-fit overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={tab === t.id ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Tenant Information */}
          <div className="bg-[var(--card)] rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Settings size={16} className="text-orange-500" /> Tenant Information
              </p>
              <div className="flex gap-2">
                {editing && (
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold text-white disabled:opacity-60 transition-all hover:opacity-90"
                    style={{ background: 'var(--primary)' }}>
                    {saving
                      ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Check size={11} />} Save
                  </button>
                )}
                <button onClick={() => { setEditing(!editing); setForm(company); }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-black/5"
                  style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                  {editing ? <><X size={11} />Cancel</> : <><Edit3 size={11} />Edit Tenant</>}
                </button>
              </div>
            </div>

            <FieldDisplay editing={editing} form={form} setForm={setForm} label="Company Name" field="name" />
            <FieldDisplay editing={editing} form={form} setForm={setForm} label="ABN (Australian Business Number)" field="abn" />

            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Subscription Status</p>
              {editing ? (
                <select
                  value={form.subscription_status ?? 'active'}
                  onChange={e => setForm((f: Record<string, any>) => ({ ...f, subscription_status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-orange-500"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
                  <option value="active">Active (Billing Normal)</option>
                  <option value="suspended">Suspended (Lockout)</option>
                </select>
              ) : (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {company.subscription_status.toUpperCase()}
                </span>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Suspending a tenant locks out all their users from the platform.
              </p>
            </div>
          </div>

          {/* Platform Users quick-view */}
          <div className="bg-[var(--card)] rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Users size={16} className="text-blue-500" /> Platform Users
              </p>
            </div>

            {usersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--bg)' }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 rounded" style={{ background: 'var(--bg)', width: '60%' }} />
                      <div className="h-2.5 rounded" style={{ background: 'var(--bg)', width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>No users on this tenant yet.</p>
            ) : (
              <div className="space-y-3">
                {users.slice(0, 6).map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: u.is_active ? 'var(--primary)' : '#64748b' }}>
                      {getInitials(u.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{u.full_name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{u.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {u.role}
                    </span>
                  </div>
                ))}
                {users.length > 6 && (
                  <button onClick={() => setTab('users')}
                    className="text-xs font-semibold mt-1 hover:underline"
                    style={{ color: 'var(--primary)' }}>
                    View all {users.length} users →
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── USERS TAB ────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            <p className="font-bold" style={{ color: 'var(--text)' }}>All users on {company.name}</p>
            <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              {users.length} total
            </span>
          </div>

          {usersLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: 'var(--bg)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded" style={{ background: 'var(--bg)', width: '40%' }} />
                    <div className="h-3 rounded" style={{ background: 'var(--bg)', width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <Users size={32} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>No users found for this tenant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                    {['User', 'Email', 'Role', 'Phone', 'Status', 'Joined'].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: u.is_active ? 'var(--primary)' : '#64748b' }}>
                            {getInitials(u.full_name)}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
