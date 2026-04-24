// Forgot Password — navy curved header + floating form card, success state
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Card, Input } from '@/components/ui';
import Animated, { FadeInDown } from 'react-native-reanimated';

type BannerState = { type: 'success' | 'error'; message: string } | null;

export default function ForgotPasswordScreen() {
  const [email, setEmail]         = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner]       = useState<BannerState>(null);
  const C = useColors();

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
      style={[styles.container, { backgroundColor: C.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy Hero Header ──────────── */}
        <View style={[styles.heroSection, { backgroundColor: C.primary }]}>
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
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={[styles.formCard]}>

          {/* Success state replaces form */}
          {banner?.type === 'success' ? (
            <View style={styles.successCard}>
              <View style={[styles.successIcon, { backgroundColor: C.success }]}>
                <MaterialCommunityIcons name="check-circle" size={36} color="#FFFFFF" />
              </View>
              <Text style={[styles.successTitle, { color: C.text }]}>Email Sent!</Text>
              <Text style={[styles.successBody, { color: C.textSecondary }]}>{banner.message}</Text>
              <Button style={{ marginTop: 12, width: '100%' }} variant="secondary" title="Back to Login" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              {/* Error banner */}
              {banner?.type === 'error' ? (
                <View style={[styles.errorBanner, { backgroundColor: C.errorLight }]}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color={C.errorDark} />
                  <Text style={[styles.errorBannerText, { color: C.errorDark }]}>{banner.message}</Text>
                </View>
              ) : null}

              {/* Email field */}
              <Input
                label="EMAIL ADDRESS"
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                placeholder="you@company.com.au"
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailError}
                leftIcon={<MaterialCommunityIcons name="email-outline" size={18} color={C.textSecondary} />}
                style={{ marginBottom: 20 }}
              />

              {/* Send button */}
              <Button title="Send Reset Email" variant="secondary" onPress={handleSendReset} isLoading={isLoading} />
            </>
          )}
          </Card>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: { flexGrow: 1 },

  // Hero
  heroSection: {
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
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: -24,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  successBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Field
  fieldGroup: { marginBottom: 20, gap: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 2,
    marginLeft: 2,
  },
});
