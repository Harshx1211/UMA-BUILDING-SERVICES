import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function CTABanner() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #0A1628 0%, #0F1E3C 50%, #1B2D4F 100%)',
      padding: '96px 0',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -120, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(249,115,22,0.06)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>

        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 22 }}>
          Get Started
        </p>

        <h2 style={{
          fontSize: 'clamp(26px, 4vw, 48px)',
          fontWeight: 900,
          color: 'white',
          letterSpacing: '-0.035em',
          lineHeight: 1.1,
          maxWidth: 520,
          margin: '0 auto 18px',
        }}>
          Ready to Get Your Property Compliant?
        </h2>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: '0 auto 40px', lineHeight: 1.75 }}>
          Send us your property details and we&apos;ll respond within one business day.
        </p>

        <div id="cta-banner-buttons" className="cta-group" style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/contact" id="cta-banner-primary" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
            Get a Free Quote <ArrowRight size={17} />
          </Link>
          <Link href="/services" id="cta-banner-secondary" className="btn btn-outline" style={{ fontSize: 15.5, padding: '14px 26px' }}>
            View Services
          </Link>
        </div>

      </div>

      <style>{`
        @media (max-width: 480px) {
          #cta-banner-buttons { align-items: stretch; }
        }
      `}</style>
    </section>
  );
}
