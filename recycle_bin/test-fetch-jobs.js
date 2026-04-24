const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkJobs() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'harsh12112021@gmail.com',
    password: 'password123' // generic
  });
  
  if (authError) {
    console.log('Login failed:', authError.message);
  } else {
    console.log('User ID:', authData.user.id);
    
    // Fetch all jobs for this user
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .eq('assigned_to', authData.user.id);
      
    if (jobsError) {
      console.log('Error fetching jobs:', jobsError.message);
    } else {
      console.log('Total Jobs assigned to user:', jobs.length);
      if (jobs.length > 0) {
        console.log('Dates of jobs:', jobs.map(j => j.scheduled_date));
      }
    }
  }
}
checkJobs();
