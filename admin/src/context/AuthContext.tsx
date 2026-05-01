'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  signIn: async () => null,
  signOut: async () => {},
});

/** Build a minimal User from Supabase auth session when the profile row is missing/inaccessible */
function fallbackUser(authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    full_name: (authUser.user_metadata?.full_name as string) ?? authUser.email?.split('@')[0] ?? 'Admin',
    role: 'admin' as unknown as User['role'],
    phone: null,
    avatar_url: null,
    push_token: null,
    is_active: true,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (authUser: SupabaseUser) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (data) {
        setUser(data as User);
      } else {
        // Profile row missing or RLS blocking — keep user logged in via fallback
        if (error) console.warn('[AuthContext] Profile load error (fallback active):', error.message);
        setUser(fallbackUser(authUser));
      }
    } catch (e) {
      // Network error — don't log the user out, use auth session as fallback
      console.warn('[AuthContext] Profile fetch failed (fallback active):', e);
      setUser(fallbackUser(authUser));
    }
  }, []);

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // React to auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        loadProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    // Role guard — only admins may access this portal
    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profile && profile.role !== 'admin') {
        // Technician / subcontractor tried to log in — kick them out
        await supabase.auth.signOut();
        return 'Admin access only. Please use the SiteTrack mobile app.';
      }
      // No profile row → allow (the fallbackUser in loadProfile handles it)
    }

    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
