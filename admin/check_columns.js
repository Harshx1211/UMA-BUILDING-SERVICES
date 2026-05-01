const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vnrmgcxmcspdgqcnmmdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NTU2NSwiZXhwIjoyMDkwNTMxNTY1fQ.CMrndZVs5jLxjTshcasIak1rDcFECb84Y2PHM93J5fc'
);

const tables = [
  'users', 'properties', 'assets', 'jobs', 'job_assets', 
  'defects', 'inspection_photos', 'signatures', 'time_logs',
  'inventory_items', 'quotes', 'quote_items', 'notifications',
  'asset_type_definitions', 'defect_codes'
];

async function check() {
  for (const table of tables) {
    const { data } = await supabase.from(table).select('*').limit(1);
    if (data && data.length > 0) {
      console.log(`\nTable ${table} columns:`);
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log(`\nTable ${table} is empty. Let's try getting columns via rpc if possible or just ignore.`);
    }
  }
}

check();
