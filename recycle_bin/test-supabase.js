const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log('Testing connection to:', url);
  try {
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: 'harsh12112021@gmail.com',
      password: 'testpassword123' // Just guessing or it will at least reach the DB
    });
    console.log('Auth response:', error ? error.message : 'Success');
    
    // Test a simple select if public
    const { data, error: dbError } = await supabase.from('users').select('*').limit(1);
    console.log('DB response:', dbError ? dbError.message : data);
  } catch (err) {
    console.log('Error:', err.message);
  }
}
test();
