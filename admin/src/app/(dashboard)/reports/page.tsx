'use client';
import { useEffect, useState } from 'react';
import { adminRead, adminReadBatch } from '@/lib/admin-api';
import { formatDate, timeAgo } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import { ClipboardList, Download, Building2, ShieldAlert, TrendingUp, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCached, setCached } from '@/lib/pageCache';

const CACHE_KEY = 'reports_data';

export default function ReportsPage() {
  const cached = getCached<Record<string, unknown>>(CACHE_KEY);
  const [stats, setStats] = useState((cached?.stats as { properties: number, compliant: number, nonCompliant: number, overdue: number }) ?? { properties: 0, compliant: 0, nonCompliant: 0, overdue: 0 });
  const [overdueProperties, setOverdueProperties] = useState<Record<string, unknown>[]>((cached?.overdueProperties as Record<string, unknown>[]) ?? []);
  const [openDefects, setOpenDefects] = useState<Record<string, unknown>[]>((cached?.openDefects as Record<string, unknown>[]) ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const results = await adminReadBatch([
        { table: 'properties', options: { count: true, limit: 0 } },
        { table: 'properties', options: { count: true, limit: 0, filters: { compliance_status: 'compliant' } } },
        { table: 'properties', options: { count: true, limit: 0, filters: { compliance_status: 'non_compliant' } } },
        { table: 'properties', options: { count: true, limit: 0, filters: { compliance_status: 'overdue' } } },
        { table: 'properties', options: { select: '*', filters: {}, order: { column: 'next_inspection_date', ascending: true }, limit: 10 } },
        { table: 'defects', options: { select: '*, property:properties(name), asset:assets(asset_type)', filters: { status: 'open', severity: 'critical' }, order: { column: 'created_at', ascending: false }, limit: 10 } },
      ]);
      const [
        { count: total }, { count: compliant }, { count: nonCompliant }, { count: overdue },
        { data: assets }, { data: defects },
      ] = results;
      const newStats = { properties: total ?? 0, compliant: compliant ?? 0, nonCompliant: nonCompliant ?? 0, overdue: overdue ?? 0 };
      const newOverdue = (assets ?? []).filter((p: Record<string, string>) => p.next_inspection_date && p.next_inspection_date < today);
      setStats(newStats);
      setOverdueProperties(newOverdue);
      setOpenDefects(defects ?? []);
      setCached(CACHE_KEY, { stats: newStats, overdueProperties: newOverdue, openDefects: defects ?? [] });
      setLoading(false);
    }
    load();
  }, []);

  const exportCSV = async (type: string) => {
    let rows: Record<string, unknown>[] = [];
    if (type === 'properties') {
      const { data } = await adminRead<Record<string, unknown>>('properties', {
        select: 'name,address,suburb,state,postcode,compliance_status,created_at',
        order: { column: 'name', ascending: true },
      });
      rows = data ?? [];
    } else if (type === 'assets') {
      const { data } = await adminRead<Record<string, unknown>>('assets', {
        select: 'asset_type,variant,asset_ref,serial_number,location_on_site,last_service_date,next_service_date,status,property:properties(name)',
        order: { column: 'asset_type', ascending: true },
      });
      rows = (data ?? []).map(a => ({ ...a, property_name: (a.property as Record<string, unknown>)?.name }));
    } else if (type === 'defects') {
      const { data } = await adminRead<Record<string, unknown>>('defects', {
        select: 'description,severity,status,created_at,property:properties(name),asset:assets(asset_type)',
        order: { column: 'created_at', ascending: false },
      });
      rows = (data ?? []).map(d => ({ ...d, property_name: (d.property as Record<string, unknown>)?.name, asset_type: (d.asset as Record<string, unknown>)?.asset_type }));
    }
    if (!rows.length) { toast.error('No data to export'); return; }
    const keys = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
    const csv = [keys.join(','), ...rows.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `uma-building-services-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${type} exported!`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reports & Compliance" subtitle="Export data and view compliance status across all sites" />

      {/* Compliance Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Sites', value: stats.properties, icon: Building2, color: '#3b82f6', bg: 'var(--primary-light)' },
          { label: 'Compliant', value: stats.compliant, icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
          { label: 'Non-Compliant', value: stats.nonCompliant, icon: ShieldAlert, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
          { label: 'Overdue', value: stats.overdue, icon: TrendingUp, color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
        ].map((s, i) => (
          <div key={s.label} className="bg-[var(--card)] rounded-2xl border p-5 animate-fade-in-up" style={{ borderColor: 'var(--border)', animationDelay: `${i * 50}ms` }}>
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
      <div className="bg-[var(--card)] rounded-2xl border p-5 mb-6" style={{ borderColor: 'var(--border)' }}>
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
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)' }}>
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
        {/* Overdue Properties */}
        <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>⚠️ Overdue for Inspection</p>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} variant="text" className="h-10 w-full" />)}
            </div>
          ) : overdueProperties.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No overdue properties 🎉</p>
          ) : (
            overdueProperties.map((p) => (
              <div key={p.id as string} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{p.name as string}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{[p.suburb as string, p.state as string].filter(Boolean).join(', ') || 'Location unknown'}</p>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>{formatDate(p.next_inspection_date as string)}</span>
              </div>
            ))
          )}
        </div>

        {/* Critical Open Defects */}
        <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color: 'var(--text)' }}>🔴 Critical Open Defects</p>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} variant="text" className="h-10 w-full" />)}
            </div>
          ) : openDefects.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>No critical defects open 🎉</p>
          ) : (
            openDefects.map((d: Record<string, unknown>) => (
              <div key={d.id as string} className="flex items-start justify-between py-2.5 border-b last:border-0 gap-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.description as string}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(d.property as Record<string,unknown>)?.name as string} · {(d.asset as Record<string,unknown>)?.asset_type as string} · {timeAgo(d.created_at as string)}</p>
                </div>
                <Badge value="critical" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}



