/**
 * ScanReviewModal — review screen shown between scanning and saving. Lets a
 * technician see every captured page before it's committed: drag to reorder,
 * tap to view full-screen, delete a bad page, add a missed one. Pure review
 * UI — DocumentScanSheet.tsx owns the actual scan invocation, PDF assembly,
 * and the store write; this component only ever hands back a title string
 * and fires callbacks.
 *
 * No "retake this one page" control — react-native-document-scanner-plugin
 * has no single-capture API, so a bad page is fixed by deleting it, tapping
 * Add Page (which re-runs the same multi-page scan session), and dragging
 * the result into place. No automatic blur/quality detection either — the
 * technician's own eyes via the full-screen viewer are the review mechanism.
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal as RNModal, BackHandler } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MAX_LENGTHS } from '@/utils/sanitize';

export interface ScannedPage {
  id: string;
  base64: string;
}

interface Props {
  visible: boolean;
  pages: ScannedPage[];
  title: string;
  onTitleChange: (title: string) => void;
  onReorder: (pages: ScannedPage[]) => void;
  onDeletePage: (id: string) => void;
  onAddPage: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  addingPage: boolean;
}

function dataUri(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

export function ScanReviewModal({
  visible, pages, title, onTitleChange, onReorder, onDeletePage,
  onAddPage, onCancel, onSave, saving, addingPage,
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const noMotion = useReducedMotion();
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const busy = saving || addingPage;

  // The full-screen viewer below is a plain overlay, not a nested Modal (see
  // its render site) — so it doesn't get the Android hardware back button for
  // free the way a real Modal would. Wire it up manually while open.
  useEffect(() => {
    if (viewingIndex === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setViewingIndex(null);
      return true;
    });
    return () => sub.remove();
  }, [viewingIndex]);

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDeletePage(id);
  };

  const renderRow = ({ item, index, drag, isActive }: RenderItemParams<ScannedPage> & { index: number }) => (
    <ScaleDecorator>
      <Animated.View
        entering={noMotion ? undefined : FadeIn}
        exiting={noMotion ? undefined : FadeOut}
        layout={noMotion ? undefined : Layout.springify()}
        style={[
          s.row,
          { backgroundColor: isActive ? C.backgroundTertiary : C.surface, borderColor: C.border },
        ]}
      >
        <TouchableOpacity onLongPress={drag} disabled={busy} hitSlop={8} style={s.dragHandle}>
          <MaterialCommunityIcons name="drag-horizontal-variant" size={18} color={C.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setViewingIndex(index)} disabled={busy} activeOpacity={0.8}>
          <Image source={{ uri: dataUri(item.base64) }} style={[s.thumb, { borderColor: C.border }]} contentFit="cover" />
        </TouchableOpacity>

        <Text style={[s.pageLabel, { color: C.text }]}>Page {index + 1}</Text>

        <TouchableOpacity onPress={() => handleDelete(item.id)} disabled={busy} hitSlop={8} style={s.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={19} color={busy ? C.textTertiary : C.error} />
        </TouchableOpacity>
      </Animated.View>
    </ScaleDecorator>
  );

  return (
    <RNModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[s.container, { backgroundColor: C.background }]}>
          <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16), borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: C.text }]}>Review Scan</Text>
              <Text style={[s.headerSub, { color: C.textSecondary }]}>{pages.length} page{pages.length !== 1 ? 's' : ''} · drag to reorder</Text>
            </View>
            <TouchableOpacity onPress={onCancel} disabled={busy} style={[s.closeBtn, { backgroundColor: C.backgroundTertiary }]} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          <DraggableFlatList
            data={pages}
            keyExtractor={(item) => item.id}
            renderItem={renderRow as never}
            onDragEnd={({ data }) => onReorder(data)}
            contentContainerStyle={s.listContent}
            ListFooterComponent={
              <TouchableOpacity
                onPress={onAddPage}
                disabled={busy}
                activeOpacity={0.8}
                style={[s.addPageBtn, { borderColor: C.borderStrong, opacity: busy ? 0.5 : 1 }]}
              >
                {addingPage ? (
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <MaterialCommunityIcons name="plus" size={18} color={C.accent} />
                )}
                <Text style={[s.addPageTxt, { color: C.accent }]}>{addingPage ? 'Scanning…' : 'Add Page'}</Text>
              </TouchableOpacity>
            }
          />

          <View style={[s.bottomPanel, { backgroundColor: C.surface, borderTopColor: C.border, paddingBottom: 16 + insets.bottom }]}>
            <Text style={[s.fieldLabel, { color: C.textTertiary }]}>Document Name</Text>
            <TextInput
              style={[s.input, { backgroundColor: C.backgroundTertiary, borderColor: C.border, color: C.text }]}
              value={title}
              onChangeText={onTitleChange}
              placeholderTextColor={C.textTertiary}
              maxLength={MAX_LENGTHS.shortText}
              editable={!busy}
              returnKeyType="done"
            />
            <View style={s.actionsRow}>
              <TouchableOpacity style={[s.cancelBtn, { borderColor: C.border }]} onPress={onCancel} disabled={busy}>
                <Text style={[s.cancelTxt, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: C.accent, opacity: busy || pages.length === 0 ? 0.6 : 1 }]}
                onPress={onSave}
                disabled={busy || pages.length === 0}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.textOnPrimary} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={17} color={C.textOnPrimary} />
                    <Text style={[s.saveTxt, { color: C.textOnPrimary }]}>Save Document</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Full-screen page viewer — a same-tree overlay, NOT a nested Modal.
            react-native-document-scanner-plugin aside, RN's own Modal-inside-
            Modal is unreliable (most visibly on Android, where a second
            native Modal opened while one is already showing can fail to
            render at all) — mirrors PhotoViewer's visuals from
            asset/[assetId].tsx but as a plain absolutely-positioned View so
            it always shows up on top of this screen. */}
        {viewingIndex !== null && pages[viewingIndex] ? (
          <Animated.View
            entering={noMotion ? undefined : FadeIn}
            exiting={noMotion ? undefined : FadeOut}
            style={[StyleSheet.absoluteFillObject, s.viewerOverlay]}
          >
            <TouchableOpacity style={s.viewerCloseBtn} onPress={() => setViewingIndex(null)} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: dataUri(pages[viewingIndex].base64) }} style={s.viewerImage} contentFit="contain" />
            <Text style={s.viewerPageLabel}>Page {viewingIndex + 1} of {pages.length}</Text>
            <TouchableOpacity
              style={s.viewerDeleteBtn}
              onPress={() => {
                const id = pages[viewingIndex].id;
                setViewingIndex(null);
                handleDelete(id);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
              <Text style={s.viewerDeleteTxt}>Delete Page</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </GestureHandlerRootView>
    </RNModal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  listContent: { padding: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  dragHandle: { padding: 4 },
  thumb: { width: 44, height: 60, borderRadius: 7, borderWidth: 1 },
  pageLabel: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  deleteBtn: { padding: 6 },

  addPageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 48, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  addPageTxt: { fontSize: 13.5, fontWeight: '700' },

  bottomPanel: { padding: 16, borderTopWidth: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 12, fontSize: 15, marginBottom: 14 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 14.5, fontWeight: '700' },
  saveBtn: { flex: 1.6, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveTxt: { fontSize: 14.5, fontWeight: '700' },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  viewerImage: { width: '100%', height: '78%' },
  viewerPageLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginTop: 14 },
  viewerDeleteBtn: {
    position: 'absolute', bottom: 50, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(220,38,38,0.9)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
  },
  viewerDeleteTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
