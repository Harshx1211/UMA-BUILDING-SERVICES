import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { cardShadow } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui';
import { useQuotesStore } from '@/store/quotesStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { getDefectsForJob } from '@/lib/database';
import { Defect } from '@/types';
import { QuoteStatus } from '@/constants/Enums';

export default function QuoteScreen() {
  const C = useColors();
  const { id: jobId } = useLocalSearchParams<{ id: string }>();
  const quoteStore = useQuotesStore();
  const inventoryStore = useInventoryStore();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [pendingQty, setPendingQty] = useState(1); // FLOW-5: quantity before adding to quote


  useEffect(() => {
    if (jobId) {
      quoteStore.loadQuoteForJob(jobId);
      inventoryStore.loadInventory();
      setDefects(getDefectsForJob(jobId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const handleCreateDraft = () => {
    if (jobId) quoteStore.createDraftQuote(jobId);
  };

  const currentQuote = quoteStore.currentQuote;
  const isApproved = currentQuote?.status === QuoteStatus.Approved;

  const getInventoryItemName = (invId: string) => {
    const item = inventoryStore.items.find(i => i.id === invId);
    return item ? item.name : 'Unknown Item';
  };

  const getDefectDescription = (defectId: string | null) => {
    if (!defectId) return 'General/Manual Add';
    const def = defects.find(d => d.id === defectId);
    return def ? def.description : 'Unknown Defect';
  };

  return (
    <View style={[s.screen, { backgroundColor: C.background }]}>
      <ScreenHeader
        eyebrow="QUOTE & BILLING"
        title="Quote Summary"
        subtitle="Add materials, repairs, and labor"
        showBack={true}
        curved={true}
      />
      <ScrollView contentContainerStyle={s.content}>
        <View style={{ paddingTop: 16 }}>
        {!currentQuote ? (
          <View style={[s.emptyState, { backgroundColor: C.surface }, cardShadow]}>
            <Text style={{ fontSize: 40 }}>💰</Text>
            <Text style={[s.emptyTitle, { color: C.text }]}>No Quote Generated</Text>
            <Text style={[s.emptySub, { color: C.textSecondary }]}>Create a draft quote to start adding materials and defect repairs.</Text>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.primary }]} onPress={handleCreateDraft}>
              <Text style={s.actionBtnTxt}>Create Draft Quote</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <View style={s.quoteHeader}>
              <Text style={[s.quoteTitle, { color: C.textSecondary }]}>Current Quote</Text>
              <View style={[s.statusBadge, { backgroundColor: isApproved ? C.success : C.border }]}>
                <Text style={s.statusTxt}>{currentQuote.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={[s.totalAmount, { color: C.text }]}>${currentQuote.total_amount.toFixed(2)}</Text>

            <View style={[s.section, { backgroundColor: C.surface }, cardShadow]}>
              <Text style={[s.sectionTitle, { color: C.text }]}>Line Items</Text>
              {quoteStore.items.length === 0 ? (
                <Text style={[s.emptyItems, { color: C.textTertiary }]}>No items added to this quote yet.</Text>
              ) : (
                quoteStore.items.map((item, idx) => (
                  <View key={item.id} style={[s.itemCard, { borderBottomColor: C.border }]}>
                    <View style={s.itemInfo}>
                      <Text style={[s.itemName, { color: C.text }]}>{getInventoryItemName(item.inventory_item_id)}</Text>
                      <Text style={[s.itemDefect, { color: C.textSecondary }]}>For: {getDefectDescription(item.defect_id)}</Text>
                      <Text style={[s.itemPrice, { color: C.primary }]}>{item.quantity} x ${item.unit_price.toFixed(2)} = ${(item.quantity * item.unit_price).toFixed(2)}</Text>
                    </View>
                    {!isApproved && (
                      <TouchableOpacity onPress={() => quoteStore.removeItem(item.id)} style={s.deleteBtn}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color={C.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>

            {!isApproved && (
              <View style={s.addTools}>
                {showInventory ? (
                  <View style={[s.inventoryList, { backgroundColor: C.surface }, cardShadow]}>
                    <Text style={[s.sectionTitle, { color: C.text }]}>Select from Inventory</Text>

                    {/* FLOW-5 FIX: Quantity stepper — was always hardcoded to 1 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: C.backgroundTertiary }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.textSecondary }}>Quantity</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity
                          onPress={() => setPendingQty(q => Math.max(1, q - 1))}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>−</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, minWidth: 24, textAlign: 'center' }}>{pendingQty}</Text>
                        <TouchableOpacity
                          onPress={() => setPendingQty(q => q + 1)}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF' }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {inventoryStore.items.map(inv => (
                      <TouchableOpacity 
                        key={inv.id} 
                        style={[s.invOption, { borderBottomColor: C.border }]}
                        onPress={() => {
                          quoteStore.addItem(inv.id, null, pendingQty);
                          setPendingQty(1); // reset for next item
                          setShowInventory(false);
                        }}
                      >
                        <Text style={[s.invOptionName, { color: C.text }]}>{inv.name}</Text>
                        <Text style={[s.invOptionPrice, { color: C.primary }]}>
                          {pendingQty > 1 ? `${pendingQty} × ` : ''}${inv.price.toFixed(2)}
                          {pendingQty > 1 ? ` = $${(inv.price * pendingQty).toFixed(2)}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnSecondary, { borderColor: C.border, backgroundColor: C.background }]}
                      onPress={() => { setShowInventory(false); setPendingQty(1); }}
                    >
                      <Text style={[s.actionBtnTxt, { color: C.primary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.actionsRow}>
                    <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: C.primary }]} onPress={() => setShowInventory(true)}>
                      <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
                      <Text style={s.actionBtnTxt}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {quoteStore.items.length > 0 && !showInventory && (
                  <TouchableOpacity 
                    style={[s.actionBtn, s.approveBtn, { backgroundColor: C.success }, cardShadow]} 
                    onPress={() => {
                      Alert.alert(
                        "Approve Quote?",
                        "Once approved, this quote cannot be edited. It will be attached to the final completion report.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Approve", style: "destructive", onPress: quoteStore.approveQuote }
                        ]
                      );
                    }}
                  >
                    <Text style={[s.actionBtnTxt, {color: '#FFF'}]}>Approve Quote</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 60 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 40, padding: 32, borderRadius: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  actionBtnSecondary: { borderWidth: 1, marginTop: 8 },
  
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  quoteTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  totalAmount: { fontSize: 32, fontWeight: '800', marginVertical: 8 },
  
  section: { borderRadius: 16, padding: 16, marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  emptyItems: { fontSize: 14, fontStyle: 'italic' },
  itemCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemDefect: { fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  itemPrice: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  deleteBtn: { padding: 8 },
  
  addTools: { marginTop: 24 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  approveBtn: { marginTop: 16 },
  
  inventoryList: { borderRadius: 16, padding: 16 },
  invOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  invOptionName: { fontSize: 15, fontWeight: '500' },
  invOptionPrice: { fontSize: 15, fontWeight: '700' },
});
