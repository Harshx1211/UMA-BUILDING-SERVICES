'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const TRUST = [
  { short: 'AS1851 Compliant',     full: 'AS1851:2012 Compliant Services' },
  { short: 'PDF Reports',          full: 'Digital PDF Report on Every Job' },
  { short: 'Australia-Wide',       full: 'Australia-Wide Coverage' },
  { short: '1 Business Day',       full: '1 Business Day Response' },
];

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="hero-gradient"
      style={{ position: 'relative', paddingTop: 72, display: 'flex', flexDirection: 'column' }}
    >
      {/* Subtle glow */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -160, right: -80, width: 520, height: 520, borderRadius: '50%', background: 'rgba(249,115,22,0.07)', filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(36,58,101,0.4)', filter: 'blur(80px)' }} />
      </div>

      {/* Content */}
      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 72, paddingBottom: 64, position: 'relative', zIndex: 1 }}>

        {/* Eyebrow */}
        <p className="hero-eyebrow">
          Fire Safety · Building Compliance · Australia
        </p>

        {/* H1 */}
        <h1 className="hero-h1">
          Professional<br />Building Services,<br />
          <span style={{ color: '#F97316' }}>Done Properly.</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-sub">
          Routine fire safety inspections and defect repairs, fully managed through our own purpose-built digital platform.
        </p>

        {/* CTAs */}
        <div className="cta-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/contact" id="hero-cta-primary" className="btn btn-primary">
            Get a Free Quote <ArrowRight size={16} />
          </Link>
          <Link href="/services" id="hero-cta-secondary" className="btn btn-outline">
            Our Services
          </Link>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="container">
          <div className="hero-trust-grid">
            {TRUST.map((pt, i, arr) => (
              <div key={pt.full} className="hero-trust-item" style={{
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                <span className="hero-trust-text">
                  <span className="trust-full">{pt.full}</span>
                  <span className="trust-short">{pt.short}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hero-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase; color: #F97316; margin-bottom: 24px;
        }
        .hero-h1 {
          font-size: clamp(36px, 9vw, 70px);
          font-weight: 900; letter-spacing: -0.04em;
          line-height: 1.05; color: white;
          margin-bottom: 22px; max-width: 680px;
        }
        .hero-sub {
          font-size: 17px; color: rgba(255,255,255,0.50);
          line-height: 1.8; max-width: 460px; margin-bottom: 40px;
        }
        .hero-trust-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .hero-trust-item {
          padding: 20px 0;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .hero-trust-text { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.50); }
        .trust-short { display: none; }
        .trust-full  { display: inline; }

        @media (max-width: 900px) {
          .hero-trust-grid { grid-template-columns: repeat(2, 1fr); }
          .hero-trust-item { justify-content: flex-start; padding: 16px 12px; }
          /* Show shorter labels on small trust bar */
          .hero-trust-item:nth-child(2n) { border-right: none !important; }
        }
        @media (max-width: 640px) {
          .hero-sub { font-size: 15px; }
          .trust-short { display: inline; }
          .trust-full  { display: none; }
        }
        @media (max-width: 480px) {
          .hero-eyebrow { font-size: 10px; letter-spacing: 0.09em; }
          .hero-trust-grid { grid-template-columns: repeat(2, 1fr); }
          .hero-trust-item { padding: 14px 8px; gap: 6px; }
          .hero-trust-text { font-size: 11px; }
        }
      `}</style>
    </section>
  );
}
