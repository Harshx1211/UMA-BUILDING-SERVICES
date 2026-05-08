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
        background: 'linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 100%)',
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
            Get In Touch
          </h1>
          <p className="body-lg" style={{ color: 'rgba(255,255,255,0.62)', maxWidth: 500 }}>
            Send us an enquiry and we&apos;ll get back to you to discuss your property&apos;s service requirements.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="section" style={{ background: '#F8FAFC' }}>
        <div className="container">
          {/* ← Using .contact-grid CSS class — 1fr 2fr → stacks on mobile */}
          <div className="contact-grid">

            {/* Left sidebar */}
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0F1E3C', marginBottom: 8, letterSpacing: '-0.025em' }}>
                Enquiry Details
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, marginBottom: 32 }}>
                Fill in the form with as much detail as possible and we&apos;ll be in touch promptly.
              </p>

              {/* Contact info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
                <a href="mailto:info@umabuildingservices.com.au"
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
                  className="contact-info-link"
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(249,115,22,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mail size={18} color="#F97316" />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>Email</p>
                    <p style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>info@umabuildingservices.com.au</p>
                  </div>
                </a>

                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(27,45,79,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Clock size={18} color="#1B2D4F" />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>Response Time</p>
                    <p style={{ fontSize: 14, color: '#334155', fontWeight: 500 }}>We aim to respond within 1 business day</p>
                  </div>
                </div>
              </div>

              {/* What happens next */}
              <div style={{ background: '#0F1E3C', borderRadius: 18, padding: '24px 22px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: -30, right: -30, width: 150, height: 150,
                  borderRadius: '50%', background: 'rgba(249,115,22,0.10)', filter: 'blur(30px)', pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.80)', marginBottom: 18 }}>
                    What Happens Next
                  </p>
                  {[
                    'We receive and review your enquiry',
                    'We contact you to discuss requirements',
                    'We schedule a service visit for your site',
                    'Your job is set up in our system',
                  ].map((step, i) => (
                    <div key={step} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '10px 0',
                      borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(249,115,22,0.18)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 900, color: '#F97316',
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Form card */}
            <div style={{
              background: 'white', borderRadius: 22,
              border: '1px solid #e2e8f0', padding: '40px 36px',
              boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
            }}>
              {status === 'success' ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(34,197,94,0.10)', border: '2px solid rgba(34,197,94,0.20)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px',
                  }}>
                    <CheckCircle size={38} color="#22c55e" />
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0F1E3C', marginBottom: 12, letterSpacing: '-0.02em' }}>
                    Enquiry Received!
                  </h3>
                  <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.75, maxWidth: 340, margin: '0 auto 32px' }}>
                    Thank you for getting in touch. We&apos;ll review your details and contact you shortly.
                  </p>
                  <button onClick={() => setStatus('idle')} className="btn btn-navy" style={{ fontSize: 14 }}>
                    Send Another Enquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} id="enquiry-form" noValidate>
                  <h3 style={{ fontSize: 19, fontWeight: 800, color: '#0F1E3C', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    Service Enquiry
                  </h3>
                  <p style={{ fontSize: 13.5, color: '#94a3b8', marginBottom: 28 }}>
                    Fields marked * are required
                  </p>

                  {/* Row 1 */}
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-name">Full Name *</label>
                      <input id="inp-name" className="form-input" placeholder="Your full name"
                        value={form.name} onChange={e => set('name', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-company">Company</label>
                      <input id="inp-company" className="form-input" placeholder="Company or organisation"
                        value={form.company} onChange={e => set('company', e.target.value)} />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-email">Email Address *</label>
                      <input id="inp-email" type="email" className="form-input" placeholder="you@company.com"
                        value={form.email} onChange={e => set('email', e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-phone">Phone Number</label>
                      <input id="inp-phone" type="tel" className="form-input" placeholder="04XX XXX XXX"
                        value={form.phone} onChange={e => set('phone', e.target.value)} />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="form-grid-2" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-service">Service Type</label>
                      <select id="inp-service" className="form-input"
                        value={form.service_type} onChange={e => set('service_type', e.target.value)}
                        style={{ cursor: 'pointer' }}>
                        <option value="">Select a service…</option>
                        {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="inp-address">Property Address</label>
                      <input id="inp-address" className="form-input" placeholder="Street, suburb or postcode"
                        value={form.property_address} onChange={e => set('property_address', e.target.value)} />
                    </div>
                  </div>

                  {/* Message */}
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label className="form-label" htmlFor="inp-message">Message *</label>
                    <textarea id="inp-message" className="form-input" rows={5}
                      placeholder="Tell us about your property, the service you need, and any specific requirements…"
                      value={form.message} onChange={e => set('message', e.target.value)}
                      required style={{ resize: 'vertical', minHeight: 120 }}
                    />
                  </div>

                  {status === 'error' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', borderRadius: 10,
                      background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 16,
                    }}>
                      <AlertCircle size={16} color="#ef4444" />
                      <span style={{ fontSize: 14, color: '#ef4444' }}>{errorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    id="enquiry-submit-btn"
                    disabled={status === 'sending'}
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: 15, padding: '14px 0', opacity: status === 'sending' ? 0.75 : 1 }}
                  >
                    {status === 'sending'
                      ? <><Loader size={17} className="animate-spin-slow" /> Sending Enquiry…</>
                      : <><Send size={17} /> Send Enquiry</>
                    }
                  </button>

                  <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 14 }}>
                    We&apos;ll respond within 1 business day.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>

        <style>{`
          .contact-info-link { transition: opacity 150ms; }
          .contact-info-link:hover { opacity: 0.75; }
        `}</style>
      </section>
    </>
  );
}
