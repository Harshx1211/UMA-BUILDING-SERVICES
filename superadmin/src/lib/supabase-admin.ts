// Server-side only — NEVER import this in client components.
// Uses the service_role key which bypasses ALL RLS policies.
// This is the correct pattern for an admin portal doing privileged writes.
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!key || key === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.warn('[UMA BUILDING SERVICES Admin] SUPABASE_SERVICE_ROLE_KEY is not set. Write operations will fail. Add it to .env.local');
}

export const supabaseAdmin = createClient(url, key, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
    detectSessionInUrl: false,
  },
});
