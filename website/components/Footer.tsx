'use client';
import Link from 'next/link';
import { Shield, Mail, MapPin, Clock } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Footer({ platformName = 'SiteTrack', supportEmail = 'hello@sitetrack.app' }: { platformName?: string, supportEmail?: string }) {
  // Was: useState(2026) + a useEffect to correct it after mount — a pattern
  // meant to dodge SSR/hydration mismatches, but it also meant the site
  // would silently ship a hardcoded "2026" in its initial HTML forever,
  // one frame before the effect corrects it. Computing it directly avoids
  // both the stale hardcode and the unnecessary effect — year granularity
  // essentially never disagrees between server and client render.
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="footer-wrapper">
        {/* Glow effect at the top of the footer */}
        <div className="footer-glow" />

        <div className="container footer-container">
          {/* ── Top grid ── */}
          <div className="footer-grid">

            {/* Col 1 — Brand */}
            <div className="footer-col">
              <Link href="/" className="footer-logo">
                <div className="footer-logo-icon">
                  <Shield size={17} color="white" strokeWidth={2.5} aria-hidden="true" />
                </div>
                <div>
                  <div className="footer-logo-name">{platformName}</div>
                  <div className="footer-logo-sub">Platform</div>
                </div>
              </Link>
              <p className="footer-tagline">
                The ultimate operating system for Fire Safety &amp; Building Compliance companies. Mobile apps, defect remediation, and digital field management.
              </p>
              <div className="footer-badge">
                <span className="footer-badge-dot" />
                Enterprise Secure
              </div>
            </div>

            {/* Col 2 — Quick Links */}
            <div className="footer-col footer-col-shifted">
              <p className="footer-col-heading">Quick Links</p>
              <nav className="footer-link-list">
                {NAV_LINKS.map(l => (
                  <Link key={l.href} href={l.href} className="footer-link">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Col 3 — Contact */}
            <div className="footer-col footer-col-shifted">
              <p className="footer-col-heading">Contact</p>
              <div className="footer-contact-list">
                <div className="footer-contact-row">
                  <Mail size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" aria-hidden="true" />
                  <a href={`mailto:${supportEmail}`} className="footer-link">
                    {supportEmail}
                  </a>
                </div>
                <div className="footer-contact-row">
                  <MapPin size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" aria-hidden="true" />
                  <span className="footer-contact-text">Sydney, Australia</span>
                </div>
                <div className="footer-contact-row">
                  <Clock size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" aria-hidden="true" />
                  <span className="footer-contact-text">Mon – Fri, 9:00 AM – 5:00 PM AEST</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="footer-divider" />

          {/* ── Bottom bar ── */}
          <div className="footer-bottom">
            <span className="footer-copyright">
              © {year} {platformName} Software. All rights reserved.
            </span>
            <span className="footer-powered">
              Built for <span className="footer-powered-accent">Fire Maintenance Companies</span>
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        .footer-wrapper {
          position: relative;
          background-color: var(--off-white);
          border-top: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.6);
          margin-top: auto;
          overflow: hidden;
        }

        /* Ambient glow for premium feel */
        .footer-glow {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 200px;
          background: rgba(var(--orange-rgb), 0.06);
          filter: blur(80px);
          pointer-events: none;
        }

        .footer-container {
          position: relative;
          z-index: 1;
          padding: var(--space-16) var(--space-6) var(--space-8);
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1.5fr;
          gap: 60px;
          margin-bottom: var(--space-12);
        }

        .footer-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        /* Was an inline style={{ paddingTop: 8 }} + a \`.footer-col[style]\`
           attribute-selector hack to reset it on mobile. Attribute selectors
           on \`style\` match ANY inline style, not just this one — a real
           landmine if column 1 ever gets its own inline style later. A
           named class is the same behavior with none of the fragility. */
        .footer-col-shifted { padding-top: 8px; }
        @media (max-width: 768px) {
          .footer-col-shifted { padding-top: 0; }
        }

        /* Logo */
        .footer-logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          text-decoration: none;
          margin-bottom: 4px;
        }
        .footer-logo-icon {
          width: 34px; height: 34px; border-radius: 8px;
          background: var(--orange);
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15), 0 4px 12px rgba(var(--orange-rgb), 0.2);
        }
        .footer-logo-name {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700; color: white;
          letter-spacing: -0.02em; line-height: 1; margin-bottom: 3px;
        }
        .footer-logo-sub {
          font-size: 10px; font-weight: 800; color: var(--orange);
          text-transform: uppercase; letter-spacing: 0.1em; line-height: 1;
        }

        .footer-tagline {
          font-size: 14.5px;
          line-height: 1.7;
          color: rgba(255,255,255,0.5);
          max-width: 380px;
          margin: 0;
        }

        .footer-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          background: rgba(var(--orange-rgb), 0.08);
          border: 1px solid rgba(var(--orange-rgb), 0.2);
          border-radius: 20px;
          padding: 6px var(--space-4);
          font-size: 11px;
          font-weight: 700;
          color: var(--orange-tint);
          align-self: flex-start;
          margin-top: 4px;
        }
        .footer-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background-color: var(--orange);
          box-shadow: 0 0 8px var(--orange);
        }

        .footer-col-heading {
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: white;
          text-transform: uppercase;
          margin: 0;
        }

        .footer-link-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .footer-link {
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          font-size: 14.5px;
          transition: color 0.2s, transform 0.2s;
          display: inline-block;
          transform-origin: left;
        }
        .footer-link:hover {
          color: white;
          transform: translateX(2px);
        }

        .footer-contact-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .footer-contact-row {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }
        .footer-contact-icon {
          flex-shrink: 0;
          margin-top: 3px;
        }
        .footer-contact-text {
          color: rgba(255,255,255,0.5);
          font-size: 14.5px;
          line-height: 1.5;
        }

        .footer-divider {
          height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          margin-bottom: var(--space-6);
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-4);
        }
        .footer-copyright {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
        }
        .footer-powered {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
        }
        .footer-powered-accent {
          color: rgba(255,255,255,0.7);
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .footer-container {
            padding: 56px var(--space-5) var(--space-8);
          }
          .footer-grid {
            grid-template-columns: 1fr;
            gap: var(--space-12);
            margin-bottom: var(--space-10);
          }
          .footer-col {
            gap: var(--space-3);
            align-items: center;
            text-align: center;
          }

          /* Center everything inside the columns */
          .footer-logo { justify-content: center; }
          .footer-tagline { text-align: center; margin: 0 auto; }
          .footer-badge { align-self: center; }
          .footer-link-list { align-items: center; }
          .footer-link { transform-origin: center; }
          .footer-contact-list { align-items: center; }
          .footer-contact-row { justify-content: center; }

          .footer-bottom {
            flex-direction: column;
            align-items: center;
            text-align: center;
            justify-content: center;
            gap: var(--space-3);
          }
        }
      `}</style>
    </>
  );
}
