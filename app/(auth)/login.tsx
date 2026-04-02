// Login screen — navy curved hero section + floating white form card
import { useState, useEffect } from 'react';
import {

  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput as RNTextInput,
  TextInputProps,
} from 'react-native';
import { Checkbox, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import Colors from '@/constants/Colors';
import Animated, { FadeInDown } from 'react-native-reanimated';

const REMEMBER_ME_KEY = '@sitetrack/remember_me';

export default function LoginScreen() {
  const { signIn, isLoading, error, clearError } = useAuth();

  // Form state
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [emailError, setEmailError]   = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Focus state
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Biometric state
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | null>(null);

  // ── Check biometric availability ─────────────
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
          if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
            setBiometricType('face');
          } else {
            setBiometricType('fingerprint');
          }
        }
      } catch {
        // Biometrics not critical — silently skip
      }
    };
    checkBiometrics();
  }, []);

  // ── Validation ────────────────────────────────
  const validate = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('Email is required.');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address.');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      valid = false;
    }
    return valid;
  };

  // ── Sign in ───────────────────────────────────
  const handleSignIn = async () => {
    clearError();
    if (!validate()) return;
    await signIn(email, password, rememberMe);
  };

  // ── Biometric auth ────────────────────────────
  const handleBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to SiteTrack',
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      if (result.success) {
        router.replace('/(app)/');
      }
    } catch (err) {
      console.warn('[Login] Biometric error:', err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Hero Header ──────────────── */}
        <View style={styles.heroSection}>
          {/* Double-circle logo */}
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoLetters}>ST</Text>
            </View>
          </View>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.welcomeSub}>Sign in to continue</Text>
        </View>

        {/* ── Floating Form Card ────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.formCard}>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert" size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.emailFieldWrap}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[
              styles.inputWrap, 
              emailFocused && styles.inputFocus,
              emailError ? styles.inputError : null
            ]}>
              <MaterialCommunityIcons name="email-outline" size={18} color="#94A3B8" />
              <CustomTextInput
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="you@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
            {emailError ? <Text style={styles.fieldErrorText}>{emailError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.passwordFieldWrap}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[
              styles.inputWrap, 
              passwordFocused && styles.inputFocus,
              passwordError ? styles.inputError : null
            ]}>
              <MaterialCommunityIcons name="lock-outline" size={18} color="#94A3B8" />
              <CustomTextInput
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.fieldErrorText}>{passwordError}</Text> : null}
          </View>

          {/* Remember me + Forgot */}
          <View style={styles.rememberRow}>
            <TouchableOpacity
              style={styles.rememberLeft}
              onPress={() => setRememberMe(v => !v)}
              activeOpacity={0.7}
            >
              <Checkbox
                status={rememberMe ? 'checked' : 'unchecked'}
                onPress={() => setRememberMe(v => !v)}
                color={Colors.light.accent}
              />
              <Text style={styles.rememberLabel}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            style={[styles.signInBtn, isLoading && styles.signInBtnLoading]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading
              ? <MaterialCommunityIcons name="loading" size={20} color="#FFFFFF" />
              : null}
            <Text style={styles.signInBtnText}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Biometric button - Ghost Style */}
          {biometricsAvailable && (
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometric}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={biometricType === 'face' ? 'face-recognition' : 'fingerprint'}
                size={20}
                color={Colors.light.primary}
              />
              <Text style={styles.biometricLabel}>
                {biometricType === 'face' ? 'Use Face ID' : 'Use Fingerprint'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Inline custom text input (avoids react-native-paper outline style) ──
function CustomTextInput(props: TextInputProps) {
  return (
    <RNTextInput
      style={styles.textInput}
      placeholderTextColor={"#94A3B8"}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  scroll: {
    flexGrow: 1,
  },

  // ── Hero section ──────────
  heroSection: {
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 0,
  },
  logoOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetters: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  welcomeSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // ── Floating form card ────
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: -24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    gap: 0,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
    flex: 1,
  },

  // Field Wraps
  emailFieldWrap: {
    marginBottom: 16,
  },
  passwordFieldWrap: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  inputFocus: {
    borderColor: Colors.light.primary,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  // Remember row
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rememberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8, // compensate for Checkbox default padding
  },
  rememberLabel: {
    fontSize: 13,
    color: '#0F172A',
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.accent,
  },

  // Sign In button
  signInBtn: {
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signInBtnLoading: { opacity: 0.75 },
  signInBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Biometric Ghost Btn
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: 12,
    backgroundColor: 'transparent',
  },
  biometricLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
  },
});
