import Link from 'next/link';
import { Shield, Mail, MapPin, FileText, Wrench, ClipboardCheck } from 'lucide-react';


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
  { icon: Shield,         text: 'Fire safety inspections' },
  { icon: FileText,       text: 'Digital PDF service reports' },
  { icon: Wrench,         text: 'Defect assessment & repair' },
  { icon: ClipboardCheck, text: 'Per-asset inspection logging' },
];


const WHY_ITEMS = [
  { num: '01', title: 'Digital-first',           body: 'Every job managed through our own platform — no paper processes.' },
  { num: '02', title: 'PDF reports on every job', body: 'A structured service report generated at job completion.' },
  { num: '03', title: 'Per-asset inspection log', body: 'Each asset logged individually with Pass / Fail results.' },
  { num: '04', title: 'Defect tracking',          body: 'Defects classified by severity, photographed, and resolved.' },
];

export default function Footer() {
  return (
    <footer className="uf">

      {/* Orange top accent */}
      <div className="uf-accent" />

      {/* Main grid */}
      <div className="uf-body">
        <div className="container">
          <div className="uf-grid">

            {/* Brand */}
            <div className="uf-brand">
              <Link href="/" className="uf-logo">
                <div className="uf-logo-icon">
                  <Shield size={18} color="white" strokeWidth={2.5} />
                </div>

                <div>
                  <div className="uf-logo-name">UMA Building</div>
                  <div className="uf-logo-sub">Services</div>
                </div>
              </Link>

              <p className="uf-desc">
                Professional building maintenance and fire safety services for commercial and industrial properties across Australia.
              </p>

              <div className="uf-caps">
                {CAPABILITIES.map(({ icon: Icon, text }) => (
                  <div key={text} className="uf-cap">
                    <div className="uf-cap-icon">
                      <Icon size={12} color="#F97316" strokeWidth={2.5} />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <a href="mailto:info@umabuildingservices.com.au" className="uf-email">
                <div className="uf-email-icon">
                  <Mail size={14} color="#F97316" />
                </div>
                info@umabuildingservices.com.au
              </a>

              <div className="uf-location">
                <MapPin size={13} color="rgba(255,255,255,0.3)" strokeWidth={2} />
                <span>Servicing sites across Australia</span>
              </div>
            </div>

            {/* Navigation */}
            <div>
              <p className="uf-heading">Navigation</p>
              <div className="uf-links">
                {NAV_LINKS.map(l => (
                  <Link key={l.href} href={l.href} className="uf-link">
                    <span className="uf-dot" />
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Services */}
            <div>
              <p className="uf-heading">Services</p>
              <div className="uf-links">
                {SERVICES.map(s => (
                  <Link key={s.label} href={s.href} className="uf-link">
                    <span className="uf-dot" />
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Why UMA */}
            <div>
              <p className="uf-heading">Why UMA</p>
              <div className="uf-why">
                {WHY_ITEMS.map(item => (
                  <div key={item.num} className="uf-why-item">
                    <span className="uf-why-num">{item.num}</span>
                    <div>
                      <p className="uf-why-title">{item.title}</p>
                      <p className="uf-why-body">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="uf-bottom">
        <div className="container">
          <div className="uf-bottom-inner">
            <span>© {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.</span>
            <div className="uf-bottom-nav">
              <Link href="/contact" className="uf-bottom-link">Contact</Link>
              <span className="uf-bottom-sep" />
              <Link href="/services" className="uf-bottom-link">Services</Link>
              <span className="uf-bottom-sep" />
              <Link href="/about" className="uf-bottom-link">About</Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Base ── */
        .uf {
          background: linear-gradient(180deg, #06101f 0%, #08111f 50%, #0c1830 100%);
          color: rgba(255,255,255,0.5);
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* Orange accent strip */
        .uf-accent {
          height: 3px;
          background: linear-gradient(90deg, #F97316 0%, #fb923c 50%, transparent 100%);
        }

        /* ── Body ── */
        .uf-body { padding: 64px 0 48px; }

        /* ── Grid ── */
        .uf-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1.2fr 1.3fr;
          gap: 40px;
          align-items: start;
        }

        /* ── Brand col ── */
        .uf-logo {
          display: flex; align-items: center; gap: 11px;
          text-decoration: none; color: inherit; margin-bottom: 20px;
        }
        .uf-logo-icon {
          width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg, #F97316, #ea6900);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(249,115,22,0.35);
        }
        .uf-logo-name {
          font-size: 16px; font-weight: 900; color: white;
          letter-spacing: -0.025em; line-height: 1.1;
        }
        .uf-logo-sub {
          font-size: 10px; font-weight: 700; color: #F97316;
          letter-spacing: 0.09em; text-transform: uppercase; margin-top: 2px;
        }
        .uf-desc {
          font-size: 13px; line-height: 1.8; color: rgba(255,255,255,0.40);
          max-width: 260px; margin-bottom: 20px;
        }

        /* Capabilities */
        .uf-caps { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .uf-cap { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,0.45); }
        .uf-cap-icon {
          width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
          background: rgba(249,115,22,0.10);
          display: flex; align-items: center; justify-content: center;
        }

        /* Email */
        .uf-email {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12.5px; color: rgba(255,255,255,0.45);
          text-decoration: none; transition: color 180ms; margin-bottom: 10px;
        }
        .uf-email:hover { color: #F97316; }
        .uf-email-icon {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: rgba(249,115,22,0.12);
          display: flex; align-items: center; justify-content: center;
        }

        /* Location */
        .uf-location {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; color: rgba(255,255,255,0.28);
        }

        /* ── Column heading ── */
        .uf-heading {
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.10em;
          text-transform: uppercase; color: rgba(255,255,255,0.80);
          margin-bottom: 18px;
        }

        /* ── Links ── */
        .uf-links { display: flex; flex-direction: column; gap: 9px; }
        .uf-link {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: rgba(255,255,255,0.42);
          text-decoration: none; transition: color 180ms;
        }
        .uf-link:hover { color: rgba(255,255,255,0.90); }
        .uf-dot {
          width: 3px; height: 3px; border-radius: 50%; flex-shrink: 0;
          background: rgba(249,115,22,0.45); transition: background 180ms;
        }
        .uf-link:hover .uf-dot { background: #F97316; }

        /* ── Why list ── */
        .uf-why { display: flex; flex-direction: column; gap: 14px; }
        .uf-why-item { display: flex; align-items: flex-start; gap: 10px; }
        .uf-why-num {
          font-size: 9px; font-weight: 900; color: #F97316;
          letter-spacing: 0.06em; min-width: 18px; flex-shrink: 0;
          padding-top: 3px; opacity: 0.85;
        }
        .uf-why-title {
          font-size: 12.5px; font-weight: 700;
          color: rgba(255,255,255,0.70); margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
        .uf-why-body {
          font-size: 11.5px; color: rgba(255,255,255,0.32); line-height: 1.6;
        }

        /* ── Bottom bar ── */
        .uf-bottom { border-top: 1px solid rgba(255,255,255,0.06); padding: 18px 0; }
        .uf-bottom-inner {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          font-size: 12px; color: rgba(255,255,255,0.25);
        }
        .uf-bottom-nav { display: flex; align-items: center; gap: 10px; }
        .uf-bottom-link {
          font-size: 12px; color: rgba(255,255,255,0.25);
          text-decoration: none; transition: color 180ms;
        }
        .uf-bottom-link:hover { color: rgba(255,255,255,0.60); }
        .uf-bottom-sep {
          width: 1px; height: 10px; background: rgba(255,255,255,0.12);
          display: inline-block;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          .uf-grid { grid-template-columns: 1fr 1fr; gap: 36px 32px; }
        }
        @media (max-width: 640px) {
          .uf-grid { grid-template-columns: 1fr; gap: 28px; }
          .uf-body { padding: 48px 0 36px; }
          .uf-bottom-nav { display: none; }
        }
      `}</style>
    </footer>
  );
}
