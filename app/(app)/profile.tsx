import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { stopSync, retryAllFailedSyncItems } from '@/lib/sync';
import { updateRecord, addToSyncQueue, getFailedSyncItems } from '@/lib/database';
import { SyncOperation } from '@/constants/Enums';
import { T } from '@/constants/Colors';
import { useColors } from '@/hooks/useColors';
import { ScreenHeader, Badge } from '@/components/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cardShadow } from '@/components/ui/Card';
import { sanitizeText } from '@/utils/sanitize';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { signOut, company, updateUser } = useAuthStore();
  const C = useColors();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: user?.phone || '',
  });

  const failedSyncCount = getFailedSyncItems().length;

  function _confirmLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Any unsynced changes will be uploaded first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            stopSync();
            setIsSigningOut(true);
            const success = await signOut();
            setIsSigningOut(false);
            if (success) router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  const fpasExpiry = user?.fpas_expiry ? new Date(user.fpas_expiry) : null;
  const daysToFpasExpiry = fpasExpiry
    ? Math.ceil((fpasExpiry.getTime() - Date.now()) / 86400000)
    : null;

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Sanitize phone: strip anything that isn't digits, +, -, spaces or parentheses
      const phone = sanitizeText(editForm.phone.trim(), 15);

      // FIX: Use offline-first pattern — write to SQLite immediately, queue
      // for sync. The old code wrote directly to Supabase with no try/catch
      // and no retry logic, meaning it silently failed when offline.
      updateRecord('users', user.id, { phone });
      addToSyncQueue('users', user.id, SyncOperation.Update, { phone });

      // Update in-memory auth state so the UI reflects the change immediately
      updateUser({ ...user, phone });
      setIsEditing(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
      console.error('[Profile] handleSave error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Profile"
        rightComponent={
          <TouchableOpacity onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
            {isSaving ? <ActivityIndicator size="small" color={C.accent} /> : 
              <Text style={{ color: C.accent, fontWeight: '700', fontSize: 16 }}>{isEditing ? 'Save' : 'Edit'}</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={[styles.avatarInitials, { color: C.textOnPrimary }]}>
              {user?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('') ?? 'T'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.full_name ?? 'Technician'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
            <Badge status="active" label={(user?.role ?? 'Technician').replace(/\b\w/g, c => c.toUpperCase())} />
          </View>
        </View>

        {/* FPAS expiry warning */}
        {daysToFpasExpiry !== null && daysToFpasExpiry <= 60 && (
          <View style={[styles.warningBanner, daysToFpasExpiry <= 0 && styles.dangerBanner]}>
            <MaterialCommunityIcons
              name={daysToFpasExpiry <= 0 ? 'alert-circle' : 'alert'}
              size={16}
              color={daysToFpasExpiry <= 0 ? T.danger : T.warning}
            />
            <Text style={[styles.warningText, daysToFpasExpiry <= 0 && { color: T.danger }]}>
              {daysToFpasExpiry <= 0
                ? `FPAS accreditation EXPIRED — contact your office immediately`
                : `FPAS accreditation expires in ${daysToFpasExpiry} days`}
            </Text>
          </View>
        )}

        {/* Contact details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {isEditing ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <TextInput 
                style={styles.input} 
                value={editForm.phone} 
                onChangeText={t => setEditForm(f => ({ ...f, phone: t }))} 
                placeholder="Phone number" 
                placeholderTextColor={C.textTertiary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          ) : (
            <InfoRow label="Phone" value={user?.phone} />
          )}
          <InfoRow label="Email" value={user?.email} />
        </View>

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
        <TouchableOpacity
          style={[styles.signOutBtn, isSigningOut && { opacity: 0.6 }]}
          onPress={_confirmLogout}
          activeOpacity={0.85}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator color={T.danger} size="small" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        {/* Retry failed syncs — only visible when there are permanently-failed items */}
        {failedSyncCount > 0 && (
          <TouchableOpacity
            style={[styles.retryBtn, isRetrying && { opacity: 0.6 }]}
            onPress={async () => {
              setIsRetrying(true);
              retryAllFailedSyncItems();
              // Give the sync cycle a moment to kick off
              setTimeout(() => setIsRetrying(false), 1500);
              Alert.alert(
                'Retry Queued',
                `${failedSyncCount} failed item(s) have been re-queued. They will sync automatically within 60 seconds.`,
              );
            }}
            activeOpacity={0.85}
            disabled={isRetrying}
          >
            <MaterialCommunityIcons name="refresh" size={16} color={T.warning} />
            <Text style={styles.retryText}>
              {isRetrying ? 'Retrying…' : `Retry ${failedSyncCount} Failed Sync${failedSyncCount !== 1 ? 's' : ''}`}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.version}>SiteTrack v2.0  •  {company?.name || 'Company'}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: T.background },
  scroll:         { padding: 16, paddingBottom: 40 },
  avatarCard:     {
    backgroundColor: T.surface, borderRadius: T.radiusCard, borderWidth: 1, borderColor: T.border,
    flexDirection: 'row', alignItems: 'center', padding: 20, marginBottom: 16, gap: 16,
    ...cardShadow,
  },
  avatarCircle:   {
    width: 64, height: 64, borderRadius: 32, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 22, fontWeight: '800' },
  userName:       { color: T.textPrimary, fontSize: 18, fontWeight: '700' },
  userEmail:      { color: T.textMuted, fontSize: 13, marginTop: 2 },
  warningBanner:  {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: T.warningBg, borderLeftWidth: 3, borderLeftColor: T.warning,
    borderRadius: T.radiusButton, padding: 14, marginBottom: 16,
  },
  dangerBanner:   { backgroundColor: T.dangerBg, borderLeftColor: T.danger },
  warningText:    { color: T.warning, fontSize: 13, lineHeight: 18, flex: 1 },
  section:        {
    backgroundColor: T.surface, borderRadius: T.radiusCard, borderWidth: 1, borderColor: T.border,
    marginBottom: 16, overflow: 'hidden',
    ...cardShadow,
  },
  sectionTitle:   {
    color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  infoRow:        {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  infoLabel:      { color: T.textMuted, fontSize: 13 },
  infoValue:      { color: T.textPrimary, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  signOutBtn:     {
    backgroundColor: T.dangerBg, borderRadius: T.radiusCard, borderWidth: 1,
    borderColor: T.danger, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  signOutText:    { color: T.danger, fontSize: 15, fontWeight: '700' },
  retryBtn:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.warningBg, borderRadius: T.radiusCard, borderWidth: 1,
    borderColor: T.warning, paddingVertical: 14, marginBottom: 20,
  },
  retryText:      { color: T.warning, fontSize: 14, fontWeight: '700' },
  version:        { color: T.textMuted, fontSize: 11, textAlign: 'center' },
  input:          {
    color: T.textPrimary, fontSize: 13, fontWeight: '500',
    minWidth: 150, textAlign: 'right', paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: T.surfaceInput, borderRadius: T.radiusButton, borderWidth: 1, borderColor: T.primary,
  },
});
