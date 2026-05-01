'use client';
import { useState, useEffect } from 'react';
import { adminApi, adminRead } from '@/lib/admin-api';
import { X, Plus, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  SERVICE_CATEGORIES,
  ROUTINE_FREQUENCIES,
  getJobTypeLabel,
  type ServiceCategory,
} from '@/constants/jobTypes';

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent',  dot: '#ef4444' },
  { value: 'high',   label: 'High',    dot: '#f97316' },
  { value: 'normal', label: 'Normal',  dot: '#3b82f6' },
  { value: 'low',    label: 'Low',     dot: '#94a3b8' },
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
  initialPropertyId?: string;
  initialJobType?: string;
  assetsToRepair?: string[];
}

export default function CreateJobModal({
  onClose, onCreated, initialPropertyId, initialJobType, assetsToRepair,
}: Props) {
  const [properties, setProperties] = useState<any[]>([]);
  const [users, setUsers]           = useState<any[]>([]);
  const [creating, setCreating]     = useState(false);
  const [pickerStep, setPickerStep] = useState<'category' | 'frequency'>('category');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [selectedJobType, setSelectedJobType]   = useState<string>(initialJobType || '');

  const [form, setForm] = useState({
    property_id:    initialPropertyId || '',
    assigned_to:    '',
    priority:       'normal',
    scheduled_date: '',
    scheduled_time: '',
    notes: assetsToRepair ? `Repair job for ${assetsToRepair.length} asset(s).` : '',
  });

  useEffect(() => {
    Promise.all([
      adminRead<any>('properties', { select: 'id,name,suburb', order: { column: 'name' } }),
      adminRead<any>('users', { select: 'id,full_name', filters: { is_active: true }, order: { column: 'full_name' } }),
    ]).then(([{ data: p }, { data: u }]) => {
      setProperties(p ?? []);
      setUsers(u ?? []);
    });
  }, []);

  useEffect(() => {
    if (!initialJobType) return;
    const cat = SERVICE_CATEGORIES.find(c => initialJobType.startsWith(c.value));
    if (cat) { setSelectedCategory(cat); setSelectedJobType(initialJobType); }
  }, [initialJobType]);

  const handleCategoryClick = (cat: ServiceCategory) => {
    setSelectedCategory(cat);
    if (cat.frequencies) {
      setPickerStep('frequency');
      setSelectedJobType('');
    } else {
      setSelectedJobType(cat.value);
    }
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.assigned_to || !form.scheduled_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!selectedJobType) {
      toast.error('Please select a service type');
      return;
    }
    setCreating(true);
    try {
      const { error, data: newJob } = await adminApi.insert<any[]>('jobs', {
        ...form, job_type: selectedJobType, status: 'scheduled',
      });
      if (error) throw new Error(error);
      if (assetsToRepair?.length && Array.isArray(newJob) && newJob[0]?.id) {
        await adminApi.update('jobs', {
          notes: `${form.notes}\n\nRepair assets: ${assetsToRepair.join(', ')}`,
        }, newJob[0].id);
      }
      toast.success('Job created!');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-scale-in"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>New Job</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Schedule a work order</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={createJob} className="p-6 space-y-5">

            {/* Property + Technician */}
            {[
              { label: 'Property', field: 'property_id', opts: properties.map(p => ({ value: p.id, label: `${p.name}${p.suburb ? ` — ${p.suburb}` : ''}` })), disabled: !!initialPropertyId },
              { label: 'Assigned Technician', field: 'assigned_to', opts: users.map(u => ({ value: u.id, label: u.full_name })), disabled: false },
            ].map(({ label, field, opts, disabled }) => (
              <div key={field}>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  {label} <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  value={(form as any)[field]}
                  onChange={e => f(field, e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)', background: disabled ? '#f8fafc' : '#fff' }}
                  onFocus={e => { e.target.style.borderColor = '#1B2D4F'; }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                >
                  <option value="">Select {label}…</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}

            {/* ── Service Type Picker ── */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                Service Type <span style={{ color: 'var(--error)' }}>*</span>
              </label>

              {/* Breadcrumb back button */}
              {pickerStep === 'frequency' && (
                <button
                  type="button"
                  onClick={() => { setPickerStep('category'); setSelectedJobType(''); }}
                  className="flex items-center gap-1.5 text-xs font-semibold mb-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors -ml-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  ← Back to categories
                </button>
              )}

              {/* Step 1 — Category list */}
              {pickerStep === 'category' && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {SERVICE_CATEGORIES.map((cat, i) => {
                    const isSelected = selectedCategory?.value === cat.value && !cat.frequencies;
                    const isLast = i === SERVICE_CATEGORIES.length - 1;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => handleCategoryClick(cat)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        style={{
                          borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          background: isSelected ? '#f0f4ff' : undefined,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Selection indicator */}
                          <div
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: isSelected ? '#1B2D4F' : 'var(--border)',
                              background: isSelected ? '#1B2D4F' : 'transparent',
                            }}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: isSelected ? '#1B2D4F' : 'var(--text)' }}>
                              {cat.label}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{cat.description}</p>
                          </div>
                        </div>
                        {cat.frequencies && (
                          <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2 — Frequency sub-select (Routine Service only) */}
              {pickerStep === 'frequency' && selectedCategory?.frequencies && (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Routine Service — select frequency:
                  </p>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {ROUTINE_FREQUENCIES.map((freq, i) => {
                      const isSelected = selectedJobType === freq.value;
                      const isLast = i === ROUTINE_FREQUENCIES.length - 1;
                      return (
                        <button
                          key={freq.value}
                          type="button"
                          onClick={() => setSelectedJobType(freq.value)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                          style={{
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                            background: isSelected ? '#f0f4ff' : undefined,
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: isSelected ? '#1B2D4F' : 'var(--border)',
                              background: isSelected ? '#1B2D4F' : 'transparent',
                            }}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="flex items-center justify-between flex-1">
                            <p className="text-sm font-semibold" style={{ color: isSelected ? '#1B2D4F' : 'var(--text)' }}>
                              {freq.label}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-md font-mono"
                              style={{ background: '#f1f5f9', color: 'var(--text-secondary)' }}>
                              every {freq.months === 60 ? '5 yrs' : freq.months === 12 ? '12 mo' : `${freq.months} mo`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected summary pill */}
              {selectedJobType && (
                <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: '#f0f4ff', border: '1px solid #c7d7fd' }}>
                  <p className="text-xs font-semibold" style={{ color: '#1B2D4F' }}>
                    ✓ {getJobTypeLabel(selectedJobType)}
                  </p>
                  <button type="button"
                    onClick={() => { setSelectedJobType(''); setPickerStep('category'); setSelectedCategory(null); }}
                    className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => {
                  const active = form.priority === p.value;
                  return (
                    <button key={p.value} type="button" onClick={() => f('priority', p.value)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all"
                      style={{
                        borderColor: active ? '#1B2D4F' : 'var(--border)',
                        background: active ? '#f0f4ff' : '#fafafa',
                        color: active ? '#1B2D4F' : 'var(--text-secondary)',
                      }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.dot }} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Date', type: 'date', field: 'scheduled_date', req: true },
                { label: 'Time', type: 'time', field: 'scheduled_time', req: false },
              ].map(({ label, type, field, req }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    {label}{req && <span style={{ color: 'var(--error)' }}> *</span>}
                  </label>
                  <input type={type} value={(form as any)[field]} onChange={e => f(field, e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#fff' }}
                    onFocus={e => { e.target.style.borderColor = '#1B2D4F'; }}
                    onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }} />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Notes</label>
              <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2}
                placeholder="Special instructions or site notes…"
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#fff' }}
                onFocus={e => { e.target.style.borderColor = '#1B2D4F'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button type="submit" disabled={creating || !selectedJobType}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.25)' }}>
                {creating
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
                  : <><Plus size={14} />Create Job</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
