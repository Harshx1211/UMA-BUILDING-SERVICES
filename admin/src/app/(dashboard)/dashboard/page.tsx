import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAdminCompanyId } from '@/lib/supabase-server';
import DashboardClient, { DashboardData } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const companyId = await getAdminCompanyId();
  if (!companyId) {
    redirect('/login');
  }

  const today = new Date().toISOString().split('T')[0];

  // Run all counts in parallel server-side — single round trip
  const [
    totalJobs, todayJobs, completedJobs, inProgressJobs,
    totalProperties, overdueProperties,
    openDefects, criticalDefects,
    activeTechs, pendingQuotes,
    recentJobs, recentDefects, allDefects,
  ] = await Promise.all([
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('scheduled_date', today),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'completed'),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'in_progress'),
    supabaseAdmin.from('properties').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabaseAdmin.from('properties').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('compliance_status', 'overdue'),
    supabaseAdmin.from('defects').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'open'),
    supabaseAdmin.from('defects').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('severity', 'critical').eq('status', 'open'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).neq('role', 'superadmin'),
    supabaseAdmin.from('quotes').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'draft'),
    supabaseAdmin.from('jobs').select('id, status, scheduled_date, property:properties(name), assigned_user:users(full_name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(6),
    supabaseAdmin.from('defects').select('id, description, severity, status, created_at, property:properties(name), asset:assets(asset_type)').eq('company_id', companyId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('defects').select('severity').eq('company_id', companyId),
  ]);

  // Weekly data (1 extra call, minimal data)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0];
  });
  const { data: weekJobs } = await supabaseAdmin
    .from('jobs').select('scheduled_date, status')
    .eq('company_id', companyId).in('scheduled_date', days);

  const sevCounts: Record<string, number> = { minor: 0, major: 0, critical: 0 };
  (allDefects.data ?? []).forEach((d: { severity: string }) => {
    sevCounts[d.severity] = (sevCounts[d.severity] ?? 0) + 1;
  });

  const stats = {
    totalJobs:         totalJobs.count         ?? 0,
    todayJobs:         todayJobs.count         ?? 0,
    completedJobs:     completedJobs.count     ?? 0,
    inProgressJobs:    inProgressJobs.count    ?? 0,
    totalProperties:   totalProperties.count   ?? 0,
    overdueProperties: overdueProperties.count ?? 0,
    openDefects:       openDefects.count       ?? 0,
    criticalDefects:   criticalDefects.count   ?? 0,
    activeTechs:       activeTechs.count       ?? 0,
    pendingQuotes:     pendingQuotes.count      ?? 0,
  };

  const initialData = {
    stats,
    recentJobs:    recentJobs.data    ?? [],
    recentDefects: recentDefects.data ?? [],
    defectSeverityData: [
      { name: 'Minor',    value: sevCounts.minor    },
      { name: 'Major',    value: sevCounts.major    },
      { name: 'Critical', value: sevCounts.critical },
    ],
    weeklyData: days.map(date => ({
      day:       new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' }),
      scheduled: (weekJobs ?? []).filter((j: { scheduled_date: string; status: string }) => j.scheduled_date === date).length,
      completed: (weekJobs ?? []).filter((j: { scheduled_date: string; status: string }) => j.scheduled_date === date && j.status === 'completed').length,
    })),
  };

  return <DashboardClient initialData={initialData as unknown as DashboardData} />;
}
