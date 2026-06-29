'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Shield, ArrowRight } from 'lucide-react';

// 3 nav links (Contact removed to avoid duplicating the Get Started CTA)
const NAV_LINKS = [
  { href: '/',         label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about',    label: 'About' },
];

export default function Navbar() {
  const [open, setOpen]         = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname                = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll(); // read scroll position immediately on mount
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <header
        id="site-navbar"
        className={scrolled ? 'navbar navbar-scrolled' : 'navbar'}
      >
        <div className="container navbar-inner">

          {/* Logo */}
          <Link href="/" id="nav-logo" className="navbar-logo">
            <div className="navbar-logo-icon">
              <Shield size={17} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div className={scrolled ? 'navbar-logo-name scrolled' : 'navbar-logo-name'}>
                SiteTrack
              </div>
              <div className="navbar-logo-sub">Platform</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="navbar-links hide-mobile-nav">
            {NAV_LINKS.map(l => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  id={`nav-${l.label.toLowerCase()}`}
                  className={[
                    'navbar-link',
                    scrolled ? 'navbar-link-dark' : 'navbar-link-dark',
                    active ? (scrolled ? 'active-dark' : 'active-dark') : '',
                  ].join(' ')}
                >
                  {l.label}
                  {active && <span className="navbar-active-dot" />}
                </Link>
              );
            })}
          </nav>

          {/* CTA Button */}
          <Link
            href="/contact"
            id="nav-cta"
            className="navbar-cta hide-mobile-nav"
          >
            Get Started <ArrowRight size={14} />
          </Link>

          {/* Hamburger */}
          <button
            id="nav-hamburger"
            onClick={() => setOpen(!open)}
            className="navbar-burger show-mobile-nav"
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="navbar-mobile animate-slide-down">
            <div className="container navbar-mobile-inner">
              {NAV_LINKS.map(l => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={active ? 'navbar-mobile-link active' : 'navbar-mobile-link'}
                  >
                    {l.label}
                  </Link>
                );
              })}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="navbar-mobile-cta"
              >
                Get Started <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </header>

      <style>{`
        /* ── Navbar shell ── */
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          transition: background 350ms, box-shadow 350ms, border-color 350ms, backdrop-filter 350ms;
          background: transparent;
          border-bottom: 1px solid transparent;
        }
        .navbar-scrolled {
          background: rgba(10,22,40,0.7);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 32px rgba(0,0,0,0.4);
        }
        .navbar-inner {
          display: flex; align-items: center; height: 72px; gap: 8px;
        }

        /* ── Logo ── */
        .navbar-logo {
          display: flex; align-items: center; gap: 10px;
          flex-shrink: 0; margin-right: auto; text-decoration: none;
        }
        .navbar-logo-icon {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg,#F97316,#ea6900);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(249,115,22,0.42);
        }
        .navbar-logo-name {
          font-weight: 900; font-size: 14.5px; letter-spacing: -0.03em;
          color: white; line-height: 1.1; transition: color 350ms;
        }
        .navbar-logo-name.scrolled { color: white; }
        .navbar-logo-sub {
          font-weight: 700; font-size: 9.5px; letter-spacing: 0.09em;
          text-transform: uppercase; color: #F97316; line-height: 1;
        }

        /* ── Desktop nav links ── */
        .navbar-links { display: flex; align-items: center; gap: 2px; }
        .navbar-link {
          position: relative; padding: 7px 14px; font-size: 14px; font-weight: 500;
          letter-spacing: -0.01em; border-radius: 8px; text-decoration: none;
          display: flex; flex-direction: column; align-items: center;
          transition: color 180ms, background 180ms;
        }
        .navbar-link-dark { color: rgba(255,255,255,0.70); }
        .navbar-link-dark:hover { color: white; background: rgba(255,255,255,0.09); }
        .navbar-link-light { color: #64748b; }
        .navbar-link-light:hover { color: #0F1E3C; background: rgba(15,30,60,0.05); }
        .navbar-link.active-dark { color: white; font-weight: 700; }
        .navbar-link.active-light { color: #0F1E3C; font-weight: 700; }
        .navbar-active-dot {
          position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%; background: #F97316;
        }

        /* ── CTA button ── */
        .navbar-cta {
          margin-left: 12px; display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: #F97316; color: white; border-radius: 10px;
          font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(249,115,22,0.45);
          transition: all 200ms; flex-shrink: 0; text-decoration: none;
        }
        .navbar-cta:hover {
          background: #ea6900; transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(249,115,22,0.55);
        }

        /* ── Hamburger ── */
        .navbar-burger {
          margin-left: auto; width: 42px; height: 42px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.12); color: white;
          border: none; cursor: pointer; transition: background 200ms;
        }
        .navbar-burger-light { background: #f1f5f9; color: #1B2D4F; }

        /* ── Mobile menu ── */
        .navbar-mobile {
          background: rgba(10,22,40,0.95); border-top: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          backdrop-filter: blur(24px);
        }
        .navbar-mobile-inner {
          padding: 12px 18px 20px; display: flex; flex-direction: column; gap: 2px;
        }
        .navbar-mobile-link {
          padding: 13px 16px; border-radius: 10px; font-size: 15px; font-weight: 600;
          color: rgba(255,255,255,0.7); background: transparent; border-left: 3px solid transparent;
          transition: all 150ms; text-decoration: none;
        }
        .navbar-mobile-link.active {
          color: white; background: rgba(255,255,255,0.05); border-left-color: #F97316;
        }
        .navbar-mobile-cta {
          margin-top: 10px; display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 14px 20px; background: #F97316; color: white;
          border-radius: 12px; font-size: 15px; font-weight: 700;
          text-decoration: none; box-shadow: 0 4px 16px rgba(249,115,22,0.40);
        }

        /* ── Responsive visibility ── */
        @media (min-width: 769px) { .show-mobile-nav { display: none !important; } }
        @media (max-width: 768px) { .hide-mobile-nav { display: none !important; } .show-mobile-nav { display: flex !important; } }
      `}</style>
    </>
  );
}
