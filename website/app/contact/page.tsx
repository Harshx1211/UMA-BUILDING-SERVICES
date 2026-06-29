'use client';
import { useState } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, Loader, Clock } from 'lucide-react';

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

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Server error');
      setStatus('success');
      setForm({ name: '', company: '', email: '', phone: '', service_type: '', property_address: '', message: '' });
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again or email us directly.');
    }
  };

  return (
    <>
      {/* Hero */}
      <section style={{
        padding: '130px 0 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 480, height: 480, borderRadius: '50%',
          background: 'rgba(249,115,22,0.10)', filter: 'blur(90px)',
          top: '-100px', right: '-80px', pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', marginBottom: 20,
            background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999,
          }}>
            <Mail size={13} color="#F97316" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fdba74' }}>
              Contact Us
            </span>
          </div>
          <h1 className="heading-xl" style={{ color: 'white', marginBottom: 16, maxWidth: 520 }}>
            Contact <span style={{ color: '#F97316' }}>Sales.</span>
          </h1>
          <p className="body-lg" style={{ color: 'rgba(255,255,255,0.62)', maxWidth: 500 }}>
            Ready to scale your fire safety business? Send us a message and we'll get you set up with a free trial of SiteTrack.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="section">
        <div className="container">
          {/* ← Using .contact-grid CSS class — 1fr 2fr → stacks on mobile */}
          <div className="contact-grid">

            {/* Left sidebar */}
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-0.025em' }}>
                Enquiry Details
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: 32 }}>
                Fill in the form with as much detail as possible and we&apos;ll be in touch promptly.
              </p>

              {/* Contact info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail size={15} color="rgba(255,255,255,0.7)" />
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>Email</p>
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>hello@sitetrack.app</p>
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
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '32px 32px 40px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              {status === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 20px' }} />
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 12 }}>Message Sent</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                    Thanks for reaching out! We&apos;ve received your details and will be in contact shortly to discuss your free trial.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Row 1 */}
                  <div className="form-row-2">
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        type="text" required 
                        className="form-input" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        value={form.name} onChange={e => set('name', e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Company</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        value={form.company} onChange={e => set('company', e.target.value)}
                        placeholder="Acme Fire Safety"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="form-row-2">
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                      <input 
                        type="email" required 
                        className="form-input" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        value={form.email} onChange={e => set('email', e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Phone Number</label>
                      <input 
                        type="tel" 
                        className="form-input" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        value={form.phone} onChange={e => set('phone', e.target.value)}
                        placeholder="0400 000 000"
                      />
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />

                  {/* Property */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>How many technicians do you have?</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                      value={form.property_address} onChange={e => set('property_address', e.target.value)}
                      placeholder="e.g. 1-5, 10+"
                    />
                  </div>

                  {/* Service type */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Primary Focus</label>
                    <select 
                      className="form-input"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                      value={form.service_type} onChange={e => set('service_type', e.target.value)}
                    >
                      <option value="" disabled style={{ color: 'black' }}>Select an option...</option>
                      <option value="Compliance" style={{ color: 'black' }}>Compliance & Reporting</option>
                      <option value="Defects" style={{ color: 'black' }}>Defect Repairs</option>
                      <option value="Both" style={{ color: 'black' }}>Both</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="form-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Message <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea 
                      required rows={5} 
                      className="form-input" 
                      style={{ resize: 'vertical', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                      value={form.message} onChange={e => set('message', e.target.value)}
                      placeholder="Tell us a bit about your business..."
                    />
                  </div>

                  {errorMsg && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '12px 14px', borderRadius: 8 }}>
                      <AlertCircle size={16} color="#DC2626" style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#991B1B', lineHeight: 1.5 }}>{errorMsg}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={status === 'sending'}
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: 8, padding: '14px 24px', fontSize: 15 }}
                  >
                    {status === 'sending' ? (
                      <><Loader size={16} className="animate-spin" /> Sending...</>
                    ) : (
                      <><Send size={16} /> Send Enquiry</>
                    )}
                  </button>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 }}>
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
