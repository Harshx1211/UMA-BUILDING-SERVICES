'use client';
import { useEffect, useState } from 'react';
import { adminRead } from '@/lib/admin-api';
import { MessageSquare, ShieldAlert, Mail, Phone, Calendar, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    // Check access & load leads
    const load = async () => {
      try {
        const [compRes, leadsRes] = await Promise.all([
          fetch('/api/admin/company'),
          fetch('/api/admin/leads')
        ]);
        
        const [compJson, leadsJson] = await Promise.all([
          compRes.json(),
          leadsRes.json()
        ]);
        
        // If the Superadmin hasn't explicitly enabled this page for this tenant, block access.
        if (compJson.data?.custom_sidebar_url !== '/leads') {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        if (leadsRes.ok) {
          setLeads(leadsJson.data || []);
        } else {
          toast.error(leadsJson.error || 'Failed to fetch leads');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4 max-w-7xl">
        <div className="h-24 rounded-3xl animate-pulse" style={{ background: 'var(--card)' }} />
        <div className="h-64 rounded-3xl animate-pulse" style={{ background: 'var(--card)' }} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>Access Denied</h1>
        <p className="max-w-md text-sm" style={{ color: 'var(--text-tertiary)' }}>
          This feature has not been enabled for your account. If you believe you should have access to the Website Leads integration, please contact your Superadmin.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 max-w-7xl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg,#1B2D4F 0%,#243a65 100%)', boxShadow: '0 8px 32px rgba(27,45,79,0.35)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #FF7A20 0%, transparent 60%)' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: 'var(--primary)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}>
              <MessageSquare size={24} />
            </div>
            <div className="pt-1">
              <h1 className="text-2xl font-extrabold text-white flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
                Website Enquiries
              </h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Leads captured directly from your marketing website.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--card)] rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Search leads..." disabled className="w-full pl-9 pr-4 py-2 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }} />
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
            {leads.length} total leads
          </span>
        </div>

        {leads.length === 0 ? (
          <div className="flex flex-col items-center py-20">
            <MessageSquare size={32} style={{ color: 'var(--text-tertiary)' }} className="mb-3" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No enquiries yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>When someone fills out the form on your website, it will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Contact Info</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Message</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b last:border-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{lead.name}</span>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <Mail size={12} /> {lead.email}
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          <Phone size={12} /> {lead.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm max-w-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{lead.message}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        <Calendar size={12} /> {formatDate(lead.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
