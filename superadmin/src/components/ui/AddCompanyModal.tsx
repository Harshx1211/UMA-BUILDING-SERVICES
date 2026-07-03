import { useState } from 'react';
import { Building2, User, Mail, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/adminFetch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCompanyModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    abn: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await adminFetch('/api/superadmin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create company');

      toast.success('Company and Admin created successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-md flex flex-col animate-scale-in max-h-[92vh]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18)', border: '1px solid var(--border)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Register New SaaS Tenant</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Create a new company instance</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors">
            <X size={15} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Company Details */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                <Building2 size={14} className="text-orange-500" />
                Company Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Company Name <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <input 
                    required
                    type="text" 
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; }}
                    onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                    placeholder="e.g. Acme Fire Services"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    ABN (Optional)
                  </label>
                  <input 
                    type="text" 
                    value={form.abn}
                    onChange={e => setForm({ ...form, abn: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; }}
                    onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                    placeholder="00 000 000 000"
                  />
                </div>
              </div>
            </div>

            <div className="h-px w-full" style={{ background: 'var(--border)' }} />

            {/* Master Admin Details */}
            <div>
              <div className="mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <User size={14} className="text-blue-500" />
                  Master Admin Account
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Creates the primary admin user for the tenant.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Admin Full Name
                  </label>
                  <input 
                    type="text" 
                    value={form.adminName}
                    onChange={e => setForm({ ...form, adminName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; }}
                    onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Admin Email <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <input 
                      required
                      type="email" 
                      value={form.adminEmail}
                      onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; }}
                      onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                      placeholder="admin@acmefire.com.au"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    Initial Password <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                    <input 
                      required
                      type="password" 
                      value={form.adminPassword}
                      onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
                      onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; }}
                      onBlur={e  => { e.target.style.borderColor = 'var(--border)'; }}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-white/5 transition-all disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)', boxShadow: '0 4px 14px rgba(27,45,79,0.25)' }}
            >
              {loading 
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</> 
                : 'Create Tenant'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
