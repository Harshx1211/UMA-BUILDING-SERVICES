import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';

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

      {/* Main bar */}
      <div style={{ background: '#06101f', padding: '28px 0' }}>
        <div className="container footer-bar">

          {/* Logo */}
          <Link href="/" className="footer-logo">
            <div className="footer-logo-icon">
              <Shield size={16} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="footer-logo-name">UMA Building</div>
              <div className="footer-logo-sub">Services</div>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="footer-nav">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="footer-nav-link">{l.label}</Link>
            ))}
          </nav>

          {/* CTA */}
          <Link href="/contact" className="btn btn-primary footer-cta">
            Get a Free Quote <ArrowRight size={14} />
          </Link>

        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#04090f', padding: '14px 0' }}>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.</span>
          <span className="footer-compliance">AS1851:2012 Compliant · Australia-Wide</span>
        </div>
      </div>

      <style>{`
        .footer-bar {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .footer-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; flex-shrink: 0;
          margin-right: auto;
        }
        .footer-logo-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: linear-gradient(135deg, #F97316, #ea6900);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 3px 12px rgba(249,115,22,0.35);
        }
        .footer-logo-name {
          font-size: 13.5px; font-weight: 900; color: white;
          letter-spacing: -0.025em; line-height: 1.1;
        }
        .footer-logo-sub {
          font-size: 9px; font-weight: 700; color: #F97316;
          letter-spacing: 0.09em; text-transform: uppercase; margin-top: 1px;
        }
        .footer-nav {
          display: flex; align-items: center; gap: 4px;
        }
        .footer-nav-link {
          padding: 7px 13px; font-size: 13.5px; font-weight: 500;
          color: rgba(255,255,255,0.45); text-decoration: none;
          border-radius: 7px; transition: color 180ms, background 180ms;
        }
        .footer-nav-link:hover {
          color: white; background: rgba(255,255,255,0.07);
        }
        .footer-cta {
          font-size: 13.5px !important;
          padding: 9px 18px !important;
          flex-shrink: 0;
        }
        .footer-bottom {
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 8px;
          font-size: 11.5px; color: rgba(255,255,255,0.20);
        }
        .footer-compliance { letter-spacing: 0.02em; }

        @media (max-width: 768px) {
          .footer-bar { gap: 16px; }
          .footer-cta { display: none !important; }
          .footer-nav { gap: 0; }
          .footer-nav-link { padding: 7px 10px; font-size: 13px; }
        }
        @media (max-width: 480px) {
          .footer-bar { flex-direction: column; align-items: flex-start; gap: 16px; }
          .footer-logo { margin-right: 0; }
          .footer-compliance { display: none; }
          .footer-bottom { font-size: 11px; }
        }
      `}</style>
    </footer>
  );
}
