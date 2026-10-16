// Forgot Password — approved redesign (stitch-designs/README.md, Batch A): form, error box, success view
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PASSWORD_RESET_URL } from '@/constants/Config';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { T } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

type BannerState = { type: 'success' | 'error'; message: string } | null;

export default function ForgotPasswordScreen() {
  const [email, setEmail]         = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner]       = useState<BannerState>(null);
  const C = useColors();
  const noMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email is required.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendReset = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setBanner(null);
    try {
      // FIX: no redirectTo used to be sent, so the link went to the project's
      // Site URL, where nothing handles a recovery link — the reset could
      // never actually be completed. See PASSWORD_RESET_URL.
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: PASSWORD_RESET_URL },
      );
      if (error) {
        setBanner({ type: 'error', message: error.message });
      } else {
        setBanner({
          type: 'success',
          message: 'Check your inbox — a password reset link has been sent.',
        });
      }
    } catch {
      setBanner({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(16, insets.top + 8), paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Approved redesign (stitch-designs/README.md, Batch A) */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>

        <Animated.View entering={noMotion ? undefined : FadeInDown.delay(100).duration(400)} style={styles.body}>
          <View style={[styles.iconTile, { backgroundColor: C.primary + '1F' }]}>
            <MaterialCommunityIcons name="lock-reset" size={26} color={C.primary} />
          </View>
          <Text style={[styles.title, { color: C.text }]}>Reset password</Text>
          <Text style={[styles.intro, { color: C.textSecondary }]}>
            Enter your email address and we&apos;ll send you a link to reset your password.
          </Text>

          {banner?.type === 'success' ? (
            <View style={[styles.successCard, { backgroundColor: C.successLight, borderColor: T.tintBorder(C.success) }]}>
              <View style={[styles.successIcon, { backgroundColor: T.tintBg(C.success) }]}>
                <MaterialCommunityIcons name="check-circle" size={20} color={C.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.successTitle, { color: C.success }]}>Email sent</Text>
                <Text style={[styles.successBody, { color: C.textSecondary }]}>{banner.message}</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.backLink} hitSlop={8} accessibilityRole="link">
                  <Text style={[styles.backLinkTxt, { color: C.text }]}>Back to sign in</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={C.text} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {banner?.type === 'error' ? (
                <View style={[styles.errorBanner, { backgroundColor: C.errorLight, borderColor: T.tintBorder(C.error) }]}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color={C.error} />
                  <Text style={[styles.errorBannerText, { color: C.error }]}>{banner.message}</Text>
                  <TouchableOpacity onPress={() => setBanner(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
                    <MaterialCommunityIcons name="close" size={16} color={C.error} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <Input
                label="Email address"
                required
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                placeholder="you@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSendReset}
                disabled={isLoading}
                maxLength={254}
                error={emailError}
                style={{ marginBottom: 16 }}
              />

              <Button title="Send reset email" icon="arrow-right" iconRight onPress={handleSendReset} isLoading={isLoading} />
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  body: { width: '100%', maxWidth: 400, alignSelf: 'center', marginTop: 16 },
  iconTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  successCard: { flexDirection: 'row', gap: 12, borderRadius: T.radiusCard, borderWidth: 1, padding: 16 },
  successIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 16, fontWeight: '700' },
  successBody: { fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 12 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  backLinkTxt: { fontSize: 14, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  errorBannerText: { fontSize: 13, lineHeight: 18, fontWeight: '500', flex: 1 },
});
