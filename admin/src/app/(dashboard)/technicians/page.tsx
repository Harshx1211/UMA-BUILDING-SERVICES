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
import { getCached, setCached } from '@/lib/pageCache';
import Skeleton from '@/components/ui/Skeleton';
import Link from 'next/link';

const CACHE_KEY = 'technicians_list';

export default function TechniciansPage() {
  const cachedUsers = getCached<any[]>(CACHE_KEY);
  const [users, setUsers] = useState<any[]>(cachedUsers ?? []);
  const [loading, setLoading] = useState(!cachedUsers);
  const [search, setSearch] = useState('');
  const [roleF, setRoleF] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (forceSkeleton = false) => {
    if (forceSkeleton) setLoading(true);
    const { data } = await adminRead<any>('users', { order: { column: 'full_name' } });
    const usersList = (data ?? []).filter((u: any) => u.role !== 'admin' && u.role !== 'superadmin');
    setUsers(usersList);
    setCached(CACHE_KEY, usersList);
    setLoading(false);
  }, []);

  useEffect(() => { load(!getCached(CACHE_KEY)); }, [load]);

  const toggleActive = async (user: any) => {
    const { error } = await adminApi.update('users', { is_active: !user.is_active }, user.id);
    if (error) toast.error(typeof error === 'string' ? error : 'Failed to update user');
    else { toast.success(user.is_active ? 'User deactivated' : 'User activated'); load(); }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
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
    
    setIsSubmitting(false);
    
    const json = await res.json();
    if (!res.ok) { 
      toast.error(typeof json.error === 'string' ? json.error : 'Failed to create user'); 
      return; 
    }
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
          <div className="bg-[var(--card)] rounded-2xl border p-4 mb-4 flex gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team..." className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <select value={roleF} onChange={e => setRoleF(e.target.value)} className="px-3 py-2 rounded-lg border text-sm font-medium outline-none cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">Role: All</option>
              <option value="technician">Technician</option>
            </select>
            {(search || roleF) && <button onClick={() => { setSearch(''); setRoleF(''); }} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.15)' }}><X size={13} />Clear</button>}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-full bg-[var(--card)] rounded-2xl border p-4 flex items-center gap-4" style={{ borderColor: 'var(--border)' }}>
                  <Skeleton variant="bg" className="w-10 h-10 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="h-4 w-1/3" />
                    <Skeleton variant="text" className="h-3 w-1/4" />
                  </div>
                  <Skeleton variant="bg" className="w-20 h-6 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Users size={24} style={{ color: 'var(--text-tertiary)' }} />} title="No team members" />
          ) : (
            <div className="space-y-2">
              {filtered.map((u, i) => (
                <Link key={u.id} href={`/technicians/${u.id}`} className="block w-full bg-[var(--card)] rounded-2xl border p-4 hover:shadow-sm transition-all animate-fade-in-up"
                  style={{ borderColor: 'var(--border)', animationDelay: `${i * 20}ms` }}>
                  <div className="flex items-center gap-4">
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
                      {!u.is_active && <span className="chip" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>Inactive</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
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
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl border text-sm font-medium disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--primary)' }}>
                  {isSubmitting ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



