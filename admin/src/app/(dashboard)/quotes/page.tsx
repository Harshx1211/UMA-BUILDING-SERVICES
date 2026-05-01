'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi, adminRead } from '@/lib/admin-api';
import { formatDate, formatCurrency, timeAgo } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PreviewModal from './PreviewModal';
import CreateJobModal from '../jobs/CreateJobModal';
import { FileText, Search, X, ChevronDown, ChevronUp, Check, Play } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['', 'draft', 'approved', 'rejected'];

export default function QuotesPage() {
  const [mappedQuotes, setMappedQuotes] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusF, setStatusF]           = useState('');
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<any>(null);
  const [repairJobData, setRepairJobData] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all jobs with their properties, users, defects, and quotes
    const { data: jobs } = await adminRead<any>('jobs', {
      select: '*, property:properties(name,suburb), assigned_user:users(full_name), defects(*), quotes(*)',
      order: { column: 'created_at', ascending: false }
    });

    if (jobs) {
      // Only show jobs that have defects OR already have a quote created
      const relevantJobs = jobs.filter(j => (j.defects && j.defects.length > 0) || (j.quotes && j.quotes.length > 0));
      
      const mapped = relevantJobs.map(j => {
        const quoteRow = j.quotes?.[0]; // Assume 1 quote per job max
        const defects = j.defects || [];
        // Calculate total dynamically from defects
        const total = defects.reduce((s: number, d: any) => s + (Number(d.quote_price) || 0), 0);
        
        return {
          id: quoteRow?.id || `draft-${j.id}`,
          job: j,
          quoteRow,
          defects,
          total_amount: total,
          status: quoteRow?.status || 'draft',
          created_at: quoteRow?.created_at || j.created_at,
        };
      });
      
      // Filter by status if selected
      const finalMapped = statusF ? mapped.filter(m => m.status === statusF) : mapped;
      setMappedQuotes(finalMapped);
    }
    setLoading(false);
  }, [statusF]);

  useEffect(() => { load(); }, [load]);

  const updateQuotePrice = async (defectId: string, price: string) => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return;

    const { error } = await adminApi.update('defects', { quote_price: numPrice }, defectId);
    if (error) toast.error(error);
    else {
      // Optimistically update local state
      setMappedQuotes(prev => prev.map(mq => {
        const newDefects = mq.defects.map((d: any) => d.id === defectId ? { ...d, quote_price: numPrice } : d);
        return {
          ...mq,
          defects: newDefects,
          total_amount: newDefects.reduce((s: number, d: any) => s + (Number(d.quote_price) || 0), 0)
        };
      }));
    }
  };

  const approveQuote = async (mq: any) => {
    try {
      // If no quote row exists yet, create it and mark it approved
      if (!mq.quoteRow) {
        const { error } = await adminApi.insert('quotes', {
          job_id: mq.job.id,
          status: 'approved',
          total_amount: mq.total_amount,
          created_at: new Date().toISOString()
        });
        if (error) throw new Error(error);
      } else {
        const { error } = await adminApi.update('quotes', { status: 'approved', total_amount: mq.total_amount }, mq.quoteRow.id);
        if (error) throw new Error(error);
      }
      
      toast.success('Quote approved!');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve quote');
    }
  };

  const filtered = mappedQuotes.filter(q => {
    if (!search) return true;
    const t = search.toLowerCase();
    return q.job?.property?.name?.toLowerCase().includes(t) ||
           q.job?.assigned_user?.full_name?.toLowerCase().includes(t);
  });

  const stats = {
    draft:    mappedQuotes.filter(q => q.status === 'draft'),
    approved: mappedQuotes.filter(q => q.status === 'approved'),
    rejected: mappedQuotes.filter(q => q.status === 'rejected'),
  };

  const renderDefectsGroup = (title: string, defects: any[], color: string) => {
    if (defects.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2 px-4">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{title} ({defects.length})</p>
        </div>
        <table className="w-full">
          <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Description', 'Status', 'Price'].map(h => (
              <th key={h} className="px-4 py-2.5 text-xs font-semibold text-left" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {defects.map((d: any, idx: number) => (
              <tr key={d.id} style={{ borderBottom: idx < defects.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-2 text-sm" style={{ color: 'var(--text)' }}>{d.description}</td>
                <td className="px-4 py-2 text-xs"><Badge value={d.status} /></td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    defaultValue={d.quote_price || ''}
                    onBlur={(e) => updateQuotePrice(d.id, e.target.value)}
                    placeholder="0.00"
                    className="w-24 px-2 py-1.5 rounded-lg border text-sm outline-none font-semibold text-right"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: '#16a34a' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="animate-fade-in pb-20">
      <PageHeader
        title="Quotes & Repairs"
        subtitle={`${mappedQuotes.length} total quotes · Automatically drafted from job defects`}
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Pending Approval', items: stats.draft,    color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Approved',         items: stats.approved, color: '#22c55e', bg: '#f0fdf4' },
          { label: 'Rejected',         items: stats.rejected, color: '#ef4444', bg: '#fef2f2' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--border)', borderTop: `3px solid ${c.color}` }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{c.items.length}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            <p className="text-xs mt-1 font-medium" style={{ color: c.color }}>
              {formatCurrency(c.items.reduce((s, q) => s + Number(q.total_amount), 0))}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-4 mb-4 flex flex-wrap gap-3 items-center" style={{ borderColor: 'var(--border)' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by property or technician…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          {STATUSES.map(s => <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Status: All'}</option>)}
        </select>
        {(statusF || search) && (
          <button onClick={() => { setStatusF(''); setSearch(''); }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm"
            style={{ color: 'var(--error)', background: '#fef2f2' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText size={24} style={{ color: 'var(--text-tertiary)' }} />} title="No quotes to display" subtitle="When technicians log defects on jobs, draft quotes will automatically appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((q: any, i: number) => (
            <div key={q.id} className="bg-white rounded-2xl border overflow-hidden animate-fade-in-up"
              style={{ borderColor: 'var(--border)', animationDelay: `${i * 20}ms` }}>
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{q.job?.property?.name ?? '—'}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {q.job?.assigned_user?.full_name ?? 'Admin'} · {formatDate(q.job?.scheduled_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{formatCurrency(q.total_amount)}</p>
                    <Badge value={q.status} />
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  {q.status === 'draft' && (
                    <button onClick={() => approveQuote(q)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white flex-1 justify-center transition-opacity hover:opacity-90"
                      style={{ background: '#22c55e' }}>
                      <Check size={14} /> Approve Quote
                    </button>
                  )}
                  {q.status === 'approved' && (
                    <button onClick={() => setRepairJobData(q)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white flex-1 justify-center transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                      <Play size={14} /> Create Repair Job
                    </button>
                  )}
                  <button onClick={() => setPreviewQuote(q)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium flex-1 justify-center border hover:bg-gray-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    <FileText size={14} /> Preview PDF
                  </button>
                </div>

                <button onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="flex items-center justify-center gap-1 text-xs mt-3 pt-3 border-t w-full hover:bg-gray-50 transition-colors rounded-b-2xl -mx-4 -mb-4 px-4 py-3"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  {expanded === q.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {expanded === q.id ? 'Hide defects' : `View ${q.defects.length} defect${q.defects.length !== 1 ? 's' : ''}`}
                </button>
              </div>

              {expanded === q.id && (
                <div className="border-t pb-2" style={{ borderColor: 'var(--border)', background: '#fafafa' }}>
                  <div className="pt-4">
                    {renderDefectsGroup('Critical / Immediate', q.defects.filter((d:any) => d.severity === 'critical'), '#ef4444')}
                    {renderDefectsGroup('Major Defects', q.defects.filter((d:any) => d.severity === 'major'), '#f97316')}
                    {renderDefectsGroup('Minor Defects', q.defects.filter((d:any) => d.severity === 'minor'), '#eab308')}
                  </div>
                  <div className="px-4 py-3 border-t flex justify-between" style={{ borderColor: 'var(--border)', background: '#f0f4f8' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Total (ex-GST)</span>
                    <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{formatCurrency(q.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewQuote && (
        <PreviewModal quote={previewQuote} onClose={() => setPreviewQuote(null)} />
      )}

      {repairJobData && (
        <CreateJobModal
          onClose={() => setRepairJobData(null)}
          onCreated={() => setRepairJobData(null)}
          initialPropertyId={repairJobData.job.property_id}
          initialJobType="defect_repair"
          assetsToRepair={repairJobData.defects.map((d: any) => d.asset_id)}
        />
      )}
    </div>
  );
}
