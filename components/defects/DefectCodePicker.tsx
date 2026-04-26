/**
 * DefectCodePicker.tsx — Searchable Uptick-style defect code picker
 *
 * Matches the UI from Uptick Image 6:
 *   - Search bar filters codes + descriptions in real-time
 *   - "Custom Note" always at top
 *   - Code bold + description grey + price badge (green)
 *   - Category grouping with icons
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Platform,
  Keyboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  DEFECT_CODES,
  DEFECT_CATEGORIES,
  CATEGORY_ICONS,
  searchDefectCodes,
  type DefectCode,
  type DefectCategory,
} from '@/constants/DefectCodes';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

// ─── Props ─────────────────────────────────────────────────────────────────────
interface DefectCodePickerProps {
  visible: boolean;
  onSelect: (code: DefectCode | null) => void; // null = Custom Note
  onClose: () => void;
}

// ─── Custom Note pseudo-item ───────────────────────────────────────────────────
const CUSTOM_NOTE: DefectCode = {
  code: 'custom',
  description: 'Enter a custom defect description',
  category: 'General',
};

// ─── Category filter pill ─────────────────────────────────────────────────────
function CategoryPill({
  label,
  icon,
  isActive,
  onPress,
  C,
}: {
  label: string;
  icon: string;
  isActive: boolean;
  onPress: () => void;
  C: any;
}) {
  return (
    <TouchableOpacity
      style={[
        s.catPill,
        {
          backgroundColor: isActive ? C.primary : C.backgroundTertiary,
          borderColor: isActive ? C.primary : C.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={13}
        color={isActive ? '#FFF' : C.textSecondary}
      />
      <Text style={[s.catPillTxt, { color: isActive ? '#FFF' : C.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Single code row ──────────────────────────────────────────────────────────
const CodeRow = React.memo(function CodeRow({
  item,
  isCustom,
  onPress,
  C,
}: {
  item: DefectCode;
  isCustom?: boolean;
  onPress: () => void;
  C: any;
}) {
  return (
    <TouchableOpacity
      style={[s.codeRow, { borderBottomColor: C.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left icon */}
      <View style={[s.codeIcon, { backgroundColor: isCustom ? C.accent + '18' : C.backgroundTertiary }]}>
        <MaterialCommunityIcons
          name={isCustom ? 'pencil-outline' : 'tag-outline'}
          size={16}
          color={isCustom ? C.accent : C.textTertiary}
        />
      </View>

      {/* Text block */}
      <View style={s.codeTextBlock}>
        <Text
          style={[s.codeLabel, { color: isCustom ? C.accent : C.text }]}
          numberOfLines={1}
        >
          {isCustom ? 'Custom Note' : item.code.toUpperCase()}
        </Text>
        <Text
          style={[s.codeDesc, { color: C.textSecondary }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      </View>

      {/* Price badge */}
      {item.quote_price !== undefined && (
        <View style={[s.priceBadge, { backgroundColor: '#10B981' + '18', borderColor: '#10B981' + '40' }]}>
          <Text style={s.priceBadgeTxt}>${item.quote_price}</Text>
        </View>
      )}

      {/* Arrow */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={16}
        color={C.borderStrong}
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DefectCodePicker({ visible, onSelect, onClose }: DefectCodePickerProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<DefectCategory | 'All'>('All');
  const searchRef = useRef<TextInput>(null);

  const handleClose = () => {
    setQuery('');
    setActiveCategory('All');
    Keyboard.dismiss();
    onClose();
  };

  const handleSelect = useCallback((code: DefectCode | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery('');
    setActiveCategory('All');
    Keyboard.dismiss();
    onSelect(code);
  }, [onSelect]);

  // Filter codes by search query + active category
  const filteredCodes = useMemo(() => {
    let results = query.trim() ? searchDefectCodes(query) : DEFECT_CODES;
    if (activeCategory !== 'All') {
      results = results.filter(d => d.category === activeCategory);
    }
    return results;
  }, [query, activeCategory]);

  // Build flat data with the custom note always first
  const listData = useMemo(() => {
    if (activeCategory !== 'All' || query.trim()) return filteredCodes;
    return filteredCodes; // custom note rendered separately as header
  }, [filteredCodes, activeCategory, query]);

  const renderItem = useCallback(({ item }: { item: DefectCode }) => (
    <CodeRow
      item={item}
      onPress={() => handleSelect(item)}
      C={C}
    />
  ), [C, handleSelect]);

  const keyExtractor = useCallback((item: DefectCode) => item.code, []);

  const ListHeader = useMemo(() => (
    <Animated.View entering={FadeIn.duration(200)}>
      {/* Custom Note (always at top) */}
      <CodeRow
        item={CUSTOM_NOTE}
        isCustom
        onPress={() => handleSelect(null)}
        C={C}
      />

      {/* Results header */}
      <View style={[s.resultsHeader, { backgroundColor: C.backgroundTertiary }]}>
        <Text style={[s.resultsLabel, { color: C.textTertiary }]}>
          {query.trim()
            ? `${filteredCodes.length} result${filteredCodes.length !== 1 ? 's' : ''}`
            : `ALL CODES (${DEFECT_CODES.length})`}
        </Text>
      </View>
    </Animated.View>
  ), [C, handleSelect, filteredCodes.length, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      onShow={() => setTimeout(() => searchRef.current?.focus(), 100)}
    >
      <View style={[s.container, { backgroundColor: C.background }]}>

        {/* ── HEADER ───────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border, paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={s.closeBtn} onPress={handleClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={C.textSecondary} />
          </TouchableOpacity>

          {/* Search bar */}
          <View style={[s.searchBar, { backgroundColor: C.backgroundTertiary, borderColor: C.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={C.textTertiary} />
            <TextInput
              ref={searchRef}
              style={[s.searchInput, { color: C.text }]}
              placeholder="Filter Remark Types…"
              placeholderTextColor={C.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS === 'android' && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={16} color={C.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── CATEGORY FILTER PILLS ─────────────────────────── */}
        <View style={[s.catRow, { borderBottomColor: C.border }]}>
          <FlatList
            data={['All', ...DEFECT_CATEGORIES] as (DefectCategory | 'All')[]}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => (
              <CategoryPill
                label={item}
                icon={item === 'All' ? 'format-list-bulleted' : CATEGORY_ICONS[item as DefectCategory]}
                isActive={activeCategory === item}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveCategory(item as DefectCategory | 'All');
                }}
                C={C}
              />
            )}
          />
        </View>

        {/* ── CODE LIST ─────────────────────────────────────── */}
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="file-search-outline" size={40} color={C.textTertiary} />
              <Text style={[s.emptyTitle, { color: C.text }]}>No codes found</Text>
              <Text style={[s.emptySub, { color: C.textSecondary }]}>
                Try a different search term, or use &quot;Custom Note&quot;
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // Category pills
  catRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillTxt: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Results header
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Code row
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  codeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeTextBlock: {
    flex: 1,
    gap: 3,
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  codeDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  priceBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
