'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import {
  ArrowLeft, Building2, MapPin, Phone, ShieldAlert, Briefcase,
  Boxes, FileText, Edit3, Check, X, AlertTriangle, Calendar,
  QrCode, ExternalLink, RefreshCw, ChevronRight, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

const COMPLIANCE_OPTS = ['compliant','non_compliant','overdue','pending'];
const today = new Date().toISOString().split('T')[0];

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<any>(null);
  const [assets, setAssets]     = useState<any[]>([]);
  const [jobs, setJobs]         = useState<any[]>([]);
  const [defects, setDefects]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('overview');
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState<any>({});

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: a }, { data: j }, { data: d }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).single(),
      supabase.from('assets').select('*').eq('property_id', id).order('asset_type'),
      supabase.from('jobs').select('*, assigned_user:users(full_name)').eq('property_id', id).order('scheduled_date', { ascending: false }).limit(30),
      supabase.from('defects').select('*, asset:assets(asset_type,location_on_site)').eq('property_id', id).order('created_at', { ascending: false }),
    ]);
    setProperty(p); setForm(p ?? {}); setAssets(a ?? []); setJobs(j ?? []); setDefects(d ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await adminApi.update('properties', {
      name: form.name, address: form.address, suburb: form.suburb,
      state: form.state, postcode: form.postcode,
      site_contact_name: form.site_contact_name, site_contact_phone: form.site_contact_phone,
      access_notes: form.access_notes, hazard_notes: form.hazard_notes,
      compliance_status: form.compliance_status, next_inspection_date: form.next_inspection_date || null,
    }, id);
    setSaving(false);
    if (error) toast.error(error);
    else { toast.success('Property updated!'); setProperty(form); setEditing(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  );
  if (!property) return <p className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>Property not found.</p>;

  const isOverdue = property.next_inspection_date && property.next_inspection_date < today;
  const openDefects   = defects.filter(d => d.status === 'open' || d.status === 'quoted');
  const completedJobs = jobs.filter(j => j.status === 'completed').length;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'assets',   label: `Assets (${assets.length})`, icon: Boxes },
    { id: 'jobs',     label: `Jobs (${jobs.length})`, icon: Briefcase },
    { id: 'defects',  label: `Defects (${defects.length})`, icon: ShieldAlert },
  ];

  const F = ({ label, field, multiline = false, type = 'text' }: { label: string; field: string; multiline?: boolean; type?: string }) => (
    <div>
      <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      {editing ? (
        multiline
          ? <textarea rows={2} value={form[field] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
          : <input type={type} value={form[field] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [field]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
      ) : <p className="text-sm" style={{ color: form[field] ? 'var(--text)' : 'var(--text-tertiary)' }}>{form[field] || '—'}</p>}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-4 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
          <ArrowLeft size={14} /> Properties
        </button>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text)' }} className="font-medium truncate">{property.name}</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg,#1B2D4F 0%,#243a65 100%)', boxShadow: '0 8px 32px rgba(27,45,79,0.35)' }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #F97316 0%, transparent 60%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.2)' }}>
              <Building2 size={26} style={{ color: '#F97316' }} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white" style={{ letterSpacing: '-0.03em' }}>{property.name}</h1>
              {(property.address || property.suburb) && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {[property.address, property.suburb, property.state, property.postcode].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {property.site_contact_name && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {property.site_contact_name}{property.site_contact_phone ? ` · ${property.site_contact_phone}` : ''}
                  </p>
                </div>
              )}
              <div className="mt-3"><Badge value={property.compliance_status} /></div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={load} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <RefreshCw size={14} className="text-white" />
            </button>
            <button
              onClick={() => setTab('jobs')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: '#F97316', color: '#fff', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
              <FileText size={14} /> View Jobs &amp; Reports
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Total Assets', value: assets.length, color: 'rgba(255,255,255,0.9)' },
            { label: 'Next Inspection', value: property.next_inspection_date ? formatDate(property.next_inspection_date) : 'Not Set', color: isOverdue ? '#fca5a5' : 'rgba(255,255,255,0.9)' },
            { label: 'Open Defects', value: openDefects.length, color: openDefects.length > 0 ? '#fcd34d' : 'rgba(255,255,255,0.9)' },
            { label: 'Jobs Completed', value: completedJobs, color: '#86efac' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl border bg-white w-fit overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={tab === t.id ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-secondary)' }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="font-bold" style={{ color: 'var(--text)' }}>Site Details</p>
              <div className="flex gap-2">
                {editing && (
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold text-white disabled:opacity-60"
                    style={{ background: 'var(--primary)' }}>
                    {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={11} />} Save
                  </button>
                )}
                <button onClick={() => { setEditing(!editing); setForm(property); }}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                  {editing ? <><X size={11} />Cancel</> : <><Edit3 size={11} />Edit</>}
                </button>
              </div>
            </div>
            <F label="Property Name" field="name" />
            <F label="Street Address" field="address" />
            <div className="grid grid-cols-3 gap-3">
              <F label="Suburb" field="suburb" />
              <F label="State" field="state" />
              <F label="Postcode" field="postcode" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Compliance Status</p>
                {editing
                  ? <select value={form.compliance_status ?? 'pending'} onChange={e => setForm((f: any) => ({ ...f, compliance_status: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                      {COMPLIANCE_OPTS.map(v => <option key={v} value={v}>{v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                    </select>
                  : <Badge value={property.compliance_status} />}
              </div>
              <F label="Next Inspection Date" field="next_inspection_date" type="date" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold" style={{ color: 'var(--text)' }}>Contact</p>
              <F label="Site Contact Name" field="site_contact_name" />
              <F label="Site Contact Phone" field="site_contact_phone" />
            </div>
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
              <p className="font-bold" style={{ color: 'var(--text)' }}>Site Notes</p>
              <F label="Access Notes" field="access_notes" multiline />
              <F label="Hazard Notes" field="hazard_notes" multiline />
            </div>
          </div>
        </div>
      )}

      {/* ASSETS */}
      {tab === 'assets' && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {assets.length === 0
            ? <div className="flex flex-col items-center py-16"><Boxes size={24} style={{ color: 'var(--text-tertiary)' }} /><p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>No assets registered</p></div>
            : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                      {['Ref','Type','Variant','Location','Serial #','Install','Last Service','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a, i) => {
                      return (
                        <tr key={a.id} className="border-b last:border-0 transition-colors"
                          style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{a.asset_ref ?? '—'}</td>
                          <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--text)' }}>{a.asset_type}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{a.variant ?? '—'}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{a.location_on_site ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.serial_number ?? '—'}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(a.install_date)}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(a.last_service_date)}</td>
                          <td className="px-4 py-3"><Badge value={a.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* JOBS */}
      {tab === 'jobs' && (
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {jobs.length === 0
            ? <div className="flex flex-col items-center py-16"><Briefcase size={24} style={{ color: 'var(--text-tertiary)' }} /><p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>No jobs yet</p></div>
            : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                      {['Date','Time','Type','Technician','Priority','Status','Report',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j => (
                      <tr key={j.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group"
                        style={{ borderColor: 'var(--border)' }}
                        onClick={() => window.location.href = `/jobs/${j.id}`}>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text)' }}>{formatDate(j.scheduled_date)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{j.scheduled_time ?? '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{j.job_type.replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase())}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text)' }}>{j.assigned_user?.full_name ?? '—'}</td>
                        <td className="px-4 py-3"><Badge value={j.priority} /></td>
                        <td className="px-4 py-3"><Badge value={j.status} /></td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {j.report_url ? (
                            <a
                              href={j.report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                              style={{ background: 'linear-gradient(135deg,#F97316,#ea580c)' }}
                            >
                              <Download size={11} /> View PDF
                            </a>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><ExternalLink size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* DEFECTS */}
      {tab === 'defects' && (
        <div className="space-y-3">
          {defects.length === 0
            ? <div className="bg-white rounded-2xl border p-16 text-center" style={{ borderColor: 'var(--border)' }}>
                <ShieldAlert size={24} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                <p className="font-semibold" style={{ color: 'var(--text)' }}>No defects recorded</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>All clear 🎉</p>
              </div>
            : defects.map(d => {
                const sevColor: Record<string,string> = { critical:'#ef4444', major:'#f97316', minor:'#f59e0b' };
                const c = sevColor[d.severity] ?? '#94a3b8';
                const photos: string[] = Array.isArray(d.photos) ? d.photos : [];
                return (
                  <div key={d.id} className="bg-white rounded-2xl border overflow-hidden"
                    style={{ borderColor: 'var(--border)', borderLeft: `4px solid ${c}` }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{d.description}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {d.asset?.asset_type ?? '—'}{d.asset?.location_on_site ? ` · ${d.asset.location_on_site}` : ''} · {formatDate(d.created_at)}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0"><Badge value={d.severity} /><Badge value={d.status} /></div>
                      </div>
                      {photos.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {photos.slice(0, 5).map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer"
                              className="w-14 h-14 rounded-xl overflow-hidden border flex-shrink-0"
                              style={{ borderColor: 'var(--border)' }}>
                              <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                          {photos.length > 5 && <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>+{photos.length-5}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}
