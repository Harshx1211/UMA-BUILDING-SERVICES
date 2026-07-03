'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/adminFetch';
import { FileText, X, CheckCircle, AlertTriangle, Info, Clock } from 'lucide-react';

type AuditLog = {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  created_at: string;
  changed_by: string;
  users: { full_name: string; email: string } | null;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await adminFetch('/api/superadmin/audit');
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.2)' };
      case 'UPDATE': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' };
      case 'DELETE': return { bg: 'rgba(239, 68, 68, 0.1)',  text: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' };
      default:       return { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.2)' };
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton variant="card" className="h-8 w-40" />
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 px-6 py-5 border-b" style={{ borderColor: 'var(--border)', animationDelay: `${i*60}ms` }}>
              <Skeleton variant="bg" className="h-10 w-10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-4 w-48" />
                <Skeleton variant="text" className="h-3 w-32" />
              </div>
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
          title="Audit Logs" 
          subtitle="Immutable, system-wide activity log of all critical database changes."
          action={
            <button 
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] hover:bg-white/5 border text-sm font-semibold rounded-xl transition-colors shadow-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <Clock size={16} />
              Refresh
            </button>
          }
        />

        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <table className="min-w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Timestamp</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Action</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Table</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Author</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const colors = getActionColor(log.action);
                const isSystem = !log.changed_by || !log.users;
                
                return (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-white/5 transition-colors ${idx !== logs.length - 1 ? 'border-b' : ''}`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                        <FileText size={14} style={{ color: 'var(--text-tertiary)' }} />
                        {log.table_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isSystem ? (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <AlertTriangle size={14} className="text-orange-500" />
                          <span>System / Superadmin</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                          <CheckCircle size={14} className="text-green-500" />
                          <span>{log.users?.full_name || 'Unknown User'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-sm font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        View JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-4xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <Info className="text-blue-400" size={20} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Log Details</h3>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/10 ml-2 font-mono">{selectedLog.record_id}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg)]">
              
              <div className="border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--border)' }}>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs" style={{ color: 'var(--text-secondary)' }}>Field</th>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs" style={{ color: 'var(--text-secondary)' }}>Previous Value</th>
                      <th className="px-6 py-3 font-semibold uppercase tracking-wider text-xs" style={{ color: 'var(--text-secondary)' }}>New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {(() => {
                      const oldObj = selectedLog.old_data || {};
                      const newObj = selectedLog.new_data || {};
                      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort();

                      return allKeys.map(key => {
                        const oldVal = JSON.stringify(oldObj[key] ?? null);
                        const newVal = JSON.stringify(newObj[key] ?? null);
                        const isChanged = oldVal !== newVal && selectedLog.action === 'UPDATE';
                        
                        return (
                          <tr key={key} className={isChanged ? 'bg-orange-500/10' : 'hover:bg-white/5 transition-colors'}>
                            <td className="px-6 py-3 font-medium font-mono text-xs" style={{ color: 'var(--text)' }}>
                              {key}
                            </td>
                            <td className={`px-6 py-3 font-mono text-xs ${isChanged ? 'text-red-400 line-through opacity-80' : 'text-gray-400'}`}>
                              {selectedLog.action === 'INSERT' ? '-' : oldVal}
                            </td>
                            <td className={`px-6 py-3 font-mono text-xs ${isChanged ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                              {selectedLog.action === 'DELETE' ? '-' : newVal}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
