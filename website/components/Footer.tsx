import Link from 'next/link';

const NAV_LINKS = [
  { href: '/',         label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about',    label: 'About' },
  { href: '/contact',  label: 'Contact' },
];

export default function Footer() {
  return (
    <footer style={{ background: '#06101f', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #F97316 0%, #fb923c 50%, transparent 100%)' }} />

      <div className="container" style={{ padding: '32px 24px', textAlign: 'center' }}>

        {/* Company name */}
        <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', marginBottom: 16 }}>
          UMA Building Services
        </p>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 24 }}>
          {NAV_LINKS.map((l, i, arr) => (
            <span key={l.href} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link href={l.href} className="footer-link">{l.label}</Link>
              {i < arr.length - 1 && (
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
              )}
            </span>
          ))}
        </div>

        {/* Copyright */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.02em' }}>
          © {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved. · AS1851:2012 Compliant · Australia-Wide
        </p>

      </div>

      <style>{`
        .footer-link {
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.38);
          text-decoration: none; padding: 4px 8px; border-radius: 5px;
          transition: color 160ms;
        }
        .footer-link:hover { color: rgba(255,255,255,0.75); }
      `}</style>
    </footer>
  );
}
