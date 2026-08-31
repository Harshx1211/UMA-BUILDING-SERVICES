import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui';

const MAX_LENGTH = 500;

interface AssetNoteModalProps {
  visible: boolean;
  initialNote: string;
  assetType: string;
  location: string | null;
  onClose: () => void;
  onSave: (note: string) => void;
}

/**
 * A lightweight note editor for a Pass/Not-Tested asset. A Fail already has
 * its own "Technician Notes" field built into AssetInspectModal's full-page
 * form (alongside severity/code/description) — same job_assets.technician_notes
 * column, already saved correctly, just never surfaced in the PDF until now.
 * This is the equivalent for Pass/N-T, which never had that form to live in.
 * Input styling matches AssetInspectModal's `input`/`formLabel`/`formHint`
 * constants intentionally — same design language, just a lighter container
 * since a single optional field doesn't need a full pageSheet.
 */
export default function AssetNoteModal({ visible, initialNote, assetType, location, onClose, onSave }: AssetNoteModalProps) {
  const C = useColors();
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (visible) setNote(initialNote);
  }, [visible, initialNote]);

  const handleSave = () => {
    onSave(note.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: C.surface }]}>
          <View style={s.header}>
            <View style={[s.headerIconWrap, { backgroundColor: C.info + '18' }]}>
              <MaterialCommunityIcons name="note-text-outline" size={18} color={C.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: C.text }]}>Inspection Note</Text>
              <Text style={[s.assetContext, { color: C.textSecondary }]} numberOfLines={1}>
                {assetType}{location ? ` · ${location}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons name="close" size={20} color={C.textTertiary} />
            </TouchableOpacity>
          </View>
          <Text style={[s.formHint, { color: C.textTertiary }]}>
            Optional remark for this asset — shown on the inspection report.
          </Text>
          <TextInput
            style={[s.input, s.textArea, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
            value={note}
            onChangeText={t => setNote(t.slice(0, MAX_LENGTH))}
            placeholder="e.g. Flow test done, unit relocated, access restricted…"
            placeholderTextColor={C.textTertiary}
            multiline
            textAlignVertical="top"
            autoFocus
          />
          <Text style={[s.charCount, { color: C.textTertiary }]}>{note.length}/{MAX_LENGTH}</Text>
          <View style={s.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save Note" onPress={handleSave} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  assetContext: {
    fontSize: 12,
    marginTop: 1,
  },
  // Matches AssetInspectModal's formHint/input/textArea exactly — same
  // design language, just without the surrounding pageSheet/form-sections.
  formHint: { fontSize: 11, lineHeight: 16, marginTop: 14, marginBottom: 10 },
  input: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '500',
  },
  textArea: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
