const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkLogin() {
  console.log('Testing login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'harsh12112021@gmail.com',
    password: 'password123' // generic password guess
  });
  
  if (error) {
    console.log('Login failed:', error.message);
  } else {
    console.log('Login success! User ID:', data.user.id);
    // try to fetch from public.users
    const { data: profile, error: dbError } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    if (dbError) {
      console.log('Could not fetch from public.users:', dbError.message);
    } else {
      console.log('Profile found:', profile);
    }
  }
}
checkLogin();
