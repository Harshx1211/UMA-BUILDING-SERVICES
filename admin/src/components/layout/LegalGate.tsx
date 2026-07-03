'use client';
import { useState } from 'react';
import { ShieldAlert, CheckSquare, Square, ArrowRight, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface LegalGateProps {
  userId: string;
  onAccepted: () => void;
}

export default function LegalGate({ userId, onAccepted }: LegalGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!agreed) return;
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/user/accept-tos', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to record acceptance.');
      }
      
      const responseData = await res.json();
      
      // Instantly mutate the cache so the reload doesn't flash the gate
      try {
        const cached = localStorage.getItem('sitetrack_admin_profile');
        if (cached) {
          const user = JSON.parse(cached);
          user.accepted_tos_at = responseData.accepted_tos_at || new Date().toISOString();
          localStorage.setItem('sitetrack_admin_profile', JSON.stringify(user));
        }
      } catch (e) {
        console.error('Failed to update local cache', e);
      }

      toast.success('Terms accepted successfully.');
      onAccepted();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record acceptance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" style={{ background: 'var(--bg)' }}>
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--text) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-2xl bg-[var(--card)] rounded-2xl border flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up"
        style={{ borderColor: 'var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.04)' }}>
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b flex items-start gap-5 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid rgba(217, 83, 79, 0.2)' }}>
            <ShieldAlert size={24} style={{ color: '#d9534f' }} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Action Required: Master Terms of Service
            </h1>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Before accessing the dashboard, you must formally acknowledge your liability and obligations regarding fire safety compliance data managed on this platform.
            </p>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-sm space-y-4"
          style={{ 
            background: 'var(--bg-secondary)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent'
          }}>
          
          {/* Card 1 */}
          <div className="bg-[var(--card)] p-5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(232,101,10,0.1)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="font-bold text-base tracking-tight" style={{ color: 'var(--text)' }}>1. Binding Acknowledgment of Software Utility</h2>
            </div>
            <div className="space-y-3 leading-relaxed text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <p>You formally acknowledge and agree that SiteTrack functions exclusively as a B2B data management platform. SiteTrack is <strong style={{ color: 'var(--text)' }}>NOT</strong> a statutory fire safety authority, certifying engineering firm, or regulatory compliance body.</p>
              <p>SiteTrack does not verify the physical accuracy, reality, or legal validity of any compliance telemetry entered by your personnel.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[var(--card)] p-5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.1)' }}>
                <ShieldAlert size={16} style={{ color: '#dc2626' }} />
              </div>
              <h2 className="font-bold text-base tracking-tight" style={{ color: 'var(--text)' }}>2. Exclusive Assumption of Statutory Liability</h2>
            </div>
            <div className="space-y-3 leading-relaxed text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <p>The Customer assumes <strong style={{ color: 'var(--text)' }}>total and exclusive statutory liability</strong> for the physical inspection, functional testing, and ongoing compliance of all fire protection systems managed via the platform, strictly in accordance with Australian Standard 1851-2012.</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[var(--card)] p-5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.1)' }}>
                <ShieldCheck size={16} style={{ color: '#3b82f6' }} />
              </div>
              <h2 className="font-bold text-base tracking-tight" style={{ color: 'var(--text)' }}>3. Comprehensive Indemnification & Waiver</h2>
            </div>
            <div className="space-y-3 leading-relaxed text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <p>Except to the extent proximately caused by SiteTrack's gross negligence, wilful misconduct, or a material software defect, you agree to unconditionally indemnify, defend, and hold SiteTrack harmless against any third-party claims, lawsuits, or regulatory penalties (including those initiated by building owners, state fire brigades, or government authorities) arising from faulty physical works, lapsed maintenance schedules, or data falsification committed by your Authorised Users.</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-[var(--card)] p-5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <FileText size={16} style={{ color: '#10b981' }} />
              </div>
              <h2 className="font-bold text-base tracking-tight" style={{ color: 'var(--text)' }}>4. Ratification of Master Agreements</h2>
            </div>
            <div className="space-y-3 leading-relaxed text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <p>By proceeding, you declare that you possess the requisite legal authority to bind your organization to these terms. You confirm that you have read, comprehended, and unconditionally ratified the entirety of the SiteTrack <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-[var(--primary)] transition-colors">Master Terms of Service</a>, <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-[var(--primary)] transition-colors">Privacy Policy</a>, and <a href="/legal/aup" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-[var(--primary)] transition-colors">Acceptable Use Policy</a>.</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 rounded-lg bg-[var(--bg)] border border-dashed" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[12px] italic text-center" style={{ color: 'var(--text-tertiary)' }}>
              Nothing in this Agreement excludes, restricts, or modifies any consumer guarantee, right, or remedy under the Australian Consumer Law (ACL) that cannot lawfully be excluded.
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 sm:p-8 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <button
            type="button"
            onClick={() => setAgreed(!agreed)}
            className="flex items-start gap-3 w-full text-left p-4 rounded-xl border transition-colors hover:bg-[var(--bg)] cursor-pointer"
            style={{ 
              borderColor: agreed ? 'var(--accent)' : 'var(--border)',
              background: agreed ? 'rgba(232, 101, 10, 0.05)' : 'transparent' 
            }}
          >
            <div className="mt-0.5 flex-shrink-0">
              {agreed 
                ? <CheckSquare size={20} style={{ color: 'var(--accent)' }} /> 
                : <Square size={20} style={{ color: 'var(--text-tertiary)' }} />}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: agreed ? 'var(--accent)' : 'var(--text)' }}>
                I agree and accept the Master Terms of Service
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                By checking this box, I declare that I possess the legal authority to bind my company to these terms and assume full liability for physical fire safety compliance as outlined above.
              </p>
            </div>
          </button>

          <button
            onClick={handleSubmit}
            disabled={!agreed || loading}
            className="w-full py-4 mt-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: (!agreed || loading) ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
              color: (!agreed || loading) ? 'var(--text-tertiary)' : '#fff',
              boxShadow: (!agreed || loading) ? 'none' : '0 4px 20px rgba(232,101,10,0.35)',
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Enter Dashboard <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
