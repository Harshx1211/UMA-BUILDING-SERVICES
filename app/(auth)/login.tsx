// Login screen — Minimalist, professional SiteTrack dark mode aesthetic
import { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { Checkbox, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const REMEMBER_ME_KEY = '@uma-building-services/remember_me';

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const { restoreSession } = useAuthStore();
  const C = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const { isOnline } = useNetworkStatus();

  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [rememberMe, setRememberMe]         = useState(false);
  const [emailError, setEmailError]         = useState('');
  const [passwordError, setPasswordError]   = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType]   = useState<'fingerprint' | 'face' | null>(null);

  // Adjust scroll when keyboard opens so inputs remain visible
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollTo({ y: 150, animated: true });
    });
    return () => show.remove();
  }, []);

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const [compatible, enrolled, remembered] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(REMEMBER_ME_KEY),
        ]);
        if (compatible && enrolled && remembered === 'true') {
          setBiometricsAvailable(true);
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          setBiometricType(
            types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
              ? 'face' : 'fingerprint'
          );
        }
      } catch { /* silently skip */ }
    };
    checkBiometrics();
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
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await signIn(email, password, rememberMe);
  };

  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to SiteTrack',
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await restoreSession();
      }
    } catch (err) { console.warn('[Login] Biometric error:', err); }
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
        <View style={styles.content}>
          {/* ── Brand Logo ────── */}
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.logoContainer}>
            <View style={[styles.logoBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="shield-check" size={42} color={C.primary} />
            </View>
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Text style={[styles.brandName, { color: C.text }]}>SiteTrack</Text>
              <Text style={[styles.brandTagline, { color: C.textSecondary }]}>Enter your credentials to continue</Text>
            </Animated.View>
          </Animated.View>

          {/* ── Form Section ─────────────── */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.formContainer}>
            {!isOnline && (
              <View style={[styles.alertBanner, { backgroundColor: C.warningLight, borderColor: C.warning + '40' }]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color={C.warning} />
                <Text style={[styles.alertText, { color: C.warningDark }]}>
                  You are offline. Biometric sign-in still works. Signing in with a password requires internet.
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.alertBanner, { backgroundColor: C.errorLight, borderColor: C.error + '40' }]}>
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
              error={emailError}
              leftIcon={<MaterialCommunityIcons name="email-outline" size={18} color={C.textTertiary} />}
              style={{ marginBottom: 16 }}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              error={passwordError}
              leftIcon={<MaterialCommunityIcons name="lock-outline" size={18} color={C.textTertiary} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
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

            {biometricsAvailable && (
              <>
                <View style={styles.dividerRow}>
                  <View style={[styles.divider, { backgroundColor: C.border }]} />
                  <Text style={[styles.dividerTxt, { color: C.textTertiary }]}>or</Text>
                  <View style={[styles.divider, { backgroundColor: C.border }]} />
                </View>
                <Button
                  title={biometricType === 'face' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                  variant="secondary"
                  onPress={handleBiometric}
                  icon={
                    <MaterialCommunityIcons
                      name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'}
                      size={20}
                      color={C.primary}
                    />
                  }
                  style={{ height: 52, borderRadius: 12 }}
                />
              </>
            )}
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { color: C.textTertiary }]}>© 2026 SiteTrack · Field Service Platform</Text>
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
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
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

  // ── Divider ──────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  divider: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 13, fontWeight: '500' },

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
