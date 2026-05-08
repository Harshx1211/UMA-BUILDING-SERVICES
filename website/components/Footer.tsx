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
      {/* Orange accent strip */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #F97316 0%, #fb923c 60%, transparent 100%)' }} />

      {/* Main bar: Logo left | Nav right */}
      <div style={{ background: '#06101f', padding: '26px 0' }}>
        <div className="container footer-bar">

          {/* Logo */}
          <Link href="/" className="footer-logo">
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #F97316, #ea6900)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(249,115,22,0.32)',
            }}>
              <Shield size={15} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'white', letterSpacing: '-0.025em', lineHeight: 1.1 }}>UMA Building</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#F97316', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 1 }}>Services</div>
            </div>
          </Link>

          {/* Nav links — horizontal */}
          <nav className="footer-nav">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="footer-nav-link">{l.label}</Link>
            ))}
          </nav>

        </div>
      </div>

      {/* Copyright bar */}
      <div className="footer-bottom-bar">
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.</span>
          <span className="footer-compliance">AS1851:2012 Compliant · Australia-Wide</span>
        </div>
      </div>

      <style>{`
        .footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .footer-logo {
          display: flex; align-items: center; gap: 9px;
          text-decoration: none; flex-shrink: 0;
        }
        .footer-nav {
          display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
        }
        .footer-nav-link {
          padding: 6px 12px; font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.40); text-decoration: none;
          border-radius: 6px; transition: color 160ms;
        }
        .footer-nav-link:hover { color: rgba(255,255,255,0.80); }
        .footer-bottom-bar {
          background: #04090f;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 13px 0;
        }
        .footer-bottom {
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 8px;
          font-size: 11px; color: rgba(255,255,255,0.18);
        }
        @media (max-width: 560px) {
          .footer-compliance { display: none; }
          .footer-nav-link { padding: 5px 9px; font-size: 12.5px; }
        }
      `}</style>
    </footer>
  );
}
