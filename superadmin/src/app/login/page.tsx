'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, ArrowRight, Shield, Globe, Activity, Lock, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

const PLATFORM_STATS = [
  { icon: Globe,    label: 'Active Tenants',  value: 'SaaS' },
  { icon: Activity, label: 'System Status',   value: 'Live' },
  { icon: Cpu,      label: 'Platform',        value: 'v2.0' },
];

export default function LoginPage() {
  const { signIn, user, hydrated } = useAuth();
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [dots, setDots]         = useState('');
  const [platformName, setPlatformName] = useState('SiteTrack');

  // Fetch global platform name
  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 'global').single()
      .then(({ data }) => {
        if (data?.platform_name) setPlatformName(data.platform_name);
      });
  }, []);

  // Already logged in → skip login form
  useEffect(() => {
    if (hydrated && user) router.replace('/dashboard');
  }, [hydrated, user, router]);

  // Animated dots for the live indicator
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await signIn(email.trim(), password);
    setLoading(false);
    if (error) toast.error(error);
    else { toast.success('Access granted.'); router.replace('/dashboard'); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#030712' }}>

      {/* ── Left: Platform info panel ── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden flex-shrink-0"
        style={{ width: 460, background: 'linear-gradient(160deg, #050d1a 0%, #090f1f 60%, #0a1628 100%)', borderRight: '1px solid rgba(99,179,237,0.08)' }}>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,179,237,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Radial glow */}
        <div className="absolute w-[500px] h-[500px] rounded-full -top-32 -left-32 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full bottom-0 right-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,179,237,0.05) 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10 p-10 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center relative"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', boxShadow: '0 0 24px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <Shield size={20} color="#93c5fd" strokeWidth={2} />
            </div>
            <div>
              <p className="font-extrabold text-base leading-none tracking-tight" style={{ color: '#e2e8f0' }}>{platformName.toUpperCase()} PLATFORM</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'rgba(147,197,253,0.5)' }}>Superadmin Control Center</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 px-10 flex-1 flex flex-col justify-center">
          <div className="mb-10">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#60a5fa' }} />
              <span className="text-xs font-mono font-semibold" style={{ color: '#93c5fd' }}>
                SYSTEM OPERATIONAL{dots}
              </span>
            </div>

            <h2 className="text-3xl font-black leading-tight mb-4" style={{ color: '#f1f5f9', letterSpacing: '-0.04em' }}>
              Platform<br />
              <span style={{ color: '#3b82f6' }}>Command</span> Center
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Restricted access. Authorised personnel only. All sessions are logged and monitored.
            </p>
          </div>

          {/* Platform stats */}
          <div className="space-y-3 mb-10">
            {PLATFORM_STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <Icon size={15} style={{ color: '#60a5fa' }} />
                </div>
                <span className="text-sm font-medium flex-1" style={{ color: 'rgba(148,163,184,0.9)' }}>{label}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <div className="flex items-start gap-2.5">
              <Lock size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(252,165,165,0.8)' }}>
                Unauthorised access attempts are automatically blocked and reported. This system is monitored 24/7.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 p-10 pt-6">
          <p className="text-xs font-mono" style={{ color: 'rgba(100,116,139,0.6)' }}>
            © 2026 {platformName} Platform · Restricted System
          </p>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)' }}>
              <Shield size={17} color="#93c5fd" strokeWidth={2} />
            </div>
            <span className="text-base font-extrabold" style={{ color: '#e2e8f0', letterSpacing: '-0.02em' }}>{platformName.toUpperCase()} SUPERADMIN</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8"
            style={{ background: '#0f172a', border: '1px solid rgba(99,179,237,0.1)', boxShadow: '0 0 0 1px rgba(37,99,235,0.05), 0 32px 64px rgba(0,0,0,0.5)' }}>

            <div className="mb-7">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.2)' }}>
                  <Shield size={16} style={{ color: '#60a5fa' }} />
                </div>
                <span className="text-xs font-mono font-semibold" style={{ color: '#60a5fa' }}>SUPERADMIN ACCESS</span>
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ color: '#f1f5f9', letterSpacing: '-0.04em' }}>
                Authenticate
              </h1>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.7)' }}>
                Enter your credentials to access the platform control center.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  Administrator Email
                </label>
                <input
                  id="superadmin-email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required placeholder={`admin@${platformName.toLowerCase().replace(/\s+/g, '')}.com.au`} autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all font-mono"
                  style={{ borderColor: 'rgba(37,99,235,0.25)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0' }}
                  onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(37,99,235,0.25)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.7)' }}>
                  Access Key
                </label>
                <div className="relative">
                  <input
                    id="superadmin-password" type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    required placeholder="••••••••••••" autoComplete="current-password"
                    className="w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all font-mono"
                    style={{ borderColor: 'rgba(37,99,235,0.25)', background: 'rgba(15,23,42,0.8)', color: '#e2e8f0' }}
                    onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(37,99,235,0.25)'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all mt-2 active:scale-[0.98]"
                style={{
                  background: loading ? 'rgba(37,99,235,0.3)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                  boxShadow: loading ? 'none' : '0 0 24px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                  color: loading ? 'rgba(147,197,253,0.5)' : '#fff',
                }}>
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />Authenticating…</>
                ) : (
                  <>Authenticate <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t flex items-center gap-2" style={{ borderColor: 'rgba(37,99,235,0.12)' }}>
              <Lock size={12} style={{ color: 'rgba(100,116,139,0.6)' }} />
              <p className="text-xs font-mono" style={{ color: 'rgba(100,116,139,0.6)' }}>
                Platform Superadmin Only · Sessions are monitored
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
