// Zustand authentication store — manages user session, sign-in/out, and session restoration
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, signOut as supabaseSignOut } from '@/lib/supabase';
import { stopSync } from '@/lib/sync';
import { SESSION_KEY } from '@/constants/Config';
import type { User } from '@/types';
import { UserRole } from '@/constants/Enums';


const REMEMBER_ME_KEY    = '@uma-building-services/remember_me';
const USER_PROFILE_KEY   = '@uma-building-services/user_profile'; // FLOW-11: offline session cache

// ---------------------------------------------
// Types
// ---------------------------------------------

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

// Helper: race a promise against a timeout — returns null on timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([promise, timer]);
}

// ---------------------------------------------
// Store
// ---------------------------------------------

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  // Sign in
  signIn: async (email, password, rememberMe = false) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        console.error('[AuthStore] signIn error:', error.message, error);
        set({ error: error.message, isLoading: false });
        return;
      }

      if (!data.session || !data.user) {
        console.error('[AuthStore] signIn failed: No session or user returned.', data);
        set({ error: 'Sign in failed — no session returned.', isLoading: false });
        return;
      }

      // Fetch full profile from public.users
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // No profile row — could be an admin account (no technician row).
        // Build a minimal fallback from the auth session so they can still log in.
        const fallback: User = {
          id: data.user.id,
          email: data.user.email ?? '',
          full_name:
            (data.user.user_metadata?.full_name as string) ??
            data.user.email?.split('@')[0] ??
            'User',
          role: 'admin' as unknown as UserRole,
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: data.user.created_at ?? new Date().toISOString(),
        };
        if (rememberMe) await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(fallback));
        set({ user: fallback, session: data.session, isAuthenticated: true, isLoading: false, error: null });
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      }
      // FLOW-11: Cache profile so offline restoreSession can succeed without network
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));

      set({
        user: profile as User,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[AuthStore] signIn unexpected exception:', err);
      set({
        error: 'An unexpected error occurred. Please try again.',
        isLoading: false,
      });
    }
  },

  // Sign out
  signOut: async () => {
    set({ isLoading: true });
    try {
      stopSync();
      await supabaseSignOut();
      // Security: clear ALL session data including cached profile.
      // Without USER_PROFILE_KEY removal, signing in as a different user
      // via biometrics would restore the previous user's profile.
      await AsyncStorage.multiRemove([REMEMBER_ME_KEY, SESSION_KEY, USER_PROFILE_KEY]);
    } catch (err) {
      console.error('[AuthStore] signOut error:', err);
    } finally {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  // Restore session on app launch
  // Uses 5-second timeouts so the app NEVER hangs on the splash screen
  // if Supabase is unreachable (offline, slow network, etc.)
  restoreSession: async () => {
    set({ isLoading: true });
    try {
      // C1 FIX: Check AsyncStorage cache first — instant auth for returning users / offline
      // This is especially important for biometric login where we call restoreSession
      // directly and can't afford a 5-second network timeout blocking the UX.
      const [cachedProfileStr, sessionResult] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_KEY).catch(() => null),
        withTimeout(supabase.auth.getSession(), 5000),
      ]);

      // No valid session at all — send to login
      if (!sessionResult || sessionResult.error || !sessionResult.data.session) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const { session } = sessionResult.data;

      // If we have a cached profile, authenticate immediately — don't block on network
      if (cachedProfileStr) {
        try {
          const cached = JSON.parse(cachedProfileStr) as User;
          set({ user: cached, session, isAuthenticated: true, isLoading: false, error: null });
          // Refresh cache in the background (non-blocking) so it stays fresh
          void Promise.resolve(
            supabase.from('users').select('*').eq('id', session.user.id).single()
          ).then(({ data }) => {
            if (data) void AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data)).catch(() => null);
          }).catch(() => null);
          return;
        } catch { /* corrupt cache — fall through to network fetch */ }
      }

      // No cache: fetch profile from Supabase (with safety timeout)
      type ProfileResult = { data: User | null; error: { message: string } | null };
      const profileResult = await withTimeout<ProfileResult>(
        (supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single() as unknown) as Promise<ProfileResult>,
        5000
      );

      if (!profileResult || profileResult.error || !profileResult.data) {
        // Profile fetch failed — build minimal fallback from session
        const su = session.user;
        const fallback: User = {
          id: su.id,
          email: su.email ?? '',
          full_name: (su.user_metadata?.full_name as string) ?? su.email?.split('@')[0] ?? 'User',
          role: 'admin' as unknown as UserRole,
          phone: null,
          avatar_url: null,
          is_active: true,
          created_at: su.created_at ?? new Date().toISOString(),
        };
        set({ user: fallback, session, isAuthenticated: true, isLoading: false });
        return;
      }

      // Save fresh profile to cache for future fast restores
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profileResult.data));
      set({
        user: profileResult.data as User,
        session,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('[AuthStore] restoreSession error:', err);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // Update user profile in local state
  updateUser: (updates) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...updates } });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

// ---------------------------------------------
// Subscribe to Supabase auth state changes
// Handles token refresh, server-side sign-out, etc.
// ---------------------------------------------
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
    });
  } else if (event === 'TOKEN_REFRESHED' && session) {
    useAuthStore.setState({ session });
  }
});
