'use client';
import { useEffect, useRef } from 'react';
import { Smartphone, FileBarChart2, MapPin, ClipboardCheck, CheckCircle } from 'lucide-react';

const FEATURES = [
  {
    id: 'feature-digital-tracking',
    icon: Smartphone,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.18)',
    title: 'Purpose-Built Mobile App',
    description:
      'Our technicians use our own custom mobile app on-site — logging inspection results, capturing photo evidence, and collecting client signatures. No paper. No delays.',
  },
  {
    id: 'feature-pdf-reports',
    icon: FileBarChart2,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.18)',
    title: 'Digital PDF Service Reports',
    description:
      'A structured PDF report is automatically generated at the end of every job — documenting each asset inspected, its result, defects found, and the technician signature.',
  },
  {
    id: 'feature-asset-tracking',
    icon: ClipboardCheck,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.18)',
    title: 'Per-Asset Inspection Logging',
    description:
      'Every fire safety asset at your property is individually logged with a Pass or Fail result. Defects are recorded with severity classification and photo evidence.',
  },
  {
    id: 'feature-multi-site',
    icon: MapPin,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.18)',
    title: 'Multi-Site Management',
    description:
      'We manage multiple properties simultaneously — each with its own asset register, compliance record, job history, and scheduled service dates in our system.',
  },
];

const PLATFORM_LIST = [
  'Properties & site asset registers',
  'Scheduled jobs & assigned technicians',
  'Per-asset inspection results (Pass/Fail)',
  'Defects with severity classifications',
  'Photo evidence captured during jobs',
  'Client signatures at job completion',
  'Digital PDF service reports per job',
  'Compliance status tracked per site',
];

export default function WhyUsSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.why-card');
    if (!cards) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.06 }
    );
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="why-us" className="section" style={{ background: '#F8FAFC' }} ref={ref}>
      <div className="container">

        {/* Top: headline + platform panel */}
        <div className="why-header-grid">
          <div>
            <div className="section-label">Why Choose Us</div>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 20 }}>
              Technology&#8209;Backed<br />Building Services
            </h2>
            <p className="body-md" style={{ color: '#64748b', lineHeight: 1.85, marginBottom: 18 }}>
              Unlike traditional building services companies using paper-based processes, UMA Building Services operates with its own purpose-built digital platform — built specifically for our workflow.
            </p>
            <p className="body-md" style={{ color: '#64748b', lineHeight: 1.85 }}>
              Every service visit we carry out produces a clear, structured digital record — giving our clients accurate documentation of what was inspected, what was found, and what was done.
            </p>
          </div>

          {/* Platform tracking panel */}
          <div className="why-platform-card">
            <div className="why-platform-glow" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: 'rgba(249,115,22,0.90)', marginBottom: 20,
              }}>
                Our Platform Tracks
              </p>
              {PLATFORM_LIST.map((item, i) => (
                <div key={item} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < PLATFORM_LIST.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <CheckCircle size={14} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="why-feature-grid">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                id={f.id}
                className="why-card"
                style={{
                  background: 'white',
                  border: `1px solid ${f.border}`,
                  borderRadius: 18,
                  padding: '26px 24px',
                  opacity: 0,
                  transform: 'translateY(22px)',
                  transition: `opacity 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 90}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 90}ms`,
                  display: 'flex', alignItems: 'flex-start', gap: 18,
                  boxShadow: `0 2px 12px ${f.color}12`,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 13,
                  background: f.bg, flexShrink: 0,
                  border: `1px solid ${f.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={21} color={f.color} strokeWidth={1.9} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#0F1E3C', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.75 }}>{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <style>{`
        .why-header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 52px;
          align-items: center;
          margin-bottom: 56px;
        }
        .why-platform-card {
          background: linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 100%);
          border-radius: 22px; padding: 36px 32px;
          position: relative; overflow: hidden;
          box-shadow: 0 16px 48px rgba(15,30,60,0.22);
        }
        .why-platform-glow {
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(249,115,22,0.12); filter: blur(50px);
          pointer-events: none;
        }
        .why-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        @media (max-width: 960px) {
          .why-header-grid { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 640px) {
          .why-feature-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
