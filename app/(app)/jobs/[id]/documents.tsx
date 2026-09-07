import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { useDocumentsStore } from '@/store/documentsStore';
import DocumentCard from '@/components/documents/DocumentCard';
import DocumentScanSheet, { DocumentScanSheetRef } from '@/components/documents/DocumentScanSheet';
import { getJobById } from '@/lib/database';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button, EmptyState, showConfirm } from '@/components/ui';
import { useJobLiveSync } from '@/hooks/useJobLiveSync';
import type { SiteDocument } from '@/types';

export default function DocumentsScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const store = useDocumentsStore();
  const sheetRef = useRef<DocumentScanSheetRef>(null);

  const [propertyId, setPropertyId] = useState<string>('');
  // Lock scanning on completed jobs, same reasoning as the FAB on photos.tsx —
  // the PDF report is already generated, don't create a silent data gap.
  const [jobStatus, setJobStatus] = useState<string>('');

  useEffect(() => {
    if (jobId) {
      const job = getJobById<{ property_id: string; status: string }>(jobId);
      if (job) {
        setPropertyId(job.property_id);
        setJobStatus(job.status);
        store.loadDocuments(job.property_id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Now that the background sync interval is a slow safety net rather than
  // a 60s heartbeat (constants/Config.ts), a document another tech scans
  // (or an admin uploads) mid-visit needs its own live path — this job's
  // Realtime channel now carries site_documents (see subscribeToJobLive).
  useJobLiveSync(jobId, useCallback((table) => {
    if (table === 'site_documents' && propertyId) store.loadDocuments(propertyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, store.loadDocuments]));

  const handleLongPress = (doc: SiteDocument) => {
    showConfirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${doc.title || 'this document'}"? This cannot be undone.`,
      icon: 'trash-can-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            store.deleteDocument(doc.id);
            Toast.show({ type: 'success', text1: 'Document deleted' });
          },
        },
      ],
    });
  };

  if (store.isLoading) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Site Documents" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </View>
    );
  }

  if (store.error) {
    return (
      <View style={[s.screen, { backgroundColor: C.background }]}>
        <ScreenHeader title="Site Documents" showBack={true} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 }}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={C.error} />
          <Text style={{ color: C.error, textAlign: 'center', fontSize: 14, lineHeight: 21 }}>
            {store.error}
          </Text>
          <Button title="Retry" onPress={() => store.loadDocuments(propertyId)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        title="Site Documents"
        showBack={true}
        rightComponent={
          store.documents.length > 0 ? (
            <View style={[s.countBadge, { backgroundColor: C.backgroundTertiary }]}>
              <Text style={[s.countText, { color: C.textSecondary }]}>{store.documents.length} doc{store.documents.length !== 1 ? 's' : ''}</Text>
            </View>
          ) : null
        }
      />

      {store.documents.length === 0 ? (
        <EmptyState
          icon="file-document-outline"
          title="No documents yet"
          subtitle="Scan a compliance certificate, data plate, or sign-off sheet to attach it to this site."
        />
      ) : (
        <FlatList
          data={store.documents}
          keyExtractor={(d) => d.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <DocumentCard document={item} currentJobId={jobId as string} onLongPress={handleLongPress} />
          )}
        />
      )}

      {jobStatus !== 'completed' && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: C.accent }, cardShadow]}
          activeOpacity={0.9}
          onPress={() => sheetRef.current?.open()}
        >
          <MaterialCommunityIcons name="text-box-plus-outline" size={26} color={C.textOnPrimary} />
        </TouchableOpacity>
      )}

      <DocumentScanSheet ref={sheetRef} propertyId={propertyId} jobId={(jobId as string) ?? null} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countText: { fontSize: 11, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 100 },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
