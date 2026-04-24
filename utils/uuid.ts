/**
 * Shared RFC-4122 v4 UUID generator.
 * Used by all Zustand stores to generate local-first record IDs
 * before they are synced to Supabase.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
