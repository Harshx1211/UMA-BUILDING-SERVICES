// Supabase client initialisation — uses AsyncStorage for session persistence across app restarts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Add fallbacks to bypass Expo cache issues if .env was just created
const fallbackUrl = 'https://vnrmgcxmcspdgqcnmmdx.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NTU1NjUsImV4cCI6MjA5MDUzMTU2NX0.1k6VgJQiUrg83_dFKiKkisVeeJ83kZGj87810elmPKc';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || fallbackUrl).trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fallbackKey).trim();

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('[UMA BUILDING SERVICES] Using fallback Supabase URL. If this persists, restart Expo with --clear.');
}
if (__DEV__) console.log(`[UMA BUILDING SERVICES] Supabase initialized with URL: ${supabaseUrl}`);

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
      let attempt = 0;
      while (attempt < 3) {
        try {
          if (__DEV__ && attempt > 0) console.log(`[Supabase Fetch] Retry ${attempt} -> ${url}`);
          const res = await fetch(url, options);
          return res;
        } catch (err) {
          attempt++;
          if (attempt >= 3) {
            console.warn(`[Supabase Fetch] Network error after 3 attempts for ${url}:`, err);
            throw err;
          }
          // Wait 500ms before retrying network blips
          await new Promise(r => setTimeout(r, 500));
        }
      }
      throw new Error('Unreachable');
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
        console.warn('[UMA BUILDING SERVICES] getCurrentUser warning:', error.message);
      }
      return null;
    }
    return user;
  } catch (err) {
    console.error('[UMA BUILDING SERVICES] getCurrentUser unexpected error:', err);
    return null;
  }
}

/**
 * Signs the current user out and clears the persisted session from AsyncStorage.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[UMA BUILDING SERVICES] signOut error:', error.message);
  }
}
