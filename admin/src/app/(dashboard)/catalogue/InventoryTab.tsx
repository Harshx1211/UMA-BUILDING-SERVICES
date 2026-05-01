'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { Plus, Pencil, Trash2, X, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const EMPTY = { name: '', description: '', price: '' };

export default function InventoryTab() {
  const [rows, setRows]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<any | null>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [delTarget, setDelTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('inventory_items').select('*').order('name');
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm({ ...EMPTY }); setShowModal(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name, description: r.description ?? '', price: String(r.price) }); setShowModal(true); };
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, price: Number(form.price) || 0 };
    const { error } = editing
      ? await adminApi.update('inventory_items', payload, editing.id)
      : await adminApi.insert('inventory_items', payload);
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(editing ? 'Updated!' : 'Item added!');
    setShowModal(false);
    load();
  };

  const del = async () => {
    if (!delTarget) return;
    const { error } = await adminApi.delete('inventory_items', delTarget.id);
    if (error) toast.error(error);
    else { toast.success('Deleted'); load(); }
    setDelTarget(null);
  };

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
          {rows.length} item{rows.length !== 1 ? 's' : ''} · used in quote line items
        </p>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
          <Plus size={14} /> Add Item
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--bg)' }}>
            <Package size={24} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>No inventory items yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Add items here — they'll appear as line items when creating quotes</p>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
            <Plus size={14} /> Add First Item
          </button>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
              {['Item Name', 'Description', 'Unit Price (ex-GST)', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-tertiary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors animate-fade-in"
                style={{ borderColor: 'var(--border)', animationDelay: `${i * 15}ms` }}>
                <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.name}</td>
                <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.description ?? '—'}</td>
                <td className="px-5 py-3.5 text-sm font-bold" style={{ color: '#16a34a' }}>${Number(r.price).toFixed(2)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors">
                      <Pencil size={13} style={{ color: '#3b82f6' }} />
                    </button>
                    <button onClick={() => setDelTarget(r)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                      <Trash2 size={13} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md animate-scale-in" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>{editing ? 'Edit Item' : 'Add Inventory Item'}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><X size={16} /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Item Name *</label>
                <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Replace Smoke Alarm 240V"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Description</label>
                <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2}
                  placeholder="Optional detail shown on quote line items"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Unit Price ($ ex-GST)</label>
                <input type="number" step="0.01" value={form.price} onChange={e => f('price', e.target.value)} placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delTarget && (
        <ConfirmDialog
          title="Delete Inventory Item?"
          message={`Delete "${delTarget.name}"? Existing quote line items that reference this will still show in old quotes, but it won't be available for new quotes.`}
          onConfirm={del}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
