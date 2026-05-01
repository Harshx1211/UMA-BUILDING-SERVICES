'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const CATEGORIES = ['Gap','Seal','Hardware','Delamination','Alarm','Lock','Hinge','Access','Window','Compliance','General'];
const EMPTY = { code: '', description: '', quote_price: '', category: 'General' };

export default function DefectCodesTab() {
  const [rows, setRows]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catF, setCatF]           = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<any | null>(null);
  const [form, setForm]           = useState({ ...EMPTY });
  const [saving, setSaving]       = useState(false);
  const [delTarget, setDelTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('defect_codes').select('*').order('sort_order');
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    const matchC = !catF || r.category === catF;
    return matchQ && matchC;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(r => r.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {} as Record<string, any[]>);

  const openAdd  = () => { setEditing(null); setForm({ ...EMPTY }); setShowModal(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ code: r.code, description: r.description, quote_price: r.quote_price ?? '', category: r.category }); setShowModal(true); };
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.description) { toast.error('Code and description are required'); return; }
    setSaving(true);
    const payload = {
      code: form.code.toLowerCase().trim(),
      description: form.description,
      quote_price: form.quote_price === '' ? null : Number(form.quote_price),
      category: form.category,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await adminApi.update('defect_codes', payload, editing.id)
      : await adminApi.insert('defect_codes', { ...payload, sort_order: rows.length + 1 });
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(editing ? 'Updated!' : 'Defect code added!');
    setShowModal(false);
    load();
  };

  const del = async () => {
    if (!delTarget) return;
    const { error } = await adminApi.delete('defect_codes', delTarget.id);
    if (error) toast.error(error);
    else { toast.success('Deleted'); load(); }
    setDelTarget(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3" style={{ borderColor: 'var(--border)' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
        </div>
        <select value={catF} onChange={e => setCatF(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: catF ? 'var(--primary)' : 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}>
          <option value="">Category: All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        {(search || catF) && (
          <button onClick={() => { setSearch(''); setCatF(''); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold"
            style={{ color: 'var(--error)', background: '#fef2f2' }}>
            <X size={13} /> Clear
          </button>
        )}
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
          <Plus size={14} /> Add Code
        </button>
      </div>

      {/* Groups */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{cat}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--primary)', color: '#fff' }}>{items.length}</span>
            </div>
            <table className="w-full">
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    style={{ borderColor: 'var(--border)', animationDelay: `${i * 10}ms` }}>
                    <td className="px-5 py-3 w-24">
                      <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: '#f0f4ff', color: 'var(--primary)' }}>{r.code}</span>
                    </td>
                    <td className="px-3 py-3 text-sm" style={{ color: 'var(--text)' }}>{r.description}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-semibold" style={{ color: r.quote_price ? '#16a34a' : 'var(--text-tertiary)' }}>
                        {r.quote_price ? `$${Number(r.quote_price).toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-20">
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
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md animate-scale-in" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>{editing ? 'Edit Defect Code' : 'Add Defect Code'}</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><X size={16} /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Code *</label>
                  <input value={form.code} onChange={e => f('code', e.target.value)} placeholder="e.g. bg"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none font-mono"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Quote Price ($)</label>
                  <input type="number" value={form.quote_price} onChange={e => f('quote_price', e.target.value)} placeholder="Optional"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Description *</label>
                <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Category</label>
                <select value={form.category} onChange={e => f('category', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delTarget && (
        <ConfirmDialog
          title="Delete Defect Code?"
          message={`Delete code "${delTarget.code}" — ${delTarget.description.slice(0, 60)}…? This cannot be undone.`}
          onConfirm={del}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </div>
  );
}
