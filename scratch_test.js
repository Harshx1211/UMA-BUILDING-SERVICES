const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vnrmgcxmcspdgqcnmmdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucm1nY3htY3NwZGdxY25tbWR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NTU2NSwiZXhwIjoyMDkwNTMxNTY1fQ.CMrndZVs5jLxjTshcasIak1rDcFECb84Y2PHM93J5fc'
);

async function test() {
  const { data, error } = await supabase.from('enquiries').insert({
    company_id: '8bcd9216-20ee-4d46-bb23-5fe78235222b',
    name: 'Test Name',
    email: 'test@example.com',
    message: 'Test Message',
    status: 'new',
    service: 'Website Quote Request'
  });
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
