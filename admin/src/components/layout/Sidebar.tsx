'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Briefcase, Building2,
  Users, FileText, Settings, Bell, ChevronLeft, ChevronRight,
  ClipboardList, LogOut, Zap, X, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard',     href: '/dashboard',    icon: LayoutDashboard },
      { label: 'Jobs',          href: '/jobs',          icon: Briefcase },
      { label: 'Properties',    href: '/properties',    icon: Building2 },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Technicians',   href: '/technicians',   icon: Users },
      { label: 'Quotes',        href: '/quotes',        icon: FileText },
      { label: 'Catalogue',     href: '/catalogue',     icon: BookOpen },
      { label: 'Reports',       href: '/reports',       icon: ClipboardList },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings',      href: '/settings',      icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  // Close mobile drawer on route change
  useEffect(() => { onMobileClose?.(); }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const NavContent = () => (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#ff9a3c,#F97316)', boxShadow: '0 4px 14px rgba(249,115,22,0.45)' }}>
          <Zap size={17} color="#fff" strokeWidth={2.5} />
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="animate-fade-in overflow-hidden flex-1">
            <p className="text-white text-sm font-bold leading-none tracking-tight">SiteTrack</p>
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>Admin Portal</p>
          </div>
        )}
        {/* Close button on mobile */}
        {mobileOpen && (
          <button onClick={onMobileClose} className="ml-auto p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {(!collapsed || mobileOpen) && (
              <p className="text-xs font-semibold uppercase tracking-widest px-3 mb-2"
                style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em' }}>
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ label, href, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href} title={collapsed && !mobileOpen ? label : undefined}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative overflow-hidden"
                    style={{
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.50)',
                      background: active ? 'rgba(249,115,22,0.14)' : 'transparent',
                      borderLeft: active ? '2.5px solid #F97316' : '2.5px solid transparent',
                    }}>
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0 relative z-10"
                      style={{ color: active ? '#F97316' : undefined }} />
                    {(!collapsed || mobileOpen) && (
                      <span className="truncate relative z-10">{label}</span>
                    )}
                    {collapsed && !mobileOpen && (
                      <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-gray-800">
                        {label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {(!collapsed || mobileOpen) ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors group cursor-default">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#ff9a3c,#F97316)' }}>
              {user?.full_name?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold leading-tight truncate">{user?.full_name ?? 'Admin'}</p>
              <p className="text-xs truncate leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{user?.email}</p>
            </div>
            <button onClick={signOut} title="Sign out"
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
              <LogOut size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </button>
          </div>
        ) : (
          <button onClick={signOut} title="Sign out"
            className="w-full flex justify-center p-2.5 rounded-xl hover:bg-white/10 transition-colors">
            <LogOut size={16} style={{ color: 'rgba(255,255,255,0.45)' }} />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        'hidden lg:flex flex-col flex-shrink-0 h-screen transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-[70px]' : 'w-[248px]'
      )}
        style={{ background: 'linear-gradient(180deg,#0d1b35 0%,#0F1E3C 40%,#0d1a36 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <NavContent />
        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3.5 top-[60px] w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-20"
          style={{ borderColor: 'var(--border)' }}>
          {collapsed
            ? <ChevronRight size={12} strokeWidth={2.5} style={{ color: 'var(--text-secondary)' }} />
            : <ChevronLeft  size={12} strokeWidth={2.5} style={{ color: 'var(--text-secondary)' }} />}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div className="lg:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onMobileClose} />
          {/* Drawer */}
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col w-[280px] animate-slide-left"
            style={{ background: 'linear-gradient(180deg,#0d1b35 0%,#0F1E3C 40%,#0d1a36 100%)' }}>
            <NavContent />
          </aside>
        </>
      )}
    </>
  );
}
