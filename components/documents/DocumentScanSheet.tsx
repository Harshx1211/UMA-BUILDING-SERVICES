import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';
import { useDocumentsStore } from '@/store/documentsStore';
import { useAuthStore } from '@/store/authStore';
import { localDateString } from '@/utils/dateHelpers';
import { MAX_LENGTHS, sanitizeText } from '@/utils/sanitize';
import { generateUUID } from '@/utils/uuid';
import { ScanReviewModal, ScannedPage } from './ScanReviewModal';

interface Props {
  propertyId: string;
  /** Job this document is being captured during — null when scanned outside a job. */
  jobId: string | null;
}

export interface DocumentScanSheetRef {
  /** Launches the native document scanner immediately. */
  open: () => void;
}

/** Wraps a set of scanned page images in a minimal HTML doc for expo-print. */
function buildPdfHtml(base64Pages: string[]): string {
  const pages = base64Pages
    .map((b64) => `<div style="page-break-after: always"><img src="data:image/jpeg;base64,${b64}" style="width:100%;display:block" /></div>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    @page { margin: 0; }
    body { margin: 0; }
  </style></head><body>${pages}</body></html>`;
}

const DocumentScanSheet = forwardRef<DocumentScanSheetRef, Props>(({ propertyId, jobId }, ref) => {
  const { addDocument } = useDocumentsStore();

  const [pendingPages, setPendingPages] = useState<ScannedPage[]>([]);
  const [title, setTitle] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingPage, setAddingPage] = useState(false);

  const defaultTitle = () => `Document – ${localDateString()}`;

  /**
   * Runs one native multi-page scan session and returns whatever pages it
   * captured (or [] if the user cancelled). Shared by open() (first scan)
   * and handleAddPage() (adding more) — the plugin has no single-capture
   * mode, so "add a page" re-runs this exact same full session.
   */
  const runScan = async (): Promise<string[]> => {
    // Android only: the app already declares CAMERA permission for
    // expo-camera, which means (per the scanner plugin's own docs) it
    // must be explicitly requested here or scanDocument() fails with a
    // permission-denial error — iOS handles its own prompt via
    // NSCameraUsageDescription and needs no separate request.
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Toast.show({ type: 'error', text1: 'Camera permission required', text2: 'Allow camera access to scan a document.' });
        return [];
      }
    }

    const { scannedImages, status } = await DocumentScanner.scanDocument({
      responseType: ResponseType.Base64,
    });

    if (status !== ScanDocumentResponseStatus.Success || !scannedImages || scannedImages.length === 0) {
      return []; // user cancelled — nothing to do
    }
    return scannedImages;
  };

  useImperativeHandle(ref, () => ({
    open: async () => {
      try {
        const scannedImages = await runScan();
        if (scannedImages.length === 0) return;

        setPendingPages(scannedImages.map((base64) => ({ id: generateUUID(), base64 })));
        setTitle(defaultTitle());
        setShowReview(true);
      } catch (e) {
        console.error('[DocumentScanSheet] scan error:', e);
        Toast.show({ type: 'error', text1: 'Scan failed', text2: 'Please try again.' });
      }
    },
  }));

  const handleAddPage = async () => {
    if (addingPage || saving) return;
    setAddingPage(true);
    try {
      const scannedImages = await runScan();
      if (scannedImages.length === 0) return;
      setPendingPages((prev) => [...prev, ...scannedImages.map((base64) => ({ id: generateUUID(), base64 }))]);
    } catch (e) {
      console.error('[DocumentScanSheet] add page error:', e);
      Toast.show({ type: 'error', text1: 'Scan failed', text2: 'Please try again.' });
    } finally {
      setAddingPage(false);
    }
  };

  const handleDeletePage = (id: string) => {
    setPendingPages((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCancel = () => {
    setShowReview(false);
    setPendingPages([]);
  };

  const handleSave = async () => {
    if (saving || addingPage || pendingPages.length === 0) return;
    setSaving(true);
    try {
      const currentUserId = useAuthStore.getState().user?.id ?? null;
      if (!currentUserId) {
        Toast.show({ type: 'error', text1: 'Session Error', text2: 'Please re-sign in before scanning documents.' });
        return;
      }

      const html = buildPdfHtml(pendingPages.map((p) => p.base64));
      const { uri: printedUri } = await Print.printToFileAsync({ html, base64: false });

      // Copy out of expo-print's temp cache location into permanent app
      // storage — same reasoning PhotoCaptureSheet uses for captured photos:
      // a cache-dir file can be purged by the OS before the upload runs.
      const destUri = `${FileSystem.documentDirectory}document_${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: printedUri, to: destUri });

      const finalTitle = sanitizeText(title, MAX_LENGTHS.shortText) || defaultTitle();
      const pageCount = pendingPages.length;

      addDocument({
        company_id: useAuthStore.getState().user?.company_id ?? null,
        property_id: propertyId,
        job_id: jobId,
        title: finalTitle,
        document_url: destUri,
        local_uri: destUri,
        page_count: pageCount,
        uploaded_by: currentUserId,
      });

      setShowReview(false);
      setPendingPages([]);

      // Sharing is now a separate, optional follow-up — tapping the toast
      // opens the share sheet, but saving never forces it open.
      Toast.show({
        type: 'success',
        text1: 'Document saved',
        text2: 'Tap to share',
        onPress: async () => {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(destUri, { mimeType: 'application/pdf', dialogTitle: finalTitle });
          }
        },
      });
    } catch (e) {
      console.error('[DocumentScanSheet] save error:', e);
      Toast.show({ type: 'error', text1: 'Failed to save document', text2: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScanReviewModal
      visible={showReview}
      pages={pendingPages}
      title={title}
      onTitleChange={setTitle}
      onReorder={setPendingPages}
      onDeletePage={handleDeletePage}
      onAddPage={handleAddPage}
      onCancel={handleCancel}
      onSave={handleSave}
      saving={saving}
      addingPage={addingPage}
    />
  );
});

DocumentScanSheet.displayName = 'DocumentScanSheet';

export default DocumentScanSheet;
