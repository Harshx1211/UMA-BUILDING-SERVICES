'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Shield } from 'lucide-react';

/* ── Loading splash (first-time login only) ───────────────────────────────── */
function LoadingSplash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
          <Shield size={24} color="white" strokeWidth={2.5} />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--accent)', animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <p className="text-sm font-semibold tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          LOADING PLATFORM...
        </p>
      </div>
    </div>
  );
}

/* ── Inner layout ─────────────────────────────────────────────────────────── */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrated, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !loading) {
      if (!user || user.role !== 'superadmin') {
        // Hard redirect to clear stuck states and flush cache properly
        if (user) signOut();
        window.location.href = '/login';
      }
    }
  }, [hydrated, loading, user, signOut]);

  // Heartbeat access check
  useEffect(() => {
    if (user?.id) {
      supabase.from('users').select('is_active').eq('id', user.id).single()
        .then(({ data, error }) => {
          if (!error && data && data.is_active === false) {
            signOut();
          }
        });
    }
  }, [user?.id, signOut]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ① If fully loaded and NO user or wrong role, block render entirely
  if (hydrated && !loading && (!user || user.role !== 'superadmin')) return null;

  // ② Render the dashboard shell
  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: 'var(--bg)' }}
    >
      {/* Show Loading Splash overlay ONLY if genuinely loading */}
      {(!hydrated || loading) && (
        <div className="absolute inset-0 z-50">
          <LoadingSplash />
        </div>
      )}

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 relative">
          {/* Strict guard: never render children if unauthorized, prevents 401 errors */}
          {(!hydrated || loading || !user || user.role !== 'superadmin') ? null : children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <LayoutInner>{children}</LayoutInner>;
}
