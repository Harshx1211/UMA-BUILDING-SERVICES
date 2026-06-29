import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { stopSync } from '@/lib/sync';
import { C } from '@/constants/Config';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { logout } = useAuthStore();

  function _confirmLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Any unsynced changes will sync next time you log in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            stopSync();
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  const fpasExpiry = user?.fpas_expiry ? new Date(user.fpas_expiry) : null;
  const daysToFpasExpiry = fpasExpiry
    ? Math.ceil((fpasExpiry.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {user?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('') ?? 'T'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.full_name ?? 'Technician'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{(user?.role ?? 'technician').toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* FPAS expiry warning */}
        {daysToFpasExpiry !== null && daysToFpasExpiry <= 60 && (
          <View style={[styles.warningBanner, daysToFpasExpiry <= 0 && styles.dangerBanner]}>
            <Text style={styles.warningText}>
              {daysToFpasExpiry <= 0
                ? `⚠️  FPAS accreditation EXPIRED — contact your office immediately`
                : `⚠️  FPAS accreditation expires in ${daysToFpasExpiry} days`}
            </Text>
          </View>
        )}

        {/* Contact details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <InfoRow label="Phone" value={user?.phone} />
          <InfoRow label="Email" value={user?.email} />
        </View>

        {/* FPAS accreditation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FPAS Accreditation</Text>
          <InfoRow label="FPAS Number" value={user?.fpas_number} />
          <InfoRow label="FPAS Class"  value={user?.fpas_class} />
          <InfoRow label="FPAS Expiry" value={user?.fpas_expiry} />
          <InfoRow label="State Licence"   value={user?.state_license} />
          <InfoRow label="Licence Expiry"  value={user?.state_license_expiry} />
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Status"       value={user?.is_active ? 'Active' : 'Inactive'} />
          <InfoRow label="Member since" value={user?.created_at?.slice(0, 10)} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={_confirmLogout} activeOpacity={0.85}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>SiteTrack v2.0  •  UMA Building Services</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.primary },
  header:         {
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title:          { color: C.textLight, fontSize: 22, fontWeight: '800' },
  scroll:         { padding: 16, paddingBottom: 40 },
  avatarCard:     {
    backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', padding: 20, marginBottom: 16, gap: 16,
  },
  avatarCircle:   {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 22, fontWeight: '800' },
  userName:       { color: C.textLight, fontSize: 18, fontWeight: '700' },
  userEmail:      { color: C.textMuted, fontSize: 13, marginTop: 2 },
  roleBadge:      {
    marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(37,99,235,0.15)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  roleBadgeText:  { color: C.info, fontSize: 10, fontWeight: '700' },
  warningBanner:  {
    backgroundColor: 'rgba(217,119,6,0.15)', borderLeftWidth: 3, borderLeftColor: C.warning,
    borderRadius: 10, padding: 14, marginBottom: 16,
  },
  dangerBanner:   { backgroundColor: 'rgba(220,38,38,0.15)', borderLeftColor: C.danger },
  warningText:    { color: '#FCD34D', fontSize: 13, lineHeight: 18 },
  section:        {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle:   {
    color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  infoRow:        {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLabel:      { color: C.textMuted, fontSize: 13 },
  infoValue:      { color: C.textLight, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  signOutBtn:     {
    backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 14, borderWidth: 1,
    borderColor: C.danger, paddingVertical: 16, alignItems: 'center', marginBottom: 20,
  },
  signOutText:    { color: C.danger, fontSize: 15, fontWeight: '700' },
  version:        { color: C.textMuted, fontSize: 11, textAlign: 'center' },
});
