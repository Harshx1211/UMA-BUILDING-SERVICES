// Exercises the live service's error paths with real users (writes only the
// QA job's own report). node test/errorpaths.livetest.js
const fs = require('fs');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const env = {};
for (let l of fs.readFileSync('F:/Full APP/admin/.env.local', 'utf8').split('\n')) {
  l = l.trim(); const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const URL_ = 'https://report-service-267881656439.australia-southeast1.run.app';
const QA_JOB = '86bf11c6-19e0-43e5-bc28-81336983f844';

async function tokenFor(email) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: l } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: s } = await anon.auth.verifyOtp({ token_hash: l.properties.hashed_token, type: 'magiclink' });
  return s.session.access_token;
}
async function call(method, path, token, body) {
  const r = await fetch(URL_ + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function expect(name, got, want) {
  const ok = got === want; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${got}, want ${want}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  const { data: users } = await admin.from('users').select('id, email, company_id, role');
  const { data: job } = await admin.from('jobs').select('company_id').eq('id', QA_JOB).single();
  const qaTech = users.find((u) => u.company_id === job.company_id && u.role === 'technician');
  const outsider = users.find((u) => u.company_id !== job.company_id);
  const tQa = await tokenFor(qaTech.email);
  const tOut = await tokenFor(outsider.email);

  expect('other company cannot generate', (await call('POST', '/generate-report', tOut, { jobId: QA_JOB })).status, 403);
  expect('other company cannot read status', (await call('GET', `/report-status?jobId=${QA_JOB}`, tOut)).status, 403);
  expect('unknown job', (await call('POST', '/generate-report', tQa, { jobId: randomUUID() })).status, 404);
  expect('malformed job id', (await call('POST', '/generate-report', tQa, { jobId: 'not-a-uuid' })).status, 404);
  expect('missing jobId', (await call('POST', '/generate-report', tQa, {})).status, 400);
  expect('expired/forged token', (await call('POST', '/generate-report', tQa.slice(0, -4) + 'abcd', { jobId: QA_JOB })).status, 401);

  const [a, b] = await Promise.all([
    call('POST', '/generate-report', tQa, { jobId: QA_JOB }),
    call('POST', '/generate-report', tQa, { jobId: QA_JOB }),
  ]);
  expect('double tap: exactly one accepted', [a.status, b.status].sort().join(','), '202,409');

  const t0 = Date.now();
  let st;
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    st = (await call('GET', `/report-status?jobId=${QA_JOB}`, tQa)).body;
    if (st.status !== 'generating') break;
  }
  expect('generation completes', st.status, 'completed');
  expect('status carries updatedAt', typeof st.updatedAt, 'string');
  console.log(`      took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const pdf = await fetch(st.pdfUrl);
  expect('signed PDF downloads', pdf.status, 200);
  expect('is a PDF', (await pdf.arrayBuffer()).byteLength > 1000 && pdf.headers.get('content-type'), 'application/pdf');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
