'use client';
import Link from 'next/link';
import { ArrowRight, Shield, FileText, ClipboardCheck, Award } from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.14)',
    title: 'Fire Safety Inspections',
    desc: 'Monthly to 5-yearly routine service schedules',
  },
  {
    icon: ClipboardCheck,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.14)',
    title: 'Per-Asset Logging',
    desc: 'Pass/Fail recorded on every individual asset',
  },
  {
    icon: FileText,
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.14)',
    title: 'Digital PDF Reports',
    desc: 'Structured report generated on job completion',
  },
];

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="hero-gradient"
      style={{ position: 'relative', paddingTop: 72, overflow: 'hidden' }}
    >
      {/* Glow orbs */}
      <div className="glow-orb" style={{ width: 560, height: 560, background: 'rgba(249,115,22,0.10)', top: '-180px', right: '-100px' }} />
      <div className="glow-orb" style={{ width: 420, height: 420, background: 'rgba(36,58,101,0.55)', bottom: '-140px', left: '-100px' }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* ── Main content ── */}
      <div
        className="container"
        style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '52px 24px 0' }}
      >
        {/* Eyebrow pill */}
        <div className="animate-fade-in-up" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 26,
          padding: '6px 16px', borderRadius: 999,
          background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.28)',
        }}>
          <Award size={12} color="#F97316" />
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fdba74' }}>
            Fire Safety &amp; Building Compliance — Australia
          </span>
        </div>

        {/* H1 — clean line breaks */}
        <h1
          className="animate-fade-in-up delay-100"
          style={{
            fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.08,
            color: 'white', marginBottom: 20, maxWidth: 760, margin: '0 auto 20px',
            fontSize: 'clamp(34px, 5.5vw, 62px)',
          }}
        >
          Professional{' '}
          <span style={{
            background: 'linear-gradient(135deg,#F97316 0%,#fb923c 60%,#fde68a 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Building&nbsp;Services
          </span>{' '}
          Done&nbsp;Right.
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up delay-200"
          style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 36px' }}
        >
          Routine fire safety inspections and defect repairs — fully managed through our own purpose-built digital platform.
        </p>

        {/* CTAs */}
        <div className="animate-fade-in-up delay-300" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 52 }}>
          <Link href="/contact" id="hero-cta-primary" className="btn btn-primary" style={{ fontSize: 15, padding: '13px 30px' }}>
            Get a Free Quote <ArrowRight size={16} />
          </Link>
          <Link href="/services" id="hero-cta-secondary" className="btn btn-outline" style={{ fontSize: 15, padding: '13px 26px' }}>
            Our Services
          </Link>
        </div>

        {/* Feature cards — lighter so they read better on dark bg */}
        <div className="animate-fade-in-up delay-400 hero-feature-strip">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 16,
                  padding: '20px 18px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: f.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={19} color={f.color} strokeWidth={1.9} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: 4, letterSpacing: '-0.015em' }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Highlights strip ── */}
      <div style={{ position: 'relative', zIndex: 2, marginTop: 48, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="container">
          <div className="hero-highlights-grid">
            {[
              { value: 'Digital',        label: 'No paper processes' },
              { value: 'PDF Report',     label: 'Every completed job' },
              { value: '1 Business Day', label: 'Enquiry response' },
              { value: 'Aus-Wide',       label: 'Commercial & industrial' },
            ].map((s, i, arr) => (
              <div key={s.label} style={{
                padding: '18px 0', textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hero-feature-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          max-width: 820px;
          margin: 0 auto;
        }
        .hero-highlights-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 720px) {
          .hero-feature-strip { grid-template-columns: 1fr; max-width: 420px; }
          .hero-highlights-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </section>
  );
}
