'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const TRUST = [
  'AS1851:2012 Compliant Services',
  'Digital PDF Report on Every Job',
  'Australia-Wide Coverage',
  '1 Business Day Response',
];

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="hero-gradient"
      style={{ position: 'relative', paddingTop: 72, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      {/* Subtle glow */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -160, right: -80, width: 520, height: 520, borderRadius: '50%', background: 'rgba(249,115,22,0.07)', filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', bottom: -120, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(36,58,101,0.4)', filter: 'blur(80px)' }} />
      </div>

      {/* Content */}
      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 88, paddingBottom: 72, position: 'relative', zIndex: 1 }}>

        {/* Eyebrow */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 28 }}>
          Fire Safety · Building Compliance · Australia
        </p>

        {/* H1 */}
        <h1 style={{
          fontSize: 'clamp(42px, 5.5vw, 70px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1.04,
          color: 'white',
          marginBottom: 28,
          maxWidth: 680,
        }}>
          Professional<br />Building Services,<br />
          <span style={{ color: '#F97316' }}>Done Properly.</span>
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.50)', lineHeight: 1.8, maxWidth: 460, marginBottom: 44 }}>
          Routine fire safety inspections and defect repairs — fully managed through our own purpose-built digital platform.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/contact" id="hero-cta-primary" className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
            Get a Free Quote <ArrowRight size={16} />
          </Link>
          <Link href="/services" id="hero-cta-secondary" className="btn btn-outline" style={{ fontSize: 15, padding: '13px 24px' }}>
            Our Services
          </Link>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="container">
          <div className="hero-trust-grid">
            {TRUST.map((pt, i, arr) => (
              <div key={pt} style={{
                padding: '20px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F97316', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.50)', whiteSpace: 'nowrap' }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hero-trust-grid { display: grid; grid-template-columns: repeat(4,1fr); }
        @media (max-width: 768px) { .hero-trust-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 480px) { .hero-trust-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
