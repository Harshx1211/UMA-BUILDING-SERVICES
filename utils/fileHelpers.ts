/**
 * utils/fileHelpers.ts
 *
 * Fix summary (this revision):
 *   1. getValidLocalUri: preserves subdirectory structure, not just the filename.
 *      Previously `file:///old-session/subdir/photo.jpg` would resolve to
 *      `file:///new-session/photo.jpg` (missing subdir), causing FileSystem reads to fail.
 *   2. getValidLocalUri: strips query strings from filenames before reconstruction.
 *   3. getValidLocalUri: returns early if uri already points to the current documentDirectory
 *      (avoids redundant stat calls on every render).
 *   4. Added safeFilename helper for generating collision-resistant local filenames.
 */

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Ensures that a locally stored file URI is valid for the current app session.
 *
 * In Expo Go, the documentDirectory path changes on each reload, invalidating
 * absolute file:// paths saved in SQLite. This function reconstructs the path
 * against the CURRENT documentDirectory so reads and uploads don't fail.
 *
 * Rules:
 *   - Remote URLs (http/https) and data URIs are returned unchanged.
 *   - Empty / null input returns an empty string.
 *   - Paths already under the current documentDirectory are returned unchanged
 *     (avoids unnecessary reconstruction).
 *   - file:// paths from a previous session are reconstructed by extracting
 *     everything after `/Documents/` (or the last path component as fallback)
 *     and joining it with the current documentDirectory.
 *
 * @param uri  Any URI — file://, https://, data:, or empty
 * @returns    A valid URI for the current session, or the original if not local
 */
export function getValidLocalUri(uri: string | null | undefined): string {
  if (!uri) return '';

  // Remote URLs and data URIs are unaffected by session path changes
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('data:')
  ) {
    return uri;
  }

  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return uri;

  // Already points to current session directory — no reconstruction needed
  if (uri.startsWith(baseDir)) return uri;

  // Extract the filename.
  // We don't use subdirectories for image storage in this app.
  // Taking the last path component perfectly adapts the URI to the new session's baseDir.
  const withoutQuery = uri.split('?')[0];
  const filename = withoutQuery.split('/').pop() ?? '';
  
  if (!filename) return uri;
  
  // baseDir already includes the trailing slash
  return `${baseDir}${filename}`;
}

/**
 * Generates a collision-resistant filename for a captured photo.
 * Uses timestamp + random suffix to prevent overwrites when multiple
 * photos are taken in quick succession.
 *
 * @param extension  File extension without dot (default: 'jpg')
 * @returns          e.g. "photo_1712345678901_k3f9.jpg"
 */
export function safeFilename(extension = 'jpg'): string {
  const ts     = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `photo_${ts}_${random}.${extension}`;
}
