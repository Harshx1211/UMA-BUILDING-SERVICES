import { createClient } from '@supabase/supabase-js';
import { config } from './config';

/** Service-role client — bypasses RLS, same pattern the old Edge Function used. */
export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
