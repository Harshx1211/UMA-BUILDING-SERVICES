'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { timeAgo } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Bell, Briefcase, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICON: Record<string, React.ReactNode> = {
  new_job:       <Briefcase size={15} style={{ color: '#3b82f6' }} />,
  urgent_job:    <Briefcase size={15} style={{ color: '#ef4444' }} />,
  defect_flagged:<ShieldAlert size={15} style={{ color: '#f97316' }} />,
  sync_complete: <CheckCircle2 size={15} style={{ color: '#22c55e' }} />,
  general:       <Info size={15} style={{ color: '#94a3b8' }} />,
};
const TYPE_BG: Record<string, string> = {
  new_job: '#eff6ff', urgent_job: '#fef2f2', defect_flagged: '#fff7ed',
  sync_complete: '#f0fdf4', general: '#f8fafc',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [sending, setSending] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [targetUser, setTargetUser] = useState('');

  useEffect(() => {
    async function load() {
      const [{ data: notifs }, { data: u }] = await Promise.all([
        supabase.from('notifications').select('*, user:users(full_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('users').select('id,full_name').eq('is_active', true).order('full_name'),
      ]);
      setNotifications(notifs ?? []); setUsers(u ?? []); setLoading(false);
    }
    load();
  }, []);

  const markAllRead = async () => {
    await adminApi.updateMatch('notifications', { is_read: true }, { is_read: false });
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    toast.success('All marked as read');
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    const targets = targetUser ? [targetUser] : users.map(u => u.id);
    // Send one at a time via adminApi so service role bypasses RLS
    let failed = false;
    for (const uid of targets) {
      const { error } = await adminApi.insert('notifications', {
        type: 'general', title: 'Admin Notification', message: broadcastMsg, user_id: uid, is_read: false,
      });
      if (error) { failed = true; break; }
    }
    setSending(false);
    if (failed) toast.error('Failed to send some notifications');
    else { toast.success(`Sent to ${targets.length} user(s)`); setBroadcastMsg(''); setTargetUser(''); }
  };

  const filtered = notifications.filter(n => filter === 'unread' ? !n.is_read : true);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread`} action={
        unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium px-3 py-2 rounded-xl border hover:bg-gray-50" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Mark all read
          </button>
        )
      } />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Notifications list */}
        <div className="lg:col-span-2">
          <div className="flex gap-1 mb-4 p-1 rounded-xl border bg-white w-fit" style={{ borderColor: 'var(--border)' }}>
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={filter === f ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
                {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Bell size={24} style={{ color: 'var(--text-tertiary)' }} />} title="No notifications" />
          ) : (
            <div className="space-y-2">
              {filtered.map((n: any, i: number) => (
                <div key={n.id} className="bg-white rounded-2xl border p-4 flex items-start gap-3 animate-fade-in-up" style={{ borderColor: n.is_read ? 'var(--border)' : 'var(--accent)', animationDelay: `${i * 15}ms` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: TYPE_BG[n.type] ?? '#f8fafc' }}>
                    {TYPE_ICON[n.type] ?? TYPE_ICON.general}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 animate-pulse-dot" style={{ background: 'var(--accent)' }} />}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      {n.user?.full_name ?? 'System'} · {timeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcast panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Send Notification</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Send to</label>
                <select value={targetUser} onChange={e => setTargetUser(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <option value="">All Active Users</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Message</label>
                <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={4} placeholder="Type your message..." className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
              <button onClick={sendBroadcast} disabled={!broadcastMsg.trim() || sending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                {sending ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</> : <><Bell size={14} />Send Notification</>}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
            <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Stats</p>
            {[
              { label: 'Total', value: notifications.length },
              { label: 'Unread', value: unreadCount },
              { label: 'Read', value: notifications.length - unreadCount },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
