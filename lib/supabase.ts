// Supabase client initialisation — uses AsyncStorage for session persistence across app restarts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SiteTrack] Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL ' +
      'and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

/** Typed Supabase client — import this everywhere you need backend access */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
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
      console.error('[SiteTrack] getCurrentUser error:', error.message);
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
