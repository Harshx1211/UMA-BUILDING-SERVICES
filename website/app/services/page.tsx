import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, ClipboardList, Camera, FileText, PenLine, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Our Services | UMA Building Services',
  description: 'Learn what happens on every UMA Building Services inspection — per-asset logging, photo evidence, defect classification, and digital PDF report generation.',
};

const VISIT_STEPS = [
  { icon: ClipboardList, title: 'Asset-by-Asset Inspection', description: 'Every fire safety asset on site is inspected individually. Each asset is logged with a Pass or Fail result — not a blanket site-level rating.' },
  { icon: Camera,        title: 'Photo Evidence Captured',   description: 'Where defects are found, our technician photographs the asset on-site. Photos are attached to the job record and included in the report.' },
  { icon: ClipboardList, title: 'Defect Classification',     description: 'Any failed asset is classified by severity. Defects are recorded with a description, location, and recommended action for remediation.' },
  { icon: PenLine,       title: 'Client Signature',          description: 'The attending technician collects a client signature at job completion, confirming the service was carried out on that date.' },
  { icon: FileText,      title: 'PDF Report Generated',      description: 'A structured service report is generated automatically at job completion — covering every asset inspected, its result, and any defects found.' },
];

const FREQUENCIES = [
  { schedule: 'Monthly',    heading: 'High-Frequency Compliance',  body: 'Monthly inspections are suited to properties with high asset counts or occupancy levels where more frequent compliance checks are required.' },
  { schedule: '3-Monthly',  heading: 'Quarterly Service Visits',   body: 'A 3-monthly schedule covers properties that require quarterly inspection cycles, typically aligned with specific AS1851 asset class requirements.' },
  { schedule: '6-Monthly',  heading: 'Bi-Annual Compliance',       body: 'Half-yearly inspections are one of the most common schedules for commercial tenancies — covering the bulk of routine fire safety assets.' },
  { schedule: 'Annual',     heading: 'Yearly Inspection',          body: 'Annual inspections cover the broadest range of assets. This is the minimum inspection frequency for most commercial and industrial properties.' },
  { schedule: '5-Yearly',   heading: 'Major Periodic Inspection',  body: 'A 5-yearly inspection covers extended compliance checks — such as full flow testing on sprinkler systems — that go beyond the annual routine.' },
  { schedule: 'On Request', heading: 'Defect Assessment & Repair', body: 'Where defects are identified, we carry out a site visit to assess and quote the repair. Work is completed upon your written approval.' },
];

const REPORT_ITEMS = [
  'Property details and service date',
  'Full list of assets inspected with Pass / Fail results',
  'Defect descriptions with location and severity',
  'Photographs of any defects found',
  'Technician name and client signature',
  'Job reference number for your records',
];

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(145deg,#060f1e 0%,#0A1628 40%,#0F1E3C 100%)', paddingTop: 72 }}>
        <div className="container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 20 }}>
            Services
          </p>
          <h1 style={{ fontSize: 'clamp(30px,7.5vw,58px)', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 22, maxWidth: 640 }}>
            What Happens on Every Service Visit
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.50)', lineHeight: 1.8, maxWidth: 500, marginBottom: 36 }}>
            Every job we carry out follows the same structured digital process — regardless of service frequency.
          </p>
          <div className="cta-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 26px' }}>
              Get a Free Quote <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* What happens on a visit */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 48 }}>
            <p className="section-eyebrow">The Process</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              What Our Technician Does on Site
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              Every inspection is logged through our own platform in real time. The record is created as the job is carried out — not filled in afterward.
            </p>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            {VISIT_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="visit-step-row" style={{ borderBottom: i < VISIT_STEPS.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div className="visit-step-left">
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#D1D5DB', letterSpacing: '0.04em', minWidth: 22 }}>0{i + 1}</span>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(15,30,60,0.07)', border: '1px solid rgba(15,30,60,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="#0F1E3C" strokeWidth={1.8} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', marginBottom: 6, letterSpacing: '-0.01em' }}>{step.title}</h3>
                    <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.75 }}>{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What the report contains */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="container">
          <div className="svc-report-grid">
            <div>
              <p className="section-eyebrow">The Report</p>
              <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 20 }}>
                What Your PDF Service Report Includes
              </h2>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8, marginBottom: 16 }}>
                A PDF service report is generated automatically at the completion of every job. It is a structured document built from the data logged by your technician on site.
              </p>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8 }}>
                Reports are stored digitally and can be provided to building owners, property managers, or compliance auditors as required.
              </p>
            </div>
            <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 14, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 22 }}>Report Contents</p>
              {REPORT_ITEMS.map((item, i, arr) => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0, marginBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <CheckCircle size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service frequencies detail */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 48 }}>
            <p className="section-eyebrow">Service Frequencies</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              Which Frequency Is Right for Your Property?
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              Under AS1851, different fire safety asset classes require inspection at different intervals. We service every frequency — from monthly through to 5-yearly.
            </p>
          </div>
          <div className="services-grid">
            {FREQUENCIES.map(f => (
              <div key={f.schedule} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '24px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <CalendarClock size={15} color="#9CA3AF" strokeWidth={1.8} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF' }}>{f.schedule}</span>
                </div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: '#111827', marginBottom: 8, letterSpacing: '-0.01em' }}>{f.heading}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg,#0A1628 0%,#0F1E3C 50%,#1B2D4F 100%)', padding: '88px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 20 }}>Get Started</p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 520, margin: '0 auto 20px' }}>
            Ready to Book a Service?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: '0 auto 36px', lineHeight: 1.75 }}>
            Tell us your property address and preferred frequency.
          </p>
          <div className="cta-group" style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
              Get a Free Quote <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        /* Visit step row */
        .visit-step-row {
          display: flex; align-items: flex-start; gap: 20;
          padding: 24px 24px; background: white;
        }
        .visit-step-left {
          display: flex; align-items: center; gap: 14px; flex-shrink: 0;
        }
        /* Report grid */
        .svc-report-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .svc-report-grid { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 640px) {
          .visit-step-row { padding: 18px 16px; gap: 14px; }
          .visit-step-left { gap: 10px; }
        }
        @media (max-width: 480px) {
          .visit-step-left span:first-child { display: none; }
        }
      `}</style>
    </>
  );
}
