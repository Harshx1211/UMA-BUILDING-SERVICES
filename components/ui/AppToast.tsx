// AppToast — the look of every pop-up message (react-native-toast-message),
// passed to <Toast config={toastConfig} /> in app/_layout.tsx. Replaces the
// library's default white card with a coloured edge: a navy card with a
// status icon, the same style as the app's own cards and buttons. The
// type names are unchanged, so all existing Toast.show({ type: ... }) calls
// pick this up with no change.
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { T } from '@/constants/Colors';

type Kind = 'success' | 'error' | 'info';

const KIND: Record<Kind, { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; label: string }> = {
  success: { icon: 'check-circle',       color: '#4ADE80', label: 'Done' },
  error:   { icon: 'alert-circle',       color: '#F87171', label: 'Problem' },
  info:    { icon: 'information',        color: '#93C5FD', label: 'Note' },
};

function AppToast({ kind, text1, text2, onPress, hide }: ToastConfigParams<unknown> & { kind: Kind }) {
  const k = KIND[kind];
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress ?? hide}
      style={styles.card}
      accessibilityRole="alert"
      accessibilityLabel={[k.label, text1, text2].filter(Boolean).join('. ')}
    >
      <MaterialCommunityIcons name={k.icon} size={20} color={k.color} />
      <View style={styles.text}>
        {text1 ? <Text style={styles.title} numberOfLines={2}>{text1}</Text> : null}
        {text2 ? <Text style={styles.body} numberOfLines={3}>{text2}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export const toastConfig: ToastConfig = {
  success: (p) => <AppToast {...p} kind="success" />,
  error:   (p) => <AppToast {...p} kind="error" />,
  info:    (p) => <AppToast {...p} kind="info" />,
};

const styles = StyleSheet.create({
  card: {
    width: '92%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: T.textPrimary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  text: { flex: 1, gap: 2 },
  title: { color: T.surface, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  body: { color: '#CBD5E1', fontSize: 13, fontWeight: '400', lineHeight: 18 },
});
