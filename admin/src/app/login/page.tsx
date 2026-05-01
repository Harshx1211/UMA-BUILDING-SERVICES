'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, ArrowRight, ShieldCheck, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: BarChart3, title: 'Real-time analytics',   sub: 'Live KPIs and operational dashboards' },
  { icon: ShieldCheck, title: 'Compliance control',   sub: 'Track all sites and assets in one place' },
  { icon: Users,       title: 'Team management',      sub: 'Schedule technicians and monitor jobs' },
];

const STATS = [
  { label: 'Properties',  value: '200+' },
  { label: 'Jobs Done',   value: '5k+' },
  { label: 'Uptime',      value: '99.9%' },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await signIn(email, password);
    setLoading(false);
    if (error) toast.error(error);
    else { toast.success('Welcome back!'); router.replace('/dashboard'); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F0F4F8' }}>

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden flex-shrink-0"
        style={{ width: 480, background: 'linear-gradient(160deg, #0d1b35 0%, #1B2D4F 50%, #1a3060 100%)' }}>

        {/* Decorative shapes */}
        <div className="absolute w-[420px] h-[420px] rounded-full opacity-[0.07] -top-24 -right-24"
          style={{ background: '#F97316' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-[0.04] bottom-12 -left-16"
          style={{ background: '#F97316' }} />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        {/* Logo */}
        <div className="relative z-10 p-10 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ff9a3c,#F97316)', boxShadow: '0 8px 24px rgba(249,115,22,0.45)' }}>
              <Zap size={21} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-extrabold text-xl leading-none tracking-tight">SiteTrack</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 px-10 flex-1 flex flex-col justify-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#F97316' }} />
              <span className="text-xs font-semibold" style={{ color: '#fdba74' }}>Field Service Management</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white leading-snug" style={{ letterSpacing: '-0.03em' }}>
              Manage your entire<br />
              <span style={{ color: '#F97316' }}>field operation</span><br />
              from one place.
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              The central hub for scheduling, compliance tracking, defect management, and real-time field visibility.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 mb-8">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <Icon size={16} style={{ color: '#F97316' }} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-tight">{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{sub}</p>
                </div>
                <CheckCircle2 size={14} className="ml-auto flex-shrink-0" style={{ color: 'rgba(249,115,22,0.5)' }} />
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(s => (
              <div key={s.label} className="p-3 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-white font-extrabold text-lg leading-none">{s.value}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 p-10 pt-6">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
            © 2026 SiteTrack Services Pty Ltd · ABN 51 602 019 081
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#ff9a3c,#F97316)' }}>
              <Zap size={17} color="#fff" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-extrabold" style={{ color: 'var(--primary)', letterSpacing: '-0.02em' }}>SiteTrack Admin</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl p-8 animate-fade-in-up"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}>

            <div className="mb-7">
              <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                Welcome back 👋
              </h1>
              <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                Sign in to your admin account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
                  Email address
                </label>
                <input
                  id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="admin@sitetrack.com.au" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all font-medium"
                  style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(27,45,79,0.08)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Password</label>
                  <button type="button" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password" type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••" autoComplete="current-password"
                    className="w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all font-medium"
                    style={{ borderColor: 'var(--border)', background: '#f8fafc', color: 'var(--text)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(27,45,79,0.08)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                    style={{ color: 'var(--text-tertiary)' }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm text-white transition-all mt-2 active:scale-[0.98]"
                style={{
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1B2D4F, #243a65)',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(27,45,79,0.35)',
                  fontSize: 14.5,
                }}>
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                ) : (
                  <>Sign in to Admin Portal <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <ShieldCheck size={14} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Admin access only · Contact your system administrator for access
              </p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-5">
            {['Secure SSL', '2FA Ready', 'Role-based Access'].map(t => (
              <div key={t} className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                <CheckCircle2 size={11} style={{ color: 'var(--success)' }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
