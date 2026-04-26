import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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
        <View style={[s.header, { backgroundColor: C.surface, paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity onPress={onCancel} style={s.headerIconBtn} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: C.text }]}>Inspection Checklist</Text>
            <Text style={[s.headerSub, { color: C.textTertiary }]} numberOfLines={1}>{assetType}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* ── PROGRESS BAR ────────────────────────────────── */}
        <View style={[s.progressTrack, { backgroundColor: C.backgroundTertiary }]}>
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
                      ? C.success + '40'
                      : isFailed
                      ? C.error + '40'
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

          {/* Spacing at bottom of scroll */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* ── BOTTOM ACTION BAR ───────────────────────────── */}
        <View style={[s.bottomBar, { backgroundColor: C.surface, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[s.bottomBtn, { backgroundColor: allAnswered ? C.primary : C.backgroundTertiary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="clipboard-check"
              size={20}
              color={allAnswered ? '#FFF' : C.textSecondary}
            />
            <Text style={[s.bottomBtnTxt, { color: allAnswered ? '#FFF' : C.textSecondary }]}>
              {allAnswered ? 'Submit Checklist' : `Answer ${required.length - answered.length} More Required`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800' },
  headerSub:     { fontSize: 12, marginTop: 2, fontWeight: '500' },

  // Progress
  progressTrack: { height: 6, width: '100%' },
  progressFill:  { height: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6 },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 18, fontWeight: '800' },
  statLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 32, marginHorizontal: 4 },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 16, marginBottom: 6,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  disclaimerTxt: { fontSize: 13, lineHeight: 19, flex: 1 },

  scrollContent: { padding: 16, paddingBottom: 120, gap: 12 },

  // Question card
  questionCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  questionNum:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  questionNumTxt: { fontSize: 12, fontWeight: '800' },
  questionText:   { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  requiredRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  requiredTxt:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  toggleWrap:     { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Bottom action bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  bottomBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54 },
  bottomBtnTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
