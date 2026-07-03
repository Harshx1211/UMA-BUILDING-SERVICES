/**
 * FormField — standardized label-above-input pattern used everywhere a user types.
 *
 * Enforces:
 *  - Consistent label typography (Typography.label)
 *  - Consistent input background (T.surfaceInput)
 *  - Consistent border (T.border, focused → T.primary)
 *  - Consistent radius (T.radiusButton = 10px)
 *  - Consistent placeholder color (T.textMuted)
 *
 * Usage:
 *   <FormField label="Client Name" value={name} onChangeText={setName} />
 *   <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
 */
import React, { useState } from 'react';
import {
  StyleSheet, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { T } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function FormField({
  label,
  error,
  containerStyle,
  multiline,
  ...inputProps
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e); }}
        onBlur={(e)  => { setFocused(false); inputProps.onBlur?.(e); }}
        placeholderTextColor={T.textMuted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          error  && styles.inputError,
        ]}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: T.space4,
    marginBottom: T.space12,
  },
  label: {
    ...Typography.label,
    color: T.textMuted,
  },
  input: {
    backgroundColor: T.surfaceInput,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusButton,
    paddingHorizontal: T.space16,
    paddingVertical: T.space12,
    fontSize: 14,
    fontWeight: '500',
    color: T.textPrimary,
    minHeight: 48,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: T.space12,
  },
  inputFocused: {
    borderColor: T.primary,
  },
  inputError: {
    borderColor: T.danger,
  },
  errorText: {
    fontSize: 12,
    color: T.danger,
    fontWeight: '500',
    marginTop: 2,
  },
});
