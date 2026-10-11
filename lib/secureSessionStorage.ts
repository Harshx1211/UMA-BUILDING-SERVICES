/**
 * Encrypted storage adapter for the Supabase auth session (lib/supabase.ts).
 *
 * The session holds the access AND refresh tokens — whoever has the refresh
 * token is this technician until it's revoked. It used to sit in plain
 * AsyncStorage, which is an unencrypted file in the app's data directory:
 * readable from an Android backup (allowBackup was on), a rooted device, or
 * any tool that can pull app data. Now:
 *
 *  - a random 256-bit key per stored item lives in expo-secure-store, i.e.
 *    the Android Keystore / iOS Keychain (hardware-backed where available),
 *    never in the app's files, and is excluded from backups (THIS_DEVICE_ONLY);
 *  - the value itself is AES-256-CTR encrypted with that key and a fresh
 *    random 16-byte IV on every write, stored in AsyncStorage as
 *    `enc1:<iv hex>:<ciphertext hex>` (the session is too large for
 *    SecureStore's own ~2KB per-item limit on some Android versions, which is
 *    why only the key goes there — the same split Supabase's React Native
 *    guide recommends).
 *
 * A session saved before this existed (plain JSON) is read once, then
 * immediately re-saved encrypted — nobody is signed out by the upgrade.
 * If the key is ever missing (e.g. data restored onto a different device),
 * the ciphertext is useless by design: treated as "no session" → login.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import * as aesjs from 'aes-js';

const PREFIX = 'enc1:';

// AFTER_FIRST_UNLOCK so background token refresh still works while the
// phone is locked; THIS_DEVICE_ONLY so the key never leaves the device in a
// backup or migration.
const KEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
const keyName = (storageKey: string) => `sk_${storageKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;

const keyCache = new Map<string, Uint8Array>();

async function getKey(storageKey: string, create: boolean): Promise<Uint8Array | null> {
  const cached = keyCache.get(storageKey);
  if (cached) return cached;
  const hex = await SecureStore.getItemAsync(keyName(storageKey), KEY_OPTIONS);
  if (hex) {
    const key = aesjs.utils.hex.toBytes(hex);
    keyCache.set(storageKey, key);
    return key;
  }
  if (!create) return null;
  const key = getRandomBytes(32);
  await SecureStore.setItemAsync(keyName(storageKey), aesjs.utils.hex.fromBytes(key), KEY_OPTIONS);
  keyCache.set(storageKey, key);
  return key;
}

async function setItem(storageKey: string, value: string): Promise<void> {
  const key = await getKey(storageKey, true);
  if (!key) throw new Error('secure storage key unavailable');
  const iv = getRandomBytes(16);
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await AsyncStorage.setItem(
    storageKey,
    `${PREFIX}${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encrypted)}`,
  );
}

async function getItem(storageKey: string): Promise<string | null> {
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored == null) return null;

  if (!stored.startsWith(PREFIX)) {
    // Pre-encryption session — migrate it in place, then hand it back.
    try { await setItem(storageKey, stored); } catch { /* keep working; retried on next write */ }
    return stored;
  }

  try {
    const [ivHex, dataHex] = stored.slice(PREFIX.length).split(':');
    const key = await getKey(storageKey, false);
    if (!key || !ivHex || !dataHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(aesjs.utils.hex.toBytes(ivHex)));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(dataHex)));
  } catch {
    return null;
  }
}

async function removeItem(storageKey: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey);
  keyCache.delete(storageKey);
  try { await SecureStore.deleteItemAsync(keyName(storageKey), KEY_OPTIONS); } catch { /* already gone */ }
}

export const secureSessionStorage = { getItem, setItem, removeItem };
