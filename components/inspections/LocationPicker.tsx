// LocationPicker — "Location on site" for Add asset and Edit asset.
//
// Replaces the old wall of location chips (every location at the property as
// a chip, sorted as text so Level 10 came before Level 2) and the separate
// three-box "New Location" form. Design chosen by the owner (Stitch,
// 2026-10-15):
//   1. Two shortcut cards — "Same as last" and "Next unit" — because
//      technicians mostly work unit by unit (Add asset only).
//   2. Three rows — Tower, Level, Unit or area — each opening a bottom
//      sheet: number order, search when long, "Add" for a new one.
//   3. A summary that says whether this place already exists at the
//      property ("4 assets here already") or is new, so typos and
//      near-duplicates are obvious before saving.
// The stored value is unchanged: the same "1-3-2" code (or free text for a
// place without a tower), formatted everywhere by utils/assetHelpers.ts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { queryRecords } from '@/lib/database';
import {
  buildLocation, compareLevels, compareUnits, formatLevelName, formatLocationFull, formatUnitName,
  isTowerCode, isUnitNumber, normalizeLevelInput, normalizeUnitInput, parseLocation,
} from '@/utils/assetHelpers';

type Field = 'tower' | 'level' | 'unit';
/** What's been picked so far. `text` set = a place without a tower. */
interface Draft { tower: string; level: string; unit: string; text: string }

const EMPTY: Draft = { tower: '', level: '', unit: '', text: '' };

function draftFrom(value: string): Draft {
  if (!value) return EMPTY;
  const p = parseLocation(value);
  return p ? { tower: p.tower, level: p.level, unit: p.unit, text: '' } : { ...EMPTY, text: value };
}

function codeOf(d: Draft): string {
  if (d.text) return d.text;
  return d.tower && d.unit ? buildLocation({ tower: d.tower, level: d.level, unit: d.unit }) : '';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

interface Props {
  /** The stored location ("1-3-2", or free text). '' while incomplete. */
  value: string;
  onChange: (value: string) => void;
  propertyId: string;
  /** Add asset: show "Same as last" / "Next unit". */
  showShortcuts?: boolean;
  /** Edit asset: leave the asset being edited out of counts and "last". */
  excludeAssetId?: string;
  error?: string;
}

export function LocationPicker({ value, onChange, propertyId, showShortcuts, excludeAssetId, error }: Props) {
  const C = useColors();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(value));
  const [sheet, setSheet] = useState<Field | null>(null);

  // Follow the form when it sets or clears the value itself (reset, edit load).
  useEffect(() => {
    if (value !== codeOf(draft)) setDraft(draftFrom(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Every location at this property, how many active assets each has, and
  // the most recently added asset's location ("Same as last").
  const { counts, last } = useMemo(() => {
    const rows = queryRecords<{ id: string; location_on_site: string | null; created_at: string | null; status: string | null }>(
      'assets', { property_id: propertyId },
    );
    const map = new Map<string, number>();
    let newest: { at: string; loc: string } | null = null;
    for (const r of rows) {
      if (!r.location_on_site || r.id === excludeAssetId || r.status === 'decommissioned') continue;
      map.set(r.location_on_site, (map.get(r.location_on_site) ?? 0) + 1);
      const at = r.created_at ?? '';
      if (!newest || at > newest.at) newest = { at, loc: r.location_on_site };
    }
    return { counts: map, last: newest?.loc ?? null };
    // Re-read when a sheet closes, so a location added a moment ago counts.
  }, [propertyId, excludeAssetId, sheet === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const structured = useMemo(
    () => [...counts.keys()].map((loc) => parseLocation(loc)).filter((p): p is NonNullable<typeof p> => !!p),
    [counts],
  );
  const towers = useMemo(() => [...new Set(structured.map((p) => p.tower))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [structured]);
  const levelsOf = useCallback((t: string) => [...new Set(structured.filter((p) => p.tower === t).map((p) => p.level))].filter(Boolean).sort(compareLevels), [structured]);
  const unitsOf = useCallback((t: string, l: string) => [...new Set(structured.filter((p) => p.tower === t && p.level === l).map((p) => p.unit))].sort(compareUnits), [structured]);
  const places = useMemo(() => [...counts.keys()].filter((loc) => !parseLocation(loc)).sort((a, b) => a.localeCompare(b)), [counts]);

  const next = useMemo(() => {
    const p = parseLocation(last);
    if (!p || !isUnitNumber(p.unit)) return null;
    const nums = unitsOf(p.tower, p.level).filter(isUnitNumber);
    const later = nums.find((u) => compareUnits(u, p.unit) > 0);
    if (later) return buildLocation({ ...p, unit: later });
    return buildLocation({ ...p, unit: String(parseInt(p.unit, 10) + 1) });
  }, [last, unitsOf]);

  const apply = (d: Draft) => {
    setDraft(d);
    onChange(codeOf(d));
  };

  const pickShortcut = (loc: string) => {
    Haptics.selectionAsync();
    apply(draftFrom(loc));
  };

  const code = codeOf(draft);
  const count = code ? counts.get(code) ?? 0 : 0;
  const levelDisabled = !draft.tower || !!draft.text;
  // A unit always sits on a level, so the code can't come out half-formed.
  const unitDisabled = !draft.tower || !!draft.text || !draft.level;

  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: C.textSecondary }]}>
        LOCATION ON SITE <Text style={{ color: C.primary }}>*</Text>
      </Text>

      {error ? (
        <View style={[s.error, { backgroundColor: C.errorLight }]}>
          <MaterialCommunityIcons name="alert-circle" size={14} color={C.error} />
          <Text style={[s.errorTxt, { color: C.error }]}>{error}</Text>
        </View>
      ) : null}

      {showShortcuts && last ? (
        <View style={s.shortcuts}>
          {shortcut('Same as last', 'Previous', last)}
          {next && next !== last ? shortcut('Next unit', 'Next', next) : null}
        </View>
      ) : null}

      {showShortcuts && last ? <Text style={[s.label, { color: C.textSecondary, marginTop: 4 }]}>OR CHOOSE LOCATION</Text> : null}

      <View style={[s.group, { backgroundColor: C.surface, borderColor: C.border }]}>
        {row('TOWER', draft.text ? 'No tower' : draft.tower ? `Tower ${draft.tower}` : '', 'tower', false, false)}
        {row('LEVEL', draft.text ? '—' : draft.level ? formatLevelName(draft.level) : '', 'level', levelDisabled, false)}
        {row('UNIT / AREA', draft.text ? draft.text : draft.unit ? formatUnitName(draft.unit) : '', 'unit', unitDisabled, true)}
      </View>

      {code ? (
        <View style={[s.summary, count > 0
          ? { backgroundColor: C.successLight, borderColor: C.success + '33' }
          : { backgroundColor: C.infoLight, borderColor: C.info + '33' }]}
        >
          <View style={s.summaryTop}>
            <MaterialCommunityIcons name={count > 0 ? 'check-circle' : 'map-marker-plus'} size={15} color={count > 0 ? C.success : C.infoDark} />
            <Text style={[s.summaryTag, { color: count > 0 ? C.successDark : C.infoDark }]}>{count > 0 ? 'EXISTING LOCATION' : 'NEW LOCATION'}</Text>
          </View>
          <Text style={[s.summaryLoc, { color: C.text }]}>{formatLocationFull(code)}</Text>
          <Text style={[s.summarySub, { color: C.textSecondary }]}>
            {count > 0 ? `${plural(count, 'asset')} here already` : 'Not used at this property yet — check it is right'}
          </Text>
        </View>
      ) : null}

      <ChoiceSheet
        field={sheet}
        onClose={() => setSheet(null)}
        draft={draft}
        towers={towers}
        places={places}
        levels={draft.tower ? levelsOf(draft.tower) : []}
        units={draft.tower ? unitsOf(draft.tower, draft.level) : []}
        counts={counts}
        onPick={(d) => {
          apply(d);
          // Walk straight on to the next list while something is still missing.
          if (sheet === 'tower' && !d.text && !d.level) setSheet('level');
          else if (sheet === 'level' && !d.unit) setSheet('unit');
          else setSheet(null);
        }}
      />
    </View>
  );

  function shortcut(title: string, tag: string, loc: string) {
    const selected = code === loc;
    return (
      <TouchableOpacity
        key={title}
        onPress={() => pickShortcut(loc)}
        activeOpacity={0.85}
        style={[s.shortcut, selected
          ? { borderColor: C.primary, borderWidth: 2, backgroundColor: C.primary + '0D' }
          : { borderColor: C.border, borderWidth: 1, backgroundColor: C.surface }]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}: ${formatLocationFull(loc)}`}
      >
        <View style={s.shortcutTop}>
          <Text style={[s.shortcutTitle, { color: selected ? C.text : C.textSecondary }]}>{title}</Text>
          {selected ? (
            <View style={[s.radioOn, { backgroundColor: C.primary }]}>
              <MaterialCommunityIcons name="check" size={13} color={C.textOnPrimary} />
            </View>
          ) : (
            <View style={[s.radioOff, { borderColor: C.borderStrong }]} />
          )}
        </View>
        <View style={[s.tag, { backgroundColor: selected ? C.primary + '1A' : C.backgroundTertiary }]}>
          <Text style={[s.tagTxt, { color: selected ? C.primary : C.textTertiary }]}>{tag.toUpperCase()}</Text>
        </View>
        <Text style={[s.shortcutLoc, { color: selected ? C.text : C.textSecondary }]} numberOfLines={2}>{formatLocationFull(loc)}</Text>
      </TouchableOpacity>
    );
  }

  function row(label: string, v: string, field: Field, disabled: boolean, isLast: boolean) {
    return (
      <TouchableOpacity
        key={field}
        onPress={() => setSheet(field)}
        disabled={disabled}
        activeOpacity={0.7}
        style={[s.row, !isLast && { borderBottomWidth: 1, borderBottomColor: C.border }, disabled && { opacity: 0.45 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label.toLowerCase()}: ${v || 'not chosen'}`}
      >
        <Text style={[s.rowLabel, { color: C.textTertiary }]}>{label}</Text>
        <Text style={[s.rowValue, { color: v ? C.text : C.textTertiary, fontWeight: v ? '700' : '500' }]} numberOfLines={1}>{v || 'Choose'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={C.textTertiary} />
      </TouchableOpacity>
    );
  }
}

// ─── Bottom sheet ────────────────────────────────────────────────────────────

const TITLES: Record<Field, { title: string; sub: string; add: string }> = {
  tower: { title: 'Choose tower', sub: 'Or a place without a tower', add: 'New tower (e.g. 3) or place (e.g. Plant room)' },
  level: { title: 'Choose level', sub: 'Select the floor for this asset', add: 'New level (e.g. 11, B1, Roof)' },
  unit:  { title: 'Choose unit or area', sub: 'Unit number or a named area', add: 'New unit (e.g. 5) or area (e.g. Bin room)' },
};

function ChoiceSheet({ field, onClose, draft, towers, places, levels, units, counts, onPick }: {
  field: Field | null; onClose: () => void; draft: Draft; towers: string[]; places: string[];
  levels: string[]; units: string[]; counts: Map<string, number>; onPick: (d: Draft) => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => { setQuery(''); setAdding(''); setAddError(''); }, [field]);
  if (!field) return null;

  type Option = { key: string; label: string; meta?: string; selected: boolean; pick: () => void };
  const options: Option[] = [];
  let sectionAt = -1;
  if (field === 'tower') {
    towers.forEach((t) => options.push({
      key: `t${t}`, label: `Tower ${t}`, selected: !draft.text && draft.tower === t,
      pick: () => onPick({ ...EMPTY, tower: t, level: draft.tower === t ? draft.level : '', unit: draft.tower === t ? draft.unit : '' }),
    }));
    sectionAt = options.length;
    places.forEach((p) => options.push({
      key: `p${p}`, label: p, meta: plural(counts.get(p) ?? 0, 'asset'), selected: draft.text === p,
      pick: () => onPick({ ...EMPTY, text: p }),
    }));
  } else if (field === 'level') {
    levels.forEach((l) => options.push({
      key: `l${l}`, label: formatLevelName(l), selected: draft.level === l,
      pick: () => onPick({ ...draft, text: '', level: l, unit: l === draft.level ? draft.unit : '' }),
    }));
  } else {
    units.forEach((u) => {
      const loc = buildLocation({ tower: draft.tower, level: draft.level, unit: u });
      options.push({
        key: `u${u}`, label: formatUnitName(u), meta: plural(counts.get(loc) ?? 0, 'asset'), selected: draft.unit === u,
        pick: () => onPick({ ...draft, text: '', unit: u }),
      });
    });
  }

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const firstPlace = shown.findIndex((o) => o.key.startsWith('p'));

  const submitAdd = () => {
    const raw = adding.trim();
    if (!raw) return;
    if (field === 'tower') {
      if (isTowerCode(raw.replace(/^tower\s+/i, ''))) onPick({ ...EMPTY, tower: raw.replace(/^tower\s+/i, '').toUpperCase() });
      else onPick({ ...EMPTY, text: raw.replace(/\s+/g, ' ') });
    } else if (field === 'level') {
      const l = normalizeLevelInput(raw);
      if (!l) { setAddError('Use a number, G (Ground), B1 (Basement), M (Mezzanine) or Roof.'); return; }
      onPick({ ...draft, text: '', level: l, unit: '' });
    } else {
      const u = normalizeUnitInput(raw);
      if (!u) return;
      onPick({ ...draft, text: '', unit: u });
    }
    Haptics.selectionAsync();
  };

  const t = TITLES[field];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[s.backdrop, { backgroundColor: C.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: C.surface, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[s.grab, { backgroundColor: C.borderStrong }]} />
        <View style={[s.sheetHead, { borderBottomColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sheetTitle, { color: C.text }]}>{t.title}</Text>
            <Text style={[s.sheetSub, { color: C.textTertiary }]}>{t.sub}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={[s.done, { color: C.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.tools, { backgroundColor: C.background, borderBottomColor: C.border }]}>
          {options.length > 8 ? (
            <View style={[s.search, { backgroundColor: C.surface, borderColor: C.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={C.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${field === 'unit' ? 'units and areas' : field === 'level' ? 'levels' : 'towers and places'}`}
                placeholderTextColor={C.textTertiary}
                style={[s.searchInput, { color: C.text }]}
                autoCorrect={false}
              />
            </View>
          ) : null}
          <View style={s.addRow}>
            <TextInput
              value={adding}
              onChangeText={(v) => { setAdding(v); setAddError(''); }}
              placeholder={t.add}
              placeholderTextColor={C.textTertiary}
              style={[s.addInput, { backgroundColor: C.surface, borderColor: addError ? C.error : C.border, color: C.text }]}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submitAdd}
            />
            <TouchableOpacity
              onPress={submitAdd}
              disabled={!adding.trim()}
              style={[s.addBtn, { backgroundColor: C.surface, borderColor: C.borderStrong, opacity: adding.trim() ? 1 : 0.5 }]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="plus" size={16} color={C.primary} />
              <Text style={[s.addBtnTxt, { color: C.text }]}>Add</Text>
            </TouchableOpacity>
          </View>
          {addError ? <Text style={[s.addError, { color: C.error }]}>{addError}</Text> : null}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={s.list}>
          {shown.length === 0 ? (
            <Text style={[s.empty, { color: C.textTertiary }]}>
              {options.length === 0 ? 'Nothing here yet. Add one above.' : 'No match. Add it above.'}
            </Text>
          ) : null}
          {shown.map((o, i) => (
            <View key={o.key}>
              {field === 'tower' && i === firstPlace && sectionAt >= 0 ? (
                <Text style={[s.section, { color: C.textTertiary, backgroundColor: C.background }]}>PLACES WITHOUT A TOWER</Text>
              ) : null}
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); o.pick(); }}
                activeOpacity={0.7}
                style={[s.opt, { borderBottomColor: C.border },
                  o.selected && { backgroundColor: C.primary + '0D', borderLeftWidth: 4, borderLeftColor: C.primary }]}
                accessibilityRole="button"
                accessibilityState={{ selected: o.selected }}
              >
                <Text style={[s.optTxt, { color: o.selected ? C.primary : C.text, fontWeight: o.selected ? '700' : '500' }]} numberOfLines={1}>{o.label}</Text>
                {o.meta ? <Text style={[s.optMeta, { color: C.textTertiary }]}>{o.meta}</Text> : null}
                {o.selected ? <MaterialCommunityIcons name="check" size={20} color={C.primary} /> : null}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  errorTxt: { fontSize: 12.5, fontWeight: '600', flex: 1 },

  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, borderRadius: 14, padding: 12, minHeight: 104, gap: 6 },
  shortcutTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  shortcutTitle: { fontSize: 13.5, fontWeight: '700', flex: 1 },
  radioOn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioOff: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  tag: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  shortcutLoc: { fontSize: 13.5, fontWeight: '700', lineHeight: 18, marginTop: 'auto' },

  group: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  rowLabel: { width: 96, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  rowValue: { flex: 1, fontSize: 15 },

  summary: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 3 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  summaryLoc: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  summarySub: { fontSize: 12.5 },

  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetSub: { fontSize: 12, marginTop: 1 },
  done: { fontSize: 15, fontWeight: '700' },
  tools: { padding: 14, gap: 10, borderBottomWidth: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1, height: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 13.5 },
  addBtn: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 9, paddingHorizontal: 14 },
  addBtnTxt: { fontSize: 13.5, fontWeight: '700' },
  addError: { fontSize: 12, fontWeight: '600' },
  list: { flexGrow: 0 },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 20, paddingVertical: 8 },
  opt: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  optTxt: { flex: 1, fontSize: 15 },
  optMeta: { fontSize: 12 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
});
