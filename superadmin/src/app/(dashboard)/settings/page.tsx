'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import { Save, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/adminFetch';

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    platform_name: '',
    support_email: '',
    website_url: ''
  });

  useEffect(() => {
    adminFetch('/api/platform-settings')
      .then(res => res.json())
      .then(json => {
        if (json.data) setSettings(json.data);
      })
      .catch(() => toast.error('Failed to load platform settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success('Platform Settings saved successfully');
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(`Failed: ${json.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      toast.error(`Error saving settings: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sitetrack-surface-400">Loading...</div>;

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in p-4 sm:p-6 lg:p-8" style={{ background: 'var(--bg)' }}>
      <PageHeader 
        title="Platform Settings"
        subtitle="Manage global SaaS branding and platform configuration."
      />

      <div className="flex flex-col md:flex-row gap-5 max-w-6xl mx-auto">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0">
          <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-all border-b last:border-0"
              style={{ borderColor: 'var(--border)', background: 'rgba(232,101,10,0.15)', color: 'var(--accent)', borderLeft: '3px solid var(--accent)' }}>
              <Settings2 size={16} />
              Global Branding
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-[var(--card)] rounded-2xl border p-6 md:p-8" style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-4 border-b pb-5 mb-6" style={{ borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,101,10,0.1)' }}>
                <Settings2 size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>Global Branding</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Updates here apply globally to all unauthenticated tenants.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Platform Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  value={settings.platform_name}
                  onChange={e => setSettings({ ...settings, platform_name: e.target.value })}
                  placeholder="e.g. SiteTrack"
                />
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Used in footers, login headers, and website titles.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Support Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  value={settings.support_email}
                  onChange={e => setSettings({ ...settings, support_email: e.target.value })}
                  placeholder="e.g. support@sitetrack.io"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Website URL</label>
                <input
                  type="url"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  value={settings.website_url}
                  onChange={e => setSettings({ ...settings, website_url: e.target.value })}
                  placeholder="e.g. https://sitetrack.io"
                />
              </div>
            </div>

            <div className="pt-6 mt-6 border-t flex justify-start" style={{ borderColor: 'var(--border)' }}>
              <button onClick={handleSave} disabled={saving} 
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                style={{ background: 'var(--primary)' }}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
