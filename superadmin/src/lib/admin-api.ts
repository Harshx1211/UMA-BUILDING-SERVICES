// Client-side helper for all admin write operations.
// Routes all mutations through /api/admin which uses the service_role key server-side.
// Usage:
//   const { data, error } = await adminApi.insert('jobs', { ...form })
//   const { error }       = await adminApi.update('jobs', { status: 'completed' }, id)
//   const { error }       = await adminApi.delete('defects', id)

type ApiResult<T = unknown> = { data: T | null; error: string | null };

async function call<T>(body: object): Promise<ApiResult<T>> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? 'Request failed' };
    return { data: json.data ?? null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export const adminApi = {
  insert: <T = unknown>(table: string, data: object) =>
    call<T>({ table, action: 'insert', data }),

  update: <T = unknown>(table: string, data: object, id: string) =>
    call<T>({ table, action: 'update', data, id }),

  updateMatch: <T = unknown>(table: string, data: object, match: object) =>
    call<T>({ table, action: 'update', data, match }),

  delete: (table: string, id: string) =>
    call({ table, action: 'delete', id }),

  deleteMatch: (table: string, match: object) =>
    call({ table, action: 'delete', match }),

  upsert: <T = unknown>(table: string, data: object) =>
    call<T>({ table, action: 'upsert', data }),

  /** Bulk-inserts rows from CSV import. Calls /api/admin/bulk (server-side, service_role). */
  bulkInsert: async (
    table: string,
    rows: object[],
  ): Promise<{ inserted: number; errors: string[]; error: string | null }> => {
    try {
      const res = await fetch('/api/admin/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows }),
      });
      const json = await res.json();
      if (!res.ok) return { inserted: 0, errors: [], error: json.error ?? 'Request failed' };
      return { inserted: json.inserted ?? 0, errors: json.errors ?? [], error: null };
    } catch (err) {
      return { inserted: 0, errors: [], error: err instanceof Error ? err.message : 'Network error' };
    }
  },
};

// ─── Admin Read API ────────────────────────────────────────────────────────
// Routes read operations through /api/admin/read (service_role key) so the admin
// portal can see ALL data regardless of RLS policies.
// This is the correct pattern for an admin portal that needs full visibility.

interface ReadOptions {
  select?: string;
  filters?: Record<string, string | number | boolean | null>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  range?: [number, number];
  count?: boolean;
  in?: { column: string; values: string[] | number[] };
}

interface ReadResult<T> {
  data: T[];
  count: number | null;
  error: string | null;
}

export async function adminRead<T = Record<string, unknown>>(
  table: string,
  options: ReadOptions = {}
): Promise<ReadResult<T>> {
  try {
    const res = await fetch('/api/admin/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ...options }),
    });
    const json = await res.json();
    if (!res.ok) return { data: [], count: null, error: json.error ?? 'Request failed' };
    return { data: json.data ?? [], count: json.count ?? null, error: null };
  } catch (err) {
    return { data: [], count: null, error: err instanceof Error ? err.message : 'Network error' };
  }
}

