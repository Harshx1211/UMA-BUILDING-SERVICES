/**
 * Timeline — field-level change history for one job_assets or defects row.
 * Shared by the Asset Detail screen and the Defect Detail screen; each save
 * produced by store/inspectionStore.ts or store/defectsStore.ts is one
 * entry here, with every field that changed in that save listed together.
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { getFieldAuditLog, getRecord, AuditLogEntry } from '@/lib/database';

interface Props {
  tableName: 'job_assets' | 'defects';
  recordId: string;
}

const FIELD_LABELS: Record<string, string> = {
  result: 'Result',
  checklist_data: 'Checklist',
  is_compliant: 'Compliant',
  defect_reason: 'Defect Reason',
  technician_notes: 'Technician Notes',
  status: 'Status',
  description: 'Description',
  severity: 'Severity',
  defect_code: 'Defect Code',
  quote_price: 'Quote Price',
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'is_compliant') return value === 1 || value === true || value === '1' ? 'Yes' : 'No';
  if (field === 'checklist_data') return 'updated';
  if (field === 'result') return String(value).replace(/_/g, ' ');
  if (field === 'severity') return String(value).replace(/_/g, ' ');
  if (typeof value === 'string' && value.length > 60) return value.slice(0, 57) + '…';
  return String(value);
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
  } catch { return iso; }
}

export function Timeline({ tableName, recordId }: Props) {
  const C = useColors();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!recordId) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const log = getFieldAuditLog(tableName, recordId);
    setEntries(log);

    const nameMap = new Map<string, string>();
    for (const entry of log) {
      if (entry.changed_by && !nameMap.has(entry.changed_by)) {
        const u = getRecord<{ full_name: string }>('users', entry.changed_by);
        nameMap.set(entry.changed_by, u?.full_name ?? 'Unknown');
      }
    }
    setNames(nameMap);
    setLoading(false);
  }, [tableName, recordId]);

  useFocusEffect(load);

  if (loading) {
    return <ActivityIndicator size="small" color={C.textTertiary} />;
  }

  if (entries.length === 0) {
    return <Text style={[s.empty, { color: C.textTertiary }]}>No changes recorded yet.</Text>;
  }

  return (
    <View>
      {entries.map((entry, i) => (
        <View key={entry.id} style={[s.row, i > 0 && { borderTopColor: C.border, borderTopWidth: 1 }]}>
          <View style={s.topRow}>
            <Text style={[s.who, { color: C.text }]}>{entry.changed_by ? names.get(entry.changed_by) ?? 'Unknown' : 'Unknown'}</Text>
            <Text style={[s.when, { color: C.textTertiary }]}>{fmtDateTime(entry.changed_at)}</Text>
          </View>
          {entry.changes.map((c, ci) => (
            <Text key={ci} style={[s.change, { color: C.textSecondary }]}>
              {c.field === '_created'
                ? 'Defect created'
                : `${FIELD_LABELS[c.field] ?? c.field} changed to ${formatValue(c.field, c.new)}`}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 12.5, fontStyle: 'italic' },
  row: { paddingVertical: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  who: { fontSize: 12.5, fontWeight: '700' },
  when: { fontSize: 11 },
  change: { fontSize: 12.5, lineHeight: 18 },
});
