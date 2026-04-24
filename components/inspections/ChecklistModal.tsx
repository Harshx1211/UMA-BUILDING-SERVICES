import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { ChecklistItem } from '@/constants/Checklists';

interface ChecklistModalProps {
  visible: boolean;
  assetType: string;
  items: ChecklistItem[];
  initialData: any;
  onSave: (data: any, isCompliant: boolean) => void;
  onCancel: () => void;
}

export default function ChecklistModal({
  visible, assetType, items, initialData, onSave, onCancel,
}: ChecklistModalProps) {
  const C = useColors();
  const [answers, setAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (visible && initialData) setAnswers(initialData);
    else if (visible)            setAnswers({});
  }, [visible, initialData]);

  const handleToggle = (id: string, currentValue: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // BUG 9 FIX: 3-state cycle: undefined (unanswered) → true (pass) → false (fail) → undefined
    let next: boolean | undefined;
    if (currentValue === undefined) next = true;
    else if (currentValue === true)  next = false;
    else                             next = undefined;

    setAnswers(prev => {
      const updated = { ...prev };
      if (next === undefined) delete updated[id];
      else updated[id] = next;
      return updated;
    });
  };

  const handleSave = () => {
    let isCompliant = true;
    for (const item of items) {
      if (item.type === 'boolean' && item.required) {
        if (!answers[item.id]) { isCompliant = false; }
      }
    }
    Haptics.notificationAsync(
      isCompliant
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );
    onSave(answers, isCompliant);
  };

  // Progress calculation
  const required   = items.filter(i => i.required);
  const answered   = required.filter(i => answers[i.id] !== undefined);
  const allAnswered = answered.length === required.length;
  const progressPct = required.length > 0 ? (answered.length / required.length) * 100 : 100;

  // Count pass / fail
  const passing = items.filter(i => answers[i.id] === true).length;
  const failing = items.filter(i => answers[i.id] === false).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={[s.container, { backgroundColor: C.background }]}>

        {/* ── HEADER ──────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={onCancel} style={s.headerIconBtn} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={22} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>Inspection Checklist</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]}>{assetType}</Text>
          </View>
          <TouchableOpacity
            style={[s.headerSaveBtn, { backgroundColor: allAnswered ? C.primary : C.backgroundTertiary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={[s.headerSaveTxt, { color: allAnswered ? '#FFF' : C.textTertiary }]}>Submit</Text>
          </TouchableOpacity>
        </View>

        {/* ── PROGRESS BAR ────────────────────────────────── */}
        <View style={[s.progressTrack, { backgroundColor: C.border }]}>
          <View style={[s.progressFill, {
            width: `${progressPct}%` as `${number}%`,
            backgroundColor: failing > 0 ? C.error : C.success,
          }]} />
        </View>

        {/* ── STATS ROW ───────────────────────────────────── */}
        <View style={[s.statsRow, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: C.text }]}>{items.length}</Text>
            <Text style={[s.statLabel, { color: C.textTertiary }]}>Total</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: C.border }]} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: C.success }]}>{passing}</Text>
            <Text style={[s.statLabel, { color: C.textTertiary }]}>Passed</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: C.border }]} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: failing > 0 ? C.error : C.textTertiary }]}>{failing}</Text>
            <Text style={[s.statLabel, { color: C.textTertiary }]}>Failed</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: C.border }]} />
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: C.primary }]}>{answered.length}/{required.length}</Text>
            <Text style={[s.statLabel, { color: C.textTertiary }]}>Required</Text>
          </View>
        </View>

        {/* ── COMPLIANCE DISCLAIMER ───────────────────────── */}
        <View style={[s.disclaimer, { backgroundColor: C.infoLight, borderColor: C.infoDark }]}>
          <MaterialCommunityIcons name="information-outline" size={14} color={C.infoDark} />
          <Text style={[s.disclaimerTxt, { color: C.infoDark }]}>
            All items marked <Text style={{ fontWeight: '800' }}>Required</Text> must pass for the asset to be marked compliant. Toggle for YES / OFF for NO.
          </Text>
        </View>

        {/* ── CHECKLIST ITEMS ─────────────────────────────── */}
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {items.map((item, idx) => {
            const answered_val = answers[item.id];
            const isPassed  = answered_val === true;
            const isFailed  = answered_val === false;
            const isAnswered = answered_val !== undefined;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.questionCard,
                  {
                    backgroundColor: isPassed
                      ? C.successLight
                      : isFailed
                      ? C.errorLight
                      : C.surface,
                    borderColor: isPassed
                      ? C.success
                      : isFailed
                      ? C.error
                      : C.border,
                  },
                ]}
                onPress={() => handleToggle(item.id, answered_val)}
                activeOpacity={0.75}
              >
                {/* Index bubble */}
                <View style={[s.questionNum, {
                  backgroundColor: isPassed ? C.success : isFailed ? C.error : C.backgroundTertiary,
                }]}>
                  <Text style={[s.questionNumTxt, { color: isAnswered ? '#FFF' : C.textTertiary }]}>
                    {String(idx + 1).padStart(2, '0')}
                  </Text>
                </View>

                {/* Question text */}
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={[s.questionText, { color: isPassed ? C.successDark : isFailed ? C.errorDark : C.text }]}>
                    {item.question}
                  </Text>
                  {item.required && (
                    <View style={s.requiredRow}>
                      <MaterialCommunityIcons
                        name="asterisk"
                        size={8}
                        color={isPassed ? C.success : isFailed ? C.error : C.textTertiary}
                      />
                      <Text style={[s.requiredTxt, { color: isPassed ? C.success : isFailed ? C.error : C.textTertiary }]}>
                        Required
                      </Text>
                    </View>
                  )}
                </View>

                {/* Toggle indicator */}
                <View style={[
                  s.toggleWrap,
                  {
                    backgroundColor: isPassed ? C.success : isFailed ? C.error : C.backgroundTertiary,
                    borderColor: isPassed ? C.success : isFailed ? C.error : C.border,
                  },
                ]}>
                  <MaterialCommunityIcons
                    name={isPassed ? 'check' : isFailed ? 'close' : 'minus'}
                    size={18}
                    color={isAnswered ? '#FFF' : C.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* ── SUBMIT BUTTON ──────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: allAnswered ? C.primary : C.backgroundTertiary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="clipboard-check"
              size={20}
              color={allAnswered ? '#FFF' : C.textTertiary}
            />
            <Text style={[s.submitBtnTxt, { color: allAnswered ? '#FFF' : C.textTertiary }]}>
              {allAnswered ? 'Submit Checklist' : `Answer ${required.length - answered.length} More Required`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={[s.cancelBtnTxt, { color: C.textTertiary }]}>Cancel Checklist</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800' },
  headerSub:     { fontSize: 11, marginTop: 1 },
  headerSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  headerSaveTxt: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },

  // Progress
  progressTrack: { height: 4, width: '100%' },
  progressFill:  { height: 4, borderRadius: 2 },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 16, fontWeight: '800' },
  statLabel:   { fontSize: 10, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 28, marginHorizontal: 4 },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  disclaimerTxt: { fontSize: 12, lineHeight: 17, flex: 1 },

  scrollContent: { padding: 16, paddingBottom: 48, gap: 10 },

  // Question card
  questionCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  questionNum:    { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  questionNumTxt: { fontSize: 12, fontWeight: '800' },
  questionText:   { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  requiredRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  requiredTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  toggleWrap:     { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  // Submit / cancel
  submitBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54, marginTop: 8 },
  submitBtnTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  cancelBtn:    { marginTop: 10, alignItems: 'center', padding: 8 },
  cancelBtnTxt: { fontSize: 13, fontWeight: '500' },
});
