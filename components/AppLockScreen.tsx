// App lock — covers everything while a remembered session waits for the
// device unlock (fingerprint, face, or the phone's own PIN/pattern). See
// authStore's "Remembered session + device lock" notes for when it shows.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';

export function AppLockScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const unlock = useAuthStore((s) => s.unlock);
  const signOut = useAuthStore((s) => s.signOut);
  const [isPrompting, setIsPrompting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The OS prompt is modal and single-instance — never stack a second one
  // (a fast double tap, or the auto-prompt racing a tap).
  const promptingRef = useRef(false);

  const prompt = useCallback(async () => {
    if (promptingRef.current) return;
    promptingRef.current = true;
    setIsPrompting(true);
    setMessage(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock SiteTrack',
        cancelLabel: 'Cancel',
        // Falls back to the phone's own PIN/pattern/passcode, so a failed or
        // unavailable fingerprint/face never locks the technician out.
        disableDeviceFallback: false,
      });
      if (result.success) {
        unlock();
      } else if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
        setMessage("Couldn't verify it's you. Try again.");
      }
    } catch {
      setMessage("Couldn't open the unlock prompt. Try again.");
    } finally {
      promptingRef.current = false;
      setIsPrompting(false);
    }
  }, [unlock]);

  // signOut() refuses while unsynced work can't be uploaded (so this can
  // never cost the technician their data) and explains why in a dialog —
  // but dialogs render underneath this screen, so say it here instead.
  const handleSignOut = useCallback(async () => {
    setMessage(null);
    const ok = await signOut();
    if (!ok) setMessage("You have work that hasn't synced yet. Connect to the internet, then try signing out again — or unlock to keep working.");
  }, [signOut]);

  // Ask straight away — the lock should feel like one step, not two.
  useEffect(() => { void prompt(); }, [prompt]);

  // The app's screens are still mounted underneath; the hardware back
  // button must not navigate them while locked.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <View
      style={[StyleSheet.absoluteFillObject, styles.root, { backgroundColor: C.background, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
      accessibilityViewIsModal
    >
      <View style={styles.center}>
        <BrandLogo size="large" showWordmark={false} />
        <View style={[styles.lockBadge, { backgroundColor: C.backgroundTertiary }]}>
          <MaterialCommunityIcons name="lock-outline" size={22} color={C.textSecondary} />
        </View>
        <Text style={[styles.title, { color: C.text }]}>SiteTrack is locked</Text>
        <Text style={[styles.sub, { color: C.textSecondary }]}>
          Unlock with your fingerprint, face or phone PIN to continue.
        </Text>
        {message ? <Text style={[styles.sub, { color: C.error, marginTop: 12 }]}>{message}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Button title="Unlock" icon="fingerprint" onPress={prompt} isLoading={isPrompting} disabled={isPrompting} />
        <Button title="Sign out" variant="secondary" onPress={handleSignOut} disabled={isPrompting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10000, elevation: 10000, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  lockBadge: { marginTop: 32, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub: { marginTop: 8, fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  actions: { gap: 10, width: '100%', maxWidth: 400, alignSelf: 'center' },
});
