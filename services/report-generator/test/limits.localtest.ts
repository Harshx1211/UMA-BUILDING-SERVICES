// Checks the Supabase request-size limits the report pipeline must stay under,
// against the REAL project (read-only: no rows or files are written).
//   npx tsx test/limits.localtest.ts
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const raw of readFileSync('F:/Full APP/admin/.env.local', 'utf8').split('\n')) {
  const l = raw.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '');
}
process.env.SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const { db } = await import('../src/supabaseClient');
  const { fetchAllByIds } = await import('../src/data/paginate');
  const { prepareFullResUrls } = await import('../src/photos/prepareFullResUrls');

  const ids = Array.from({ length: 1500 }, () => randomUUID());
  const rows = await fetchAllByIds(ids, (batch) => db.from('assets').select('id').in('id', batch));
  console.log(`OK: 1500-id asset lookup in batches -> no error (${rows.length} rows, ids are random)`);

  const { data: realPhotos } = await db.from('inspection_photos').select('*').limit(50);
  if (!realPhotos?.length) throw new Error('no photos to test with');
  const many = Array.from({ length: 1500 }, (_, i) => ({ ...realPhotos[i % realPhotos.length], id: `p${i}` }));
  const t = Date.now();
  const urls = await prepareFullResUrls(db, many, 'job-photos');
  console.log(`OK: signed ${urls.size}/1500 photo links in ${Date.now() - t}ms`);
  if (urls.size !== 1500) throw new Error('not every photo got a link');
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
