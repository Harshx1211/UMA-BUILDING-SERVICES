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

const CACHE_KEY = 'sitetrack_admin_profile';

function buildFallback(su: SupabaseUser): User {
  return {
    id:         su.id,
    email:      su.email ?? '',
    full_name:  (su.user_metadata?.full_name as string)
                  ?? su.email?.split('@')[0]
                  ?? 'Admin',
    role:       'admin' as unknown as User['role'],
    phone:      null,
    avatar_url: null,
    push_token: null,
    is_active:  true,
    created_at: su.created_at ?? new Date().toISOString(),
    accepted_tos_at: null,
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
  // All state starts at "unknown" values that match SSR output exactly.
  // We never read localStorage during render — only inside useEffect.
  const [user,     setUser]     = useState<User | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // A ref so that the onAuthStateChange closure ALWAYS reads the latest user.
  // React state updates are async; ref updates are synchronous.
  // This is the fix for the "redirect on every page navigation" bug:
  // without the ref, the closure captures user=null from the first render
  // and sets loading=true on every background token refresh.
  const userRef = useRef<User | null>(null);

  // Helper that keeps ref and state in sync.
  const setUserSync = useCallback((u: User | null) => {
    userRef.current = u;
    setUser(u);
  }, []);

  // Fetches the DB profile row and updates state + cache.
  // Never touches loading — callers manage that.
  const fetchProfile = useCallback(async (su: SupabaseUser) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*, companies(subscription_status)')
        .eq('id', su.id)
        .maybeSingle();

      if (data) {
        const companyStatus = (data as any).companies?.subscription_status;
        if (data.is_active === false || companyStatus === 'suspended') {
          clearCache();
          setUserSync(null);
          await supabase.auth.signOut();
          return;
        }
      }

      const resolved = data ? (data as User) : buildFallback(su);
      
      // Prevent UI flicker: only update state if data actually changed
      if (!userRef.current || JSON.stringify(userRef.current) !== JSON.stringify(resolved)) {
        setUserSync(resolved);
        writeCache(resolved);
      }
    } catch {
      // Network error: prefer existing cache over re-building fallback
      // so the user's name/role doesn't flicker.
      const cached = readCache();
      if (cached) { setUserSync(cached); return; }
      const fallback = buildFallback(su);
      setUserSync(fallback);
    }
  }, [setUserSync]);

  // ── Single initialisation effect ────────────────────────────────────────
  // Doing BOTH the cache read AND the auth listener setup in one effect
  // guarantees that userRef.current is populated BEFORE any Supabase
  // auth event can fire (JavaScript is single-threaded; the listener
  // callback cannot run until after this synchronous block finishes).
  useEffect(() => {
    // ① Read cache synchronously → ref is set before any event fires.
    const cached = readCache();
    if (cached) {
      userRef.current = cached;   // sync — ref is always up-to-date
      setUser(cached);            // async — triggers re-render
      setLoading(false);
    }
    setHydrated(true);

    // ② Attach the Supabase auth listener.
    //    At this point userRef.current already reflects the cache (or null).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          // Explicit logout or session gone.
          setUserSync(null);
          setLoading(false);
          clearCache();
          return;
        }

        // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION:
        // Check the REF (always fresh) — NOT the stale closure variable.
        // If we already have a user (from cache), background refreshes are silent.
        if (!userRef.current) {
          setLoading(true);
        }

        fetchProfile(session.user).finally(() => setLoading(false));
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, setUserSync]); // stable refs — effect runs once

  /* ── signIn ──────────────────────────────────────────────────────────── */
  const signIn = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password,
    });
    if (error) return error.message;

    // Gate-check: verify this Supabase user is actually an admin
    // with an active company subscription.
    const token = data.session?.access_token;
    try {
      const res = await fetch('/api/admin/session', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        await supabase.auth.signOut();
        if (json.reason === 'suspended')
          return 'Your company account has been suspended. Contact platform support.';
        if (json.reason === 'deactivated')
          return 'Your account has been deactivated. Please contact your administrator.';
        if (json.reason === 'not_admin')
          return 'Admin access only. Please use the mobile app.';
        return 'Access denied. Contact your administrator.';
      }
    } catch {
      // Network error during gate-check — let the user in.
      // Individual API routes still enforce auth independently.
      console.warn('[Auth] Gate-check network error — allowing login');
    }

    // onAuthStateChange will fire and call fetchProfile automatically.
    return null;
  };

  /* ── signOut ─────────────────────────────────────────────────────────── */
  const signOut = async () => {
    clearCache();
    setUserSync(null);
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT event will also fire and is idempotent.
  };

  return (
    <AuthContext.Provider value={{ user, loading, hydrated, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
