// Login screen — professional hero with branding + premium floating form
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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Card, Input } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

const REMEMBER_ME_KEY = '@sitetrack/remember_me';

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();
  const C = useColors();
  const scrollRef = useRef<ScrollView>(null);

  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [showPassword, setShowPassword]     = useState(false);
  const [rememberMe, setRememberMe]         = useState(false);
  const [emailError, setEmailError]         = useState('');
  const [passwordError, setPasswordError]   = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType]   = useState<'fingerprint' | 'face' | null>(null);

  // Scroll down to form when keyboard opens so inputs are always visible
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
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
      if (result.success) router.replace('/(app)/');
    } catch (err) { console.warn('[Login] Biometric error:', err); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero with Branding ────── */}
        <View style={[styles.heroSection, { backgroundColor: C.primary }]}>

          {/* Background decorative circles for depth */}
          <View style={[styles.decorCircle1, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <View style={[styles.decorCircle2, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.decorCircle3, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

          {/* App Logo */}
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.logoContainer}>
            <View style={[styles.logoRing, { borderColor: 'rgba(255,255,255,0.3)' }]}>
              <View style={[styles.logoInner, { backgroundColor: C.accent }]}>
                <MaterialCommunityIcons name="tools" size={32} color="#FFFFFF" />
              </View>
            </View>
          </Animated.View>

          {/* Brand name + tagline */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.brandBlock}>
            <Text style={styles.brandName}>SiteTrack</Text>
            <Text style={styles.brandTagline}>Field Service Management</Text>
          </Animated.View>

          {/* Feature pills */}
          <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.featureStrip}>
            {['📋 Jobs', '✅ Inspections', '📄 Reports'].map((f) => (
              <View
                key={f}
                style={[styles.featurePill, {
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }]}
              >
                <Text style={styles.featurePillTxt}>{f}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* ── Premium Form Card ─────────────── */}
        {/* NOTE: Plain View here — Animated.View with entering= blocks TextInput touches on Android new arch */}
        <View style={styles.cardWrapper}>
          <Card style={styles.formCard}>

            <Text style={[styles.formTitle, { color: C.text }]}>Welcome back 👋</Text>
            <Text style={[styles.formSub, { color: C.textSecondary }]}>Sign in to your account to continue</Text>

            {/* Error banner */}
            {error && (
              <View style={[styles.errorBanner, { backgroundColor: C.errorLight, borderColor: C.error + '40', borderWidth: 1 }]}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={C.error} />
                <Text style={[styles.errorBannerText, { color: C.error }]}>{error}</Text>
              </View>
            )}

            {/* Email */}
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

            {/* Password */}
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

            {/* Remember me + Forgot */}
            <View style={styles.rememberRow}>
              <TouchableOpacity
                style={styles.rememberLeft}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                activeOpacity={0.7}
              >
                <Checkbox
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRememberMe(v => !v); }}
                  color={C.accent}
                />
                <Text style={[styles.rememberLabel, { color: C.text }]}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotLink, { color: C.accent }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In */}
            <Button
              title="Sign In"
              onPress={handleSignIn}
              isLoading={isLoading}
              style={{ height: 52, borderRadius: 26 }}
            />

            {/* Divider */}
            {biometricsAvailable && (
              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: C.border }]} />
                <Text style={[styles.dividerTxt, { color: C.textTertiary }]}>or continue with</Text>
                <View style={[styles.divider, { backgroundColor: C.border }]} />
              </View>
            )}

            {/* Biometric */}
            {biometricsAvailable && (
              <Button
                title={biometricType === 'face' ? 'Face ID' : 'Fingerprint'}
                variant="outline"
                onPress={handleBiometric}
                icon={
                  <MaterialCommunityIcons
                    name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'}
                    size={20}
                    color={C.primary}
                  />
                }
              />
            )}
          </Card>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTxt}>© 2025 SiteTrack · Built for Australian trade professionals</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },

  // ── Hero ──────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 60,
    overflow: 'hidden',
    position: 'relative',
  },
  // Decorative depth circles
  decorCircle1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -100,
    right: -100,
  },
  decorCircle2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -50,
    left: -70,
  },
  decorCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: 30,
    left: 30,
  },
  // Logo
  logoContainer: { marginBottom: 20 },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  // Branding
  brandBlock: { alignItems: 'center', marginBottom: 24 },
  brandName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  // Feature pills
  featureStrip: { flexDirection: 'row', gap: 8 },
  featurePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  featurePillTxt: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ── Form Card ─────────────────────
  cardWrapper: {
    marginHorizontal: 16,
    marginTop: -32,
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F1E3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    gap: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  formTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  formSub: { fontSize: 14, marginBottom: 24, lineHeight: 20 },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },

  // Remember row
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  rememberLeft: { flexDirection: 'row', alignItems: 'center', marginLeft: -8 },
  rememberLabel: { fontSize: 13 },
  forgotLink: { fontSize: 13, fontWeight: '600' },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  divider: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 11, fontWeight: '500' },

  // Footer
  footer: {
    paddingVertical: 28,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  footerTxt: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 17,
  },
});
