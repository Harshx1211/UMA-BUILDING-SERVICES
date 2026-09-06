import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { openJob } from '@/utils/navigation';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useColors } from '@/hooks/useColors';
import { getValidLocalUri } from '@/utils/fileHelpers';
import type { SiteDocument } from '@/types';

/** Resolves document.local_uri to a usable path for THIS session, or null if
 * it's missing/never existed/was purged by the OS — same reasoning as
 * inspection_photos.local_uri (see utils/fileHelpers.ts's own docs). */
async function resolveLocalUri(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  const resolved = getValidLocalUri(uri);
  if (!resolved) return null;
  try {
    const info = await FileSystem.getInfoAsync(resolved);
    return info.exists ? resolved : null;
  } catch {
    return null;
  }
}

interface Props {
  document: SiteDocument;
  /** The job screen this card is rendered from, if any — drives the "This visit" badge. */
  currentJobId?: string;
  onLongPress?: (doc: SiteDocument) => void;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function DocumentCard({ document, currentJobId, onLongPress }: Props) {
  const C = useColors();
  const [sharing, setSharing] = useState(false);
  const isUploaded = document.document_url.startsWith('https://');
  const isThisVisit = !!currentJobId && document.job_id === currentJobId;

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      let uri = await resolveLocalUri(document.local_uri);
      if (!uri) {
        if (!isUploaded) {
          Toast.show({ type: 'info', text1: 'Still uploading', text2: 'Try sharing again in a moment.' });
          return;
        }
        const dest = `${FileSystem.cacheDirectory}${document.id}.pdf`;
        const dl = await FileSystem.downloadAsync(document.document_url, dest);
        uri = dl.uri;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: document.title ?? 'Document' });
      } else {
        Toast.show({ type: 'error', text1: 'Sharing not available on this device' });
      }
    } catch (e) {
      console.error('[DocumentCard] share error:', e);
      Toast.show({ type: 'error', text1: 'Could not share document' });
    } finally {
      setSharing(false);
    }
  };

  // Tapping the card to "view" a document has the same problem opening a raw
  // file:// PDF that handleShare above already solves for sharing: neither
  // Android nor iOS has a reliable Linking.openURL handler for a local file
  // path, so this used to just refuse ("Still uploading") until the upload
  // finished — even though the PDF already exists on disk and is fully
  // readable right after scanning. Now it opens the local copy the same way
  // handleShare does (the share sheet is also a perfectly good "open/preview"
  // affordance — Quick Look on iOS, an app chooser on Android) and only
  // falls back to the "still uploading" message once there's truly neither a
  // local file nor an uploaded URL to show.
  const handleView = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const localUri = await resolveLocalUri(document.local_uri);
      if (localUri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri, { mimeType: 'application/pdf', dialogTitle: document.title ?? 'Document' });
        } else {
          Toast.show({ type: 'error', text1: 'Cannot open document on this device' });
        }
        return;
      }
      if (!isUploaded) {
        Toast.show({ type: 'info', text1: 'Still uploading', text2: 'This document will open once it finishes syncing.' });
        return;
      }
      Linking.openURL(document.document_url);
    } catch (e) {
      console.error('[DocumentCard] view error:', e);
      Toast.show({ type: 'error', text1: 'Could not open document' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}
      activeOpacity={0.8}
      onPress={handleView}
      onLongPress={() => onLongPress?.(document)}
      disabled={sharing}
    >
      <View style={[s.iconWrap, { backgroundColor: C.accent + '15' }]}>
        <MaterialCommunityIcons name="file-pdf-box" size={22} color={C.accent} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: C.text }]} numberOfLines={1}>
          {document.title || 'Untitled document'}
        </Text>
        <View style={s.metaRow}>
          <Text style={[s.meta, { color: C.textTertiary }]} numberOfLines={1}>
            {fmtDate(document.uploaded_at)}
            {document.page_count ? ` · ${document.page_count} page${document.page_count !== 1 ? 's' : ''}` : ''}
          </Text>
          {!isUploaded && (
            <View style={[s.badge, { backgroundColor: C.backgroundTertiary }]}>
              <Text style={[s.badgeTxt, { color: C.textSecondary }]}>Uploading…</Text>
            </View>
          )}
          {isThisVisit ? (
            <View style={[s.badge, { backgroundColor: C.primary + '18' }]}>
              <Text style={[s.badgeTxt, { color: C.primary }]}>This visit</Text>
            </View>
          ) : document.job_id ? (
            <TouchableOpacity
              style={[s.badge, { backgroundColor: C.backgroundTertiary }]}
              onPress={() => openJob(document.job_id as string)}
            >
              <Text style={[s.badgeTxt, { color: C.textSecondary }]}>Other visit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TouchableOpacity style={s.actionBtn} onPress={handleShare} disabled={sharing} hitSlop={8}>
        <MaterialCommunityIcons name="share-variant" size={19} color={sharing ? C.textTertiary : C.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta: { fontSize: 11, fontWeight: '500' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
