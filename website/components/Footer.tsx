import Link from 'next/link';
import { Shield } from 'lucide-react';

const NAV_LINKS = [
  { href: '/',         label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about',    label: 'About' },
  { href: '/contact',  label: 'Contact' },
];

export default function Footer() {
  return (
    <footer>
      {/* Orange accent */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #F97316 0%, #fb923c 60%, transparent 100%)' }} />

      {/* Main section */}
      <div style={{ background: '#06101f', padding: '36px 0 28px' }}>
        <div className="container footer-main">

          {/* Left: Logo + tagline */}
          <div className="footer-brand">
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, #F97316, #ea6900)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 12px rgba(249,115,22,0.35)',
              }}>
                <Shield size={16} color="white" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 900, color: 'white', letterSpacing: '-0.025em', lineHeight: 1.1 }}>UMA Building</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#F97316', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 1 }}>Services</div>
              </div>
            </Link>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.30)', lineHeight: 1.7, maxWidth: 280 }}>
              Professional fire safety inspections and defect repair services across commercial and industrial properties in Australia.
            </p>
          </div>

          {/* Right: Nav links */}
          <nav className="footer-nav">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 14 }}>
              Navigation
            </p>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} style={{
                display: 'block', fontSize: 13.5, color: 'rgba(255,255,255,0.45)',
                textDecoration: 'none', marginBottom: 9, transition: 'color 180ms',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
              >
                {l.label}
              </Link>
            ))}
          </nav>

        </div>
      </div>

      {/* Copyright bar */}
      <div style={{ background: '#04090f', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '14px 0' }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
          fontSize: 11.5, color: 'rgba(255,255,255,0.20)',
        }}>
          <span>© {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.</span>
          <span className="footer-compliance">AS1851:2012 Compliant · Australia-Wide</span>
        </div>
      </div>

      <style>{`
        .footer-main {
          display: flex;
          align-items: flex-start;
          gap: 48px;
          justify-content: space-between;
        }
        .footer-brand { flex: 1; max-width: 340px; }
        .footer-nav { flex-shrink: 0; }
        @media (max-width: 640px) {
          .footer-main { flex-direction: column; gap: 28px; }
          .footer-brand { max-width: 100%; }
          .footer-compliance { display: none; }
        }
      `}</style>
    </footer>
  );
}
