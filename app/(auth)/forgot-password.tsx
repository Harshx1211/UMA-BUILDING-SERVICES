// Forgot Password — navy curved header + floating form card, success state
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/Colors';
import Animated, { FadeInDown } from 'react-native-reanimated';

type BannerState = { type: 'success' | 'error'; message: string } | null;

export default function ForgotPasswordScreen() {
  const [email, setEmail]         = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner]       = useState<BannerState>(null);

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
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Hero Header ──────────── */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Reset Password</Text>
          <Text style={styles.heroSub}>Enter your email to receive a reset link</Text>
        </View>

        {/* ── Form Card ─────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.formCard}>

          {/* Success state replaces form */}
          {banner?.type === 'success' ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <MaterialCommunityIcons name="check-circle" size={36} color={Colors.light.success} />
              </View>
              <Text style={styles.successTitle}>Email Sent!</Text>
              <Text style={styles.successBody}>{banner.message}</Text>
              <TouchableOpacity style={styles.backToLoginBtn} onPress={() => router.back()}>
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Error banner */}
              {banner?.type === 'error' ? (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.light.errorDark} />
                  <Text style={styles.errorBannerText}>{banner.message}</Text>
                </View>
              ) : null}

              {/* Email field */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <View style={[styles.inputWrap, !!emailError && styles.inputError]}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={Colors.light.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                    placeholder="you@company.com.au"
                    placeholderTextColor={Colors.light.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
              </View>

              {/* Send button */}
              <TouchableOpacity
                style={[styles.sendBtn, isLoading && styles.sendBtnLoading]}
                onPress={handleSendReset}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.sendBtnText}>
                  {isLoading ? 'Sending...' : 'Send Reset Email'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  scroll: { flexGrow: 1 },

  // Hero
  heroSection: {
    backgroundColor: Colors.light.primary,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },

  // Form card
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
    elevation: 6,
  },

  // Success
  successCard: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 0,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  backToLoginBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.light.errorLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    color: Colors.light.errorDark,
    fontWeight: '500',
    flex: 1,
  },

  // Field
  fieldGroup: { marginBottom: 20, gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  inputError: { borderColor: Colors.light.error },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  fieldError: {
    fontSize: 12,
    color: Colors.light.error,
    marginTop: 2,
    marginLeft: 2,
  },

  // Send button
  sendBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnLoading: { opacity: 0.7 },
  sendBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
