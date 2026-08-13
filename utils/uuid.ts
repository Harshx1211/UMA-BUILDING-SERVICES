/**
 * Cryptographically-secure RFC-4122 v4 UUID generator.
 *
 * Uses expo-crypto (backed by the OS CSPRNG: SecRandomCopyBytes on iOS,
 * java.security.SecureRandom on Android) instead of Math.random().
 *
 * Math.random() is NOT cryptographically secure — it is predictable and
 * should never be used for IDs that are used as primary keys in a database
 * or as unguessable identifiers in URLs/links.
 *
 * Falls back to Math.random() only if expo-crypto is unavailable (web/test env).
 */
import * as Crypto from 'expo-crypto';

export function generateUUID(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Fallback for environments where expo-crypto native module is unavailable
    // (e.g. Expo Go web, Jest unit tests). NOT for production use.
    if (__DEV__) console.warn('[UUID] expo-crypto unavailable — falling back to Math.random(). Not for production.');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
