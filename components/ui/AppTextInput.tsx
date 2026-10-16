// AppTextInput — the app's <TextInput>. Same props, ref and behaviour as
// react-native's TextInput, plus the approved Public Sans font for typed text
// and placeholders (constants/Fonts.ts), the same way AppText does for <Text>.
// Screens import it as `TextInput`, so nothing else about them changes.
import { forwardRef } from 'react';
import { StyleSheet, TextInput as RNTextInput, type TextInputProps, type TextStyle } from 'react-native';
import { fontFor } from '@/constants/Fonts';

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  const font = fontFor(StyleSheet.flatten(style) as TextStyle | undefined);
  return <RNTextInput ref={ref} {...rest} style={font ? [style, font] : style} />;
});

// So `useRef<TextInput>(null)` keeps working where a screen focuses a box.
// eslint-disable-next-line @typescript-eslint/no-redeclare -- same name on purpose (value + type)
export type TextInput = RNTextInput;
