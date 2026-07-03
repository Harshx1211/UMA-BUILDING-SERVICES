import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, ClipboardList, Camera, FileText, PenLine, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Platform Features | SiteTrack',
  description: 'Learn how SiteTrack standardizes fire safety inspections with per-asset logging, photo evidence, and digital PDF generation.',
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

export default async function ServicesPage() {
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 'global').single();
  const platformName = data?.platform_name || 'SiteTrack';

  return (
    <>
      {/* Hero */}
      <section style={{ padding: 'var(--space-32) 0 var(--space-16)', position: 'relative', overflow: 'hidden' }}>
        {/* Background Glow */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'rgba(var(--orange-rgb), 0.07)', filter: 'blur(100px)',
          top: '-200px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
        }} />

        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-orange" style={{ marginBottom: 'var(--space-6)' }}>
            Features
          </div>
          <h1 className="heading-xl mx-auto" style={{ maxWidth: 800, color: 'white', marginBottom: 'var(--space-6)' }}>
            What Happens on <br /><span style={{ color: 'var(--orange)' }}>Every Mobile Job.</span>
          </h1>
          <p className="hero-sub mx-auto">
            Every inspection your technicians carry out follows a rigorous digital structure — resulting in perfect compliance records, every time.
          </p>
          <div className="cta-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
              Start Free Trial <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* What happens on a visit */}
      <section className="section">
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 'var(--space-12)' }}>
            <p className="section-eyebrow">The Mobile Process</p>
            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 'var(--space-4)' }}>
              What Your Technician Does on Site
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
              Every inspection is logged through the {platformName} mobile app in real time. The record is created as the job is carried out — not typed up afterward.
            </p>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            {VISIT_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="visit-step-row" style={{ borderBottom: i < VISIT_STEPS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'transparent' }}>
                  <div className="visit-step-left">
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em', minWidth: 22 }}>0{i + 1}</span>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(var(--orange-rgb), 0.1)', border: '1px solid rgba(var(--orange-rgb), 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={18} color="var(--orange)" strokeWidth={1.8} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="heading-sm" style={{ color: 'white', marginBottom: 6 }}>{step.title}</h3>
                    <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What the report contains */}
      <section className="section">
        <div className="container">
          <div className="svc-report-grid">
            <div>
              <p className="section-eyebrow">The PDF Output</p>
              <h2 className="heading-lg" style={{ color: 'white', marginBottom: 'var(--space-5)' }}>
                What Your Generated PDF Report Includes
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>
                A PDF service report is generated automatically by the platform at the completion of every job. It is a structured document built from the data logged by your technician on site.
              </p>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Reports are stored digitally and can be instantly emailed to building owners, property managers, or compliance auditors as required.
              </p>
            </div>
            <div className="card-glass" style={{ padding: '32px 28px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 22 }}>Report Contents</p>
              {REPORT_ITEMS.map((item, i, arr) => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < arr.length - 1 ? 14 : 0, marginBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <CheckCircle size={15} color="var(--orange)" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Service frequencies detail */}
      <section className="section">
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 'var(--space-12)' }}>
            <p className="section-eyebrow">Service Frequencies</p>
            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 'var(--space-4)' }}>
              Support For Every Compliance Cycle
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
              Under AS1851, different fire safety asset classes require inspection at different intervals. {platformName} supports scheduling for every frequency — from monthly through to 5-yearly.
            </p>
          </div>
          <div className="services-grid">
            {FREQUENCIES.map(f => (
              <div key={f.schedule} className="card-glass" style={{ padding: '24px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                  <CalendarClock size={15} color="var(--slate-400)" strokeWidth={1.8} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--slate-400)' }}>{f.schedule}</span>
                </div>
                <h3 className="heading-sm" style={{ color: 'white', marginBottom: 8 }}>{f.heading}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: 'var(--space-20) 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="heading-lg" style={{ color: 'white', maxWidth: 520, margin: '0 auto var(--space-5)' }}>
            Ready to upgrade your system?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: '0 auto var(--space-8)', lineHeight: 1.75 }}>
            Create an account and start managing properties today.
          </p>
          <div className="cta-group" style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
              Get Started <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        .visit-step-row {
          display: flex; align-items: flex-start; gap: 20;
          padding: 24px 24px; background: transparent;
        }
        .visit-step-left {
          display: flex; align-items: center; gap: 14px; flex-shrink: 0;
        }
        /* Report grid */
        .svc-report-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-16);
          align-items: start;
        }
        @media (max-width: 900px) {
          .svc-report-grid { grid-template-columns: 1fr; gap: var(--space-10); }
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
