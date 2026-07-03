'use client';
import { usePathname } from 'next/navigation';
import { Bell, Search, RefreshCw, ChevronRight, Home, Menu, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getInitials } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PAGE_META: Record<string, { title: string; emoji: string; desc: string }> = {
  '/dashboard':    { title: 'Dashboard',     emoji: '📊', desc: 'Overview & live operations' },
  '/jobs':         { title: 'Jobs',          emoji: '💼', desc: 'Schedule & manage field jobs' },
  '/properties':   { title: 'Properties',    emoji: '🏢', desc: 'Site & compliance register' },
  '/assets':       { title: 'Assets',        emoji: '📦', desc: 'Equipment & service register' },
  '/defects':      { title: 'Defects',       emoji: '🔴', desc: 'Defect tracking & remediation' },
  '/technicians':  { title: 'Technicians',   emoji: '👷', desc: 'Staff & performance management' },
  '/quotes':       { title: 'Quotes',        emoji: '📝', desc: 'Quote approvals & line items' },
  '/enquiries':    { title: 'Enquiries',     emoji: '💬', desc: 'Website enquiries & lead management' },
  '/catalogue':    { title: 'Catalogue',     emoji: '📚', desc: 'Asset types, defect codes & service items' },
  '/reports':      { title: 'Reports',       emoji: '📈', desc: 'Compliance reports & exports' },
  '/notifications':{ title: 'Notifications', emoji: '🔔', desc: 'Alerts & broadcast messages' },
  '/settings':     { title: 'Settings',      emoji: '⚙️',  desc: 'System configuration' },
};

interface HeaderProps { onMenuClick: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const root = '/' + pathname.split('/')[1];
  const meta = PAGE_META[root] ?? { title: 'Superadmin', emoji: '⚡', desc: 'Platform Superadmin Portal' };

  // Fetch real unread notification count
  useEffect(() => {
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [pathname]); // re-check on every route change

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 bg-[var(--card)] border-b"
      style={{ borderColor: 'var(--border)', height: 64, minHeight: 64 }}>

      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 transition-all hover:bg-[var(--primary-light)] active:scale-95"
          style={{ borderColor: 'var(--border)' }}>
          <Menu size={17} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          <Home size={14} />
          <ChevronRight size={12} style={{ opacity: 0.5 }} />
          <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{meta.title}</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

        <button onClick={handleRefresh} title="Refresh"
          className="w-9 h-9 rounded-xl border flex items-center justify-center transition-all hover:bg-[var(--primary-light)] active:scale-95"
          style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''}
            style={{ color: 'var(--text-secondary)' }} />
        </button>

        <Link href="/notifications" title="Notifications"
          className="relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all hover:bg-[var(--primary-light)] active:scale-95"
          style={{ borderColor: pathname === '/notifications' ? 'var(--accent)' : 'var(--border)', background: pathname === '/notifications' ? 'var(--primary-light)' : undefined }}>
          <Bell size={15} style={{ color: pathname === '/notifications' ? 'var(--accent)' : 'var(--text-secondary)' }} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white flex items-center justify-center text-[9px] font-bold"
              style={{ background: 'var(--accent)', boxShadow: '0 2px 6px rgba(232,101,10,0.5)' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="hidden sm:block w-px h-7" style={{ background: 'var(--border)' }} />

        <div className="flex items-center gap-2 cursor-default">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#FF7A20,#E8650A)', boxShadow: '0 2px 8px rgba(232,101,10,0.35)' }}>
            {user ? getInitials(user.full_name) : 'A'}
          </div>
          <div className="hidden xl:block">
            <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>{user?.full_name ?? 'Admin'}</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{user?.role ?? 'Administrator'}</p>
          </div>
          <button onClick={signOut}
            className="w-8 h-8 rounded-xl border flex items-center justify-center transition-all hover:bg-white/5 active:scale-95 ml-2"
            style={{ borderColor: 'var(--border)' }}>
            <LogOut size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>
    </header>
  );
}
