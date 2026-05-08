import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, Smartphone, ArrowRight, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | UMA Building Services',
  description: 'UMA Building Services is a specialist fire safety inspection and defect repair company operating across commercial and industrial properties in Australia.',
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
  { old: 'Paper forms filled out by hand on site',      uma: 'Digital logging via our own mobile platform, in real time' },
  { old: 'General pass/fail notation per site visit',   uma: 'Per-asset Pass/Fail result logged individually, every job' },
  { old: 'Reports written up manually after the visit', uma: 'PDF report auto-generated at job completion, every time' },
  { old: 'No photographic evidence attached',           uma: 'Photos captured on-site and linked to the job record' },
  { old: 'Paper compliance records, hard to retrieve',  uma: 'All records stored digitally and accessible when needed' },
];

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(145deg,#060f1e 0%,#0A1628 40%,#0F1E3C 100%)',
        paddingTop: 72,
      }}>
        <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 20 }}>
            About UMA Building Services
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 4.5vw, 54px)',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.04em',
            lineHeight: 1.08,
            marginBottom: 22,
            maxWidth: 620,
          }}>
            A Building Services Company Built Around the Paper Problem
          </h1>
          <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.48)', lineHeight: 1.8, maxWidth: 500, marginBottom: 36 }}>
            UMA Building Services is a specialist fire safety inspection and defect repair company. We operate across commercial and industrial properties throughout Australia.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15, padding: '12px 26px' }}>
            Get in Touch <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Our Story — 2-col ────────────────────────── */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div className="about-story-grid">
            <div>
              <p className="section-eyebrow">Our Story</p>
              <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 24 }}>
                Why UMA Exists
              </h2>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.85, marginBottom: 18 }}>
                The building services industry has long relied on paper-based processes — forms filled out by hand, reports written up after the fact, compliance records that are difficult to retrieve and impossible to verify quickly.
              </p>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.85, marginBottom: 18 }}>
                We started UMA Building Services because we believed there was a better standard for this work. Rather than adapting existing tools, we built our own platform from the ground up — designed specifically around how fire safety inspections and building compliance work is actually carried out.
              </p>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.85 }}>
                The result is a company that operates with the structure and documentation discipline of a far larger organisation — applied consistently, across every property we service.
              </p>
            </div>

            {/* Right: clean checklist card */}
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 14, padding: '36px 32px', alignSelf: 'start' }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 24 }}>
                Every Job Produces
              </p>
              {[
                'Individual Pass/Fail result per asset',
                'Photo evidence of any defects found',
                'Defect severity classification on site',
                'Client signature at job completion',
                'Structured digital PDF service report',
                'Permanent record stored in our system',
              ].map((item, i, arr) => (
                <div key={item} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  paddingBottom: i < arr.length - 1 ? 14 : 0,
                  marginBottom: i < arr.length - 1 ? 14 : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid #E5E7EB' : 'none',
                }}>
                  <CheckCircle size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Traditional vs UMA ───────────────────────── */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="container">
          <div style={{ maxWidth: 520, marginBottom: 48 }}>
            <p className="section-eyebrow">A Different Approach</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              How We Operate Differently
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
              Most fire safety companies still operate the way they always have. Here is the difference.
            </p>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', background: 'white' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ padding: '14px 24px', background: '#F9FAFB', borderRight: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>
                  Traditional Approach
                </span>
              </div>
              <div style={{ padding: '14px 24px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F97316' }}>
                  The UMA Approach
                </span>
              </div>
            </div>
            {CONTRAST.map((row, i, arr) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ padding: '18px 24px', borderRight: '1px solid #F3F4F6', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D1D5DB', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.65 }}>{row.old}</span>
                </div>
                <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: '#111827', fontWeight: 500, lineHeight: 1.65 }}>{row.uma}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ───────────────────────────────────── */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto 52px' }}>
            <p className="section-eyebrow" style={{ textAlign: 'center' }}>What We Stand For</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              The Principles Behind Every Job
            </h2>
          </div>
          <div className="values-grid">
            {VALUES.map(v => {
              const Icon = v.icon;
              return (
                <div key={v.title} style={{
                  border: '1px solid #E5E7EB', borderRadius: 12, padding: '36px 30px',
                  background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(15,30,60,0.07)', border: '1px solid rgba(15,30,60,0.09)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
                  }}>
                    <Icon size={20} color="#0F1E3C" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 12, letterSpacing: '-0.015em' }}>{v.title}</h3>
                  <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.8 }}>{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg,#0A1628 0%,#0F1E3C 50%,#1B2D4F 100%)', padding: '96px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 20 }}>
            Work With Us
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 480, margin: '0 auto 20px' }}>
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

      <style>{`
        .about-story-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 72px;
          align-items: start;
        }
        .values-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 960px) {
          .about-story-grid { grid-template-columns: 1fr; gap: 40px; }
        }
        @media (max-width: 780px) {
          .values-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
