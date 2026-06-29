const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    query: `
      DROP POLICY IF EXISTS "super_admins_select_own" ON public.super_admins;
      CREATE POLICY "super_admins_select_own" ON public.super_admins
        FOR SELECT USING (id = auth.uid());
    `
  });

  if (error) {
    console.error('Failed to create policy via RPC. We will use a direct sql approach.');
  } else {
    console.log('Policy created via RPC!');
  }
}

main();
