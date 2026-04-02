import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';

export default function AssetInspectionScreen() {
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerInner}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Asset Inspection</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>
      <View style={s.content}>
        <MaterialCommunityIcons name="magnify" size={64} color={Colors.light.border} />
        <Text style={s.title}>Asset Inspection</Text>
        <Text style={s.sub}>Coming in Phase 4</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.light.background },
  header: { backgroundColor: Colors.light.primary, paddingTop: 52, paddingBottom: 20 },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.light.text },
  sub: { fontSize: 14, color: Colors.light.textSecondary },
});
