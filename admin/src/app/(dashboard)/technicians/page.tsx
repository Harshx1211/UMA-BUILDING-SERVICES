'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi, adminRead } from '@/lib/admin-api';
import { formatDate, getInitials, timeAgo } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Users, Search, X, Plus, Mail, Phone, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TechniciansPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleF, setRoleF] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [jobStats, setJobStats] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await adminRead<any>('users', { order: { column: 'full_name' } });
    setUsers(data ?? []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (user: any) => {
    setSelected(user);
    const [tl, total, completed] = await Promise.all([
      adminRead('time_logs', { select: '*, job:jobs(scheduled_date, property:properties(name))', filters: { user_id: user.id }, order: { column: 'clock_in', ascending: false }, limit: 10 }),
      adminRead('jobs', { count: true, limit: 0, filters: { assigned_to: user.id } }),
      adminRead('jobs', { count: true, limit: 0, filters: { assigned_to: user.id, status: 'completed' } }),
    ]);
    setTimeLogs(tl.data ?? []);
    setJobStats({ total: total.count ?? 0, completed: completed.count ?? 0 });
  };

  const toggleActive = async (user: any) => {
    const { error } = await adminApi.update('users', { is_active: !user.is_active }, user.id);
    if (error) toast.error(error);
    else { toast.success(user.is_active ? 'User deactivated' : 'User activated'); load(); if (selected?.id === user.id) setSelected((u: any) => ({ ...u, is_active: !u.is_active })); }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        action: 'create-user',
        data: {
          email:     fd.get('email') as string,
          password:  fd.get('password') as string,
          full_name: fd.get('full_name') as string,
          role:      fd.get('role') as string,
          phone:     (fd.get('phone') as string) || null,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? 'Failed to create user'); return; }
    toast.success('User created — they can log in immediately!');
    setShowCreate(false);
    load();
  };

  const filtered = users.filter(u => {
    const t = search.toLowerCase();
    const matchRole = roleF ? u.role === roleF : true;
    const matchSearch = !search || u.full_name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t);
    return matchRole && matchSearch;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Technicians" subtitle={`${users.length} team members`} action={
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)', boxShadow: '0 4px 14px rgba(27,45,79,0.25)' }}>
          <Plus size={16} /> Invite User
        </button>
      } />

      <div className="flex gap-4">
        {/* List Panel */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border p-4 mb-4 flex gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..." className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <select value={roleF} onChange={e => setRoleF(e.target.value)} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">Role: All</option>
              <option value="technician">Technician</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="admin">Admin</option>
            </select>
            {(search || roleF) && <button onClick={() => { setSearch(''); setRoleF(''); }} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--error)', background: '#fef2f2' }}><X size={13} />Clear</button>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Users size={24} style={{ color: 'var(--text-tertiary)' }} />} title="No team members" />
          ) : (
            <div className="space-y-2">
              {filtered.map((u, i) => (
                <button key={u.id} onClick={() => openDetail(u)} className="w-full bg-white rounded-2xl border p-4 flex items-center gap-4 hover:shadow-sm transition-all text-left animate-fade-in-up"
                  style={{ borderColor: selected?.id === u.id ? 'var(--accent)' : 'var(--border)', animationDelay: `${i * 20}ms` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: u.is_active ? 'var(--primary)' : '#94a3b8' }}>
                    {getInitials(u.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{u.full_name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge value={u.role} />
                    {!u.is_active && <span className="chip" style={{ background: '#f1f5f9', color: '#64748b' }}>Inactive</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 space-y-4 animate-slide-left">
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white" style={{ background: selected.is_active ? 'var(--primary)' : '#94a3b8' }}>
                  {getInitials(selected.full_name)}
                </div>
                <div>
                  <p className="font-bold" style={{ color: 'var(--text)' }}>{selected.full_name}</p>
                  <Badge value={selected.role} />
                </div>
              </div>
              {[[Mail, selected.email], [Phone, selected.phone ?? '—']].map(([Icon, val], i) => (
                <div key={i} className="flex items-center gap-2 py-2 border-b last:border-0 text-sm" style={{ borderColor: 'var(--border)' }}>
                  <Icon size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ color: 'var(--text)' }}>{String(val)}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{jobStats.total}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Jobs</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: '#f0fdf4' }}>
                  <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{jobStats.completed}</p>
                  <p className="text-xs" style={{ color: '#16a34a' }}>Completed</p>
                </div>
              </div>
              <button onClick={() => toggleActive(selected)} className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#ef4444' : '#16a34a' }}>
                {selected.is_active ? 'Deactivate User' : 'Activate User'}
              </button>
            </div>

            {timeLogs.length > 0 && (
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
                <p className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text)' }}><Clock size={15} />Recent Time Logs</p>
                {timeLogs.slice(0, 5).map(tl => (
                  <div key={tl.id} className="py-2.5 border-b last:border-0 text-xs" style={{ borderColor: 'var(--border)' }}>
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{(tl.job as any)?.property?.name ?? '—'}</p>
                    <p style={{ color: 'var(--text-secondary)' }}>{timeAgo(tl.clock_in)} {tl.clock_out ? '' : '· Active'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Invite Team Member</p>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {[
                { label: 'Full Name *', name: 'full_name', type: 'text' },
                { label: 'Email *', name: 'email', type: 'email' },
                { label: 'Phone', name: 'phone', type: 'tel' },
                { label: 'Password *', name: 'password', type: 'password' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{f.label}</label>
                  <input type={f.type} name={f.name} required={f.label.includes('*')} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Role</label>
                <select name="role" className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <option value="technician">Technician</option>
                  <option value="subcontractor">Subcontractor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--border)' }}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
