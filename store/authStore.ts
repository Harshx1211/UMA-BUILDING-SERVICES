// Zustand authentication store — manages user session, sign-in/out, and session restoration
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, signOut as supabaseSignOut } from '@/lib/supabase';
import { stopSync } from '@/lib/sync';
import { clearDatabase, getPendingSyncItems } from '@/lib/database';
import { setCurrentUserId } from '@/lib/currentUserId';
import { showConfirm } from '@/components/ui';
import { SESSION_KEY, LAST_SYNCED_KEY, LAST_DELETION_LOG_ID_KEY, LAST_NOTIFICATION_PULL_KEY } from '@/constants/Config';
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
  /** Returns false (and leaves the session intact) if unsynced work couldn't be flushed first. */
  signOut: () => Promise<boolean>;
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

// FIX: every OTHER feature store (jobs, dashboard, notifications, defects,
// photos, documents, catalogue, inspection) used to keep whatever it last
// held in memory across a sign-out — only authStore's own fields and SQLite
// (via clearDatabase()) were ever cleared. Since these are module-level
// Zustand singletons, a fast second login on a shared device could render a
// frame of the PREVIOUS technician's jobs/photos/notifications before each
// store's own next load() call happened to overwrite it. Dynamic imports
// here (not static ones) are deliberate: several of these stores already
// import authStore for company_id/user lookups, so a static import back
// from authStore would be a circular dependency — same pattern this file
// already uses for lib/sync.ts below.
async function resetAllFeatureStores(): Promise<void> {
  const [
    { useJobsStore }, { useDashboardStore }, { useNotificationsStore },
    { useDefectsStore }, { usePhotosStore }, { useDocumentsStore },
    { useCatalogueStore }, { useInspectionStore }, { useNotebookStore },
  ] = await Promise.all([
    import('@/store/jobsStore'), import('@/store/dashboardStore'), import('@/store/notificationsStore'),
    import('@/store/defectsStore'), import('@/store/photosStore'), import('@/store/documentsStore'),
    import('@/store/catalogueStore'), import('@/store/inspectionStore'),
    // FIX: added after the fact — this store was introduced later (its
    // property_notebook_items table shipped 2026-09-19, after this reset
    // list was already written) and never got added here, reintroducing
    // exactly the stale-singleton class every other store above was
    // already fixed for. Its only current consumer reloads before
    // rendering on every open, so no on-screen flash was proven today —
    // but the very next consumer that reads it without doing that (a
    // notes-count badge, a search screen) would have one.
    import('@/store/notebookStore'),
  ]);
  useJobsStore.getState().reset();
  useDashboardStore.getState().reset();
  useNotificationsStore.getState().reset();
  useDefectsStore.getState().reset();
  usePhotosStore.getState().reset();
  useDocumentsStore.getState().reset();
  useCatalogueStore.getState().reset();
  useInspectionStore.getState().reset();
  useNotebookStore.getState().reset();
}

// FIX: app/(app)/jobs/[id]/signature.tsx persists an in-progress signature
// draft under `draft_tech_sig_<jobId>` (no user/company prefix) so it
// survives an app kill before the technician taps Save — but nothing ever
// swept these on sign-out, so a draft abandoned without returning to that
// screen lingers in AsyncStorage indefinitely. Job ids are globally-unique
// UUIDs gated by jobs_tenant_isolation RLS, so this was never a cross-
// tenant confidentiality leak (a different company's technician can never
// navigate to this job id to read it back) — purely unbounded local
// storage housekeeping. AsyncStorage has no native prefix-delete, so this
// scans all keys once and removes only the matching ones.
async function sweepDraftSignatureKeys(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((k) => k.startsWith('draft_tech_sig_'));
    if (draftKeys.length > 0) await AsyncStorage.multiRemove(draftKeys);
  } catch { /* best-effort housekeeping — never block sign-out on this */ }
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

      // Fetch full profile from public.users — embeds the linked company row
      // in the SAME query via the users.company_id -> companies.id FK
      // (PostgREST resolves this server-side) instead of two sequential
      // round trips (profile, then company). FIX (cold-start "1 full
      // second" from login tap to Home screen): this was the second of
      // three back-to-back awaited network calls in this function
      // (signInWithPassword, profile fetch, company fetch) — each one a
      // real round trip to Supabase, not a local read. Cutting one out
      // directly cuts one round trip off the login→Home critical path.
      const { data: profileWithCompany, error: profileError } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('id', data.user.id)
        .maybeSingle();

      // FIX: a real fetch error (network/DB issue) used to be treated
      // identically to "confirmed no profile row exists" — both fell into
      // the fallback branch below, which grants a full-access, Admin-
      // labelled local session with none of the is_active/subscription
      // checks further down ever running. .maybeSingle() returns
      // {data: null, error: null} for a genuine zero-row result, so a
      // truthy profileError here specifically means the query itself
      // failed — that must never grant access, only a confirmed empty
      // result should.
      if (profileError) {
        console.error('[AuthStore] signIn: profile fetch failed:', profileError.message);
        await supabase.auth.signOut();
        set({ error: 'Could not verify your account — check your connection and try again.', isLoading: false });
        return;
      }

      if (!profileWithCompany) {
        // Confirmed no profile row — could be an admin account (no technician row).
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

      // Split the embedded relation back out — PostgREST returns it as a
      // nested `companies` object (singular: company_id is a to-one FK)
      // right on the same row, null when the user has no company.
      const { companies: fetchedCompany, ...profile } = profileWithCompany as (User & { companies: CompanyRecord | null });

      // SaaS Subscription Lockout: check if the company is suspended
      if (fetchedCompany && fetchedCompany.subscription_status !== 'active') {
        await supabase.auth.signOut();
        set({ error: 'Your company account has been suspended. Please contact platform support.', isLoading: false });
        return;
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
      // FIX: stopSync() is now async specifically because it must be
      // awaited here — it doesn't just signal a running background sync to
      // stop, it also tears down both realtime channels and waits for their
      // unsubscribe to actually be confirmed server-side, closing the
      // window where a postgres_changes message already in flight could
      // still land in local SQLite after clearDatabase() runs below (see
      // stopSync's own comment for the full reasoning).
      await stopSync();

      // FIX: stopSync() only signals a running background sync to stop at
      // its next checkpoint — it doesn't abort one already mid-_pullJobs(),
      // whose writes land in local SQLite regardless. Without this wait, the
      // pending-items check just below (and clearDatabase() past it) used to
      // run immediately whenever nothing was queued to push — the common
      // case — letting an in-flight pull's writes for this now-signing-out
      // user land in SQLite after it had just been wiped for the next
      // login. See waitForSyncIdle's own comment.
      const { waitForSyncIdle } = await import('@/lib/sync');
      await waitForSyncIdle();

      // FIX: signOut() used to wipe the local database unconditionally, even
      // with unsynced work still queued (offline inspection results, photos,
      // defects) — silently destroying it, despite the sign-out confirmation
      // dialog promising "unsynced changes will sync next time you log in."
      // Attempt a bounded final flush first, same retry shape as
      // forceFinalSyncAndSignOut, and abort the sign-out (keep the session)
      // if it still can't get everything up.
      {
        const { flushPendingSyncWithRetry } = await import('@/lib/sync');
        const currentUserId = get().user?.id ?? get().session?.user.id ?? '';
        const pending = await flushPendingSyncWithRetry(currentUserId);

        if (pending.length > 0) {
          console.warn(`[AuthStore] signOut: ${pending.length} item(s) still unsynced — aborting to prevent data loss.`);
          set({ isLoading: false });
          showConfirm({
            title: 'Unsynced Work',
            message: 'You have offline work that hasn\'t reached the server yet. Connect to Wi-Fi or mobile data and try again so it isn\'t lost.',
            icon: 'cloud-alert-outline',
          });
          return false;
        }
      }

      await supabaseSignOut();
      // Security: clear ALL session data including cached profile.
      // Without USER_PROFILE_KEY removal, signing in as a different user
      // via biometrics would restore the previous user's profile.
      // FIX: the three sync checkpoint keys below were never cleared here —
      // on a shared/pool device, the NEXT (different-company) technician who
      // signs in inherits this account's leftover deletion-log/notification
      // checkpoints, since both only ever advance forward and never
      // backfill. That silently and permanently skips any of the new
      // account's own deletions/notifications whose id/timestamp happens to
      // be at or before the old checkpoint — e.g. a decommissioned asset can
      // stay a permanently visible "ghost" for the new user. See
      // lib/sync.ts's _pullDeletions/_pullNotifications for how these are
      // used. LAST_SYNCED_KEY is included too for the same hygiene reason,
      // though its only live effect today is a cosmetic stale timestamp.
      await AsyncStorage.multiRemove([
        REMEMBER_ME_KEY, SESSION_KEY, USER_PROFILE_KEY, COMPANY_CACHE_KEY,
        LAST_SYNCED_KEY, LAST_DELETION_LOG_ID_KEY, LAST_NOTIFICATION_PULL_KEY,
      ]);
      await sweepDraftSignatureKeys();
      clearDatabase();
      await resetAllFeatureStores();
      set({
        user: null,
        company: null, // FIX: this was never cleared here — only via the
        // onAuthStateChange listener's own set() a moment later, which
        // worked only because supabaseSignOut() above happens to trigger
        // it first. Two separately-maintained copies of "what a full
        // sign-out clears" is exactly how the SIGNED_OUT listener's own
        // gap (see below) went unnoticed — set it directly here too.
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isForceSyncing: false,
        error: null,
      });
      return true;
    } catch (err) {
      console.error('[AuthStore] signOut error:', err);
      set({ isLoading: false });
      return false;
    }
  },

  // Graceful exit for deactivated users — flushes offline data before wiping
  forceFinalSyncAndSignOut: async () => {
    // Prevent multiple parallel calls
    if (get().isForceSyncing) return;

    set({ isForceSyncing: true });
    try {
      const currentUserId = get().user?.id ?? get().session?.user.id ?? '';
      // FIX: only this user's OWN pending items should factor into "is there
      // work worth flushing" — a shared/pool device can have a previous
      // account's queued edits still sitting here (see _pushQueue's own
      // comment on sync_queue.user_id), and those were never going to push
      // under this session anyway.
      const initialPending = getPendingSyncItems().filter((p) => !p.user_id || p.user_id === currentUserId);
      if (initialPending.length > 0) {
        if (__DEV__) console.log(`[AuthStore] Deactivated user has ${initialPending.length} pending items. Attempting final sync...`);

        // FIX S2: Run processPhotoQueue FIRST so offline photo binaries upload.
        // _pushQueue only handles data records (Insert/Update/Delete/ReportGenerate).
        // Photo binaries live in a separate binary upload queue (photoUpload.ts).
        // Previously, offline photos were permanently lost on forced logout.
        const { flushPendingSyncWithRetry } = await import('@/lib/sync');
        const pending = await flushPendingSyncWithRetry(currentUserId);

        // Critical Data Loss Prevention:
        // If we still have pending items (poor connection), DO NOT wipe the DB.
        if (pending.length > 0) {
          console.warn(`[AuthStore] Final sync failed. ${pending.length} items remain. Aborting logout to prevent data loss.`);
          set({ isForceSyncing: false });
          showConfirm({
            title: 'Final Sync Failed',
            message: 'Your account was deactivated, but we could not upload your final offline work. Please connect to a strong Wi-Fi network so your work is not lost.',
            icon: 'cloud-alert-outline',
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

            // FIX: this closure captures `session` from when restoreSession
            // was first called — it has no check that it's still the
            // active session by the time this fetch resolves. A sign-out
            // completing while this was in flight used to have this still
            // unconditionally write the fetched profile/company back into
            // AsyncStorage and the live store afterward, re-seeding this
            // user's data right after they'd just signed out (a data-bleed
            // risk on a shared device). Bail out before writing anything if
            // the store no longer reflects this same session.
            if (useAuthStore.getState().session?.user.id !== session.user.id) return;

            if (profile) {
              await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)).catch(() => null);

              // FIX (simplification): is_active used to be checked
              // separately in three different branches below (companyRes
              // truthy, companyRes falsy, no company_id at all) — three
              // copies of the same two-line "force logout" block, one edit
              // away from silently missing a branch again the way this
              // exact check already once did (see the git history this
              // replaced). Checked once, unconditionally, first.
              if (profile.is_active === false) {
                console.warn('[AuthStore] User deactivated during background check. Forcing graceful logout.');
                get().forceFinalSyncAndSignOut();
              } else if (profile.company_id) {
                const { data: companyRes } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', profile.company_id)
                  .maybeSingle();

                if (useAuthStore.getState().session?.user.id !== session.user.id) return;

                if (companyRes) {
                  await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(companyRes)).catch(() => null);
                  useAuthStore.setState({ company: companyRes });
                  if (companyRes.subscription_status !== 'active') {
                    console.warn('[AuthStore] Company suspended during background check. Forcing graceful logout.');
                    get().forceFinalSyncAndSignOut();
                  }
                }
              }
            }
          });
          return;
        } catch { /* corrupt cache — fall through to network fetch */ }
      }

      // No cache: fetch profile from Supabase (with safety timeout).
      // maybeSingle() (not single()) so a genuine zero-row result comes
      // back as {data: null, error: null} — distinguishable from a real
      // fetch error, which single() would otherwise conflate into the same
      // error shape as "no such user."
      // FIX: same round-trip-cutting change as signIn() above — embed the
      // linked company row in this same query instead of a second
      // sequential fetch further down.
      type ProfileResult = { data: (User & { companies: CompanyRecord | null }) | null; error: { message: string } | null };
      const profileResult = await withTimeout<ProfileResult>(
        (supabase
          .from('users')
          .select('*, companies(*)')
          .eq('id', session.user.id)
          .maybeSingle() as unknown) as Promise<ProfileResult>,
        5000
      );

      // FIX: a timeout or a real fetch error used to be treated identically
      // to "confirmed this user has no profile row" — all three fell into
      // the same fallback, granting a full-access local session with none
      // of the is_active/subscription checks below ever running. There's no
      // cache to fall back on at this point either (that's the branch
      // above) — the honest answer when the network genuinely can't verify
      // this session is "not authenticated," not a fabricated grant.
      if (!profileResult || profileResult.error) {
        console.warn('[AuthStore] restoreSession: profile fetch failed or timed out — cannot verify this session offline with no cache.', profileResult?.error?.message);
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      if (!profileResult.data) {
        // Confirmed zero rows — an admin account with no technician row.
        // Build a minimal fallback from the auth session so they can still log in.
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

      // Split the embedded relation back out — same shape as signIn()'s own
      // combined query above.
      const { companies: fetchedCompany, ...profileData } = profileResult.data;

      // Save fresh profile to cache for future fast restores
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profileData));

      // If we did a network fetch, check subscription status before allowing them in
      if (fetchedCompany) {
        await AsyncStorage.setItem(COMPANY_CACHE_KEY, JSON.stringify(fetchedCompany));

        if (fetchedCompany.subscription_status !== 'active') {
          console.warn('[AuthStore] Company suspended during network restore. Forcing graceful logout.');
          get().forceFinalSyncAndSignOut();
          return;
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

// FIX: keeps lib/currentUserId.ts's module-level value in lockstep with
// this store's own `user`, driven by the resulting state rather than
// scattered at every individual set({ user: ... }) call site above (of
// which there are several — sign-in, restore-session, and their various
// fallback paths) — a subscription can't be accidentally missed the way
// one more sprinkled call easily could be. See that file's own comment
// for why lib/database.ts needs this at all instead of importing
// useAuthStore directly (circular import).
useAuthStore.subscribe((state, prevState) => {
  if (state.user?.id !== prevState.user?.id) {
    setCurrentUserId(state.user?.id ?? null);
  }
});

// ---------------------------------------------
// Subscribe to Supabase auth state changes
// Handles token refresh, server-side sign-out, etc.
// ---------------------------------------------
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    // FIX A3 (original): Clear SQLite and AsyncStorage on sign-out so a
    // previous user's data doesn't persist on shared devices. stopSync()
    // prevents the sync engine from trying to pull data for a user who is
    // no longer logged in.
    //
    // CRITICAL FIX: this used to call clearDatabase() unconditionally the
    // instant this fired — but Supabase fires SIGNED_OUT not only on a
    // user-initiated sign-out but also silently, in the background,
    // whenever a token refresh fails (autoRefreshToken is on — see
    // lib/supabase.ts — so this happens on its own after e.g. a long
    // offline stretch with an expired refresh token). That wiped a
    // technician's entire day of offline inspection work — results,
    // defects, photos, all still sitting in sync_queue — with zero warning,
    // via a path that completely bypassed the "Unsynced Work" safeguard
    // signOut() has, just above. Mirror that same bounded flush-then-check
    // here, and only wipe local data once nothing is left waiting to sync.
    void (async () => {
      // FIX: stopSync() must be awaited here too, for the same reason it's
      // now awaited in signOut() above (see its own comment) — this handler
      // is the OTHER path that can lead to clearDatabase(), and it needs
      // the same guarantee that both realtime channels have genuinely
      // finished unsubscribing before local data is wiped, not just been
      // told to.
      await stopSync();

      // FIX: same wait signOut() now does, and for the same reason — see
      // waitForSyncIdle's own comment. Without it, this handler's own
      // pending-items check (and clearDatabase() past it) ran immediately
      // whenever nothing was queued to push, letting an in-flight pull's
      // writes land in SQLite after it had just been wiped.
      const { waitForSyncIdle } = await import('@/lib/sync');
      await waitForSyncIdle();

      const currentUserId = useAuthStore.getState().user?.id ?? useAuthStore.getState().session?.user.id ?? '';
      // FIX: only THIS (outgoing) user's own pending items should decide
      // whether it's safe to wipe local data — see _pushQueue's own comment
      // on sync_queue.user_id. A previous, already-signed-out account's
      // stale leftover items on a shared device were never going to push
      // under this session either way, and shouldn't hold this one hostage.
      let pending = getPendingSyncItems().filter((p) => !p.user_id || p.user_id === currentUserId);
      if (pending.length > 0) {
        try {
          const { flushPendingSyncWithRetry } = await import('@/lib/sync');
          pending = await flushPendingSyncWithRetry(currentUserId);
        } catch (err) {
          // Session is likely already invalid — expected in the common
          // "background refresh failed" case. Fall through to the
          // pending.length check below, which decides whether it's safe
          // to wipe.
          if (__DEV__) console.log('[AuthStore] SIGNED_OUT final flush attempt failed:', err);
        }
      }

      if (pending.length > 0) {
        console.warn(
          `[AuthStore] Session ended with ${pending.length} item(s) still unsynced — preserving local data instead of wiping it. It will finish syncing next time a valid session is available.`,
        );
      } else {
        clearDatabase();
      }

      await resetAllFeatureStores();
      // FIX: same shared-device checkpoint leak as signOut()'s own multiRemove
      // above (see its comment) — this is the OTHER teardown pipeline
      // (SIGNED_OUT listener) that must clear the same keys, since either one
      // can be the one that actually runs for a given sign-out.
      AsyncStorage.multiRemove([
        USER_PROFILE_KEY, COMPANY_CACHE_KEY, SESSION_KEY,
        LAST_SYNCED_KEY, LAST_DELETION_LOG_ID_KEY, LAST_NOTIFICATION_PULL_KEY,
      ]).catch(() => null);
      void sweepDraftSignatureKeys();
      // FIX: this used to leave error/isForceSyncing untouched, while
      // signOut()'s own final set() (above) explicitly resets both — two
      // independent teardown pipelines that can run concurrently (a manual
      // sign-out fires this same SIGNED_OUT event), so whichever one's
      // write landed last silently decided the terminal state. If this one
      // landed last, a stale error string could linger on the freshly-
      // shown login screen, or isForceSyncing could stay stuck true,
      // tripping forceFinalSyncAndSignOut's re-entrancy guard on the next
      // attempt. Match signOut()'s terminal state exactly so it doesn't
      // matter which of the two finishes last.
      useAuthStore.setState({
        user: null,
        company: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isForceSyncing: false,
        error: null,
      });
    })();
  } else if (event === 'TOKEN_REFRESHED' && session) {
    useAuthStore.setState({ session });
  }
});
