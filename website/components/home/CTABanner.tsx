import Link from 'next/link';
import { ArrowRight, Mail, Clock, CheckCircle } from 'lucide-react';

const QUICK_POINTS = [
  'No lock-in contracts',
  'Digital reports on every job',
  'Response within 1 business day',
];

export default function CTABanner() {
  return (
    <section id="cta-banner" style={{
      background: 'linear-gradient(135deg, #0a1628 0%, #0F1E3C 50%, #1B2D4F 100%)',
      padding: '88px 0',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(249,115,22,0.10)', filter: 'blur(90px)',
        top: '-150px', right: '-80px', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(249,115,22,0.07)', filter: 'blur(60px)',
        bottom: '-80px', left: '5%', pointerEvents: 'none',
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '52px 52px', pointerEvents: 'none',
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="cta-inner">

          {/* Left — copy */}
          <div className="cta-text">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 22,
              padding: '5px 14px', background: 'rgba(249,115,22,0.14)',
              border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999,
            }}>
              <Mail size={12} color="#F97316" />
              <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fdba74' }}>
                Ready to Get Started?
              </span>
            </div>

            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 18, maxWidth: 480 }}>
              Let&apos;s Get Your<br />
              <span style={{
                background: 'linear-gradient(135deg, #F97316 0%, #fb923c 60%, #fde68a 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                Property Serviced
              </span>
            </h2>

            <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: 16, lineHeight: 1.8, marginBottom: 32, maxWidth: 400 }}>
              Send us an enquiry with your property details and the service you need. We&apos;ll be in touch promptly to discuss next steps.
            </p>

            {/* Quick trust points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QUICK_POINTS.map(pt => (
                <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.68)' }}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — action card */}
          <div className="cta-card">
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 150, height: 150,
              borderRadius: '50%', background: 'rgba(249,115,22,0.12)', filter: 'blur(40px)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(249,115,22,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Clock size={18} color="#F97316" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Fast Response</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>Within 1 business day</div>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 28 }}>
                Fill in our short enquiry form with your property details and preferred service type — we&apos;ll handle the rest.
              </p>

              <Link
                href="/contact"
                id="cta-banner-enquire"
                className="btn btn-primary"
                style={{ width: '100%', fontSize: 15, padding: '14px 0', justifyContent: 'center' }}
              >
                Send a Free Enquiry <ArrowRight size={17} />
              </Link>

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginTop: 14 }}>
                No obligation. No lock-in contract.
              </p>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .cta-inner {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 60px;
          align-items: center;
        }
        .cta-card {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 22px;
          padding: 32px 28px;
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 900px) {
          .cta-inner { grid-template-columns: 1fr; gap: 40px; }
          .cta-card { max-width: 520px; }
          .cta-text { text-align: left; }
        }
      `}</style>
    </section>
  );
}
