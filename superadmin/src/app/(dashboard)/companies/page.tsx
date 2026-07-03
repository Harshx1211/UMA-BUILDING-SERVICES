'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import { AddCompanyModal } from '@/components/ui/AddCompanyModal';
import { Building2, Plus, Power, Users, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/adminFetch';
import Skeleton from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';
import { getCached, setCached } from '@/lib/pageCache';

type Company = {
  id: string;
  name: string;
  abn: string;
  subscription_status: 'active' | 'suspended' | 'cancelled';
  created_at: string;
  users_count: number;
  jobs_count: number;
};

export default function CompaniesPage() {
  const router = useRouter();
  const cached = getCached<Company[]>('superadmin_companies');
  const [companies, setCompanies] = useState<Company[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await adminFetch('/api/superadmin/companies');
      const json = await res.json();
      if (json.data) {
        setCompanies(json.data);
        setCached('superadmin_companies', json.data);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCompanies();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await adminFetch(`/api/superadmin/companies/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ subscription_status: newStatus })
      });
      if (res.ok) {
        toast.success(`Company ${newStatus}`);
        const updated = companies.map(c => c.id === id ? { ...c, subscription_status: newStatus as "active" | "suspended" | "cancelled" } : c);
        setCompanies(updated);
        setCached('superadmin_companies', updated);
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(`Failed: ${json.error ?? `HTTP ${res.status}`}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Network error: ${msg}`);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton variant="card" className="h-8 w-40" />
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-4 px-6 py-5 border-b" style={{ borderColor: 'var(--border)', animationDelay: `${i*60}ms` }}>
              <Skeleton variant="bg" className="h-10 w-10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-4 w-48" />
                <Skeleton variant="text" className="h-3 w-32" />
              </div>
              <Skeleton variant="bg" className="h-6 w-20 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <PageHeader 
          title="SaaS Tenants" 
          subtitle="Manage all companies using the platform."
          action={
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Tenant
            </button>
          }
        />

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <table className="min-w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Company</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Users</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Jobs</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Joined</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, idx) => (
                <tr 
                  key={c.id} 
                  className={`hover:bg-white/5 transition-colors cursor-pointer ${idx !== companies.length - 1 ? 'border-b' : ''}`}
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => router.push(`/companies/${c.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
                        <Building2 size={18} className="text-orange-500" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ABN: {c.abn || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge value={c.subscription_status === 'active' ? 'active' : 'suspended'} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      <Users size={14} style={{ color: 'var(--text-tertiary)' }} />
                      {c.users_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      <Briefcase size={14} style={{ color: 'var(--text-tertiary)' }} />
                      {c.jobs_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => toggleStatus(c.id, c.subscription_status)}
                      className={`toggle ${c.subscription_status === 'active' ? 'on' : ''}`}
                      title={c.subscription_status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                    />
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      <AddCompanyModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSuccess={fetchCompanies} 
      />
    </div>
  );
}
