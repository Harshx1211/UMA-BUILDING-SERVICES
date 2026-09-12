import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useNotebookStore } from '@/store/notebookStore';
import { useAuthStore } from '@/store/authStore';
import { getRecord } from '@/lib/database';
import { MAX_LENGTHS, sanitizeText } from '@/utils/sanitize';

interface Props {
  propertyId: string;
  /** Inspection screens open this editable (add + delete); Property Detail
   * opens it read-only ("can be seen, not edited from outside the
   * inspection page" — the only place a note can be added is during an
   * actual visit). */
  editable: boolean;
}

export interface PropertyNotebookSheetRef {
  open: () => void;
  close: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

/**
 * Shared per-property notebook — a plain add/delete bullet list of things
 * to remember about a site (equipment to bring, access quirks, anything
 * worth flagging to whoever visits next). Shared across the whole company:
 * any technician who visits this property sees what a previous visit left
 * behind. No in-place edit — fixing a typo means delete and re-add,
 * deliberately, to keep this simple.
 */
export const PropertyNotebookSheet = forwardRef<PropertyNotebookSheetRef, Props>(
  ({ propertyId, editable }, ref) => {
    const C = useColors();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = ['60%'];
    const { items, isLoading, loadItems, addItem, deleteItem } = useNotebookStore();
    const [text, setText] = useState('');

    useImperativeHandle(ref, () => ({
      open: () => {
        loadItems(propertyId);
        setText('');
        bottomSheetRef.current?.expand();
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    const nameFor = useCallback((userId: string | null): string => {
      if (!userId) return 'Unknown';
      const u = getRecord<{ full_name: string }>('users', userId);
      return u?.full_name ?? 'Unknown';
    }, []);

    const handleAdd = () => {
      const trimmed = sanitizeText(text, MAX_LENGTHS.notes);
      if (!trimmed) return;
      const user = useAuthStore.getState().user;
      addItem(propertyId, trimmed, user?.id ?? null, user?.company_id ?? null);
      setText('');
    };

    const handleDelete = (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      deleteItem(id);
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        backgroundStyle={{ backgroundColor: C.background }}
      >
        <View style={s.header}>
          <MaterialCommunityIcons name="notebook-outline" size={18} color={C.text} />
          <Text style={[s.headerTxt, { color: C.text }]}>Site Notebook</Text>
        </View>

        {editable && (
          <View style={[s.addRow, { borderColor: C.border }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. Bring the tall ladder, extra 9V batteries…"
              placeholderTextColor={C.textTertiary}
              style={[s.input, { color: C.text, backgroundColor: C.surface, borderColor: C.border }]}
              multiline
            />
            <TouchableOpacity
              onPress={handleAdd}
              disabled={!text.trim()}
              style={[s.addBtn, { backgroundColor: text.trim() ? C.accent : C.border }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={C.textOnAccent} />
            </TouchableOpacity>
          </View>
        )}

        <BottomSheetScrollView contentContainerStyle={s.content}>
          {isLoading ? (
            <ActivityIndicator size="small" color={C.textTertiary} />
          ) : items.length === 0 ? (
            <View style={s.empty}>
              <MaterialCommunityIcons name="notebook-outline" size={36} color={C.border} />
              <Text style={[s.emptyTxt, { color: C.textTertiary }]}>No notes yet for this site.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={[s.row, { borderColor: C.border }]}>
                <MaterialCommunityIcons name="circle-small" size={20} color={C.textTertiary} style={s.bullet} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemTxt, { color: C.text }]}>{item.text}</Text>
                  <Text style={[s.itemMeta, { color: C.textTertiary }]}>
                    {nameFor(item.created_by)} · {fmtDate(item.created_at)}
                  </Text>
                </View>
                {editable && (
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={C.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

PropertyNotebookSheet.displayName = 'PropertyNotebookSheet';

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  headerTxt: { fontSize: 16, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, maxHeight: 80 },
  addBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1 },
  bullet: { marginTop: -1 },
  itemTxt: { fontSize: 14, lineHeight: 20 },
  itemMeta: { fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 6 },
});
