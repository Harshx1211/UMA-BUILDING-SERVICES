'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { X, Plus, Trash2, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; onCreated: () => void; }

type Step = 'job' | 'items';

interface LineItem { inventoryItemId: string; defectId: string | null; quantity: number; unitPrice: number; name: string; }

export default function CreateQuoteModal({ onClose, onCreated }: Props) {
  const [step, setStep]             = useState<Step>('job');
  const [jobs, setJobs]             = useState<any[]>([]);
  const [defects, setDefects]       = useState<any[]>([]);
  const [inventory, setInventory]   = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [lines, setLines]           = useState<LineItem[]>([]);
  const [saving, setSaving]         = useState(false);
  const [jobSearch, setJobSearch]   = useState('');
  const [showInvPicker, setShowInvPicker] = useState<string | null>(null); // defect id or 'general'

  useEffect(() => {
    supabase.from('jobs')
      .select('*, property:properties(name,suburb), assigned_user:users(full_name)')
      .in('status', ['completed', 'in_progress'])
      .order('scheduled_date', { ascending: false })
      .then(({ data }) => setJobs(data ?? []));
    supabase.from('inventory_items').select('*').order('name')
      .then(({ data }) => setInventory(data ?? []));
  }, []);

  const selectJob = async (job: any) => {
    setSelectedJob(job);
    const { data } = await supabase.from('defects')
      .select('*').eq('job_id', job.id).eq('status', 'open');
    setDefects(data ?? []);
    setStep('items');
  };

  const addLine = (invItem: any, defectId: string | null) => {
    setLines(prev => {
      const existing = prev.find(l => l.inventoryItemId === invItem.id && l.defectId === defectId);
      if (existing) return prev.map(l => l.inventoryItemId === invItem.id && l.defectId === defectId
        ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { inventoryItemId: invItem.id, defectId, quantity: 1, unitPrice: Number(invItem.price), name: invItem.name }];
    });
    setShowInvPicker(null);
  };

  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateQty  = (idx: number, qty: number) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: Math.max(1, qty) } : l));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const save = async () => {
    if (!selectedJob) return;
    if (lines.length === 0) { toast.error('Add at least one line item'); return; }
    setSaving(true);

    const { data: quote, error: qErr } = await adminApi.insert<{ id: string }>('quotes', {
      job_id: selectedJob.id,
      status: 'draft',
      total_amount: total,
      created_at: new Date().toISOString(),
    });
    if (qErr || !quote) { toast.error(qErr ?? 'Failed to create quote'); setSaving(false); return; }

    for (const l of lines) {
      await adminApi.insert('quote_items', {
        quote_id: quote.id,
        inventory_item_id: l.inventoryItemId,
        defect_id: l.defectId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
      });
    }

    toast.success('Quote created!');
    onCreated();
  };

  const filteredJobs = jobs.filter(j => {
    if (!jobSearch) return true;
    const t = jobSearch.toLowerCase();
    return j.property?.name?.toLowerCase().includes(t) || j.assigned_user?.full_name?.toLowerCase().includes(t);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col animate-scale-in"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Create Quote</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {step === 'job' ? 'Step 1 — Select a job' : `Step 2 — Add line items · ${selectedJob?.property?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1 — Job picker */}
          {step === 'job' && (
            <div className="space-y-3">
              <input value={jobSearch} onChange={e => setJobSearch(e.target.value)}
                placeholder="Search property or technician…"
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
              {filteredJobs.length === 0 && (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No completed or in-progress jobs found</p>
              )}
              {filteredJobs.map(j => (
                <button key={j.id} onClick={() => selectJob(j)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left hover:border-blue-300 hover:bg-blue-50 transition-all"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{j.property?.name ?? '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {j.assigned_user?.full_name ?? '—'} · {formatDate(j.scheduled_date)} · <span className="capitalize">{j.status}</span>
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
          )}

          {/* STEP 2 — Line items */}
          {step === 'items' && (
            <div className="space-y-4">
              {/* Defects section */}
              {defects.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Open Defects ({defects.length})
                  </p>
                  {defects.map(d => (
                    <div key={d.id} className="mb-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: '#fff7ed' }}>
                        <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.description}</p>
                        <button onClick={() => setShowInvPicker(d.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
                          style={{ background: 'var(--primary)' }}>
                          <Plus size={11} /> Link item
                        </button>
                      </div>
                      {/* Inventory picker for this defect */}
                      {showInvPicker === d.id && (
                        <div className="mt-1 border rounded-xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                          {inventory.map(inv => (
                            <button key={inv.id} onClick={() => addLine(inv, d.id)}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 border-b last:border-0 transition-colors"
                              style={{ borderColor: 'var(--border)' }}>
                              <span style={{ color: 'var(--text)' }}>{inv.name}</span>
                              <span className="font-semibold" style={{ color: '#16a34a' }}>{formatCurrency(inv.price)}</span>
                            </button>
                          ))}
                          {inventory.length === 0 && (
                            <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>No inventory items — add them in Catalogue first.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* General items (not linked to a defect) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>General Items</p>
                  <button onClick={() => setShowInvPicker(showInvPicker === 'general' ? null : 'general')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: '#f0f4ff', color: 'var(--primary)' }}>
                    <Plus size={11} /> Add item
                  </button>
                </div>
                {showInvPicker === 'general' && (
                  <div className="border rounded-xl overflow-hidden mb-3" style={{ borderColor: 'var(--border)' }}>
                    {inventory.map(inv => (
                      <button key={inv.id} onClick={() => addLine(inv, null)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 border-b last:border-0 transition-colors"
                        style={{ borderColor: 'var(--border)' }}>
                        <span style={{ color: 'var(--text)' }}>{inv.name}</span>
                        <span className="font-semibold" style={{ color: '#16a34a' }}>{formatCurrency(inv.price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Line items list */}
              {lines.length > 0 && (
                <div className="border rounded-2xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Quote Lines</p>
                  </div>
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{l.name}</p>
                        {l.defectId && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {defects.find(d => d.id === l.defectId)?.description?.slice(0, 50)}
                        </p>}
                      </div>
                      <input type="number" min={1} value={l.quantity} onChange={e => updateQty(i, Number(e.target.value))}
                        className="w-14 text-center px-2 py-1.5 rounded-lg border text-sm outline-none"
                        style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                      <span className="text-sm font-semibold w-20 text-right" style={{ color: '#16a34a' }}>
                        {formatCurrency(l.quantity * l.unitPrice)}
                      </span>
                      <button onClick={() => removeLine(i)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50">
                        <Trash2 size={13} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f0f4f8' }}>
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Total (ex-GST)</p>
                    <p className="text-lg font-extrabold" style={{ color: 'var(--primary)' }}>{formatCurrency(total)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'items' && (
          <div className="px-6 pb-6 pt-4 border-t flex gap-3 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setStep('job')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>← Back</button>
            <button onClick={save} disabled={saving || lines.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
              {saving ? 'Creating…' : `Create Quote · ${formatCurrency(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
