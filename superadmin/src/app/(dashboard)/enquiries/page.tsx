'use client';
import { useEffect, useState, useCallback } from 'react';

import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import {
  MessageSquare, Search, X, Mail, Phone, Building2,
  MapPin, ChevronDown, CheckCircle, Clock, ArrowUpRight,
  RefreshCw, ExternalLink, Edit3, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const STATUSES = ['', 'new', 'contacted', 'converted', 'closed'];

const STATUS_LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', converted: 'Converted', closed: 'Closed',
};

const STATUS_ACTIONS: Record<string, { next: string; label: string; color: string; bg: string }[]> = {
  new:       [{ next: 'contacted', label: 'Mark Contacted', color: '#c2410c', bg: 'rgba(249,115,22,0.15)' }],
  contacted: [
    { next: 'converted', label: 'Mark Converted',  color: '#15803d', bg: 'rgba(34,197,94,0.15)' },
    { next: 'closed',    label: 'Mark Closed',     color: '#475569', bg: 'var(--bg)' },
  ],
  converted: [{ next: 'closed', label: 'Close', color: '#475569', bg: 'var(--bg)' }],
  closed:    [],
};

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusF, setStatusF]     = useState('');
  const [selected, setSelected]   = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [updatingId, setUpdatingId]     = useState<string | null>(null);

  /* ── Summary counts ── */
  const [summary, setSummary] = useState({ new: 0, contacted: 0, converted: 0, closed: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/enquiries');
      if (!res.ok) {
        if (res.status === 401) throw new Error('Unauthorized: You do not have superadmin privileges.');
        throw new Error('Failed to fetch enquiries.');
      }
      const json = await res.json();
      let all = json.data || [];
      if (statusF) all = all.filter((e: any) => e.status === statusF);
      if (search) all = all.filter((e: any) => e.name?.toLowerCase().includes(search.toLowerCase()));
      setEnquiries(all);
      setTotal(all.length);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  }, [statusF, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/superadmin/enquiries');
        const json = await res.json();
        const all = json.data || [];
        setSummary({
          new: all.filter((e: any) => e.status === 'new').length,
          contacted: all.filter((e: any) => e.status === 'contacted').length,
          converted: all.filter((e: any) => e.status === 'converted').length,
          closed: all.filter((e: any) => e.status === 'closed').length,
        });
      } catch (e) {}
    }
    loadSummary();
  }, [enquiries]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const res = await fetch(`/api/superadmin/enquiries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    setUpdatingId(null);
    if (!res.ok) { toast.error('Failed to update status'); return; }
    toast.success(`Marked as ${STATUS_LABELS[status]}`);
    if (selected?.id === id) setSelected((p: any) => ({ ...p, status }));
    load();
  };

  const updateNotes = async (id: string, notes: string) => {
    const res = await fetch(`/api/superadmin/enquiries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });
    if (!res.ok) toast.error('Failed to save notes');
    else { toast.success('Notes saved'); if (selected?.id === id) setSelected((p: any) => ({ ...p, notes })); }
  };

  const deleteEnquiry = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/superadmin/enquiries/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) toast.error('Failed to delete enquiry');
    else { toast.success('Enquiry deleted'); if (selected?.id === deleteTarget.id) setSelected(null); load(); }
    setDeleteTarget(null);
  };

  const SUMMARY_ITEMS = [
    { key: 'new',       label: 'New',       color: '#2563eb', bg: 'var(--primary-light)' },
    { key: 'contacted', label: 'Contacted', color: '#c2410c', bg: 'rgba(249,115,22,0.15)' },
    { key: 'converted', label: 'Converted', color: '#15803d', bg: 'rgba(34,197,94,0.15)' },
    { key: 'closed',    label: 'Closed',    color: '#64748b', bg: 'var(--bg)' },
  ];

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Enquiries"
        subtitle={`${total} total enquiry${total !== 1 ? 'ies' : 'y'} from the website`}
        action={
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:shadow-md active:scale-95 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--card)' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SUMMARY_ITEMS.map((s, i) => (
          <button key={s.key}
            onClick={() => setStatusF(statusF === s.key ? '' : s.key)}
            className="bg-[var(--card)] rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98] animate-fade-in-up"
            style={{
              borderColor: statusF === s.key ? s.color : 'var(--border)',
              animationDelay: `${i * 50}ms`,
              boxShadow: statusF === s.key ? `0 0 0 2px ${s.color}` : '0 1px 4px rgba(0,0,0,0.04)',
              background: statusF === s.key ? s.bg : 'var(--card)',
            }}>
            <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>
              {(summary as any)[s.key]}
            </p>
            <p className="text-xs font-semibold mt-1.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            {total > 0 && (
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${((summary as any)[s.key] / (total)) * 100}%`, background: s.color }} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Main layout: list + detail panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 16 }}>

        {/* List */}
        <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--card)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg)'; }} />
            </div>
            <select value={statusF} onChange={e => setStatusF(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
              {STATUSES.map(s => <option key={s} value={s}>{s ? STATUS_LABELS[s] : 'Status: All'}</option>)}
            </select>
            {(search || statusF) && (
              <button onClick={() => { setSearch(''); setStatusF(''); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold"
                style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.15)' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center">
                  <div className="animate-shimmer rounded-xl w-9 h-9 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="animate-shimmer rounded h-3.5 w-2/5" />
                    <div className="animate-shimmer rounded h-3 w-3/5" />
                  </div>
                  <div className="animate-shimmer rounded-full h-6 w-20" />
                </div>
              ))}
            </div>
          ) : enquiries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg)' }}>
                <MessageSquare size={24} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>No enquiries found</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {search || statusF ? 'Try clearing your filters' : 'Enquiries submitted via the website will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {enquiries.map((enq, i) => (
                <div key={enq.id}
                  onClick={() => setSelected(selected?.id === enq.id ? null : enq)}
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors animate-fade-in-up hover:bg-white/5 group"
                  style={{
                    animationDelay: `${i * 25}ms`,
                    background: selected?.id === enq.id ? 'var(--bg)' : undefined,
                    borderLeft: selected?.id === enq.id ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                    {enq.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{enq.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {enq.company ? `${enq.company} · ` : ''}{enq.email}
                    </p>
                    {enq.service_type && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{enq.service_type}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge value={enq.status} />
                    <span className="text-xs hidden lg:block" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(enq.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                    <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="bg-[var(--card)] rounded-2xl border overflow-hidden animate-slide-right sticky top-0"
            style={{ borderColor: 'var(--border)', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>

            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                  {selected.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{selected.name}</p>
                  {selected.company && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{selected.company}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setDeleteTarget(selected); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors" title="Delete enquiry">
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
                <button onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                  <X size={14} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Status + quick actions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Status</p>
                <div className="flex flex-wrap gap-2">
                  <Badge value={selected.status} />
                  {(STATUS_ACTIONS[selected.status] ?? []).map(action => (
                    <button key={action.next}
                      disabled={updatingId === selected.id}
                      onClick={() => updateStatus(selected.id, action.next)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:shadow-sm disabled:opacity-60"
                      style={{ background: action.bg, color: action.color }}>
                      {updatingId === selected.id
                        ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin-ring" />
                        : <CheckCircle size={12} />}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Contact</p>
                <div className="space-y-2">
                  <a href={`mailto:${selected.email}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                    style={{ color: 'var(--text)' }}>
                    <Mail size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-sm">{selected.email}</span>
                    <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-60" style={{ color: 'var(--text-tertiary)' }} />
                  </a>
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                      style={{ color: 'var(--text)' }}>
                      <Phone size={14} style={{ color: 'var(--accent)' }} />
                      <span className="text-sm">{selected.phone}</span>
                      <ExternalLink size={11} className="ml-auto opacity-0 group-hover:opacity-60" style={{ color: 'var(--text-tertiary)' }} />
                    </a>
                  )}
                  {selected.company && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ color: 'var(--text)' }}>
                      <Building2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-sm">{selected.company}</span>
                    </div>
                  )}
                  {selected.property_address && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ color: 'var(--text)' }}>
                      <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="text-sm">{selected.property_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service */}
              {selected.service_type && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Service Requested</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(249,115,22,0.10)', color: 'var(--accent-dark, #ea6900)' }}>
                    <Clock size={11} /> {selected.service_type}
                  </span>
                </div>
              )}

              {/* Message */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Message</p>
                <div className="p-3.5 rounded-xl text-sm leading-relaxed" style={{ background: 'var(--bg)', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                  {selected.message}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  <Edit3 size={11} /> Internal Notes
                </p>
                <NotesEditor
                  key={selected.id}
                  initialValue={selected.notes ?? ''}
                  onSave={(notes) => updateNotes(selected.id, notes)}
                />
              </div>

              {/* Meta */}
              <div className="pt-2 border-t text-xs space-y-1.5" style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
                <p>Received: {fmtDate(selected.created_at)}</p>
                {selected.updated_at !== selected.created_at && (
                  <p>Updated: {fmtDate(selected.updated_at)}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Enquiry?"
          message={`Permanently delete the enquiry from "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={deleteEnquiry}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/* ── Inline notes editor ───────────────────────────────────────────── */
function NotesEditor({ initialValue, onSave }: { initialValue: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initialValue);
  const [dirty, setDirty] = useState(false);

  return (
    <div>
      <textarea
        value={val}
        onChange={e => { setVal(e.target.value); setDirty(true); }}
        rows={3}
        placeholder="Add internal notes about this enquiry…"
        className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none transition-all"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--card)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = 'var(--bg)'; }}
      />
      {dirty && (
        <button
          onClick={() => { onSave(val); setDirty(false); }}
          className="mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
          <CheckCircle size={12} /> Save Notes
        </button>
      )}
    </div>
  );
}



