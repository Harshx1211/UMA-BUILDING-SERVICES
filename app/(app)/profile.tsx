// Profile screen — navy curved header + large avatar + info cards + destructive sign out
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getPendingSyncItems } from '@/lib/database';
import { runSync } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';
import { useColors } from '@/hooks/useColors';
import { Card, Button } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';

type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type MenuRow = {
  id: string;
  icon: MCIcon;
  label: string;
  sub?: string;
  action?: () => void; // undefined = info-only, not tappable
  danger?: boolean;
};

export default function ProfileScreen() {
  const C = useColors();
  const { user, signOut, updateUser } = useAuth();
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync]         = useState<Date | null>(null);
  const [isSyncing, setIsSyncing]       = useState(false);
  const [showSignOut, setShowSignOut]   = useState(false);

  // Edit profile state
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName]         = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  // Poll pending sync count every 5 s so the card stays accurate
  useEffect(() => {
    const update = () => {
      try { setPendingCount(getPendingSyncItems().length); } catch { /* ignore */ }
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleForcSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await runSync();
      setLastSync(new Date());
      setPendingCount(0);
      Toast.show({ type: 'success', text1: '✅ Sync complete', text2: 'All changes pushed to cloud' });
    } catch {
      Toast.show({ type: 'error', text1: 'Sync failed', text2: 'Check your connection and retry' });
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const openEditName = useCallback(() => {
    setEditName(user?.full_name ?? '');
    setShowEditName(true);
    setTimeout(() => nameInputRef.current?.focus(), 300);
  }, [user?.full_name]);

  const handleSaveName = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Toast.show({ type: 'error', text1: 'Name cannot be empty' });
      return;
    }
    if (!user?.id) return;
    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: trimmed })
        .eq('id', user.id);
      if (error) throw error;
      updateUser({ full_name: trimmed });
      setShowEditName(false);
      Toast.show({ type: 'success', text1: '✅ Name updated', text2: trimmed });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: err?.message ?? 'Try again' });
    } finally {
      setIsSavingName(false);
    }
  }, [editName, user?.id, updateUser]);

  const initials = (user?.full_name ?? 'T')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    setShowSignOut(false);
    signOut();
  };

  const roleName = user?.role === 'technician' ? 'Field Technician' : 'Subcontractor';

  const menuSections: { title: string; items: MenuRow[] }[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'name',
          icon: 'account-outline',
          label: user?.full_name ?? 'No name set',
          sub: 'Full name — tap pencil above to edit',
        },
        {
          id: 'email',
          icon: 'email-outline',
          label: user?.email ?? 'No email',
          sub: 'Email address',
        },
        {
          id: 'phone',
          icon: 'phone-outline',
          label: user?.phone ?? 'Not set',
          sub: 'Mobile number',
        },
        {
          id: 'role',
          icon: 'shield-account-outline',
          label: roleName,
          sub: 'Account role',
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          id: 'offline',
          icon: 'wifi-off',
          label: 'Offline Mode',
          sub: 'App works without internet',
        },
        {
          id: 'biometrics',
          icon: 'fingerprint',
          label: 'Biometric Login',
          sub: 'Face ID / Fingerprint enabled',
        },
        {
          id: 'help',
          icon: 'lifebuoy',
          label: 'Help & Support',
          sub: 'Guides, FAQ, and feedback',
          action: () => router.push('/help' as never),
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 'version',
          icon: 'information-outline',
          label: 'SiteTrack v1.0.0',
          sub: 'Field Service Management',
        },
        {
          id: 'support',
          icon: 'email-fast-outline',
          label: 'Contact Support',
          sub: 'support@sitetrack.com.au',
          action: () => Alert.alert('Support', 'Email us at: support@sitetrack.com.au'),
        },
      ],
    },
  ];

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Curved Header ───────────── */}
        <View style={[s.header, { backgroundColor: C.primary, paddingTop: Math.max(insets.top, 14) + 10 }]}>
          <View style={[s.headerDot1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <View style={[s.headerDot2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

          <View style={s.headerContent}>
            <View style={s.headerLeft}>
              <Text style={s.headerEyebrow}>MY PROFILE</Text>
              <View style={s.nameTitleRow}>
                <Text style={s.headerTitle} numberOfLines={1}>{user?.full_name ?? 'Technician'}</Text>
                <TouchableOpacity
                  onPress={openEditName}
                  style={s.editNameBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={15} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
              <View style={s.headerSubRow}>
                <View style={[s.rolePill, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <MaterialCommunityIcons name="shield-account-outline" size={11} color="rgba(255,255,255,0.9)" />
                  <Text style={s.rolePillText}>{roleName}</Text>
                </View>
                {user?.email ? (
                  <Text style={s.headerEmail} numberOfLines={1}>{user.email}</Text>
                ) : null}
              </View>
            </View>

            {/* Large Avatar */}
            <View style={s.avatarOuter}>
              <View style={[s.avatarInner, { backgroundColor: C.accent }]}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
            </View>
          </View>

          {/* ── Status bar below header content ── */}
          <View style={s.headerStatusBar}>
            <View style={[s.statusChip, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <View style={[s.statusDot, { backgroundColor: isOnline ? '#4ADE80' : '#F87171' }]} />
              <Text style={s.statusChipText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            <View style={[s.statusChip, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <MaterialCommunityIcons name="cloud-check-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={s.statusChipText}>
                {pendingCount === 0 ? 'All Synced' : `${pendingCount} Pending`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Sync Status Card ──────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(360)}>
          <Card style={[s.syncCard, { borderLeftColor: C.accent }]} padding={16}>
            <View style={s.syncCardHeader}>
              <View style={s.syncCardTitleRow}>
                <MaterialCommunityIcons name="cloud-sync-outline" size={16} color={C.primary} />
                <Text style={[s.syncCardTitle, { color: C.text }]}>Data Sync</Text>
              </View>
              <View style={[s.onlineBadge, { backgroundColor: isOnline ? C.successLight : C.errorLight }]}>
                <View style={[s.onlineDot, { backgroundColor: isOnline ? C.success : C.error }]} />
                <Text style={[s.onlineBadgeText, { color: isOnline ? C.successDark : C.errorDark }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={s.syncCardRow}>
              <MaterialCommunityIcons
                name="cloud-upload-outline"
                size={18}
                color={pendingCount > 0 ? C.accent : C.success}
              />
              <Text style={[s.syncCardValue, { color: C.text }]}>
                {pendingCount > 0
                  ? `${pendingCount} item${pendingCount > 1 ? 's' : ''} pending upload`
                  : 'All changes synced to cloud'}
              </Text>
            </View>

            {lastSync && (
              <View style={s.syncCardRow}>
                <MaterialCommunityIcons name="clock-check-outline" size={15} color={C.textTertiary} />
                <Text style={[s.syncLastText, { color: C.textTertiary }]}>
                  Last sync: {lastSync.toLocaleTimeString()}
                </Text>
              </View>
            )}

            <Button
              title={isSyncing ? 'Syncing...' : 'Force Sync Now'}
              icon={<MaterialCommunityIcons name={isSyncing ? 'cloud-sync' : 'cloud-sync-outline'} size={16} color="#FFFFFF" />}
              onPress={handleForcSync}
              disabled={!isOnline || isSyncing}
              isLoading={isSyncing}
              style={{ marginTop: 4 }}
            />
          </Card>
        </Animated.View>

        {/* ── Info Sections ───────────────── */}
        {menuSections.map((section, si) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(100 + si * 60).duration(360)}
          >
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: C.textTertiary }]}>{section.title.toUpperCase()}</Text>
              <View style={[s.menuCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
                {section.items.map((item, i) => {
                  const isStatic = !item.action;
                  const RowEl = isStatic ? View : TouchableOpacity;
                  return (
                    <RowEl
                      key={item.id}
                      style={[
                        s.menuRow,
                        i < section.items.length - 1 && [s.menuRowDivider, { borderBottomColor: C.border }],
                      ]}
                      {...(!isStatic && { onPress: item.action, activeOpacity: 0.7 })}
                    >
                      <View style={[
                        s.menuIconWrap,
                        { backgroundColor: item.danger ? C.errorLight : C.backgroundSecondary },
                      ]}>
                        <MaterialCommunityIcons
                          name={item.icon}
                          size={18}
                          color={item.danger ? C.error : C.primary}
                        />
                      </View>
                      <View style={s.menuText}>
                        <Text style={[s.menuLabel, { color: item.danger ? C.error : C.text }]}>
                          {item.label}
                        </Text>
                        {item.sub ? (
                          <Text style={[s.menuSub, { color: C.textTertiary }]}>{item.sub}</Text>
                        ) : null}
                      </View>
                      {/* Only show chevron for actionable rows */}
                      {!isStatic && (
                        <MaterialCommunityIcons name="chevron-right" size={16} color={C.borderStrong} />
                      )}
                    </RowEl>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        ))}

        {/* ── Sign Out — destructive outline button ── */}
        <Animated.View entering={FadeInDown.delay(340).duration(360)}>
          <Button
            variant="outline"
            title="Sign Out"
            icon={<MaterialCommunityIcons name="logout" size={18} color={C.error} />}
            style={{ borderColor: C.error, marginTop: 4, marginBottom: 8, marginHorizontal: 16 }}
            textStyle={{ color: C.error, paddingLeft: 4 }}
            onPress={() => setShowSignOut(true)}
          />
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Sign Out Bottom Sheet Modal ── */}
      <Modal visible={showSignOut} transparent animationType="fade" onRequestClose={() => setShowSignOut(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowSignOut(false)} />
          <View style={[s.bottomSheet, { backgroundColor: C.surface }]}>
            <View style={[s.bsHandle, { backgroundColor: C.borderStrong }]} />
            <Text style={[s.bsTitle, { color: C.text }]}>Sign out of SiteTrack?</Text>
            <Text style={[s.bsSub, { color: C.textSecondary }]}>
              Unsynced offline data will be lost forever. Make sure to Force Sync before signing out.
            </Text>
            <View style={{ height: 24 }} />
            <Button variant="danger" title="Sign Out" onPress={handleSignOut} />
            <View style={{ height: 8 }} />
            <Button variant="outline" title="Cancel" onPress={() => setShowSignOut(false)} />
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>

      {/* ── Edit Name Bottom Sheet Modal ── */}
      <Modal visible={showEditName} transparent animationType="slide" onRequestClose={() => setShowEditName(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowEditName(false)} />
          <View style={[s.bottomSheet, { backgroundColor: C.surface }]}>
            <View style={[s.bsHandle, { backgroundColor: C.borderStrong }]} />
            <Text style={[s.bsTitle, { color: C.text }]}>Edit Your Name</Text>
            <Text style={[s.bsSub, { color: C.textSecondary }]}>
              This will update your name everywhere in the app.
            </Text>
            <View style={{ height: 20 }} />
            <View style={[s.inputWrap, { borderColor: C.border, backgroundColor: C.background }]}>
              <MaterialCommunityIcons name="account-outline" size={20} color={C.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                ref={nameInputRef}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor={C.textTertiary}
                style={[s.nameInput, { color: C.text }]}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              {editName.length > 0 && (
                <TouchableOpacity onPress={() => setEditName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={C.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={{ height: 16 }} />
            <Button
              title={isSavingName ? 'Saving...' : 'Save Name'}
              onPress={handleSaveName}
              disabled={isSavingName || !editName.trim()}
              isLoading={isSavingName}
            />
            <View style={{ height: 8 }} />
            <Button variant="outline" title="Cancel" onPress={() => setShowEditName(false)} />
            <View style={{ height: 16 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  // ── Header ─────────────────────────────────────
  header: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 20,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  headerDot1: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    top: -110, right: -100,
  },
  headerDot2: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    bottom: -80, left: -60,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  headerLeft: { flex: 1, gap: 6 },
  headerEyebrow: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  nameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  editNameBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  rolePillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerEmail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 1,
  },

  // ── Large Avatar ───────────────────────────────
  avatarOuter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(232, 101, 10, 0.7)',
  },
  avatarInner: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // ── Status chips under header ──────────────────
  headerStatusBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusChipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },

  // ── Edit name input ────────────────────────────
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  scroll: { paddingTop: 0, paddingBottom: 20 },

  // ── Section ────────────────────────────────────
  section: { marginBottom: 16, marginHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 20,
    paddingHorizontal: 2,
  },

  // ── Menu card ──────────────────────────────────
  menuCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#0D1526',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 14,
    minHeight: 64,
  },
  menuRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIconWrap: {
    width: 42, height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  menuSub:   { fontSize: 12, marginTop: 2, letterSpacing: 0.1 },

  // ── Sync card ──────────────────────────────────
  syncCard: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 0,
    gap: 12,
    borderLeftWidth: 5,
  },
  syncCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineBadgeText: { fontSize: 12, fontWeight: '700' },
  syncCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncCardValue: { fontSize: 14, fontWeight: '600' },
  syncLastText:  { fontSize: 12 },

  // ── Modals ─────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  bsHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: -4,
  },
  bsTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  bsSub:   { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
