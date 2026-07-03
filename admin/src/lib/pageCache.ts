/**
 * In-memory page data cache.
 *
 * Because Next.js keeps the JS bundle alive across client-side navigations,
 * this module's state persists for the entire session. This means navigating
 * away from "Jobs" and back shows the previous data INSTANTLY while the
 * fresh fetch happens silently in the background.
 *
 * TTL: 5 minutes — after which the next visit re-fetches automatically.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(...keys: string[]): void {
  keys.forEach(k => store.delete(k));
}

export function invalidateAll(): void {
  store.clear();
}
