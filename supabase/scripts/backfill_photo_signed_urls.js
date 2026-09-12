// ============================================================
// One-off backfill: re-sign every existing inspection_photos row
// after the job-photos bucket was flipped from public to private.
// ============================================================
// Every row uploaded before this fix has photo_url pointing at
// /object/public/job-photos/... — once the bucket goes private, those
// URLs 403 immediately (Supabase's admin dashboard doesn't retroactively
// touch existing DB rows when you flip a bucket's visibility). New
// uploads going forward already store a long-lived signed URL instead
// (see lib/photoUpload.ts) — this script does the same thing, once, for
// every row that predates that change.
//
// Safe to run more than once — it only touches rows still holding the
// old /object/public/ URL shape, so anything already backfilled (or
// newly uploaded) is skipped automatically.
//
// Run AFTER the job-photos bucket has actually been flipped private in
// the Supabase dashboard (Storage -> job-photos -> Settings -> Public
// bucket toggle off).
//
// Usage:
//   node backfill_photo_signed_urls.js
//
// Reads creds from the admin repo's .env.local, same convention as
// create_test_data.js in this same folder.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const PHOTO_BUCKET = 'job-photos';
const EXPIRY_SECONDS = 60 * 60 * 24 * 365 * 10; // 10 years — matches lib/photoUpload.ts
const PAGE_SIZE = 500;

function extractPath(url) {
  const marker = `/object/public/${PHOTO_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

async function main() {
  let from = 0;
  let totalUpdated = 0;
  let totalSkippedNoObject = 0;

  for (;;) {
    const { data: rows, error } = await supabaseAdmin
      .from('inspection_photos')
      .select('id, photo_url')
      .like('photo_url', `%/object/public/${PHOTO_BUCKET}/%`)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('Failed to fetch a page of inspection_photos:', error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    const withPaths = rows
      .map((r) => ({ id: r.id, path: extractPath(r.photo_url) }))
      .filter((r) => r.path);

    if (withPaths.length > 0) {
      const { data: signedResults, error: signErr } = await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(withPaths.map((r) => r.path), EXPIRY_SECONDS);

      if (signErr || !signedResults) {
        console.error('Batch signing failed for this page:', signErr?.message);
        process.exit(1);
      }

      for (let i = 0; i < withPaths.length; i++) {
        const signedUrl = signedResults[i]?.signedUrl;
        if (!signedUrl) {
          // Object genuinely missing from storage (deleted binary, orphaned row) — leave alone.
          totalSkippedNoObject++;
          continue;
        }
        const { error: updateErr } = await supabaseAdmin
          .from('inspection_photos')
          .update({ photo_url: signedUrl })
          .eq('id', withPaths[i].id);
        if (updateErr) {
          console.error(`Failed to update row ${withPaths[i].id}:`, updateErr.message);
          continue;
        }
        totalUpdated++;
      }
    }

    console.log(`Processed page starting at ${from}: ${rows.length} rows, ${totalUpdated} updated so far.`);
    from += PAGE_SIZE;
  }

  console.log(`\nDone. ${totalUpdated} row(s) re-signed. ${totalSkippedNoObject} row(s) skipped (no matching object in storage).`);
}

main();
