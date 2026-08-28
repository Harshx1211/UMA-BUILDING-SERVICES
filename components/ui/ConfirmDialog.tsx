// ConfirmDialog — drop-in replacement for Alert.alert(title, message, buttons)
// that matches the app's own visual style instead of the native OS dialog.
//
// Usage is intentionally close to Alert.alert so call sites are a near-mechanical
// swap:
//   Alert.alert('Delete Defect?', 'This cannot be undone.', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Delete', style: 'destructive', onPress: doDelete },
//   ]);
// becomes:
//   showConfirm({
//     title: 'Delete Defect?', message: 'This cannot be undone.', icon: 'trash-can-outline',
//     buttons: [
//       { text: 'Cancel', style: 'cancel' },
//       { text: 'Delete', style: 'destructive', onPress: doDelete },
//     ],
//   });
//
// <ConfirmDialogHost /> is mounted once at the app root (app/_layout.tsx),
// mirroring how react-native-toast-message's <Toast /> is already mounted —
// showConfirm() can be called from anywhere without local modal state.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type MCIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface ConfirmButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface ConfirmConfig {
  title: string;
  message?: string;
  /** Optional icon shown above the title. Colour follows whether a destructive button is present. */
  icon?: MCIconName;
  /** Defaults to a single "OK" button, matching Alert.alert's own default. */
  buttons?: ConfirmButton[];
}

type Listener = (config: ConfirmConfig | null) => void;
let listener: Listener | null = null;

export function showConfirm(config: ConfirmConfig): void {
  listener?.(config);
}

export function ConfirmDialogHost() {
  const C = useColors();
  const [config, setConfig] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    listener = setConfig;
    return () => { listener = null; };
  }, []);

  const close = useCallback(() => setConfig(null), []);

  if (!config) return null;

  const buttons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: 'OK' }];
  const hasDestructive = buttons.some(b => b.style === 'destructive');
  const iconColor = hasDestructive ? C.error : C.primary;
  const stacked = buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: C.surface }]}>
          {config.icon && (
            <View style={[s.iconWrap, { backgroundColor: iconColor + '18' }]}>
              <MaterialCommunityIcons name={config.icon} size={26} color={iconColor} />
            </View>
          )}
          <Text style={[s.title, { color: C.text }]}>{config.title}</Text>
          {config.message ? (
            <Text style={[s.message, { color: C.textSecondary }]}>{config.message}</Text>
          ) : null}
          <View style={[s.btnRow, stacked && s.btnRowStacked]}>
            {buttons.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.btn,
                    { backgroundColor: isDestructive ? C.error : isCancel ? C.backgroundTertiary : C.primary },
                  ]}
                  onPress={() => { close(); b.onPress?.(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.btnTxt, { color: isCancel ? C.text : C.textOnPrimary }]} numberOfLines={1}>
                    {b.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card:     { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title:    { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  message:  { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  btnRow:       { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  btnRowStacked:{ flexDirection: 'column' },
  btn:      { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnTxt:   { fontSize: 15, fontWeight: '700' },
});
