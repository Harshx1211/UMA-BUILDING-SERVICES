// ============================================================
// Create a QA test company: 1 admin, 1 technician, a large site
// (150 assets) and a small site (10 assets) — for testing the
// dashboard/app at two different scales after the Properties
// pagination + detail-page fixes.
// ============================================================
// Auth users can't be created reliably with raw SQL — Supabase's
// auth.users table has several columns (confirmation_token, etc.)
// that break login if left NULL by a hand-written INSERT. This
// project already solved that once for the superadmin login
// (see superadmin/create_superadmin.js) by going through the
// Admin API instead, so this script does the same thing.
//
// Everything else (company, public.users, properties, assets) is
// just data, so it's inserted directly with the service-role key.
//
// Usage:
//   node create_test_data.js <adminEmail> <adminPassword> <techEmail> <techPassword>
//
// Credentials are passed as args, never hardcoded here.
// Run from the SiteTrack App repo root with SUPABASE creds in env,
// or from a folder with a .env.local containing:
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
// (the admin repo's .env.local already has both, matching this project).

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// No `dotenv` dependency in this repo (it's an Expo app, not a Node
// server) — read the admin repo's .env.local directly instead of adding
// a new dependency just for this one script.
function loadEnvFile(filePath) {
  const out = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const adminEnvPath = path.join(__dirname, '..', '..', '..', 'admin', '.env.local');
const env = loadEnvFile(adminEnvPath);

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const COMPANY_NAME = 'QA Test Co';

const ASSET_TYPES = [
  { value: 'BGA, MCP or Manual Call Point', code: 'MCP', variants: ['Break Glass'] },
  { value: 'Emergency - Exit Signs', code: 'EXIT', variants: ['Blade (Ceiling Mount) - Exit', 'Box (Wall Mount) - Exit', 'Jumbo (Wall Mount) - Exit', 'Quick Fit (Ceiling Mount) - Exit'] },
  { value: 'Emergency - Lighting', code: 'EL', variants: ['2FT - Single Diffused Batten', '4FT - Twin Diffused Batten', 'Oyster', 'Spitfire (Flush Mount)'] },
  { value: 'Fire Detection Devices (MCP, Detector, strobe, Flow Switch)', code: 'FD', variants: ['Detector - Smoke', 'Detector - Heat', 'Sounder', 'Strobe', 'MCP (Indoor)'] },
  { value: 'Fire Door (CA)', code: 'FDR', variants: ['Fire Door - Single', 'Fire Door - Double Even pair', 'Smoke Door - Single'] },
  { value: 'Fire Extinguishers - Portable', code: 'FE', variants: ['DCP AB(E) 2.3KG', 'DCP AB(E) 4.5KG', 'CO2 5.0KG', 'Wet Chemical 7.0Lt'] },
  { value: 'Fire Hose Reels', code: 'FHR', variants: ['36m - 19mm - Fire', '50m - 25mm - Fire'] },
  { value: 'Fire Hydrant System', code: 'FH', variants: ['Hydrant landing valves', 'Booster - Hydrant', 'Pillar Landing Valve'] },
  { value: 'Fire Sprinkler System - Wet Pipe', code: 'FSS', variants: ['Sprinkler head', 'Sprinkler Valve', 'General System'] },
];

function randomDateWithinYears(years) {
  const now = Date.now();
  const past = now - Math.random() * years * 365 * 24 * 60 * 60 * 1000;
  return new Date(past).toISOString().split('T')[0];
}

/** Generates `count` realistic assets spread across all 9 asset types,
 * cycling Tower/Floor/Unit location codes (matches formatLocationCode's
 * "1-3-12" structured format used by both apps). */
function generateAssets(companyId, propertyId, count) {
  const assets = [];
  const perTypeCounters = {};
  for (let i = 0; i < count; i++) {
    const type = ASSET_TYPES[i % ASSET_TYPES.length];
    const variant = type.variants[i % type.variants.length];
    perTypeCounters[type.code] = (perTypeCounters[type.code] ?? 0) + 1;
    const tower = 1 + (Math.floor(i / 40) % 2);
    const floor = 1 + (Math.floor(i / 4) % 10);
    const unit = 1 + (i % 4);
    assets.push({
      company_id: companyId,
      property_id: propertyId,
      asset_type: type.value,
      variant,
      asset_ref: `${type.code}-${String(perTypeCounters[type.code]).padStart(3, '0')}`,
      location_on_site: `${tower}-${floor}-${unit}`,
      serial_number: `SN${Math.floor(100000 + Math.random() * 899999)}`,
      install_date: randomDateWithinYears(4),
      status: 'active',
    });
  }
  return assets;
}

async function insertInBatches(table, rows, batchSize = 50) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin.from(table).insert(batch);
    if (error) throw new Error(`Insert into ${table} failed at batch ${i / batchSize}: ${error.message}`);
  }
}

async function createAuthUser(email, password, fullName) {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const oldUser = existing.users.find((u) => u.email === email);
  if (oldUser) {
    await supabaseAdmin.auth.admin.deleteUser(oldUser.id);
    console.log(`Deleted pre-existing auth user for ${email}`);
  }
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  const [adminEmail, adminPassword, techEmail, techPassword] = process.argv.slice(2);
  if (!adminEmail || !adminPassword || !techEmail || !techPassword) {
    console.error('Usage: node create_test_data.js <adminEmail> <adminPassword> <techEmail> <techPassword>');
    process.exitCode = 1;
    return;
  }

  console.log(`Cleaning up any previous "${COMPANY_NAME}"...`);
  const { data: existingCompany } = await supabaseAdmin.from('companies').select('id').eq('name', COMPANY_NAME).maybeSingle();
  if (existingCompany) {
    console.error(
      `A "${COMPANY_NAME}" company already exists (id ${existingCompany.id}). ` +
      `Run delete_test_data.sql first, then re-run this script.`
    );
    process.exitCode = 1;
    return;
  }

  console.log('Creating auth users...');
  const adminUserId = await createAuthUser(adminEmail, adminPassword, 'Test Admin');
  const techUserId = await createAuthUser(techEmail, techPassword, 'Test Technician');
  console.log(`  admin user: ${adminUserId}`);
  console.log(`  tech user:  ${techUserId}`);

  console.log('Creating company (auto-seeds the global catalogue via trigger)...');
  const { data: company, error: companyErr } = await supabaseAdmin
    .from('companies')
    .insert({ name: COMPANY_NAME, subscription_status: 'active', contact_email: adminEmail })
    .select('id')
    .single();
  if (companyErr) throw new Error(`Failed to create company: ${companyErr.message}`);
  const companyId = company.id;
  console.log(`  company: ${companyId}`);

  console.log('Creating public.users rows...');
  const { error: usersErr } = await supabaseAdmin.from('users').insert([
    { id: adminUserId, company_id: companyId, email: adminEmail, full_name: 'Test Admin', role: 'admin' },
    { id: techUserId, company_id: companyId, email: techEmail, full_name: 'Test Technician', role: 'technician' },
  ]);
  if (usersErr) throw new Error(`Failed to create users: ${usersErr.message}`);

  console.log('Creating properties...');
  const { data: properties, error: propsErr } = await supabaseAdmin
    .from('properties')
    .insert([
      {
        company_id: companyId,
        name: 'QA Load Test Site (150 Assets)',
        address: '1 Elizabeth Street', suburb: 'Sydney', state: 'NSW', postcode: '2000',
        site_contact_name: 'Load Test Contact', site_contact_phone: '0400 000 001',
        compliance_status: 'pending',
      },
      {
        company_id: companyId,
        name: 'QA Quick Test Site (10 Assets)',
        address: '1 Bligh Street', suburb: 'Sydney', state: 'NSW', postcode: '2000',
        site_contact_name: 'Quick Test Contact', site_contact_phone: '0400 000 002',
        compliance_status: 'pending',
      },
    ])
    .select('id, name');
  if (propsErr) throw new Error(`Failed to create properties: ${propsErr.message}`);

  const bigSite = properties.find((p) => p.name.includes('Load Test'));
  const smallSite = properties.find((p) => p.name.includes('Quick Test'));
  console.log(`  big site:   ${bigSite.id}`);
  console.log(`  small site: ${smallSite.id}`);

  console.log('Creating 150 assets on the load-test site...');
  await insertInBatches('assets', generateAssets(companyId, bigSite.id, 150));

  console.log('Creating 10 assets on the quick-test site...');
  await insertInBatches('assets', generateAssets(companyId, smallSite.id, 10));

  console.log('\nDone. Log in with:');
  console.log(`  Admin:      ${adminEmail} / (the password you passed in)`);
  console.log(`  Technician: ${techEmail} / (the password you passed in)`);
  console.log(`\nWhen you're done testing, run delete_test_data.sql in the Supabase SQL Editor.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
