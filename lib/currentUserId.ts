/**
 * A tiny, dependency-free module holding just the currently signed-in
 * user's id — nothing else lives here on purpose.
 *
 * Exists solely to let lib/database.ts (a low-level module lib/sync.ts and
 * store/authStore.ts both import FROM) know who's currently signed in,
 * without creating a circular import: authStore.ts already imports several
 * functions from lib/database.ts, so lib/database.ts importing back from
 * authStore.ts (or from lib/sync.ts, which itself imports from
 * lib/database.ts) would create a cycle. This one-function module has no
 * imports of its own, so anything can safely depend on it.
 */
let _currentUserId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  _currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return _currentUserId;
}
