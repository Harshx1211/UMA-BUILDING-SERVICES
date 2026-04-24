// components/ui/Input.tsx
import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Text as RNText, ViewStyle, KeyboardTypeOptions } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

export function Input({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize,
  error, disabled, multiline, numberOfLines, maxLength, leftIcon, rightIcon, style
}: InputProps) {
  const C = useColors();
  const [isFocused, setIsFocused] = useState(false);

  // Derive border and background purely from state — no Reanimated interpolation
  // on the wrapper, which caused layout re-renders (and typing glitch) on Android.
  const borderColor = error
    ? C.error
    : isFocused
      ? C.primary
      : (C as any).cardBorder || C.border;

  const backgroundColor = isFocused ? C.surface : C.backgroundSecondary;

  return (
    <View style={[styles.container, style]}>
      <RNText style={[styles.label, { color: C.textSecondary, opacity: isFocused ? 1 : 0.7 }]}>{label.toUpperCase()}</RNText>
      <View style={[
        styles.inputWrapper,
        {
          height: multiline ? undefined : 54,
          opacity: disabled ? 0.55 : 1,
          borderColor,
          backgroundColor,
        },
      ]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, { color: C.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textTertiary || '#94A3B8'}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={C.primary}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && (
        <View style={styles.errorRow}>
          <RNText style={[styles.error, { color: C.error }]}>⚠ {error}</RNText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
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
    marginTop: 5,
    paddingHorizontal: 2,
  },
  error: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
