'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Zap } from 'lucide-react';
import LegalGate from '@/components/layout/LegalGate';

/* ── Loading splash (first-time login only) ───────────────────────────────── */
function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg,var(--accent),var(--accent))',
            boxShadow: '0 8px 32px rgba(232,101,10,0.4)',
          }}
        >
          <Zap size={24} color="white" strokeWidth={2.5} />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{
                background: 'var(--accent)',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-sm font-semibold tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          LOADING WORKSPACE...
        </p>
      </div>
    </div>
  );
}

/* ── Inner layout ─────────────────────────────────────────────────────────── */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, hydrated, signOut } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !loading) {
      if (!user || user.role !== 'admin') {
        // Hard redirect to clear stuck states and flush cache properly
        if (user) signOut();
        window.location.href = '/login';
      }
    }
  }, [hydrated, loading, user, signOut]);

  // Heartbeat access check: Poll every 30s + on navigation
  useEffect(() => {
    if (!user?.id) return;

    const checkAccess = () => {
      supabase.from('users').select('is_active, companies(subscription_status)').eq('id', user.id).single()
        .then(({ data, error }) => {
          if (!error && data) {
            // @ts-expect-error Companies might not be typed properly yet
            const companyStatus = data.companies?.subscription_status;
            if (data.is_active === false || companyStatus === 'suspended') {
              signOut();
            }
          }
        });
    };

    checkAccess(); // Check immediately on mount/nav
    const interval = setInterval(checkAccess, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [pathname, user?.id, signOut]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);



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

      {/* Show Legal Gate overlay if terms not accepted */}
      {hydrated && user && user.role === 'admin' && !user.accepted_tos_at && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <LegalGate 
            userId={user.id} 
            onAccepted={() => window.location.reload()} 
          />
        </div>
      )}

      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setMobileOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <LayoutInner>{children}</LayoutInner>;
}
