'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Mail, MapPin, Clock } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Footer() {
  const [year, setYear] = useState(2026);
  useEffect(() => setYear(new Date().getFullYear()), []);

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
                  <Shield size={17} color="white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="footer-logo-name">SiteTrack</div>
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
            <div className="footer-col" style={{ paddingTop: 8 }}>
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
            <div className="footer-col" style={{ paddingTop: 8 }}>
              <p className="footer-col-heading">Contact</p>
              <div className="footer-contact-list">
                <div className="footer-contact-row">
                  <Mail size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" />
                  <a href="mailto:hello@sitetrack.app" className="footer-link">
                    hello@sitetrack.app
                  </a>
                </div>
                <div className="footer-contact-row">
                  <MapPin size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" />
                  <span className="footer-contact-text">Sydney, Australia</span>
                </div>
                <div className="footer-contact-row">
                  <Clock size={16} color="rgba(255,255,255,0.4)" className="footer-contact-icon" />
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
              © {year} SiteTrack Software. All rights reserved.
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
          background-color: #060f1e;
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
          background: rgba(249,115,22,0.06);
          filter: blur(80px);
          pointer-events: none;
        }

        .footer-container {
          position: relative;
          z-index: 1;
          padding: 72px 24px 32px;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1.5fr;
          gap: 60px;
          margin-bottom: 56px;
        }
        
        .footer-col {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        
        /* Logo */
        .footer-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          margin-bottom: 4px;
        }
        .footer-logo-icon {
          width: 34px; height: 34px; border-radius: 8px;
          background: #F97316;
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15), 0 4px 12px rgba(249,115,22,0.2);
        }
        .footer-logo-name {
          font-size: 16px; font-weight: 800; color: white;
          letter-spacing: -0.02em; line-height: 1; margin-bottom: 3px;
        }
        .footer-logo-sub {
          font-size: 10px; font-weight: 800; color: #F97316;
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
          gap: 8px;
          background: rgba(249,115,22,0.08);
          border: 1px solid rgba(249,115,22,0.2);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 700;
          color: #fdba74;
          align-self: flex-start;
          margin-top: 4px;
        }
        .footer-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background-color: #F97316;
          box-shadow: 0 0 8px #F97316;
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
          gap: 14px;
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
          gap: 16px;
        }
        .footer-contact-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
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
          margin-bottom: 24px;
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
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
            padding: 56px 20px 32px;
          }
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 48px;
            margin-bottom: 40px;
          }
          .footer-col {
            gap: 14px;
            align-items: center;
            text-align: center;
          }
          .footer-col[style] {
            padding-top: 0 !important;
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
            gap: 12px;
          }
        }
      `}</style>
    </>
  );
}
