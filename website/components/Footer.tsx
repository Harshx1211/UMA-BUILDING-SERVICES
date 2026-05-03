import Link from 'next/link';
import { Flame, Mail, MapPin, ArrowRight, Shield, FileText, Wrench } from 'lucide-react';

const NAV_LINKS = [
  { href: '/',         label: 'Home' },
  { href: '/services', label: 'Our Services' },
  { href: '/about',    label: 'About Us' },
  { href: '/contact',  label: 'Contact Us' },
];

const SERVICES = [
  { label: 'Monthly Routine Service',   href: '/services' },
  { label: '3-Monthly Routine Service', href: '/services' },
  { label: '6-Monthly Routine Service', href: '/services' },
  { label: 'Annual Routine Service',    href: '/services' },
  { label: '5-Yearly Routine Service',  href: '/services' },
  { label: 'Quote / Defect Repair',     href: '/services' },
];

const CAPABILITIES = [
  { icon: Shield, text: 'Fire safety inspections' },
  { icon: FileText, text: 'Digital PDF service reports' },
  { icon: Wrench, text: 'Defect assessment & repair' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* Orange accent line */}
      <div className="footer-accent-line" />

      {/* ── Main footer body ─────────────────────────── */}
      <div className="footer-body">
        <div className="container">
          <div className="footer-grid">

            {/* ── Col 1: Brand ─────────────────────── */}
            <div className="footer-brand-col">
              <Link href="/" className="footer-logo">
                <div className="footer-logo-icon">
                  <Flame size={20} color="white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="footer-logo-name">UMA Building</div>
                  <div className="footer-logo-sub">Services</div>
                </div>
              </Link>

              <p className="footer-tagline">
                Professional building maintenance and fire safety services for commercial and industrial properties across Australia.
              </p>

              {/* Capability list */}
              <div className="footer-capabilities">
                {CAPABILITIES.map(({ icon: Icon, text }) => (
                  <div key={text} className="footer-capability">
                    <div className="footer-cap-icon">
                      <Icon size={12} color="#F97316" strokeWidth={2.5} />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              {/* Contact row */}
              <a href="mailto:info@umabuildingservices.com.au" className="footer-email">
                <div className="footer-email-icon">
                  <Mail size={14} color="#F97316" />
                </div>
                info@umabuildingservices.com.au
              </a>
            </div>

            {/* ── Col 2: Navigation ───────────────── */}
            <div>
              <p className="footer-col-heading">Navigation</p>
              <nav className="footer-link-list">
                {NAV_LINKS.map(l => (
                  <Link key={l.href} href={l.href} className="footer-nav-link">
                    <span className="footer-nav-dot" />
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* ── Col 3: Services ─────────────────── */}
            <div>
              <p className="footer-col-heading">Services</p>
              <div className="footer-link-list">
                {SERVICES.map(s => (
                  <Link key={s.label} href={s.href} className="footer-nav-link">
                    <span className="footer-nav-dot" />
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Col 4: Contact card ──────────────── */}
            <div>
              <p className="footer-col-heading">Get In Touch</p>

              <div className="footer-contact-card">
                <div className="footer-contact-card-orb" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p className="footer-contact-card-heading">
                    Ready to get your property serviced?
                  </p>
                  <p className="footer-contact-card-body">
                    Send us an enquiry and we&apos;ll respond within 1 business day.
                  </p>
                  <Link href="/contact" className="footer-contact-btn">
                    Send Enquiry <ArrowRight size={14} />
                  </Link>

                  <div className="footer-contact-divider" />

                  <div className="footer-contact-info">
                    <MapPin size={13} color="rgba(255,255,255,0.35)" />
                    <span>Servicing commercial &amp; industrial sites across Australia</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────── */}
      <div className="footer-bottom">
        <div className="container">
          <div className="footer-bottom-inner">
            <span>© {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.</span>
            <div className="footer-bottom-links">
              <Link href="/contact" className="footer-bottom-link">Contact</Link>
              <span className="footer-bottom-sep" />
              <Link href="/services" className="footer-bottom-link">Services</Link>
              <span className="footer-bottom-sep" />
              <Link href="/about" className="footer-bottom-link">About</Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Base ────────────────────────────────── */
        .site-footer {
          background: linear-gradient(180deg, #06101f 0%, #090f1f 40%, #0c1830 100%);
          color: rgba(255,255,255,0.55);
          border-top: 1px solid rgba(255,255,255,0.04);
        }

        /* Orange accent line */
        .footer-accent-line {
          height: 3px;
          background: linear-gradient(90deg, #F97316 0%, #fb923c 40%, transparent 100%);
        }

        /* ── Main body ───────────────────────────── */
        .footer-body { padding: 68px 0 52px; }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.3fr;
          gap: 48px 40px;
        }

        /* ── Brand col ───────────────────────────── */
        .footer-logo {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 22px;
          text-decoration: none;
          color: inherit;
        }
        .footer-logo-icon {
          width: 44px; height: 44px; border-radius: 13px;
          background: linear-gradient(135deg, #F97316, #ea6900);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(249,115,22,0.38);
          flex-shrink: 0;
        }
        .footer-logo-name {
          font-weight: 900; font-size: 17px; color: white;
          letter-spacing: -0.025em; line-height: 1.1;
        }
        .footer-logo-sub {
          font-weight: 700; font-size: 10px; color: #F97316;
          letter-spacing: 0.09em; text-transform: uppercase;
          margin-top: 1px;
        }

        .footer-tagline {
          font-size: 13.5px; line-height: 1.8; max-width: 280px;
          margin-bottom: 22px; color: rgba(255,255,255,0.42);
        }

        /* Capabilities */
        .footer-capabilities {
          display: flex; flex-direction: column; gap: 9px;
          margin-bottom: 24px;
        }
        .footer-capability {
          display: flex; align-items: center; gap: 9px;
          font-size: 13px; color: rgba(255,255,255,0.50);
        }
        .footer-cap-icon {
          width: 22px; height: 22px; border-radius: 6px;
          background: rgba(249,115,22,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* Email link */
        .footer-email {
          display: inline-flex; align-items: center; gap: 9px;
          font-size: 13px; color: rgba(255,255,255,0.50);
          text-decoration: none; transition: color 200ms;
        }
        .footer-email:hover { color: #F97316; }
        .footer-email-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(249,115,22,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* ── Column headings ─────────────────────── */
        .footer-col-heading {
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.10em; text-transform: uppercase;
          color: rgba(255,255,255,0.85); margin-bottom: 22px;
        }

        /* ── Nav links ───────────────────────────── */
        .footer-link-list {
          display: flex; flex-direction: column; gap: 10px;
        }
        .footer-nav-link {
          display: flex; align-items: center; gap: 8px;
          font-size: 13.5px; color: rgba(255,255,255,0.45);
          text-decoration: none; transition: color 200ms;
        }
        .footer-nav-link:hover { color: white; }
        .footer-nav-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(249,115,22,0.50); flex-shrink: 0;
          transition: background 200ms;
        }
        .footer-nav-link:hover .footer-nav-dot {
          background: #F97316;
        }

        /* ── Contact card ────────────────────────── */
        .footer-contact-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 22px 20px;
          position: relative;
          overflow: hidden;
        }
        .footer-contact-card-orb {
          position: absolute; top: -40px; right: -40px;
          width: 130px; height: 130px; border-radius: 50%;
          background: rgba(249,115,22,0.09); filter: blur(30px);
          pointer-events: none;
        }
        .footer-contact-card-heading {
          font-size: 14px; font-weight: 700; color: white;
          line-height: 1.45; margin-bottom: 8px; letter-spacing: -0.01em;
        }
        .footer-contact-card-body {
          font-size: 12.5px; color: rgba(255,255,255,0.45);
          line-height: 1.65; margin-bottom: 18px;
        }
        .footer-contact-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 18px; border-radius: 9px;
          font-size: 13px; font-weight: 700; letter-spacing: -0.01em;
          background: #F97316; color: white;
          box-shadow: 0 4px 16px rgba(249,115,22,0.35);
          text-decoration: none; transition: all 200ms;
        }
        .footer-contact-btn:hover {
          background: #ea6900;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(249,115,22,0.45);
        }
        .footer-contact-divider {
          height: 1px; background: rgba(255,255,255,0.07);
          margin: 18px 0;
        }
        .footer-contact-info {
          display: flex; align-items: flex-start; gap: 7px;
          font-size: 12px; color: rgba(255,255,255,0.32); line-height: 1.55;
        }

        /* ── Bottom bar ──────────────────────────── */
        .footer-bottom {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 20px 0;
        }
        .footer-bottom-inner {
          display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 12px;
          font-size: 12.5px; color: rgba(255,255,255,0.28);
        }
        .footer-bottom-links {
          display: flex; align-items: center; gap: 12px;
        }
        .footer-bottom-link {
          font-size: 12.5px; color: rgba(255,255,255,0.28);
          text-decoration: none; transition: color 180ms;
        }
        .footer-bottom-link:hover { color: rgba(255,255,255,0.65); }
        .footer-bottom-sep {
          width: 1px; height: 12px;
          background: rgba(255,255,255,0.14);
          display: inline-block;
        }

        /* ── Responsive ──────────────────────────── */
        @media (max-width: 1100px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 40px 36px;
          }
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .footer-body { padding: 52px 0 40px; }
          .footer-bottom-links { display: none; }
        }
      `}</style>
    </footer>
  );
}
