import { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 500;

/**
 * Fetches every row matching a query in bounded pages instead of one unbounded
 * `select()`. No pagination pattern existed anywhere in this codebase before this
 * service — every prior Supabase read (mobile app, admin portal, the old Edge
 * Function) was an unbounded `select('*')`. That's fine at normal scale but is
 * exactly the kind of thing that turns into an unbounded-memory problem once a
 * single job can have 1000+ assets/photos.
 *
 * `queryBuilder` must return a fresh query each call (so we can apply `.range()`
 * to it) — pass a function, not a built query.
 */
export async function fetchAllPaged<T>(
  db: SupabaseClient,
  buildQuery: () => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(`Paginated fetch failed: ${error.message}`);
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

// Ids per `.in()` request. PostgREST receives the list inside the URL, and
// Supabase's gateway rejects long URLs: measured on this project, 200 uuids
// worked, 500 failed outright ("fetch failed") and 1000+ returned
// "Bad Request". So a job with a few hundred assets could never generate a
// report at all. 150 ids is ~5.5KB of URL, comfortably under the limit.
const IN_BATCH_SIZE = 150;

/**
 * `.in(column, ids)` for an arbitrarily long id list: splits it into batches
 * of IN_BATCH_SIZE and concatenates the results. Each batch is far below
 * PostgREST's per-request row cap, so no further paging is needed.
 *
 * `buildQuery` receives one batch and must return the query to run for it.
 */
export async function fetchAllByIds<T>(
  ids: string[],
  buildQuery: (batch: string[]) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) {
    const batch = ids.slice(i, i + IN_BATCH_SIZE);
    const { data, error } = await buildQuery(batch);
    if (error) throw new Error(`Batched fetch failed: ${error.message}`);
    all.push(...((data ?? []) as T[]));
  }
  return all;
}
