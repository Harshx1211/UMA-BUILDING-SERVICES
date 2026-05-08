import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckSquare, CalendarClock, Wrench, FileText, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Our Services | UMA Building Services',
  description: 'Routine fire safety inspections from monthly to 5-yearly, plus defect repair services across commercial and industrial properties.',
};

const SERVICES = [
  { icon: CalendarClock, schedule: 'Monthly',   title: 'Monthly Routine Service',   description: 'Regular monthly inspections for high-traffic commercial properties requiring frequent compliance visits.' },
  { icon: CalendarClock, schedule: '3-Monthly',  title: '3-Monthly Routine Service',  description: 'Quarterly inspections covering all required periodic checks across every installed fire safety asset on site.' },
  { icon: CalendarClock, schedule: '6-Monthly',  title: '6-Monthly Routine Service',  description: 'Bi-annual inspections — a common schedule for many commercial and industrial properties across Australia.' },
  { icon: CheckSquare,   schedule: 'Annual',     title: 'Annual Routine Service',     description: 'Comprehensive yearly inspections with a full digital PDF service report generated at job completion.' },
  { icon: FileText,      schedule: '5-Yearly',   title: '5-Yearly Routine Service',   description: 'Major periodic inspections covering extended compliance checks beyond standard annual requirements.' },
  { icon: Wrench,        schedule: 'On Request', title: 'Quote / Defect Repair',      description: 'We assess and repair defects found during inspections. Quoted and carried out upon your written approval.' },
];

const WHAT_INCLUDED = [
  'Digital job managed through our own platform',
  'Per-asset Pass/Fail inspection logging',
  'Photo evidence captured during the job',
  'Defect classification by severity',
  'Client signature collected on-site',
  'Structured PDF service report at completion',
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(145deg,#060f1e 0%,#0A1628 40%,#0F1E3C 100%)', paddingTop: 72 }}>
        <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 20 }}>
            Services
          </p>
          <h1 style={{ fontSize: 'clamp(36px,5vw,58px)', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 22, maxWidth: 620 }}>
            Routine Inspections &amp; Defect Repair Services
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.50)', lineHeight: 1.8, maxWidth: 500, marginBottom: 36 }}>
            Every service we carry out is fully tracked through our own platform — with a digital PDF report generated at job completion.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
            Get a Free Quote <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Services Grid */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 52 }}>
            <p className="section-eyebrow">What We Offer</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>All Service Frequencies</h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              We offer every routine service frequency required under AS1851 — from monthly through to 5-yearly — as well as on-request defect repair services.
            </p>
          </div>
          <div className="services-grid">
            {SERVICES.map(svc => {
              const Icon = svc.icon;
              return (
                <div key={svc.title} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '28px 26px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(15,30,60,0.07)', border: '1px solid rgba(15,30,60,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="#0F1E3C" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 7, letterSpacing: '-0.01em' }}>{svc.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75 }}>{svc.description}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF' }}>{svc.schedule}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
            <div>
              <p className="section-eyebrow">Every Job Includes</p>
              <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 20 }}>
                What Happens on Every Service Visit
              </h2>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8 }}>
                Whether it&apos;s a monthly routine service or a once-a-year inspection, every job we carry out follows the same digital process — ensuring consistent, accurate records for every property we service.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {WHAT_INCLUDED.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316' }} />
                  </div>
                  <span style={{ fontSize: 14.5, color: '#374151', fontWeight: 500 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <style>{`@media(max-width:900px){.svc-incl-grid{grid-template-columns:1fr!important}}`}</style>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg,#0A1628 0%,#0F1E3C 50%,#1B2D4F 100%)', padding: '96px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 20 }}>Get Started</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 520, margin: '0 auto 20px' }}>
            Ready to Book a Service?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: '0 auto 40px', lineHeight: 1.75 }}>
            Contact us with your property details and preferred service frequency.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
            Get a Free Quote <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
