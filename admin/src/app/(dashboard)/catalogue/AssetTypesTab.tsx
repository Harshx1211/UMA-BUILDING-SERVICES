'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const EMPTY = { value: '', label: '', full_label: '', icon: 'shield-check-outline', color: '#1B2D4F', inspection_routine: '', variants: [] as string[] };

export default function AssetTypesTab() {
  const [rows, setRows]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<any | null>(null);
  const [form, setForm]               = useState({ ...EMPTY });
  const [variantInput, setVariantInput] = useState('');
  const [saving, setSaving]           = useState(false);
  const [delTarget, setDelTarget]     = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('asset_type_definitions').select('*').order('sort_order');
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm({ ...EMPTY }); setVariantInput(''); setShowModal(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ value: r.value, label: r.label, full_label: r.full_label, icon: r.icon, color: r.color, inspection_routine: r.inspection_routine, variants: [...(r.variants ?? [])] }); setVariantInput(''); setShowModal(true); };

  const addVariant = () => {
    const v = variantInput.trim();
    if (!v || form.variants.includes(v)) return;
    setForm(p => ({ ...p, variants: [...p.variants, v] }));
    setVariantInput('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.value || !form.label) { toast.error('Value and Label are required'); return; }
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await adminApi.update('asset_type_definitions', payload, editing.id)
      : await adminApi.insert('asset_type_definitions', { ...payload, sort_order: rows.length + 1 });
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(editing ? 'Updated!' : 'Asset type added!');
    setShowModal(false);
    load();
  };

  const del = async () => {
    if (!delTarget) return;
    const { error } = await adminApi.delete('asset_type_definitions', delTarget.id);
    if (error) toast.error(error);
    else { toast.success('Deleted'); load(); }
    setDelTarget(null);
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
          {rows.length} asset type{rows.length !== 1 ? 's' : ''}
        </p>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
          <Plus size={14} /> Add Type
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : (
        <div>
          {rows.map((r, i) => {
            const open = expanded === r.id;
            const variants: string[] = r.variants ?? [];
            return (
              <div key={r.id} className="border-b last:border-0 animate-fade-in" style={{ borderColor: 'var(--border)', animationDelay: `${i * 20}ms` }}>
                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  {/* Color dot */}
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{r.full_label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{variants.length} variant{variants.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setExpanded(open ? null : r.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                      {open ? <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />}
                    </button>
                    <button onClick={() => openEdit(r)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors">
                      <Pencil size={13} style={{ color: '#3b82f6' }} />
                    </button>
                    <button onClick={() => setDelTarget(r)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                      <Trash2 size={13} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
                {open && variants.length > 0 && (
                  <div className="px-5 pb-3 flex flex-wrap gap-1.5" style={{ background: '#f8fafc' }}>
                    {variants.map(v => (
                      <span key={v} className="px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{ background: '#e8f0fe', color: '#1e3a8a' }}>{v}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>{editing ? 'Edit Asset Type' : 'Add Asset Type'}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><X size={16} /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              {[
                { label: 'Canonical Value *', key: 'value', placeholder: 'e.g. Fire Extinguishers - Portable' },
                { label: 'Short Label *', key: 'label', placeholder: 'e.g. Fire Extinguisher' },
                { label: 'Full Label', key: 'full_label', placeholder: 'Same as value or longer form' },
                { label: 'Icon (MaterialCommunityIcons name)', key: 'icon', placeholder: 'e.g. fire-extinguisher' },
                { label: 'Inspection Routine', key: 'inspection_routine', placeholder: 'e.g. 10 - Portable Extinguishers (Annual)' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{label}</label>
                  <input value={(form as any)[key]} onChange={e => f(key, e.target.value)} placeholder={placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                </div>
              ))}

              {/* Colour picker */}
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Colour</label>
                  <input type="color" value={form.color} onChange={e => f('color', e.target.value)}
                    className="w-12 h-10 rounded-xl border cursor-pointer" style={{ borderColor: 'var(--border)' }} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Hex</label>
                  <input value={form.color} onChange={e => f('color', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none font-mono"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                </div>
              </div>

              {/* Variants */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Variants</label>
                <div className="flex gap-2 mb-2">
                  <input value={variantInput} onChange={e => setVariantInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVariant())}
                    placeholder="Type a variant and press Enter or Add"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                  <button type="button" onClick={addVariant}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'var(--primary)' }}>Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.variants.map(v => (
                    <span key={v} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ background: '#e8f0fe', color: '#1e3a8a' }}>
                      {v}
                      <button type="button" onClick={() => setForm(p => ({ ...p, variants: p.variants.filter(x => x !== v) }))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delTarget && (
        <ConfirmDialog
          title="Delete Asset Type?"
          message={`Delete "${delTarget.full_label}"? This won't delete existing assets that use this type, but they won't appear in the type picker going forward.`}
          onConfirm={del}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
