// Supabase client — uses AsyncStorage for session persistence across app restarts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// ── Environment validation ────────────────────────────────────────────────
// Both vars are required. A missing env var will produce a clear error at
// startup rather than a silent auth failure or a request to the wrong project.
const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

if (!supabaseUrl) {
  // Throw in production — this is a fatal misconfiguration.
  // In dev, give a clear actionable message.
  const msg = '[SiteTrack] EXPO_PUBLIC_SUPABASE_URL is not set. Check your .env file and restart Expo with --clear.';
  if (__DEV__) { console.error(msg); } else { throw new Error(msg); }
}
if (!supabaseAnonKey) {
  const msg = '[SiteTrack] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. Check your .env file and restart Expo with --clear.';
  if (__DEV__) { console.error(msg); } else { throw new Error(msg); }
}

// ── Client ────────────────────────────────────────────────────────────────

/** Typed Supabase client — import this everywhere you need backend access */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
  global: {
    // Retry network blips up to 3 times before surfacing the error.
    // Expo's bundled fetch can briefly fail on wake from background.
    fetch: async (url, options) => {
      const MAX_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 500;
      let lastErr: unknown;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          if (__DEV__ && attempt > 1) console.log(`[Supabase] Retry ${attempt - 1} → ${url}`);
          return await fetch(url, options);
        } catch (err) {
          lastErr = err;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt)); // exponential back-off
          }
        }
      }

      console.warn(`[Supabase] Network error after ${MAX_ATTEMPTS} attempts:`, lastErr);
      throw lastErr;
    },
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────

/**
 * Returns the currently authenticated user, or null if not signed in.
 * Prefer this over supabase.auth.getUser() for null-safe access.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // 'Auth session missing!' is expected when not logged in — not a real error.
      if (error.message !== 'Auth session missing!') {
        console.warn('[SiteTrack] getCurrentUser warning:', error.message);
      }
      return null;
    }
    return user;
  } catch (err) {
    console.error('[SiteTrack] getCurrentUser unexpected error:', err);
    return null;
  }
}

/**
 * Signs the current user out and clears the persisted session from AsyncStorage.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[SiteTrack] signOut error:', error.message);
  }
}
