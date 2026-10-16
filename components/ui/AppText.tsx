// AppText — the app's <Text>. Same props and behaviour as react-native-paper's
// Text (which every screen used directly before), plus the approved fonts:
// the right Public Sans / Hanken Grotesk family for each style's weight and
// size (constants/Fonts.ts). Screens import it as `Text`, so nothing else
// about them changes. (No screen attaches a ref to text, so none is forwarded.)
import type { ComponentProps } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { fontFor } from '@/constants/Fonts';

type Props = ComponentProps<typeof PaperText>;

export function Text({ style, ...rest }: Props) {
  const font = fontFor(StyleSheet.flatten(style) as TextStyle | undefined);
  return <PaperText {...rest} style={font ? [style, font] : style} />;
}
