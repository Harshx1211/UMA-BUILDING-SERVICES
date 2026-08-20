// components/ui/Input.tsx
import React, { useState, forwardRef } from 'react';
import {
  View, StyleSheet, TextInput, Text as RNText, ViewStyle,
  KeyboardTypeOptions, TextInputProps, NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  // ── Keyboard / autofill forwarding ────────────────────────────────────────
  /** Controls the return key label on the software keyboard */
  returnKeyType?: TextInputProps['returnKeyType'];
  /** Hints the OS password manager about the field's content type (iOS) */
  textContentType?: TextInputProps['textContentType'];
  /** Hints the OS autofill system about the expected data (cross-platform) */
  autoComplete?: TextInputProps['autoComplete'];
  /** Called when the user presses the keyboard return / done key */
  onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
  /** Accessibility hint describing what the field is for */
  accessibilityHint?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize,
    autoCorrect, error, disabled, multiline, numberOfLines, maxLength,
    leftIcon, rightIcon, style,
    returnKeyType, textContentType, autoComplete, onSubmitEditing, accessibilityHint,
  },
  ref,
) {
  const C = useColors();
  const [isFocused, setIsFocused] = useState(false);

  // Border and background respond to focus/error state — no Reanimated
  // interpolation, which caused layout re-renders (typing glitch) on Android.
  const borderColor = error
    ? C.error
    : isFocused
      ? C.accentLight
      : C.cardBorder;

  const backgroundColor = isFocused ? C.surface : C.backgroundSecondary;

  return (
    <View style={[styles.container, style]}>
      {/* Label — sentence case only; all-caps is reserved for Typography.eyebrow */}
      <RNText style={[styles.label, { color: C.textSecondary, opacity: isFocused ? 1 : 0.7 }]}>
        {label}
      </RNText>

      <View
        style={[
          styles.inputWrapper,
          {
            height: multiline ? undefined : 54,
            opacity: disabled ? 0.55 : 1,
            borderColor,
            backgroundColor,
          },
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          style={[styles.input, { color: C.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          textContentType={textContentType}
          autoComplete={autoComplete}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={C.primary}
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>

      {/* Error row — icon instead of emoji for consistency */}
      {error && (
        <View style={styles.errorRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={13} color={C.error} />
          <RNText style={[styles.error, { color: C.error }]}>{error}</RNText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 14,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  error: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
