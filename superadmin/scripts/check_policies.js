const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://vnrmgcxmcspdgqcnmmdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NTU2NSwiZXhwIjoyMDkwNTMxNTY1fQ.CMrndZVs5jLxjTshcasIak1rDcFECb84Y2PHM93J5fc'
);
async function check() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
    console.log("RPC get_policies failed, let's try direct postgres access via an edge function or just by running raw sql on a client if possible. Wait, we can't do raw sql with supabase js without rpc. Let's see if we can read the properties with anon key but WITH the user's JWT if we can't login.");
  }
}
check();
