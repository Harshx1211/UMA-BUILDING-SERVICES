'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, timeAgo } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import { ClipboardList, Download, FileText, Building2, ShieldAlert, TrendingUp, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [stats, setStats] = useState({ properties: 0, compliant: 0, nonCompliant: 0, overdue: 0 });
  const [overdueAssets, setOverdueAssets] = useState<any[]>([]);
  const [openDefects, setOpenDefects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const [
        { count: total }, { count: compliant }, { count: nonCompliant }, { count: overdue },
        { data: assets }, { data: defects },
      ] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('compliance_status', 'compliant'),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('compliance_status', 'non_compliant'),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('compliance_status', 'overdue'),
        supabase.from('assets').select('*, property:properties(name)').lt('next_service_date', today).eq('status', 'active').order('next_service_date').limit(10),
        supabase.from('defects').select('*, property:properties(name), asset:assets(asset_type)').eq('status', 'open').eq('severity', 'critical').order('created_at', { ascending: false }).limit(10),
      ]);
      setStats({ properties: total ?? 0, compliant: compliant ?? 0, nonCompliant: nonCompliant ?? 0, overdue: overdue ?? 0 });
      setOverdueAssets(assets ?? []);
      setOpenDefects(defects ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const exportCSV = async (type: string) => {
    let data: any[] = [];
    if (type === 'properties') {
      const { data: d } = await supabase.from('properties').select('name,address,suburb,state,postcode,compliance_status,created_at').order('name');
      data = d ?? [];
    } else if (type === 'assets') {
      const { data: d } = await supabase.from('assets').select('asset_type,variant,asset_ref,serial_number,location_on_site,last_service_date,next_service_date,status,property:properties(name)').order('asset_type');
      data = (d ?? []).map((a: any) => ({ ...a, property_name: a.property?.name }));
    } else if (type === 'defects') {
      const { data: d } = await supabase.from('defects').select('description,severity,status,created_at,property:properties(name),asset:assets(asset_type)').order('created_at', { ascending: false });
      data = (d ?? []).map((d: any) => ({ ...d, property_name: d.property?.name, asset_type: d.asset?.asset_type }));
    }
    if (!data.length) { toast.error('No data to export'); return; }
    const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sitetrack-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${type} exported!`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reports & Compliance" subtitle="Export data and view compliance status across all sites" />

      {/* Compliance Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sites', value: stats.properties, icon: Building2, color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Compliant', value: stats.compliant, icon: CheckCircle2, color: '#22c55e', bg: '#f0fdf4' },
          { label: 'Non-Compliant', value: stats.nonCompliant, icon: ShieldAlert, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Overdue', value: stats.overdue, icon: TrendingUp, color: '#f97316', bg: '#fff7ed' },
        ].map((s, i) => (
          <div key={s.label} className="bg-white rounded-2xl border p-5 animate-fade-in-up" style={{ borderColor: 'var(--border)', animationDelay: `${i * 50}ms` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{s.value}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            {stats.properties > 0 && (
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${(s.value / stats.properties) * 100}%`, background: s.color }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Exports */}
      <div className="bg-white rounded-2xl border p-5 mb-6" style={{ borderColor: 'var(--border)' }}>
        <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Export Reports</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Properties Register', sub: 'All sites with compliance status', type: 'properties', icon: Building2 },
            { label: 'Asset Register', sub: 'All assets with service dates', type: 'assets', icon: ClipboardList },
            { label: 'Defect Register', sub: 'All defects with status', type: 'defects', icon: ShieldAlert },
          ].map(e => (
            <button key={e.type} onClick={() => exportCSV(e.type)}
              className="flex items-start gap-3 p-4 rounded-xl border hover:shadow-sm hover:border-orange-200 transition-all text-left"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fff4ed' }}>
                <e.icon size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{e.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{e.sub}</p>
              </div>
              <Download size={15} className="ml-auto flex-shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue Assets */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>⚠️ Overdue for Service</p>
          {loading ? <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
          : overdueAssets.length === 0 ? <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No overdue assets 🎉</p>
          : overdueAssets.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.asset_type}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.property?.name} · {a.location_on_site ?? 'Location unknown'}</p>
              </div>
              <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{formatDate(a.next_service_date)}</span>
            </div>
          ))}
        </div>

        {/* Critical Open Defects */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>🔴 Critical Open Defects</p>
          {loading ? <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} /></div>
          : openDefects.length === 0 ? <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No critical defects open 🎉</p>
          : openDefects.map((d: any) => (
            <div key={d.id} className="flex items-start justify-between py-2.5 border-b last:border-0 gap-2" style={{ borderColor: 'var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.description}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{d.property?.name} · {d.asset?.asset_type} · {timeAgo(d.created_at)}</p>
              </div>
              <Badge value="critical" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
