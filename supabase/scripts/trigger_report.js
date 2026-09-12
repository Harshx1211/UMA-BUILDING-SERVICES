// One-off helper: trigger report generation for a given job (using a real
// session generated for a technician, no password needed) and poll until
// done. Useful for testing report-generator changes against real data.
//
// Usage:
//   node trigger_report.js <technician-email> <jobId>

const path = require('path');
const rg = path.join(__dirname, '..', '..', 'services', 'report-generator', 'node_modules');
const { createClient } = require(path.join(rg, '@supabase', 'supabase-js'));
const fs = require('fs');

function loadEnv(p) {
  const o = {};
  fs.readFileSync(p, 'utf8').split('\n').forEach(l => {
    l = l.trim();
    if (!l || l.startsWith('#')) return;
    const i = l.indexOf('=');
    if (i === -1) return;
    o[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  return o;
}

const env = loadEnv(path.join(__dirname, '..', '..', '..', 'admin', '.env.local'));
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const REPORT_GEN_URL = 'https://sitetrack-report-generator.onrender.com';

async function main() {
  const email = process.argv[2];
  const jobId = process.argv[3];
  if (!email || !jobId) {
    console.error('Usage: node trigger_report.js <technician-email> <jobId>');
    process.exit(1);
  }

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkErr) { console.error('generateLink failed:', linkErr.message); process.exit(1); }

  const { data: sessionData, error: verifyErr } = await supabaseAnon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyErr || !sessionData.session) { console.error('verifyOtp failed:', verifyErr?.message); process.exit(1); }
  const accessToken = sessionData.session.access_token;

  const startedAt = Date.now();
  const genRes = await fetch(`${REPORT_GEN_URL}/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ jobId }),
  });
  const genBody = await genRes.json();
  console.log('generate-report response:', genRes.status, genBody);
  if (genRes.status !== 202) process.exit(1);

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${REPORT_GEN_URL}/report-status?jobId=${jobId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const statusBody = await statusRes.json();
    if (statusBody.status === 'completed' || statusBody.status === 'failed') {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`\nFINAL (took ${elapsed}s):`, statusBody);
      process.exit(statusBody.status === 'completed' ? 0 : 1);
    }
  }
  console.error('Timed out waiting for generation to finish.');
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
