// Diagnostic: download a job's generated report PDF and break down exactly
// where its bytes are going — images vs embedded fonts vs page content vs
// structural overhead. Built to answer "why is this report so much bigger
// than it should be" with real numbers instead of guessing.
//
// Font detection note: embedded font-file streams (FontFile/FontFile2/
// FontFile3) don't carry a /Subtype key the way images do — they're
// identified by the /Length1 key (and sometimes /Length2, /Length3), which
// per the PDF spec ONLY ever appears on font program streams. That's the
// actual signal used below, not /Type — font streams normally have no
// /Type key at all.
//
// Usage:
//   node diagnose_report_size.js <technician-email>
//
// Reads creds from the admin repo's .env.local, same convention as the
// other scripts in this folder.

const fs = require('fs');
const path = require('path');
// Resolved explicitly against report-generator's node_modules — this script
// lives in supabase/scripts/ (a sibling directory), and Node's normal
// require() resolution only walks UP from a script's own location, so it
// wouldn't otherwise find pdf-lib (only installed in report-generator).
const reportGenModules = path.join(__dirname, '..', '..', 'services', 'report-generator', 'node_modules');
const { createClient } = require(path.join(reportGenModules, '@supabase', 'supabase-js'));
const { PDFDocument, PDFName, PDFRawStream } = require(path.join(reportGenModules, 'pdf-lib'));

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
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function classify(dict) {
  const subtype = dict.get(PDFName.of('Subtype'));
  if (subtype && subtype.toString() === '/Image') return 'image';
  if (dict.get(PDFName.of('Length1'))) return 'font';
  return 'other';
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node diagnose_report_size.js <technician-email>');
    process.exit(1);
  }

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users').select('id, full_name').eq('email', email).maybeSingle();
  if (userErr || !user) {
    console.error('User not found:', userErr?.message ?? email);
    process.exit(1);
  }
  console.log(`Found user: ${user.full_name} (${user.id})`);

  const { data: jobs, error: jobsErr } = await supabaseAdmin
    .from('jobs')
    .select('id, report_url, scheduled_date, status, property:properties(name)')
    .eq('assigned_to', user.id)
    .not('report_url', 'is', null)
    .order('scheduled_date', { ascending: false });
  if (jobsErr) {
    console.error('Failed to fetch jobs:', jobsErr.message);
    process.exit(1);
  }
  if (!jobs || jobs.length === 0) {
    console.log('No jobs with a generated report found for this user.');
    return;
  }

  for (const job of jobs) {
    const { count: assetCount } = await supabaseAdmin
      .from('job_assets').select('id', { count: 'exact', head: true }).eq('job_id', job.id);
    const { count: photoCount } = await supabaseAdmin
      .from('inspection_photos').select('id', { count: 'exact', head: true }).eq('job_id', job.id);

    console.log(`\n=== ${job.property?.name ?? 'Unknown property'} — ${assetCount} assets, ${photoCount} photos — job ${job.id} ===`);

    const { data: signedData, error: signErr } = await supabaseAdmin.storage
      .from('job-reports').createSignedUrl(job.report_url, 300);
    if (signErr || !signedData?.signedUrl) {
      console.log('  Could not sign report URL:', signErr?.message);
      continue;
    }

    const res = await fetch(signedData.signedUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
    const context = pdfDoc.context;

    console.log(`  Total size: ${(buffer.length / 1024).toFixed(1)} KB across ${pdfDoc.getPageCount()} pages`);

    const totals = { image: { count: 0, bytes: 0 }, font: { count: 0, bytes: 0 }, other: { count: 0, bytes: 0 } };
    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream) {
        const kind = classify(obj.dict);
        totals[kind].count++;
        totals[kind].bytes += obj.contents.length;
      }
    }

    const pct = (bytes) => ((bytes / buffer.length) * 100).toFixed(0);
    console.log(`  Images:        ${totals.image.count} object(s), ${(totals.image.bytes / 1024).toFixed(1)} KB (${pct(totals.image.bytes)}%)`);
    console.log(`  Embedded fonts:${' '.repeat(0)} ${totals.font.count} object(s), ${(totals.font.bytes / 1024).toFixed(1)} KB (${pct(totals.font.bytes)}%)`);
    console.log(`  Page content / structure: ${totals.other.count} object(s), ${(totals.other.bytes / 1024).toFixed(1)} KB (${pct(totals.other.bytes)}%)`);
    if (totals.font.count > pdfDoc.getPageCount()) {
      console.log(`  ⚠ ${totals.font.count} font objects for ${pdfDoc.getPageCount()} pages — more than one per page, meaning multiple separately-rendered sections are each embedding their own font subset independently (see optimizePdf.ts).`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
