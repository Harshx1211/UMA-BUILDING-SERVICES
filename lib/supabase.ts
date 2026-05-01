// Supabase client initialisation — uses AsyncStorage for session persistence across app restarts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Add fallbacks to bypass Expo cache issues if .env was just created
const fallbackUrl = 'https://vnrmgcxmcspdgqcnmmdx.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTU1NjUsImV4cCI6MjA5MDUzMTU2NX0.1k6VgJQiUrg83_dFKiKkisVeeJ83kZGj87810elmPKc';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || fallbackUrl).trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fallbackKey).trim();

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('[SiteTrack] Using fallback Supabase URL. If this persists, restart Expo with --clear.');
}
if (__DEV__) console.log(`[SiteTrack] Supabase initialized with URL: ${supabaseUrl}`);

/** Typed Supabase client — import this everywhere you need backend access */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (url, options) => {
      if (__DEV__) console.log(`[Supabase Fetch] -> ${url}`);
      try {
        const res = await fetch(url, options);
        if (__DEV__) console.log(`[Supabase Fetch] <- ${res.status} ${url}`);
        return res;
      } catch (err) {
        console.error(`[Supabase Fetch] ERROR for ${url}:`, err);
        throw err;
      }
    }
  }
});

/**
 * Returns the currently authenticated user, or null if not signed in.
 * Prefer this over supabase.auth.getUser() for null-safe access.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
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
