import { useState, useEffect } from 'react';
import { adminApi, adminRead } from '@/lib/admin-api';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const JOB_TYPES = ['', 'routine_service', 'defect_repair', 'installation', 'emergency', 'quote'];
const PRIORITIES = ['', 'urgent', 'high', 'normal', 'low'];
const JOB_TYPE_LABELS: Record<string, string> = {
  routine_service: 'Routine Service', defect_repair: 'Defect Repair',
  installation: 'Installation', emergency: 'Emergency', quote: 'Quote',
};

interface Props {
  onClose: () => void;
  onCreated: () => void;
  initialPropertyId?: string;
  initialJobType?: string;
  assetsToRepair?: string[]; // Asset IDs to automatically link
}

export default function CreateJobModal({ onClose, onCreated, initialPropertyId, initialJobType, assetsToRepair }: Props) {
  const [properties, setProperties] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    property_id: initialPropertyId || '',
    assigned_to: '',
    job_type: initialJobType || 'routine_service',
    priority: 'normal',
    scheduled_date: '',
    scheduled_time: '',
    notes: assetsToRepair ? `Auto-generated repair job for ${assetsToRepair.length} assets.` : ''
  });

  useEffect(() => {
    Promise.all([
      adminRead<any>('properties', { select: 'id,name,suburb', order: { column: 'name' } }),
      adminRead<any>('users', { select: 'id,full_name', filters: { is_active: true }, order: { column: 'full_name' } }),
    ]).then(([{ data: p }, { data: u }]) => {
      setProperties(p ?? []);
      setUsers(u ?? []);
    });
  }, []);

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.assigned_to || !form.scheduled_date) {
      toast.error('Please fill required fields');
      return;
    }
    setCreating(true);

    try {
      // 1. Create Job
      const { error: jobError, data: newJob } = await adminApi.insert<any[]>('jobs', { ...form, status: 'scheduled' });
      if (jobError) throw new Error(jobError);

      // 2. Link assets if this is a repair job
      const newJobId = Array.isArray(newJob) && newJob.length > 0 ? (newJob as any[])[0]?.id : null;
      if (assetsToRepair && assetsToRepair.length > 0 && newJobId) {
        const assetIdsNote = `Repair required for assets: ${assetsToRepair.join(', ')}`;
        await adminApi.update('jobs', { notes: `${form.notes}\n\n${assetIdsNote}` }, newJobId);
      }

      toast.success('Job created!');
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>Create New Job</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Schedule a work order for a technician</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <form onSubmit={createJob} className="p-6 space-y-4">
          {[
            { label: 'Property *', type: 'select', field: 'property_id', options: properties.map(p => ({ value: p.id, label: `${p.name}${p.suburb ? ` — ${p.suburb}` : ''}` })) },
            { label: 'Assigned Technician *', type: 'select', field: 'assigned_to', options: users.map(u => ({ value: u.id, label: u.full_name })) },
            { label: 'Job Type', type: 'select', field: 'job_type', options: JOB_TYPES.filter(Boolean).map(t => ({ value: t, label: JOB_TYPE_LABELS[t] ?? t })) },
            { label: 'Priority', type: 'select', field: 'priority', options: PRIORITIES.filter(Boolean).map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })) },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{f.label}</label>
              <select value={(form as any)[f.field]} onChange={e => setForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#f8fafc' }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }}
                disabled={f.field === 'property_id' && !!initialPropertyId}>
                <option value="">Select {f.label.replace(' *', '')}…</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Date *</label>
              <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#f8fafc' }} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Time</label>
              <input type="time" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#f8fafc' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
              placeholder="Any special instructions or notes…"
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none resize-none transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', background: '#f8fafc' }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={creating}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.3)' }}>
              {creating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</> : <><Plus size={15} />Create Job</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
