const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vnrmgcxmcspdgqcnmmdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NTU2NSwiZXhwIjoyMDkwNTMxNTY1fQ.CMrndZVs5jLxjTshcasIak1rDcFECb84Y2PHM93J5fc'
);

async function check() {
  const { data: jobs } = await supabase.from('jobs').select('id, property_id, assigned_to');
  console.log('Jobs:', jobs);
  
  const propIds = [...new Set(jobs.map(j => j.property_id))];
  const { data: props } = await supabase.from('properties').select('id, name').in('id', propIds);
  console.log('Properties in DB:', props);
}

check();
