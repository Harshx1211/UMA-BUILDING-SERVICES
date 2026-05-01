'use client';
import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Building2, Users, Boxes, Bell, Shield, Palette, Database, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const COMPANY = {
  name: 'SiteTrack Services Pty Ltd',
  abn: '51 602 019 081',
  email: 'info@sitetrack.com.au',
  phone: '1300 748 387',
  website: 'www.sitetrack.com.au',
  address: 'P.O. Box 357',
  suburb: 'Lidcombe',
  state: 'NSW',
  postcode: '1825',
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
  const [company, setCompany] = useState(COMPANY);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    toast.success('Settings saved!');
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Configure your SiteTrack admin portal" />
      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-all border-b last:border-0"
                style={{ borderColor: 'var(--border)', background: section === s.id ? '#fff4ed' : 'transparent', color: section === s.id ? 'var(--accent)' : 'var(--text-secondary)', borderLeft: section === s.id ? '3px solid var(--accent)' : '3px solid transparent' }}>
                <s.icon size={16} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {section === 'company' && (
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Company Information</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>This information appears on generated PDF reports and client communications.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Company Name', field: 'name' },
                  { label: 'ABN', field: 'abn' },
                  { label: 'Email', field: 'email' },
                  { label: 'Phone', field: 'phone' },
                  { label: 'Website', field: 'website' },
                  { label: 'Address', field: 'address' },
                  { label: 'Suburb', field: 'suburb' },
                  { label: 'State', field: 'state' },
                  { label: 'Postcode', field: 'postcode' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
                    <input value={company[f.field as keyof typeof company]} onChange={e => setCompany(c => ({ ...c, [f.field]: e.target.value }))}
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
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Notification Settings</p>
              <div className="space-y-4">
                {[
                  { label: 'New job assigned', sub: 'Notify technician when a job is assigned to them', enabled: true },
                  { label: 'Critical defect raised', sub: 'Alert admin when a critical defect is logged', enabled: true },
                  { label: 'Quote submitted', sub: 'Notify admin when a quote is ready for approval', enabled: true },
                  { label: 'Job completed', sub: 'Notify admin when a job is marked complete', enabled: false },
                  { label: 'Overdue service reminder', sub: 'Alert admin when assets pass their service date', enabled: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.sub}</p>
                    </div>
                    <button className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
                      style={{ background: item.enabled ? 'var(--primary)' : '#cbd5e1' }}>
                      <span className="absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow-sm"
                        style={{ left: item.enabled ? '22px' : '4px' }} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={save} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
                {saved ? <><Check size={15} />Saved!</> : 'Save Settings'}
              </button>
            </div>
          )}

          {section === 'compliance' && (
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Compliance Standards</p>
              <div className="space-y-4">
                {[
                  { label: 'AS1851 – Fire Protection Systems', sub: 'Routine service standard for fire protection equipment', active: true },
                  { label: 'AS2293 – Emergency Lighting', sub: 'Testing and maintenance of emergency lighting', active: true },
                  { label: 'AS1670 – Fire Detection & Alarm', sub: 'Detection and alarm system maintenance', active: false },
                  { label: 'BCA / NCC Essential Services', sub: 'Building Code of Australia compliance tracking', active: true },
                ].map((std, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: std.active ? '#f0fdf4' : '#fafafa' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: std.active ? '#22c55e' : '#cbd5e1' }}>
                      {std.active && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{std.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{std.sub}</p>
                    </div>
                    <span className="ml-auto flex-shrink-0 chip" style={{ background: std.active ? '#dcfce7' : '#f1f5f9', color: std.active ? '#16a34a' : '#64748b' }}>
                      {std.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-5" style={{ color: 'var(--text)' }}>Appearance</p>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Theme</p>
                  <div className="flex gap-3">
                    {[
                      { label: 'Light', colors: ['#F0F4F8', '#1B2D4F', '#F97316'] },
                      { label: 'Dark (coming soon)', colors: ['#0F172A', '#334155', '#F97316'] },
                    ].map(t => (
                      <div key={t.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer" style={{ borderColor: t.label === 'Light' ? 'var(--accent)' : 'var(--border)', background: t.label === 'Light' ? '#fff4ed' : '#fafafa' }}>
                        <div className="flex gap-1">
                          {t.colors.map((c, i) => <span key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.label}</span>
                        {t.label === 'Light' && <Check size={14} style={{ color: 'var(--accent)' }} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Primary Colour</p>
                  <div className="flex gap-2">
                    {['#1B2D4F', '#1e3a5f', '#0f4c81', '#1e40af'].map(c => (
                      <button key={c} className="w-8 h-8 rounded-lg border-2 transition-all"
                        style={{ background: c, borderColor: c === '#1B2D4F' ? 'var(--accent)' : 'transparent' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'database' && (
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold text-lg mb-2" style={{ color: 'var(--text)' }}>Data & Storage</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Powered by Supabase — PostgreSQL database with row-level security.</p>
              <div className="space-y-3">
                {[
                  { label: 'Database', value: 'Supabase PostgreSQL (vnrmgcxmcspdgqcnmmdx)', status: 'Connected' },
                  { label: 'File Storage', value: 'Supabase Storage — job-photos bucket', status: 'Connected' },
                  { label: 'Auth Provider', value: 'Supabase Auth — Email/Password', status: 'Active' },
                  { label: 'Real-time', value: 'Supabase Realtime subscriptions', status: 'Enabled' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: '#fafafa' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{r.label}</p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{r.value}</p>
                    </div>
                    <span className="chip" style={{ background: '#f0fdf4', color: '#16a34a' }}>{r.status}</span>
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
