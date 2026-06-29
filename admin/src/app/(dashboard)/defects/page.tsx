'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminRead } from '@/lib/admin-api';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { timeAgo } from '@/lib/utils';
import { ShieldAlert, Building2, ChevronDown, ChevronUp, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DefectData {
  id: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  status: string;
  created_at: string;
  property_id: string;
  property: { id: string; name: string; suburb: string; };
  asset: { id: string; asset_type: string; location_on_site: string; asset_ref: string; };
}

interface SiteGroup {
  property: { id: string; name: string; suburb: string; };
  defects: DefectData[];
  critical: number;
  major: number;
  minor: number;
}

const SEV_COLORS = { minor: '#f59e0b', major: '#f97316', critical: '#ef4444' };
const SEV_BG = { minor: 'var(--warning-dark)', major: 'var(--warning-dark)', critical: 'var(--error-dark)' };

export default function DefectsPage() {
  const [siteGroups, setSiteGroups] = useState<SiteGroup[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all open defects with relations
    const { data } = await adminRead<DefectData>('defects', {
      select: '*, property:properties(id, name, suburb), asset:assets(id, asset_type, location_on_site, asset_ref)',
      filters: { status: 'open' },
      order: { column: 'created_at', ascending: false }
    });

    if (data) {
      const groups = new Map<string, SiteGroup>();

      data.forEach(d => {
        if (!d.property) return;
        
        if (!groups.has(d.property_id)) {
          groups.set(d.property_id, {
            property: d.property,
            defects: [],
            critical: 0,
            major: 0,
            minor: 0,
          });
        }
        
        const group = groups.get(d.property_id)!;
        group.defects.push(d);
        if (d.severity === 'critical') group.critical++;
        else if (d.severity === 'major') group.major++;
        else if (d.severity === 'minor') group.minor++;
      });

      // Sort groups by critical defects first, then major, then total
      const sortedGroups = Array.from(groups.values()).sort((a, b) => {
        if (b.critical !== a.critical) return b.critical - a.critical;
        if (b.major !== a.major) return b.major - a.major;
        return b.defects.length - a.defects.length;
      });

      setSiteGroups(sortedGroups);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalDefects = siteGroups.reduce((acc, g) => acc + g.defects.length, 0);

  return (
    <div className="animate-fade-in pb-20 space-y-4">
      <PageHeader
        title="Site Defects"
        subtitle={`${totalDefects} open defect${totalDefects !== 1 ? 's' : ''} across ${siteGroups.length} site${siteGroups.length !== 1 ? 's' : ''}`}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : siteGroups.length === 0 ? (
        <EmptyState 
          icon={<ShieldAlert size={24} style={{ color: 'var(--text-tertiary)' }} />} 
          title="No open defects" 
          subtitle="All sites are fully compliant! When technicians log defects on the field, they will be organized here by property." 
        />
      ) : (
        <div className="space-y-4">
          {siteGroups.map((group, i) => {
            const isExpanded = expandedId === group.property.id;
            
            return (
              <div key={group.property.id} 
                className="bg-[var(--card)] rounded-2xl border overflow-hidden animate-fade-in-up transition-shadow"
                style={{ 
                  borderColor: isExpanded ? 'rgba(249,115,22,0.3)' : 'var(--border)', 
                  animationDelay: `${i * 30}ms`,
                  boxShadow: isExpanded ? '0 12px 32px rgba(0,0,0,0.06)' : '0 1px 4px rgba(0,0,0,0.03)'
                }}
              >
                {/* ── Header Row (Clickable) ── */}
                <div 
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : group.property.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.2)' }}>
                      <Building2 size={20} style={{ color: '#fff' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
                        {group.property.name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {group.property.suburb || 'No address specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Severity Badges */}
                    <div className="flex gap-2">
                      {group.critical > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <AlertTriangle size={13} style={{ color: '#ef4444' }} />
                          <span className="text-xs font-bold" style={{ color: '#ef4444' }}>{group.critical} Critical</span>
                        </div>
                      )}
                      {group.major > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(249,115,22,0.1)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: '#f97316' }} />
                          <span className="text-xs font-bold" style={{ color: '#f97316' }}>{group.major} Major</span>
                        </div>
                      )}
                      {group.minor > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)' }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                          <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>{group.minor} Minor</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Expand Icon */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center border"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="border-t animate-slide-down" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    
                    {/* Action Bar */}
                    <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: '#fafafa' }}>
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                        {group.defects.length} Defect{group.defects.length !== 1 ? 's' : ''} Logged
                      </span>
                      <Link href="/quotes" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-white/5 border shadow-sm"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--accent)' }}>
                        Review Quotes <ArrowRight size={13} />
                      </Link>
                    </div>

                    {/* Defect List */}
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {group.defects.map((defect) => (
                        <div key={defect.id} className="p-5 flex items-start gap-4 hover:bg-white/40 transition-colors">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" 
                            style={{ background: SEV_BG[defect.severity] }}>
                            <ShieldAlert size={18} style={{ color: SEV_COLORS[defect.severity] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                              {defect.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge value={defect.severity} />
                              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {defect.asset?.asset_type || 'General Asset'} {defect.asset?.asset_ref ? `(#${defect.asset.asset_ref})` : ''}
                              </span>
                            </div>
                            {defect.asset?.location_on_site && (
                              <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                <span className="font-semibold">Location:</span> {defect.asset.location_on_site}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-right" style={{ color: 'var(--text-tertiary)' }}>
                            <p>{timeAgo(defect.created_at)}</p>
                            <p className="mt-0.5">{new Date(defect.created_at).toLocaleDateString('en-AU')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
