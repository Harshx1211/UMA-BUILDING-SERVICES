'use client';
import {
  createContext, useContext, useEffect,
  useState, useCallback, useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/types';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface AuthContextType {
  user:     User | null;
  loading:  boolean;
  hydrated: boolean;
  signIn:   (email: string, password: string) => Promise<string | null>;
  signOut:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, hydrated: false,
  signIn: async () => null,
  signOut: async () => {},
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const CACHE_KEY = 'sitetrack_superadmin_profile';

function buildSuperadminUser(su: SupabaseUser): User {
  return {
    id:         su.id,
    email:      su.email ?? '',
    full_name:  (su.user_metadata?.full_name as string) ?? 'Platform Superadmin',
    role:       'superadmin' as unknown as User['role'],
    phone:      null,
    avatar_url: null,
    push_token: null,
    is_active:  true,
    created_at: su.created_at ?? new Date().toISOString(),
  };
}

function readCache(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCache(u: User) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(u)); } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/* ─── Provider ────────────────────────────────────────────────────────────── */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Ref so the onAuthStateChange closure always reads the latest user value.
  // Prevents the stale-closure bug: background token refreshes are silent
  // for already-authenticated users.
  const userRef = useRef<User | null>(null);

  const setUserSync = useCallback((u: User | null) => {
    userRef.current = u;
    setUser(u);
  }, []);

  // Verifies superadmin status via the /api/superadmin/verify endpoint,
  // then updates state. Network errors fall back to the cached user.
  const verifyAndLoad = useCallback(async (su: SupabaseUser) => {
    try {
      const res = await fetch('/api/superadmin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: su.id }),
      });

      if (!res.ok) {
        // Server error (5xx) — trust existing session, don't boot user
        const cached = readCache();
        setUserSync(cached ?? buildSuperadminUser(su));
        return;
      }

      const { isSuper } = await res.json();
      if (isSuper) {
        const finalUser = buildSuperadminUser(su);
        
        // Prevent UI flicker: only update state if data actually changed
        if (!userRef.current || JSON.stringify(userRef.current) !== JSON.stringify(finalUser)) {
          setUserSync(finalUser);
          writeCache(finalUser);
        }
      } else {
        // Server explicitly says NOT a superadmin — clear session
        clearCache();
        setUserSync(null);
        await supabase.auth.signOut();
      }
    } catch {
      // Network error — use cache or fallback, never sign out
      const cached = readCache();
      setUserSync(cached ?? buildSuperadminUser(su));
    }
  }, [setUserSync]);

  // ── Single initialisation effect ────────────────────────────────────────
  // Cache read is synchronous and happens BEFORE the auth listener is
  // attached, so userRef.current is always set before any event fires.
  useEffect(() => {
    // ① Synchronously hydrate from localStorage
    const cached = readCache();
    if (cached) {
      userRef.current = cached;
      setUser(cached);
      setLoading(false);
    }
    setHydrated(true);

    // ② Attach auth listener — userRef is already populated
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUserSync(null);
          setLoading(false);
          clearCache();
          return;
        }

        // Background token refreshes are silent for logged-in users.
        if (!userRef.current) {
          setLoading(true);
        }

        verifyAndLoad(session.user).finally(() => setLoading(false));
      },
    );

    // Tab-focus refresh: silently re-verify when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) verifyAndLoad(session.user);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [verifyAndLoad, setUserSync]);

  /* ── signIn ──────────────────────────────────────────────────────────── */
  const signIn = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
    });
    if (error) return error.message;

    if (data.user) {
      try {
        const res = await fetch('/api/superadmin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id }),
        });
        const { isSuper } = await res.json();
        if (!isSuper) {
          await supabase.auth.signOut();
          return 'Unauthorized. Superadmin access only.';
        }
      } catch {
        console.warn('[Auth] Verify network error — allowing login');
      }
    }

    return null;
  };

  /* ── signOut ─────────────────────────────────────────────────────────── */
  const signOut = async () => {
    clearCache();
    setUserSync(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, hydrated, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
