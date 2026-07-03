'use client';
import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, Loader, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const SERVICE_OPTIONS = [
  'Routine Service: Monthly',
  'Routine Service: 3 Monthly',
  'Routine Service: 6 Monthly',
  'Routine Service: Annual',
  'Routine Service: 5 Yearly',
  'Quote / Defect Repair',
  'Not Sure, Need Advice',
];

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    service_type: '',
    property_address: '',
    message: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [platformName, setPlatformName] = useState('SiteTrack');
  const [supportEmail, setSupportEmail] = useState('hello@sitetrack.app');

  const [mathA, setMathA] = useState(0);
  const [mathB, setMathB] = useState(0);
  const [mathAnswer, setMathAnswer] = useState('');

  useEffect(() => {
    setMathA(Math.floor(Math.random() * 10) + 1);
    setMathB(Math.floor(Math.random() * 10) + 1);
  }, []);

  useEffect(() => {
    supabase.from('platform_settings').select('platform_name, support_email').eq('id', 'global').single().then(({ data }) => {
      if (data?.platform_name) setPlatformName(data.platform_name);
      if (data?.support_email) setSupportEmail(data.support_email);
    });
  }, []);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    
    if (parseInt(mathAnswer) !== mathA + mathB) {
      setErrorMsg('Incorrect math answer. Please try again.');
      return;
    }

    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error');
      }
      setStatus('success');
      setForm({ name: '', company: '', email: '', phone: '', service_type: '', property_address: '', message: '' });
      setMathAnswer('');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again or email us directly.');
    }
  };

  return (
    <>
      {/* Hero */}
      <section style={{
        padding: 'var(--space-32) 0 var(--space-20)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 480, height: 480, borderRadius: '50%',
          background: 'rgba(var(--orange-rgb), 0.10)', filter: 'blur(90px)',
          top: '-100px', right: '-80px', pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', marginBottom: 'var(--space-5)',
            background: 'rgba(var(--orange-rgb), 0.14)', border: '1px solid rgba(var(--orange-rgb), 0.25)', borderRadius: 999,
          }}>
            <Mail size={13} color="var(--orange)" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--orange-tint)' }}>
              Contact Us
            </span>
          </div>
          <h1 className="heading-xl" style={{ color: 'white', marginBottom: 'var(--space-4)', maxWidth: 520 }}>
            Contact <span style={{ color: 'var(--orange)' }}>Sales.</span>
          </h1>
          <p className="body-lg" style={{ color: 'rgba(255,255,255,0.62)', maxWidth: 500 }}>
            Ready to scale your fire safety business? Send us a message and we'll get you set up with a free trial of {platformName}.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="section">
        <div className="container">
          <div className="contact-grid">

            {/* Left sidebar */}
            <div>
              <h2 className="heading-md" style={{ color: 'white', marginBottom: 'var(--space-2)' }}>
                Enquiry Details
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: 'var(--space-8)' }}>
                Fill in the form with as much detail as possible and we&apos;ll be in touch promptly.
              </p>

              {/* Contact info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 'var(--space-10)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={15} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>Email</p>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{supportEmail}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={15} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>Hours</p>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Mon-Fri, 9am - 5pm AEST</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="card-glass" style={{ padding: '32px 32px 40px' }}>
              {status === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 20px' }} />
                  <h3 className="heading-md" style={{ color: 'white', marginBottom: 'var(--space-3)' }}>Message Sent</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                    Thanks for reaching out! We&apos;ve received your details and will be in contact shortly to discuss your free trial.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Row 1 */}
                  <div className="form-grid-2">
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input 
                        type="text" required 
                        className="form-input" 
                        value={form.name} onChange={e => set('name', e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Company</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={form.company} onChange={e => set('company', e.target.value)}
                        placeholder="Acme Fire Safety"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="form-grid-2">
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input 
                        type="email" required 
                        className="form-input" 
                        value={form.email} onChange={e => set('email', e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Phone Number</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        value={form.phone} onChange={e => set('phone', e.target.value)}
                        placeholder="0400 000 000"
                      />
                    </div>
                  </div>

                  {/* Property */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>How many technicians do you have?</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={form.property_address} onChange={e => set('property_address', e.target.value)}
                      placeholder="e.g. 1-5, 10+"
                    />
                  </div>

                  {/* Service type */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Primary Focus</label>
                    <select 
                      className="form-input"
                      value={form.service_type} onChange={e => set('service_type', e.target.value)}
                    >
                      <option value="" disabled>Select an option...</option>
                      <option value="Compliance">Compliance & Reporting</option>
                      <option value="Defects">Defect Repairs</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Message <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      required rows={5} 
                      className="form-input" 
                      style={{ resize: 'vertical' }}
                      value={form.message} onChange={e => set('message', e.target.value)}
                      placeholder="Tell us a bit about your business..."
                    />
                  </div>

                  {errorMsg && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(var(--danger-rgb), 0.1)', border: '1px solid rgba(var(--danger-rgb), 0.3)', padding: '12px 14px', borderRadius: 8, marginTop: 4 }}>
                      <AlertCircle size={16} color="var(--danger)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{errorMsg}</span>
                    </div>
                  )}

                  {/* Math Captcha - Transparent Inline Widget */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, marginBottom: 4 }}>
                    <ShieldAlert size={16} color="var(--orange)" />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}>Security Check: What is {mathA} + {mathB}?</span>
                    <input 
                      type="number" required 
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 700, width: 64, textAlign: 'center', padding: '8px', outline: 'none', transition: 'all 0.2s' }}
                      className="focus:border-[var(--orange)] focus:shadow-[0_0_0_2px_rgba(var(--orange-rgb),0.15)]"
                      value={mathAnswer} onChange={e => setMathAnswer(e.target.value)}
                      placeholder="?"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={status === 'sending'}
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {status === 'sending' ? (
                      <><Loader size={16} className="animate-spin" /> Sending...</>
                    ) : (
                      <><Send size={16} /> Send Enquiry</>
                    )}
                  </button>
                  
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 }}>
                    Your data is secure. We don&apos;t share your information.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .contact-info-link { transition: opacity 150ms; }
        `}</style>
      </section>
    </>
  );
}
