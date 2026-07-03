'use client';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { Building2, Users, Briefcase } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { adminFetch } from '@/lib/adminFetch';
import { getCached, setCached } from '@/lib/pageCache';

const CACHE_KEY = 'superadmin_dashboard_stats';

export default function SuperadminDashboard() {
  const { user } = useAuth();
  const cached = getCached<{ companies: number; users: number; jobs: number }>(CACHE_KEY);
  const [stats, setStats] = useState(cached ?? { companies: 0, users: 0, jobs: 0 });
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    adminFetch('/api/superadmin/stats')
      .then(res => res.json())
      .then(res => {
        if (res.data) {
          const newStats = {
            companies: res.data.totalCompanies,
            users: res.data.totalActiveUsers,
            jobs: res.data.totalJobs,
          };
          setStats(newStats);
          setCached(CACHE_KEY, newStats);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // No blocking return — render skeleton immediately

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <PageHeader 
          title="Platform Overview" 
          subtitle={`Welcome back, ${user?.full_name}. Here is the current state of the platform.`}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            isLoading={loading}
            label="Total SaaS Tenants"
            value={stats.companies.toString()}
            icon={Building2}
            subtitle="Platform growth"
            color="orange"
          />
          <StatCard
            isLoading={loading}
            label="Active Platform Users"
            value={stats.users.toString()}
            icon={Users}
            subtitle="All tenant users"
            color="green"
          />
          <StatCard
            isLoading={loading}
            label="Total Jobs Processed"
            value={stats.jobs.toString()}
            icon={Briefcase}
            subtitle="Across all companies"
            color="blue"
          />
        </div>

      </div>
    </div>
  );
}
