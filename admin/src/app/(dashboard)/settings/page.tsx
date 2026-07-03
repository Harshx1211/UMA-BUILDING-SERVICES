'use client';
import { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Building2, Bell, Shield, Palette, Database, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_COMPANY = {
  name: '',
  abn: '',
  contact_email: '',
  phone: '',
  notification_settings: { new_job: true, critical_defect: true, quote_submitted: true, job_completed: false, overdue_service: true },
  compliance_standards: { as1851: true, as2293: true, as1670: false, bca: true },
  appearance_settings: { theme: 'Light', primary_color: '#1B2D4F' }
};

const SECTIONS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'compliance', label: 'Compliance', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'database', label: 'Data & Storage', icon: Database },
];

export default function SettingsPage() {
  const [section, setSection] = useState('company');
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/company')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setCompany({
            name: json.data.name || '',
            abn: json.data.abn || '',
            contact_email: json.data.contact_email || '',
            phone: json.data.phone || '',
            notification_settings: json.data.notification_settings || DEFAULT_COMPANY.notification_settings,
            compliance_standards: json.data.compliance_standards || DEFAULT_COMPANY.compliance_standards,
            appearance_settings: json.data.appearance_settings || DEFAULT_COMPANY.appearance_settings,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company)
      });
      setSaving(false);
      if (res.ok) {
        setSaved(true);
        toast.success('Company settings saved!');
        setTimeout(() => setSaved(false), 2500);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      setSaving(false);
      toast.error('Network error');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Configure your company portal" />
      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-all border-b last:border-0"
                style={{ borderColor: 'var(--border)', background: section === s.id ? 'rgba(232,101,10,0.15)' : 'transparent', color: section === s.id ? 'var(--accent)' : 'var(--text-secondary)', borderLeft: section === s.id ? '3px solid var(--accent)' : '3px solid transparent' }}>
                <s.icon size={16} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {section === 'company' && (
            <div className="bg-[var(--card)] rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Company Information</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>This information appears on generated PDF reports and client communications.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Company Name', field: 'name' },
                  { label: 'ABN', field: 'abn' },
                  { label: 'Contact Email', field: 'contact_email' },
                  { label: 'Phone', field: 'phone' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
                    <input value={String(company[f.field as keyof typeof company])} onChange={e => setCompany(c => ({ ...c, [f.field]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                      onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  </div>
                ))}
              </div>
              <button onClick={save} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: saved ? '#22c55e' : 'var(--primary)' }}>
                {saved ? <><Check size={15} />Saved!</> : 'Save Changes'}
              </button>
            </div>
          )}

          {section === 'notifications' && (
            <div className="bg-[var(--card)] rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Notification Settings</p>
              <div className="space-y-4">
                {[
                  { key: 'new_job', label: 'New job assigned', sub: 'Notify technician when a job is assigned to them' },
                  { key: 'critical_defect', label: 'Critical defect raised', sub: 'Alert admin when a critical defect is logged' },
                  { key: 'quote_submitted', label: 'Quote submitted', sub: 'Notify admin when a quote is ready for approval' },
                  { key: 'job_completed', label: 'Job completed', sub: 'Notify admin when a job is marked complete' },
                  { key: 'overdue_service', label: 'Overdue service reminder', sub: 'Alert admin when assets pass their service date' },
                ].map((item, i) => {
                  const isEnabled = company.notification_settings[item.key as keyof typeof company.notification_settings];
                  return (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.sub}</p>
                    </div>
                    <button 
                      className={`toggle ${isEnabled ? 'on' : ''}`} 
                      onClick={() => setCompany(c => ({ ...c, notification_settings: { ...c.notification_settings, [item.key]: !isEnabled } }))}
                    />
                  </div>
                )})}
              </div>
              <button onClick={save} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
                {saved ? <><Check size={15} />Saved!</> : 'Save Settings'}
              </button>
            </div>
          )}

          {section === 'compliance' && (
            <div className="bg-[var(--card)] rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Compliance Standards</p>
              <div className="space-y-4">
                {[
                  { key: 'as1851', label: 'AS1851 – Fire Protection Systems', sub: 'Routine service standard for fire protection equipment' },
                  { key: 'as2293', label: 'AS2293 – Emergency Lighting', sub: 'Testing and maintenance of emergency lighting' },
                  { key: 'as1670', label: 'AS1670 – Fire Detection & Alarm', sub: 'Detection and alarm system maintenance' },
                  { key: 'bca', label: 'BCA / NCC Essential Services', sub: 'Building Code of Australia compliance tracking' },
                ].map((std, i) => {
                  const active = company.compliance_standards[std.key as keyof typeof company.compliance_standards];
                  return (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors" 
                    style={{ borderColor: 'var(--border)', background: active ? 'rgba(34,197,94,0.15)' : 'var(--bg)' }}
                    onClick={() => setCompany(c => ({ ...c, compliance_standards: { ...c.compliance_standards, [std.key]: !active } }))}
                  >
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: active ? '#22c55e' : '#cbd5e1' }}>
                      {active && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{std.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{std.sub}</p>
                    </div>
                    <span className="ml-auto flex-shrink-0 chip" style={{ background: active ? 'rgba(22,163,74,0.2)' : 'var(--bg)', color: active ? '#4ade80' : 'var(--text-secondary)' }}>
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )})}
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="bg-[var(--card)] rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Appearance</p>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Theme</p>
                  <div className="flex gap-3">
                    {[
                      { label: 'Light', colors: ['#F0F4F8', '#1B2D4F', 'var(--accent)'] },
                      { label: 'Dark (coming soon)', colors: ['#0F172A', '#334155', 'var(--accent)'] },
                    ].map(t => (
                      <div key={t.label} 
                        onClick={() => { if (t.label === 'Light') setCompany(c => ({ ...c, appearance_settings: { ...c.appearance_settings, theme: 'Light' } })) }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors" 
                        style={{ borderColor: company.appearance_settings.theme === t.label ? 'var(--accent)' : 'var(--border)', background: company.appearance_settings.theme === t.label ? 'rgba(232,101,10,0.15)' : 'var(--bg)' }}>
                        <div className="flex gap-1">
                          {t.colors.map((c, i) => <span key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.label}</span>
                        {company.appearance_settings.theme === t.label && <Check size={14} style={{ color: 'var(--accent)' }} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Primary Colour</p>
                  <div className="flex gap-2">
                    {['#1B2D4F', '#1e3a5f', '#0f4c81', '#1e40af'].map(c => (
                      <button key={c} 
                        onClick={() => setCompany(comp => ({ ...comp, appearance_settings: { ...comp.appearance_settings, primary_color: c } }))}
                        className="w-8 h-8 rounded-lg border-2 transition-all flex items-center justify-center"
                        style={{ background: c, borderColor: company.appearance_settings.primary_color === c ? 'var(--accent)' : 'transparent' }}>
                          {company.appearance_settings.primary_color === c && <Check size={14} color="white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={save} disabled={saving} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--primary)' }}>
                {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : saved ? <><Check size={15} />Saved!</> : 'Save Settings'}
              </button>
            </div>
          )}

          {section === 'database' && (
            <div className="bg-[var(--card)] rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Data & Storage</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Powered by Supabase — PostgreSQL database with row-level security.</p>
              <div className="space-y-3">
                {[
                  { label: 'Database', value: 'Supabase PostgreSQL (vnrmgcxmcspdgqcnmmdx)', status: 'Connected' },
                  { label: 'File Storage', value: 'Supabase Storage — job-photos bucket', status: 'Connected' },
                  { label: 'Auth Provider', value: 'Supabase Auth — Email/Password', status: 'Active' },
                  { label: 'Real-time', value: 'Supabase Realtime subscriptions', status: 'Enabled' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.label}</p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{r.value}</p>
                    </div>
                    <span className="chip" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



