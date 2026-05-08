import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, Wrench, CheckCircle, FileText, CheckSquare, Clock, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Our Services',
  description:
    'UMA Building Services offers routine maintenance inspections at monthly, 3-monthly, 6-monthly, annual and 5-yearly frequencies, plus quote and defect repair services.',
};

const SERVICE_DETAIL = [
  {
    id: 'svc-routine-service',
    icon: CalendarClock,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.18)',
    tag: 'Routine Service',
    title: 'Routine Maintenance Inspections',
    body: 'We carry out scheduled maintenance inspections of fire safety assets and building systems at a frequency agreed with you. All available schedules are listed below.',
    frequencies: [
      { label: 'Monthly',   detail: 'Suitable for high-traffic sites requiring frequent compliance checks.' },
      { label: '3-Monthly', detail: 'Quarterly inspections covering periodic checks at 3-month intervals.' },
      { label: '6-Monthly', detail: 'Bi-annual visits for sites that require half-yearly service.' },
      { label: 'Annual',    detail: 'Comprehensive yearly inspections with full digital service report.' },
      { label: '5-Yearly',  detail: 'Major periodic inspections at 5-year intervals as required.' },
    ],
    what: [
      'On-site attendance by an assigned technician',
      'Per-asset inspection — Pass / Fail logged for each item',
      'Photo evidence captured where required',
      'Defects identified, classified by severity, and recorded',
      'Digital PDF service report generated at job completion',
      'Client signature collected at end of service',
    ],
  },
  {
    id: 'svc-defect-repair',
    icon: Wrench,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.18)',
    tag: 'Defect Repair',
    title: 'Quote & Defect Repair',
    body: 'When defects are identified — either during a routine inspection or reported by you — we arrange a site visit to assess and quote the rectification work. Upon approval, our technician carries out the repair.',
    frequencies: null,
    what: [
      'Site visit to assess the reported defect',
      'Formal written quote provided for repair work',
      'Repair carried out upon your written approval',
      'Defect status updated in our management system',
      'Digital service report updated to reflect repair',
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <style>{`
        .svc-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .svc-detail-grid { grid-template-columns: 1fr; gap: 40px; }
        }
      `}</style>

      {/* Page hero */}
      <section style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0F1E3C 55%, #1B2D4F 100%)',
        padding: '130px 0 88px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(249,115,22,0.10)', filter: 'blur(90px)',
          top: '-100px', right: '-80px', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '52px 52px', pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', marginBottom: 22,
            background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: 999,
          }}>
            <CheckSquare size={13} color="#F97316" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fdba74' }}>
              What We Do
            </span>
          </div>
          <h1 className="heading-xl" style={{ color: 'white', marginBottom: 18, maxWidth: 560 }}>
            Our Services
          </h1>
          <p className="body-lg" style={{ color: 'rgba(255,255,255,0.60)', maxWidth: 520, marginBottom: 36 }}>
            Routine maintenance inspections across every service frequency, plus defect assessment and repair — all fully tracked and digitally reported.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <a href="#svc-routine-service" className="btn btn-primary" style={{ fontSize: 14 }}>
              Routine Inspections <ArrowRight size={15} />
            </a>
            <a href="#svc-defect-repair" className="btn btn-outline" style={{ fontSize: 14 }}>
              Defect Repair
            </a>
          </div>
        </div>
      </section>

      {/* Service Detail Sections */}
      {SERVICE_DETAIL.map((svc, idx) => {
        const Icon = svc.icon;
        return (
          <section
            key={svc.id}
            id={svc.id}
            className="section"
            style={{ background: idx % 2 === 0 ? 'white' : '#F8FAFC' }}
          >
            <div className="container">
              <div className="svc-detail-grid">

                {/* Left — description */}
                <div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '5px 14px', background: svc.bg,
                    border: `1px solid ${svc.border}`,
                    borderRadius: 999, marginBottom: 22,
                  }}>
                    <Icon size={13} color={svc.color} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: svc.color }}>
                      {svc.tag}
                    </span>
                  </div>

                  <h2 className="heading-md" style={{ color: '#0F1E3C', marginBottom: 18 }}>{svc.title}</h2>
                  <p className="body-md" style={{ color: '#64748b', marginBottom: 28, lineHeight: 1.85 }}>{svc.body}</p>

                  {svc.frequencies && (
                    <div style={{
                      background: '#F8FAFC', borderRadius: 16,
                      border: '1px solid #e2e8f0', padding: '20px 24px',
                      marginBottom: 32,
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 14 }}>
                        Available Schedules
                      </p>
                      {svc.frequencies.map((f, fi) => (
                        <div key={f.label} style={{
                          display: 'flex', gap: 14, padding: '12px 0',
                          borderBottom: fi < svc.frequencies!.length - 1 ? '1px solid #e2e8f0' : 'none',
                          alignItems: 'flex-start',
                        }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 12px', borderRadius: 999, flexShrink: 0,
                            background: 'rgba(249,115,22,0.09)',
                            border: '1px solid rgba(249,115,22,0.18)',
                          }}>
                            <Clock size={11} color="#F97316" />
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#ea6900' }}>{f.label}</span>
                          </div>
                          <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, paddingTop: 3 }}>{f.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link href="/contact" className="btn btn-primary" style={{ fontSize: 14 }}>
                    Enquire About This Service <ArrowRight size={15} />
                  </Link>
                </div>

                {/* Right — what's included */}
                <div style={{
                  background: 'linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 100%)',
                  borderRadius: 22, padding: '36px 32px',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: '0 16px 48px rgba(15,30,60,0.20)',
                }}>
                  <div style={{
                    position: 'absolute', top: -40, right: -40, width: 200, height: 200,
                    borderRadius: '50%', background: 'rgba(249,115,22,0.10)', filter: 'blur(40px)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: svc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${svc.border}`,
                      }}>
                        <Icon size={20} color={svc.color} />
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: 2 }}>Included</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>What You Get</p>
                      </div>
                    </div>
                    {svc.what.map(item => (
                      <div key={item} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <CheckCircle size={16} color="#4ade80" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.65 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
