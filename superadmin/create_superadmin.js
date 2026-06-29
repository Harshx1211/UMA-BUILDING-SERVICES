const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const email = 'superadmin1211@gmail.com';
  const password = 'Harsh@1211';

  console.log('Cleaning up old corrupted user...');
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const oldUser = users.users.find(u => u.email === email);
  if (oldUser) {
    await supabaseAdmin.auth.admin.deleteUser(oldUser.id);
    console.log('Deleted old user:', oldUser.id);
  }

  console.log('Creating new user via Admin API...');
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Master Superadmin' }
  });

  if (error) {
    console.error('Failed to create auth user:', error);
    return;
  }

  const userId = data.user.id;
  console.log('Created auth user:', userId);

  console.log('Elevating to superadmin...');
  console.log('Elevating to superadmin...');
  const { error: dbError } = await supabaseAdmin
    .from('super_admins')
    .upsert({ id: userId, email }, { onConflict: 'email' });

  if (dbError) {
    console.error('Failed to insert into super_admins:', dbError);
    return;
  }

  console.log('Success! User is now a superadmin.');
}

main();
