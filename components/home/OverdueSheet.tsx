// OverdueSheet — the properties behind Home's "N properties are overdue for
// inspection" banner. Tapping one opens that property. (With a single
// overdue property the banner opens it directly and this isn't shown.)
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/AppText';
import { useColors } from '@/hooks/useColors';
import { T } from '@/constants/Colors';

export interface OverdueProperty {
  id: string; name: string; address: string | null; suburb: string | null; next_inspection_date: string;
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

export function OverdueSheet({ visible, properties, onClose, onOpen }: {
  visible: boolean; properties: OverdueProperty[]; onClose: () => void; onOpen: (id: string) => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: C.surface, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[s.grab, { backgroundColor: C.borderStrong }]} />
        <View style={[s.head, { borderBottomColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: C.text }]}>Overdue for inspection</Text>
            <Text style={[s.sub, { color: C.textTertiary }]}>
              {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} past the next inspection date
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[s.done, { color: C.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flexGrow: 0 }}>
          {properties.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => onOpen(p.id)}
              activeOpacity={0.7}
              style={[s.row, { borderBottomColor: C.border }]}
              accessibilityRole="button"
            >
              <View style={[s.icon, { backgroundColor: C.errorLight }]}>
                <MaterialCommunityIcons name="calendar-alert" size={18} color={C.error} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { color: C.text }]} numberOfLines={1}>{p.name}</Text>
                <Text style={[s.addr, { color: C.textSecondary }]} numberOfLines={1}>
                  {[p.address, p.suburb].filter(Boolean).join(', ') || 'No address'}
                </Text>
                <Text style={[s.due, { color: C.error }]}>Was due {fmt(p.next_inspection_date)}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={C.textTertiary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  done: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, minHeight: 64 },
  icon: { width: 36, height: 36, borderRadius: T.radiusButton, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  addr: { fontSize: 13, marginTop: 1 },
  due: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
