import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, Smartphone, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | UMA Building Services',
  description: 'UMA Building Services is a specialist fire safety and building compliance company operating across commercial and industrial properties in Australia.',
};

const VALUES = [
  {
    icon: Shield,
    title: 'Accountability First',
    body: 'We believe that every fire safety inspection should leave a clear, unambiguous record — not a general statement that a site was "serviced". Every asset. Every result. Every time.',
  },
  {
    icon: FileText,
    title: 'Documentation as Standard',
    body: 'Structured reporting is not optional for us — it is the output of every job we complete. A PDF service report is generated automatically, so clients never have to chase paperwork.',
  },
  {
    icon: Smartphone,
    title: 'Built to Scale Digitally',
    body: 'We operate with our own purpose-built platform across every job. This means consistent process quality whether we are servicing one property or one hundred.',
  },
];

const CONTRAST = [
  { old: 'Paper forms filled out by hand on site', uma: 'Digital logging via our mobile app in real time' },
  { old: 'General site-level pass/fail notation', uma: 'Per-asset Pass/Fail logged individually' },
  { old: 'Reports created manually after the visit', uma: 'PDF report generated automatically at job completion' },
  { old: 'No photographic evidence of defects', uma: 'Photos captured and attached to the job record on site' },
  { old: 'Compliance records held locally or on paper', uma: 'All records stored digitally, accessible when needed' },
];

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(145deg,#060f1e 0%,#0A1628 40%,#0F1E3C 100%)', paddingTop: 72 }}>
        <div className="container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 20 }}>
            About UMA Building Services
          </p>
          <h1 style={{ fontSize: 'clamp(34px,4.8vw,56px)', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1.07, marginBottom: 24, maxWidth: 660 }}>
            Building Services Should Leave a Clear Record. We Built Our Company Around That.
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.48)', lineHeight: 1.8, maxWidth: 500 }}>
            UMA Building Services is a specialist fire safety inspection and defect repair company operating across commercial and industrial properties throughout Australia.
          </p>
        </div>
      </section>

      {/* ── Company Statement ── */}
      <section style={{ background: 'white', padding: '72px 0', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container" style={{ maxWidth: 780 }}>
          <p style={{ fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 600, color: '#111827', lineHeight: 1.75, letterSpacing: '-0.01em' }}>
            The building services industry has long relied on paper-based processes — forms filled out by hand, reports written up after the fact, compliance records that are difficult to retrieve and hard to verify.
          </p>
          <p style={{ fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 600, color: '#6B7280', lineHeight: 1.75, letterSpacing: '-0.01em', marginTop: 20 }}>
            We started UMA Building Services because we believed there was a better way to manage this work — and so we built the platform to support it ourselves.
          </p>
        </div>
      </section>

      {/* ── Old Way vs UMA Way ── */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="container">
          <div style={{ maxWidth: 520, marginBottom: 52 }}>
            <p className="section-eyebrow">A Different Approach</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              How We Operate Differently
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              Most fire safety companies still operate the way they always have. We don&apos;t.
            </p>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', background: 'white' }}>
            {/* Table Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ padding: '14px 24px', background: '#F9FAFB', borderRight: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>The Traditional Approach</span>
              </div>
              <div style={{ padding: '14px 24px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F97316' }}>The UMA Approach</span>
              </div>
            </div>
            {/* Rows */}
            {CONTRAST.map((row, i, arr) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ padding: '18px 24px', borderRight: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#F3F4F6', border: '1px solid #E5E7EB', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: '#9CA3AF', lineHeight: 1.6 }}>{row.old}</span>
                </div>
                <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14.5, color: '#111827', fontWeight: 500, lineHeight: 1.6 }}>{row.uma}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 52px' }}>
            <p className="section-eyebrow" style={{ textAlign: 'center' }}>What We Stand For</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>The Principles We Work By</h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              Every job we carry out is guided by three non-negotiable principles.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {VALUES.map(v => {
              const Icon = v.icon;
              return (
                <div key={v.title} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '36px 30px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(15,30,60,0.07)', border: '1px solid rgba(15,30,60,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                    <Icon size={20} color="#0F1E3C" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 12, letterSpacing: '-0.015em', lineHeight: 1.3 }}>{v.title}</h3>
                  <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.8 }}>{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
        <style>{`@media(max-width:800px){.values-grid{grid-template-columns:1fr!important}}`}</style>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'linear-gradient(135deg,#0A1628 0%,#0F1E3C 50%,#1B2D4F 100%)', padding: '96px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 20 }}>Work With Us</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 500, margin: '0 auto 20px' }}>
            Ready to Get Your Property Serviced?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 380, margin: '0 auto 40px', lineHeight: 1.75 }}>
            Send us your property details and we&apos;ll respond within one business day.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
            Get a Free Quote <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
