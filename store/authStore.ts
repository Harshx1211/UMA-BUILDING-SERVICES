// Zustand authentication store — manages user session, sign-in/out, and session restoration
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, signOut as supabaseSignOut } from '@/lib/supabase';
import { stopSync } from '@/lib/sync';
import { clearDatabase, getPendingSyncItems } from '@/lib/database';
import { SESSION_KEY } from '@/constants/Config';
import type { User } from '@/types';
import { UserRole } from '@/constants/Enums';


const REMEMBER_ME_KEY    = '@sitetrack/remember_me';
const USER_PROFILE_KEY   = '@sitetrack/user_profile'; // FLOW-11: offline session cache
const COMPANY_CACHE_KEY  = '@sitetrack/company_profile';

// ---------------------------------------------
// Types
// ---------------------------------------------

// Minimum shape we need from the company row (subscription gate + display).
// Extra columns from Supabase are permitted through the index signature.
export interface CompanyRecord {
  id: string;
  name: string;
  subscription_status: string;
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  company: CompanyRecord | null;
  session: Session | null;
  isLoading: boolean;
  isForceSyncing: boolean;
  isAuthenticated: boolean;
  error: string | null;
}


interface AuthActions {
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  forceFinalSyncAndSignOut: () => Promise<void>;
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
  company: null,
  session: null,
  isLoading: true,
  isForceSyncing: false,
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
          role: UserRole.Admin,
          company_id: null,
          phone: null,
          avatar_url: null,
          push_token: null,
          fpas_number: null,
          fpas_class: null,
          fpas_expiry: null,
          state_license: null,
          state_license_expiry: null,
          accepted_tos_at: null,
          accepted_aup_at: null,
          is_active: true,
          created_at: data.user.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (rememberMe) await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
        await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(fallback));
        set({ user: fallback, company: null, session: data.session, isAuthenticated: true, isLoading: false, error: null });
        return;
      }

      let fetchedCompany = null;
      // SaaS Subscription Lockout: check if the company is suspended
      if (profile.company_id) {
        const { data: companyRes } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .maybeSingle();
          
        if (companyRes) {
          fetchedCompany = companyRes;
          if (companyRes.subscription_status !== 'active') {
            await supabase.auth.signOut();
            set({ error: 'Your company account has been suspended. Please contact platform support.', isLoading: false });
            return;
          }
        }
      }

      // User Active Check: check if the technician was disabled by an admin
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        set({ error: 'Your account has been deactivated. Please contact your company administrator.', isLoading: false });
        return;
      }

      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');
      }
      // FLOW-11: Cache profile so offline restoreSession can succeed without network
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
      if (fetchedCompany) await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(fetchedCompany));

      set({
        user: profile as User,
        company: fetchedCompany,
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
      await AsyncStorage.multiRemove([REMEMBER_ME_KEY, SESSION_KEY, USER_PROFILE_KEY, COMPANY_CACHE_KEY]);
      clearDatabase();
    } catch (err) {
      console.error('[AuthStore] signOut error:', err);
    } finally {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isForceSyncing: false,
        error: null,
      });
    }
  },

  // Graceful exit for deactivated users — flushes offline data before wiping
  forceFinalSyncAndSignOut: async () => {
    // Prevent multiple parallel calls
    if (get().isForceSyncing) return;

    set({ isForceSyncing: true });
    try {
      let pending = getPendingSyncItems();
      if (pending.length > 0) {
        if (__DEV__) console.log(`[AuthStore] Deactivated user has ${pending.length} pending items. Attempting final sync...`);

        // FIX S2: Run processPhotoQueue FIRST so offline photo binaries upload.
        // _pushQueue only handles data records (Insert/Update/Delete/ReportGenerate).
        // Photo binaries live in a separate binary upload queue (photoUpload.ts).
        // Previously, offline photos were permanently lost on forced logout.
        const { processPhotoQueue } = await import('@/lib/photoUpload');
        const { _pushQueue } = await import('@/lib/sync');
        const currentUserId = get().user?.id ?? session?.user.id ?? '';

        for (let i = 0; i < 5; i++) {
          await processPhotoQueue(currentUserId);
          await _pushQueue();
          pending = getPendingSyncItems();
          if (pending.length === 0) break;
          // Exponential backoff: 1s, 2s, 3s, 4s, 5s
          await new Promise(r => setTimeout(r, (i + 1) * 1000));
        }

        // Critical Data Loss Prevention:
        // If we still have pending items (poor connection), DO NOT wipe the DB.
        if (pending.length > 0) {
          console.warn(`[AuthStore] Final sync failed. ${pending.length} items remain. Aborting logout to prevent data loss.`);
          set({ isForceSyncing: false });
          import('react-native').then(rn => {
            rn.Alert.alert(
              'Final Sync Failed',
              'Your account was deactivated, but we could not upload your final offline work. Please connect to a strong Wi-Fi network so your work is not lost.',
              [{ text: 'OK' }]
            );
          });
          return;
        }
      }

      await get().signOut();
    } catch (err) {
      console.error('[AuthStore] forceFinalSyncAndSignOut error:', err);
      set({ isForceSyncing: false });
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
      const [cachedProfileStr, cachedCompanyStr, sessionResult] = await Promise.all([
        AsyncStorage.getItem(USER_PROFILE_KEY).catch(() => null),
        AsyncStorage.getItem(COMPANY_CACHE_KEY).catch(() => null),
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
          // FIX A2: Validate cached profile belongs to the current session user.
          // Without this check, a device used by User A then User B would restore
          // User A's profile even after User B signs in (stale AsyncStorage key).
          if (cached.id !== session.user.id) {
            if (__DEV__) console.warn('[AuthStore] Cached profile user mismatch — discarding stale cache.');
            await AsyncStorage.multiRemove([USER_PROFILE_KEY, COMPANY_CACHE_KEY]).catch(() => null);
            throw new Error('stale cache');
          }
          const cachedCompany = cachedCompanyStr ? JSON.parse(cachedCompanyStr) : null;
          set({ user: cached, company: cachedCompany, session, isAuthenticated: true, isLoading: false, error: null });
          // Refresh cache in the background (non-blocking) so it stays fresh
          // Also verify the company hasn't been suspended while the app was closed
          void Promise.resolve().then(async () => {
            const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
            if (profile) {
              await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)).catch(() => null);
              
              if (profile.company_id) {
                const { data: companyRes } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', profile.company_id)
                  .maybeSingle();
                
                if (companyRes) {
                  await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(companyRes)).catch(() => null);
                  useAuthStore.setState({ company: companyRes });
                  // FIX: Check is_active FIRST, inside the companyRes branch.
                  // Previously, is_active was only checked in the `else if` branch
                  // that only ran when companyRes was null. A deactivated user with
                  // a valid company row was never logged out.
                  if (profile.is_active === false) {
                    console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                    get().forceFinalSyncAndSignOut();
                  } else if (companyRes.subscription_status !== 'active') {
                    console.warn('[AuthStore] Company suspended during background check. Forcing graceful logout.');
                    get().forceFinalSyncAndSignOut();
                  }
                } else if (profile.is_active === false) {
                  console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                  get().forceFinalSyncAndSignOut();
                }
              } else if (profile.is_active === false) {
                console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                get().forceFinalSyncAndSignOut();
              }
            }
          });
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
          role: UserRole.Admin,
          company_id: null,
          phone: null,
          avatar_url: null,
          push_token: null,
          fpas_number: null,
          fpas_class: null,
          fpas_expiry: null,
          state_license: null,
          state_license_expiry: null,
          accepted_tos_at: null,
          accepted_aup_at: null,
          is_active: true,
          created_at: su.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set({ user: fallback, company: null, session, isAuthenticated: true, isLoading: false });
        return;
      }

      // Save fresh profile to cache for future fast restores
      const profileData = profileResult.data as User;
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profileData));
      
      let fetchedCompany = null;
      // If we did a network fetch, check subscription status before allowing them in
      if (profileData.company_id) {
        const { data: companyRes } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profileData.company_id)
          .maybeSingle();
          
        if (companyRes) {
          fetchedCompany = companyRes;
          await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(companyRes));
          
          if (companyRes.subscription_status !== 'active') {
            console.warn('[AuthStore] Company suspended during network restore. Forcing graceful logout.');
            get().forceFinalSyncAndSignOut();
            return;
          }
        }
      }

      if (profileData.is_active === false) {
        console.warn('[AuthStore] User deactivated during network restore. Forcing graceful logout.');
        get().forceFinalSyncAndSignOut();
        return;
      }

      set({
        user: profileData,
        company: fetchedCompany,
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
    // FIX A3: Clear SQLite and AsyncStorage on sign-out so a previous user's
    // data doesn't persist on shared devices. stopSync() prevents the sync
    // engine from trying to pull data for a user who is no longer logged in.
    stopSync();
    clearDatabase();
    AsyncStorage.multiRemove([USER_PROFILE_KEY, COMPANY_CACHE_KEY, SESSION_KEY]).catch(() => null);
    useAuthStore.setState({
      user: null,
      company: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
    });
  } else if (event === 'TOKEN_REFRESHED' && session) {
    useAuthStore.setState({ session });
  }
});
