import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, Smartphone, ArrowRight, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | SiteTrack',
  description: 'SiteTrack is the leading platform for fire safety and compliance management.',
};

const VALUES = [
  {
    icon: Shield,
    title: 'Accountability First',
    body: 'Every asset. Every result. Every time. We believe a fire safety inspection should produce a clear, per-asset record — not a general statement that a site was "checked".',
  },
  {
    icon: FileText,
    title: 'Documentation as Standard',
    body: 'A structured PDF report is generated automatically at the end of every job. Not on request, not delayed — it is the standard output of every service visit we complete.',
  },
  {
    icon: Smartphone,
    title: 'Built to Scale Digitally',
    body: 'We operate with our own purpose-built platform across every job. Consistent process. Consistent output. Whether we are servicing one property or one hundred.',
  },
];

const CONTRAST = [
  { old: 'Paper forms filled out by hand on site',      uma: 'Digital logging via offline-first mobile app in real time' },
  { old: 'General pass/fail notation per site visit',   uma: 'Per-asset Pass/Fail result logged individually, every job' },
  { old: 'Reports written up manually after the visit', uma: 'AS1851 PDF report auto-generated instantly on job completion' },
  { old: 'No photographic evidence attached',           uma: 'Photos captured on-site, synced to the cloud, and linked to the job record' },
  { old: 'Paper compliance records, hard to retrieve',  uma: 'All records stored digitally, multi-tenant secure, and accessible instantly' },
];

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────── */}
      <section style={{ paddingTop: 110, paddingBottom: 60, position: 'relative', overflow: 'hidden' }}>
        {/* Background Glow */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'rgba(249,115,22,0.07)', filter: 'blur(100px)',
          top: '-200px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
        }} />

        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 999, marginBottom: 24
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fdba74', letterSpacing: '0.04em' }}>
              About SiteTrack
            </span>
          </div>
          <h1 className="heading-xl mx-auto" style={{ color: 'white', marginBottom: 24 }}>
            A Platform Built Around<br />the <span style={{ color: '#F97316' }}>Paper Problem.</span>
          </h1>
          <p className="hero-sub mx-auto">
            SiteTrack is the operating system for fire safety inspection and defect repair companies operating across commercial and industrial properties.
          </p>
          <div className="cta-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
              Get in Touch <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Our Story — 2-col ────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="about-story-grid">
            <div>
              <p className="section-eyebrow">Our Story</p>
              <h2 className="heading-lg" style={{ color: 'white', marginBottom: 24 }}>
                Why SiteTrack Exists
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.85, marginBottom: 18 }}>
                The building services industry has long relied on paper-based processes — forms filled out by hand, reports written up after the fact, compliance records that are difficult to retrieve and impossible to verify quickly.
              </p>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.85, marginBottom: 18 }}>
                We built SiteTrack because we believed there was a better standard for this work. Rather than adapting generic form tools, we built our own platform from the ground up — designed specifically around how fire safety inspections and AS1851 compliance work is actually carried out in the field.
              </p>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.85 }}>
                The result is a platform that lets any fire safety business operate with the structure and documentation discipline of a massive enterprise.
              </p>
            </div>

            {/* Right: clean checklist card */}
            <div className="about-checklist-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
                Platform Capabilities
              </p>
              {[
                'Offline-first React Native mobile app',
                'Asset-level pass/fail data logging',
                'Instant AS1851 compliant PDF generation',
                'Automated quote calculation from defects',
                'Multi-tenant secure database architecture',
                'Superadmin and Admin dashboard workflows',
              ].map((item, i, arr) => (
                <div key={item} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  paddingBottom: i < arr.length - 1 ? 14 : 0,
                  marginBottom: i < arr.length - 1 ? 14 : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <CheckCircle size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Traditional vs SiteTrack ───────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ maxWidth: 520, marginBottom: 48 }}>
            <p className="section-eyebrow">A Different Approach</p>
            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 16 }}>
              How SiteTrack Operates Differently
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
              Most software still operates like digital paper. Here is the difference.
            </p>
          </div>

          {/* Header row — hidden on mobile */}
          <div className="cmp-table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderRadius: '14px 14px 0 0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none' }}>
            <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>Traditional Software</span>
            </div>
            <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F97316' }}>SiteTrack App</span>
            </div>
          </div>

          {/* Rows — become stacked on mobile */}
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0 0 14px 14px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            {CONTRAST.map((row, i, arr) => (
              <div key={i} className="cmp-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div className="cmp-cell-old" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{row.old}</span>
                </div>
                <div className="cmp-cell-new">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: 'white', fontWeight: 500, lineHeight: 1.65 }}>{row.uma}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto 52px' }}>
            <p className="section-eyebrow" style={{ textAlign: 'center' }}>What We Stand For</p>
            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 16 }}>
              The Principles Behind The Platform
            </h2>
          </div>
          <div className="about-values-grid">
            {VALUES.map(v => {
              const Icon = v.icon;
              return (
                <div key={v.title} style={{
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '32px 28px',
                  background: 'rgba(255,255,255,0.02)', boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                  }}>
                    <Icon size={20} color="#F97316" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white', marginBottom: 12, letterSpacing: '-0.015em' }}>{v.title}</h3>
                  <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section style={{ padding: '88px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 480, margin: '0 auto 20px' }}>
            Ready to scale your business?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 380, margin: '0 auto 36px', lineHeight: 1.75 }}>
            Send us your details and start your free trial today.
          </p>
          <div className="cta-group" style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
              Get Started <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        /* ── Story grid ── */
        .about-story-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 64px;
          align-items: start;
        }
        .about-checklist-card {
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          padding: 32px 28px;
        }
        /* ── Values grid ── */
        .about-values-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        /* ── Comparison table ── */
        .cmp-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .cmp-cell-old {
          padding: 18px 24px;
          border-right: 1px solid #F3F4F6;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .cmp-cell-new {
          padding: 18px 24px;
          display: flex; align-items: flex-start; gap: 10px;
        }
        /* ── Responsive ── */
        @media (max-width: 960px) {
          .about-story-grid { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 780px) {
          .about-values-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
        }
        @media (max-width: 640px) {
          .about-values-grid { grid-template-columns: 1fr; }
          /* Stack comparison table */
          .cmp-table-header { display: none !important; }
          .cmp-row { grid-template-columns: 1fr; border: none !important; }
          .cmp-cell-old { border-right: none !important; border-bottom: none; padding: 12px 20px; background: rgba(255,255,255,0.01); }
          .cmp-cell-new { padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        }
        @media (max-width: 480px) {
          .about-checklist-card { padding: 24px 20px; }
        }
      `}</style>
    </>
  );
}
