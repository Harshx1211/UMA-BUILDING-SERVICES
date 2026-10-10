// Real-data test against the DEPLOYED service.
//   node test/real-job.localtest.js list
//   node test/real-job.localtest.js run <jobId> [serviceUrl]
// "run" backs up the job's current PDF to test-output/ first (generation
// overwrites job-reports/<jobId>.pdf), then generates via the service as the
// job's assigned technician, polls, and downloads the new PDF.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(p) {
  const o = {};
  for (let l of fs.readFileSync(p, 'utf8').split('\n')) {
    l = l.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i !== -1) o[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return o;
}
const env = loadEnv('F:/Full APP/admin/.env.local');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const OUT = path.join(__dirname, '..', 'test-output');
// Timestamped so a run never overwrites an earlier backup.
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

async function list() {
  const { data: jobs, error } = await admin.from('jobs')
    .select('id, status, report_url, scheduled_date, assigned_to, property:properties(name)')
    .not('report_url', 'is', null).order('scheduled_date', { ascending: false }).limit(40);
  if (error) throw error;
  for (const j of jobs) {
    const { count } = await admin.from('job_assets').select('id', { count: 'exact', head: true }).eq('job_id', j.id);
    const { count: photos } = await admin.from('inspection_photos').select('id', { count: 'exact', head: true }).eq('job_id', j.id);
    console.log(`${j.id}  assets=${String(count).padStart(4)} photos=${String(photos).padStart(4)}  ${j.status}  ${j.scheduled_date}  ${j.property?.name ?? ''}`);
  }
}

async function run(jobId, url) {
  fs.mkdirSync(OUT, { recursive: true });
  const { data: job } = await admin.from('jobs').select('report_url, assigned_to, company_id').eq('id', jobId).single();
  if (job?.report_url) {
    const { data } = await admin.storage.from('job-reports').download(job.report_url);
    if (data) {
      const p = path.join(OUT, `before-${jobId}-${STAMP}.pdf`);
      fs.writeFileSync(p, Buffer.from(await data.arrayBuffer()));
      console.log(`Backed up current PDF -> ${p} (${(fs.statSync(p).size / 1024).toFixed(0)} KB)`);
    }
  }
  let { data: tech } = await admin.from('users').select('email').eq('id', job.assigned_to).maybeSingle();
  if (!tech?.email) ({ data: tech } = await admin.from('users').select('email').eq('company_id', job.company_id).limit(1).maybeSingle());
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: tech.email });
  if (linkErr) throw linkErr;
  const { data: sess, error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (vErr) throw vErr;
  const auth = { Authorization: `Bearer ${sess.session.access_token}` };

  const t0 = Date.now();
  const gen = await fetch(`${url}/generate-report`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }) });
  console.log('generate-report:', gen.status, await gen.text());
  if (gen.status !== 202) process.exit(1);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await (await fetch(`${url}/report-status?jobId=${jobId}`, { headers: auth })).json();
    if (st.status === 'completed' || st.status === 'failed') {
      console.log(`FINAL after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${st.status}${st.error ? ' — ' + st.error : ''}`);
      if (st.status === 'completed') {
        const pdf = Buffer.from(await (await fetch(st.pdfUrl)).arrayBuffer());
        const p = path.join(OUT, `after-${jobId}-${STAMP}.pdf`);
        fs.writeFileSync(p, pdf);
        console.log(`New PDF -> ${p} (${(pdf.length / 1024).toFixed(0)} KB)`);
      }
      return;
    }
    process.stdout.write('.');
  }
}

const [cmd, a, b] = process.argv.slice(2);
(cmd === 'list' ? list() : run(a, b ?? 'https://report-service-267881656439.australia-southeast1.run.app'))
  .catch((e) => { console.error('FAIL:', e.message ?? e); process.exit(1); });
