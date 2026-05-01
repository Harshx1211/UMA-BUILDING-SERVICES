'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi, adminRead } from '@/lib/admin-api';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Search, Plus, X, Building2, MapPin, Phone, ArrowUpRight, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const COMPLIANCE = ['', 'compliant', 'non_compliant', 'overdue', 'pending'];
const STATES = ['', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [complianceF, setComplianceF] = useState('');
  const [stateF, setStateF] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', suburb: '', state: 'NSW', postcode: '', site_contact_name: '', site_contact_phone: '', access_notes: '', hazard_notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Compliance summary
  const [summary, setSummary] = useState({ compliant: 0, non_compliant: 0, overdue: 0, pending: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count } = await adminRead<any>('properties', {
      select: '*',
      count: true,
      filters: {
        ...(complianceF ? { compliance_status: complianceF } : {}),
        ...(stateF ? { state: stateF } : {}),
      },
      ...(search ? { ilike: { column: 'name', pattern: `%${search}%` } } : {}),
      order: { column: 'name', ascending: true },
    });
    setProperties(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [complianceF, stateF, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadSummary() {
      const [c, nc, o, p] = await Promise.all([
        adminRead('properties', { count: true, limit: 0, filters: { compliance_status: 'compliant' } }),
        adminRead('properties', { count: true, limit: 0, filters: { compliance_status: 'non_compliant' } }),
        adminRead('properties', { count: true, limit: 0, filters: { compliance_status: 'overdue' } }),
        adminRead('properties', { count: true, limit: 0, filters: { compliance_status: 'pending' } }),
      ]);
      setSummary({ compliant: c.count ?? 0, non_compliant: nc.count ?? 0, overdue: o.count ?? 0, pending: p.count ?? 0 });
    }
    loadSummary();
  }, []);

  const createProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Property name is required'); return; }
    setCreating(true);
    const { error } = await adminApi.insert('properties', { ...form, compliance_status: 'pending' });
    setCreating(false);
    if (error) toast.error(error);
    else { toast.success('Property created!'); setShowCreate(false); setForm({ name: '', address: '', suburb: '', state: 'NSW', postcode: '', site_contact_name: '', site_contact_phone: '', access_notes: '', hazard_notes: '' }); load(); }
  };

  const deleteProperty = async () => {
    if (!deleteTarget) return;
    const { error } = await adminApi.delete('properties', deleteTarget.id);
    if (error) toast.error(error);
    else { toast.success('Property deleted'); load(); }
    setDeleteTarget(null);
  };

  const SUMMARY_ITEMS = [
    { label: 'Compliant',     value: summary.compliant,     color: '#22c55e', bg: '#f0fdf4', status: 'compliant' },
    { label: 'Non-Compliant', value: summary.non_compliant, color: '#ef4444', bg: '#fef2f2', status: 'non_compliant' },
    { label: 'Overdue',       value: summary.overdue,       color: '#f97316', bg: '#fff7ed', status: 'overdue' },
    { label: 'Pending',       value: summary.pending,       color: '#94a3b8', bg: '#f8fafc', status: 'pending' },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Properties"
        subtitle={`${total} sites in register`}
        action={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg active:scale-95"
            style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.3)' }}>
            <Plus size={15} strokeWidth={2.5} /> Add Property
          </button>
        }
      />

      {/* Compliance Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SUMMARY_ITEMS.map((s, i) => (
          <button key={s.label} onClick={() => setComplianceF(complianceF === s.status ? '' : s.status)}
            className="bg-white rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98] animate-fade-in-up"
            style={{ borderColor: complianceF === s.status ? s.color : 'var(--border)', animationDelay: `${i * 50}ms`, boxShadow: complianceF === s.status ? `0 0 0 2px ${s.color}` : '0 1px 4px rgba(0,0,0,0.04)', background: complianceF === s.status ? s.bg : '#fff' }}>
            <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            {total > 0 && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3 items-center" style={{ borderColor: 'var(--border)' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
            onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }} />
        </div>
        <select value={stateF} onChange={e => setStateF(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}>
          {STATES.map(s => <option key={s} value={s}>{s || 'State: All'}</option>)}
        </select>
        {(search || complianceF || stateF) && (
          <button onClick={() => { setSearch(''); setComplianceF(''); setStateF(''); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold"
            style={{ color: 'var(--error)', background: '#fef2f2' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Properties Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border h-40 animate-shimmer" style={{ borderColor: 'var(--border)' }} />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-2xl border flex flex-col items-center justify-center py-16" style={{ borderColor: 'var(--border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg)' }}>
            <Building2 size={24} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>No properties found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Add your first property to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p, i) => (
            <Link key={p.id} href={`/properties/${p.id}`}
              className="group bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all animate-fade-in-up"
              style={{ borderColor: 'var(--border)', animationDelay: `${i * 30}ms` }}>
              {/* Top accent based on compliance */}
              <div className="h-1 w-full"
                style={{ background: p.compliance_status === 'compliant' ? '#22c55e' : p.compliance_status === 'overdue' ? '#f97316' : p.compliance_status === 'non_compliant' ? '#ef4444' : '#cbd5e1' }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f0f4ff' }}>
                      <Building2 size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>{p.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {[p.suburb, p.state].filter(Boolean).join(', ') || 'Location not set'}
                      </p>
                    </div>
                  </div>
                  <Badge value={p.compliance_status} />
                </div>

                {p.address && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin size={11} style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{p.address}</p>
                  </div>
                )}
                {p.site_contact_name && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Phone size={11} style={{ color: 'var(--text-tertiary)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.site_contact_name}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
                    <div className="flex items-center gap-1">
                      <ShieldCheck size={11} />
                      <span className="text-xs">{p.compliance_status?.replace(/_/g, ' ') ?? 'Unknown'}</span>
                    </div>
                    {p.next_inspection_date && (
                      <div className="flex items-center gap-1" title="Next Inspection Date">
                        <Calendar size={11} />
                        <span className="text-xs">{new Date(p.next_inspection_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={e => { e.preventDefault(); setDeleteTarget(p); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete property">
                      <Trash2 size={13} style={{ color: '#ef4444' }} />
                    </button>
                    <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>Add New Property</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Register a new site in the system</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <form onSubmit={createProperty} className="p-6 space-y-4">
              {[
                { label: 'Property Name *', field: 'name', placeholder: 'e.g. Westfield Shopping Centre' },
                { label: 'Street Address', field: 'address', placeholder: '123 Main Street' },
                { label: 'Site Contact Name', field: 'site_contact_name', placeholder: 'John Smith' },
                { label: 'Site Contact Phone', field: 'site_contact_phone', placeholder: '04XX XXX XXX' },
              ].map(f => (
                <div key={f.field}>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
                  <input value={(form as any)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }} />
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Suburb', field: 'suburb', placeholder: 'Suburb' },
                  { label: 'Postcode', field: 'postcode', placeholder: '2000' },
                ].map(f => (
                  <div key={f.field} className="col-span-1">
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
                    <input value={(form as any)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                      style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }} />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>State</label>
                  <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}>
                    {STATES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Access Notes</label>
                <textarea value={form.access_notes} onChange={e => setForm(p => ({ ...p, access_notes: e.target.value }))} rows={2}
                  placeholder="Gate codes, parking, building entry instructions…"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none transition-all"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Hazard Notes</label>
                <textarea value={form.hazard_notes} onChange={e => setForm(p => ({ ...p, hazard_notes: e.target.value }))} rows={2}
                  placeholder="Known site hazards, safety requirements…"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none transition-all"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50 transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.3)' }}>
                  {creating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</> : <><Plus size={15} />Add Property</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Property?"
          message={`Permanently delete "${deleteTarget.name}"? This will also remove all associated jobs, assets, and defects. This action cannot be undone.`}
          onConfirm={deleteProperty}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
