import * as FileSystem from 'expo-file-system/legacy';

/**
 * Ensures that a locally stored file URI is valid for the current app session.
 * In Expo Go, the documentDirectory path changes on reload, invalidating absolute paths saved in SQLite.
 * This extracts the filename and appends it to the current documentDirectory.
 */
export function getValidLocalUri(uri: string | null | undefined): string {
  if (!uri) return '';
  
  // Ignore remote URLs
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  // Extract the filename
  const filename = uri.split('/').pop();
  if (!filename) return uri;
  
  // Reconstruct with the CURRENT document directory
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) return uri;
  
  return `${baseDir}${filename}`;
}
