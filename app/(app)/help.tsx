/**
 * SiteTrack — Help & Support Screen
 * Accordion guides, FAQ, feedback email, walkthrough replay, app version
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Animated,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { Card, ScreenHeader, SectionTitle, Button } from '@/components/ui';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

// ─── Types ───────────────────────────────────
interface AccordionItem {
  id: string;
  title: string;
  content: string;
}

// ─── Accordion card ─────────────────────────
function AccordionCard({ item, icon }: { item: AccordionItem; icon: string }) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const animVal = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toVal = open ? 0 : 1;
    Animated.timing(animVal, { toValue: toVal, duration: 220, useNativeDriver: false }).start();
    setOpen(o => !o);
  };

  const maxH = animVal.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });

  return (
    <Card style={{ marginBottom: 12 }} noPadding>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={{ padding: 16 }}>
        <View style={s.accordionHeader}>
          <Text style={s.accordionIcon}>{icon}</Text>
          <Text style={[s.accordionTitle, { color: C.text }]}>{item.title}</Text>
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={C.textSecondary}
          />
        </View>
        <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
          <Text style={[s.accordionBody, { color: C.textSecondary }]}>{item.content}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Onboarding walkthrough modal ───────────
const WALKTHROUGH_STEPS = [
  {
    emoji: '🏠',
    title: 'Your Dashboard',
    body: 'This is your command centre. See today\'s job count, check your next job, and access quick actions — all in one place.',
  },
  {
    emoji: '📋',
    title: 'Schedule Tab',
    body: 'Tap "Schedule" at the bottom to see all your jobs. Filter by Today, This Week, or All Jobs. Switch to Map view to plan your route.',
  },
  {
    emoji: '🔥',
    title: 'Inspecting Assets',
    body: 'Tap a job → Clock In → then tap "Inspect All Assets". Mark each asset as Pass, Fail, or Not Tested. Log defects and take photos as you go.',
  },
  {
    emoji: '📶',
    title: 'Offline First',
    body: 'You\'re in a basement with no signal? No problem. Everything saves to your phone instantly. When you\'re back in range, SiteTrack syncs automatically.',
  },
];

function WalkthroughModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useColors();
  const [step, setStep] = useState(0);
  const current = WALKTHROUGH_STEPS[step];

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < WALKTHROUGH_STEPS.length - 1) setStep(s => s + 1);
    else onClose();
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={wt.overlay}>
        <View style={[wt.card, { backgroundColor: C.surface, padding: 16 }]}>
          {/* Progress dots */}
          <View style={wt.dots}>
            {WALKTHROUGH_STEPS.map((_, i) => (
              <View key={i} style={[wt.dot, { backgroundColor: C.border }, i === step && [wt.dotActive, { backgroundColor: C.accent }]]} />
            ))}
          </View>

          <Text style={wt.emoji}>{current.emoji}</Text>
          <Text style={[wt.title, { color: C.text }]}>{current.title}</Text>
          <Text style={[wt.body, { color: C.textSecondary }]}>{current.body}</Text>

          <View style={wt.btnRow}>
            {step > 0 ? (
              <View style={{ flex: 1 }}>
                <Button variant="outline" title="← Back" onPress={handleBack} />
              </View>
            ) : (
              <View style={wt.skipBtn}>
                <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[wt.skipTxt, { color: C.textTertiary }]}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flex: 2 }}>
               <Button title={step < WALKTHROUGH_STEPS.length - 1 ? 'Next →' : 'Got it! ✓'} onPress={handleNext} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const wt = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card:      { borderRadius: 24, alignItems: 'center', gap: 12 },
  dots:      { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20 },
  emoji:     { fontSize: 56, marginBottom: 4 },
  title:     { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  body:      { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  skipBtn:   { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center' },
  skipTxt:   { fontSize: 15, fontWeight: '500' },
});

// ─── Data ────────────────────────────────────
const HOW_TO: { item: AccordionItem; icon: string }[] = [
  {
    icon: '🕐',
    item: {
      id: 'start',
      title: 'Starting a Job',
      content: '1. Go to the Schedule tab\n2. Tap the job you\'re about to start\n3. Tap "Clock In & Start Job"\n4. Your GPS location is recorded automatically\n5. You\'re now on the clock!',
    },
  },
  {
    icon: '🔥',
    item: {
      id: 'inspect',
      title: 'Inspecting Assets',
      content: '1. From the job detail, tap "Inspect All Assets"\n2. Each asset card shows the asset type and location\n3. Tap ✅ Pass, ❌ Fail, or ⬜ N/T for each asset\n4. If you tap Fail, a defect reason field appears — fill it in\n5. You can take a photo directly from the inspection screen',
    },
  },
  {
    icon: '⚠️',
    item: {
      id: 'defects',
      title: 'Logging Defects',
      content: '1. Defects can be logged directly from the asset inspection\n2. Or go to the job detail → "Defects" tab → "Log Defect"\n3. Choose severity: Minor, Major, or Critical\n4. Write a description and attach a photo as evidence\n5. Defects sync to the cloud when you\'re back online',
    },
  },
  {
    icon: '✍️',
    item: {
      id: 'sig',
      title: 'Collecting Signatures',
      content: '1. When the job is finished, tap "Complete" from the time tracking card\n2. A signature canvas will appear\n3. Hand your phone to the site contact\n4. They sign with their finger and enter their name\n5. Tap "Save Signature" — it\'s embedded in the PDF report',
    },
  },
  {
    icon: '📄',
    item: {
      id: 'report',
      title: 'Generating Reports',
      content: '1. From the job detail screen, tap "Generate Report" at the bottom\n2. SiteTrack compiles all inspection data, defects, and the signature\n3. A PDF is generated on your device — no internet needed\n4. Tap "Share" to email it directly to the client or office\n5. The report includes pass/fail colour coding and a compliance footer',
    },
  },
];

const FAQ_ITEMS: { item: AccordionItem; icon: string }[] = [
  { icon: '📶', item: { id: 'faq1', title: 'What if I have no signal on site?', content: 'SiteTrack is built offline-first. Everything saves to your phone instantly — inspections, photos, defects, signatures. When you\'re back in range, the app syncs automatically in the background. You\'ll see a green "All synced" banner when it\'s done.' } },
  { icon: '📷', item: { id: 'faq2', title: 'Can I add photos after leaving the site?', content: 'Photos taken while offline are queued and uploaded when you reconnect. The orange pending-upload dot on the Photos screen shows what\'s still waiting. Don\'t delete the photos app or clear cache until they\'ve synced.' } },
  { icon: '🔴', item: { id: 'faq3', title: 'What is a defect?', content: 'A defect is any fire safety asset that failed inspection or has an issue needing follow-up. Defects are categorised as Minor, Major, or Critical. They appear in the compliance report and are tracked until repaired.' } },

  { icon: '🔄', item: { id: 'faq5', title: 'How often does the app sync?', content: 'The sync engine runs automatically every 60 seconds when you\'re online. You can also force a sync from the Profile screen → "Force Sync Now". The sync uploads your local changes and pulls in any new jobs assigned by your office.' } },
  { icon: '🔑', item: { id: 'faq6', title: 'I forgot my password — what do I do?', content: 'Contact your company administrator. They can reset your password through the SiteTrack admin portal. Your app data is not lost — it will re-sync once you log back in.' } },
  { icon: '📑', item: { id: 'faq7', title: 'Who receives the PDF report?', content: 'The report is generated on your device. You can share it directly to email, WhatsApp, or any other app via the native Android share sheet. It\'s your responsibility to send it to the relevant parties — typically office admin and the client.' } },
  { icon: '⚡', item: { id: 'faq8', title: 'The app seems slow — what should I do?', content: 'Try force-closing and reopening the app. Make sure you\'re running the latest version. If the jobs list is slow, try the "Force Sync" in Profile to refresh your local database. If problems persist, send feedback using the button below.' } },
];

// ─── Main Screen ─────────────────────────────
export default function HelpScreen() {
  const C = useColors();
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';



  const handleFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const subject = encodeURIComponent(`SiteTrack Feedback — v${version}`);
    const body    = encodeURIComponent('Hi SiteTrack team,\n\nI have the following feedback:\n\n');
    Linking.openURL(`mailto:support@sitetrack.com.au?subject=${subject}&body=${body}`);
  }, [version]);

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader 
        curved={true} 
        title="Help & Support" 
        subtitle={`SiteTrack v${version}`} 
        showBack={true} 
        rightComponent={<MaterialCommunityIcons name="lifebuoy" size={26} color="rgba(255,255,255,0.5)" />} 
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Walkthrough CTA ── */}
        <Reanimated.View entering={FadeInDown.delay(30).duration(350)}>
          <Card 
            style={[s.walkthroughCard, { borderColor: 'rgba(249, 115, 22, 0.15)', borderWidth: 1.5 }]} 
            noPadding
          >
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowWalkthrough(true); }} activeOpacity={0.8} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[s.walkthroughIcon, { backgroundColor: C.accentLight }]}>
                <Text style={{ fontSize: 26 }}>🎓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.walkthroughTitle, { color: C.text }]}>App Walkthrough</Text>
                <Text style={[s.walkthroughSub, { color: C.textSecondary }]}>4-step guide for new technicians</Text>
              </View>
              <MaterialCommunityIcons name="play-circle-outline" size={28} color={C.accent} />
            </TouchableOpacity>
          </Card>
        </Reanimated.View>

        {/* ── How To Use ── */}
        <Reanimated.View entering={FadeInDown.delay(80).duration(350)} style={s.section}>
          <SectionTitle title="HOW TO USE SITETRACK" />
          {HOW_TO.map(({ item, icon }) => (
            <AccordionCard key={item.id} item={item} icon={icon} />
          ))}
        </Reanimated.View>

        {/* ── FAQ ── */}
        <Reanimated.View entering={FadeInDown.delay(130).duration(350)} style={s.section}>
          <SectionTitle title="FREQUENTLY ASKED QUESTIONS" />
          {FAQ_ITEMS.map(({ item, icon }) => (
            <AccordionCard key={item.id} item={item} icon={icon} />
          ))}
        </Reanimated.View>

        {/* ── Feedback button ── */}
        <Reanimated.View entering={FadeInDown.delay(180).duration(350)}>
          <Button variant="outline" title="Send Feedback to Support" onPress={handleFeedback} />
        </Reanimated.View>

        {/* ── App info row ── */}
        <Reanimated.View entering={FadeInDown.delay(210).duration(350)}>
          <Card style={s.versionCard}>
            <View style={[s.versionIconWrap, { backgroundColor: C.backgroundTertiary }]}>
              <Text style={{ fontSize: 20 }}>🔥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.versionApp, { color: C.text }]}>SiteTrack — Field Service App</Text>
              <Text style={[s.versionNum, { color: C.textTertiary }]}>Version {version} · Build 1 · Android</Text>
            </View>
          </Card>
          <Text style={[s.legalNote, { color: C.textTertiary }]}>
            Built for Australian fire protection technicians. All data is encrypted and stored securely on Supabase.
          </Text>
        </Reanimated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <WalkthroughModal visible={showWalkthrough} onClose={() => setShowWalkthrough(false)} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  scroll: { padding: 16, gap: 12 },

  // Walkthrough CTA
  walkthroughCard: {
    marginBottom: 12,
  },
  walkthroughIcon:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  walkthroughTitle: { fontSize: 15, fontWeight: '700' },
  walkthroughSub:   { fontSize: 12, marginTop: 2 },

  // Sections
  section:      { marginBottom: 12, gap: 8 },

  // Accordion
  accordionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accordionIcon:   { fontSize: 18, width: 28, textAlign: 'center' },
  accordionTitle:  { flex: 1, fontSize: 14, fontWeight: '600' },
  accordionBody:   { fontSize: 13, lineHeight: 21, paddingTop: 12, paddingLeft: 38 },

  // Version card
  versionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 0, marginBottom: 12, marginTop: 12 },
  versionIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  versionApp:  { fontSize: 13, fontWeight: '700' },
  versionNum:  { fontSize: 11, marginTop: 2 },
  legalNote:   { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
});
