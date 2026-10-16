// Login screen — approved redesign (stitch-designs/README.md, Batch A)
import { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Keyboard,
  Switch,
} from 'react-native';
import { TextInput } from '@/components/ui/AppTextInput';
import { Text } from '@/components/ui/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MAX_LENGTHS } from '@/utils/sanitize';
import { APP_NAME } from '@/constants/Config';

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const C = useColors();
  const noMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  // On by default: a remembered session is still protected by the device
  // unlock (fingerprint/face/PIN) on every launch — see authStore's isLocked
  // and components/AppLockScreen.tsx. Unticked, the session ends when the
  // app is fully closed and the next launch needs the password again.
  const [rememberMe, setRememberMe]         = useState(true);
  const [emailError, setEmailError]         = useState('');
  const [passwordError, setPasswordError]   = useState('');

  // Adjust scroll when keyboard opens so inputs remain visible
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollTo({ y: 150, animated: true });
    });
    return () => show.remove();
  }, []);

  const validate = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) { setEmailError('Email is required.'); valid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email address.'); valid = false; }
    if (!password) { setPasswordError('Password is required.'); valid = false; }
    else if (password.length < 6) { setPasswordError('Password must be at least 6 characters.'); valid = false; }
    return valid;
  };

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearError();
    // Normalise email before validation: trim whitespace and lowercase.
    // Trailing spaces cause silent auth failures (Supabase treats them as different addresses).
    const normalisedEmail = email.trim().toLowerCase();
    setEmail(normalisedEmail);
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await signIn(normalisedEmail, password, rememberMe);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Approved redesign (stitch-designs/README.md, Batch A). Safe-area
            aware top padding as before. */}
        <View style={[styles.content, { paddingTop: Math.max(48, insets.top + 28) }]}>
          <Animated.View entering={noMotion ? undefined : FadeIn.delay(100).duration(600)} style={styles.logoContainer}>
            <BrandLogo size="medium" textColor={C.text} />
          </Animated.View>

          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(250).duration(500)} style={styles.formContainer}>
            <Text style={[styles.title, { color: C.text }]}>Sign in</Text>

            {!isOnline && (
              <View style={[styles.alertBanner, { backgroundColor: C.warningLight, borderColor: T.tintBorder(C.warning) }]}>
                <MaterialCommunityIcons name="wifi-off" size={20} color={C.warning} />
                <Text style={[styles.alertText, { color: C.warning }]}>
                  You&apos;re offline. Signing in needs an internet connection.
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.alertBanner, { backgroundColor: C.errorLight, borderColor: T.tintBorder(C.error) }]}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={C.error} />
                <Text style={[styles.alertText, { color: C.error }]}>{error}</Text>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Input
                label="Email address"
                required
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                placeholder="you@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                maxLength={MAX_LENGTHS.email}
                error={emailError}
                disabled={isLoading}
                style={{ marginBottom: 16 }}
              />

              <Input
                ref={passwordRef}
                label="Password"
                required
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                maxLength={128}
                error={passwordError}
                disabled={isLoading}
                rightIcon={
                  <TouchableOpacity
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={C.textTertiary}
                    />
                  </TouchableOpacity>
                }
                style={{ marginBottom: 14 }}
              />

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberLeft}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                  activeOpacity={0.7}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: rememberMe }}
                  accessibilityLabel="Remember me"
                >
                  <Switch
                    value={rememberMe}
                    onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v); }}
                    trackColor={{ false: C.borderStrong, true: C.primary }}
                    thumbColor={C.surface}
                    ios_backgroundColor={C.borderStrong}
                  />
                  <Text style={[styles.rememberLabel, { color: C.text }]}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8} accessibilityRole="link">
                  <Text style={[styles.forgotLink, { color: C.text }]}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <Button
                title="Sign in"
                onPress={handleSignIn}
                isLoading={isLoading}
                icon="arrow-right"
                iconRight
                style={{ marginTop: 4 }}
              />
            </View>
          </Animated.View>
        </View>

        <View style={[styles.footer, { paddingBottom: 28 + insets.bottom }]}>
          <Text style={[styles.footerTxt, { color: C.textTertiary }]}>© 2026 {APP_NAME}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  content: { paddingHorizontal: 20 },
  logoContainer: { alignItems: 'center', marginBottom: 28 },
  formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 14 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  alertText: { fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },
  card: {
    borderRadius: T.radiusCard,
    borderWidth: 1,
    padding: 20,
    marginTop: 4,
    shadowColor: T.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  rememberLabel: { fontSize: 13, fontWeight: '500' },
  forgotLink: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  footer: { paddingTop: 32, alignItems: 'center' },
  footerTxt: { fontSize: 12, textAlign: 'center' },
});
