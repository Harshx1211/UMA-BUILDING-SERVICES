// Login screen — Minimalist, professional SiteTrack dark mode aesthetic
import { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { Checkbox, Text } from 'react-native-paper';
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
        {/* FIX: paddingTop was a hardcoded 100 with no safe-area awareness
            at all (contrast components/ui/ScreenHeader.tsx's own
            Math.max(insets.top, 14) pattern) — fine on most current
            devices' notch/Dynamic Island depth, but a guess rather than a
            guarantee. Math.max keeps the original, deliberately generous
            100px on every normal device and only grows past it on a
            device with an unusually deep top inset, so this never
            actually shrinks the existing design. */}
        <View style={[styles.content, { paddingTop: Math.max(100, insets.top + 40) }]}>
          {/* ── Brand Logo ────── */}
          <Animated.View entering={noMotion ? undefined : FadeIn.delay(100).duration(600)} style={styles.logoContainer}>
            <BrandLogo
              size="medium"
              tagline="Enter your credentials to continue"
              textColor={C.text}
            />
          </Animated.View>

          {/* ── Form Section ─────────────── */}
          <Animated.View entering={noMotion ? undefined : FadeInDown.delay(300).duration(500)} style={styles.formContainer}>
            {!isOnline && (
              <View style={[styles.alertBanner, { backgroundColor: C.warningLight, borderColor: T.tintBorder(C.warning) }]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color={C.warning} />
                <Text style={[styles.alertText, { color: C.warningDark }]}>
                  You are offline. Signing in needs an internet connection.
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.alertBanner, { backgroundColor: C.errorLight, borderColor: T.tintBorder(C.error) }]}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={C.error} />
                <Text style={[styles.alertText, { color: C.error }]}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
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
              leftIcon={<MaterialCommunityIcons name="email-outline" size={18} color={C.textTertiary} />}
              style={{ marginBottom: 16 }}
            />

            <Input
              ref={passwordRef}
              label="Password"
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
              leftIcon={<MaterialCommunityIcons name="lock-outline" size={18} color={C.textTertiary} />}
              rightIcon={
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={C.textTertiary}
                  />
                </TouchableOpacity>
              }
              style={{ marginBottom: 12 }}
            />

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberLeft}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                activeOpacity={0.7}
              >
                <Checkbox
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                  color={C.primary}
                />
                <Text style={[styles.rememberLabel, { color: C.text }]}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotLink, { color: C.primary }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Sign In"
              onPress={handleSignIn}
              isLoading={isLoading}
              style={{ height: 52, borderRadius: 12, marginTop: 8 }}
            />

          </Animated.View>
        </View>

        {/* FIX: paddingVertical: 32 had no bottom-safe-area addition — on a
            device with a home indicator/gesture bar, this copyright line
            (pushed to the bottom by justifyContent: 'space-between' above)
            could end up sitting right at, or under, that system chrome. */}
        <View style={[styles.footer, { paddingBottom: 32 + insets.bottom }]}>
          <Text style={[styles.footerTxt, { color: C.textTertiary }]}>© 2026 {APP_NAME} · Field Service Platform</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  
  // ── Brand Logo ───────────────────
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },

  // ── Form Container ───────────────
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },

  // ── Alerts ───────────────────────
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  alertText: { 
    fontSize: 13, 
    fontWeight: '500', 
    flex: 1, 
    lineHeight: 18 
  },

  // ── Options Row ──────────────────
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rememberLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginLeft: -8 
  },
  rememberLabel: { 
    fontSize: 14, 
    fontWeight: '500' 
  },
  forgotLink: { 
    fontSize: 14, 
    fontWeight: '600' 
  },

  // ── Footer ───────────────────────
  footer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerTxt: {
    fontSize: 12,
    textAlign: 'center',
  },
});
