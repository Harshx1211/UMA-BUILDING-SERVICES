'use client';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = 'Delete', onConfirm, onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-2xl w-full max-w-sm animate-scale-in"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#fef2f2' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
            <p className="font-bold text-base" style={{ color: 'var(--text)' }}>{title}</p>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <p className="px-5 pb-5 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-gray-50 transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
