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
