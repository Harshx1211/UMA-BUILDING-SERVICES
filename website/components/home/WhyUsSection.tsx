'use client';
import { useEffect, useRef } from 'react';
import { Smartphone, FileBarChart2, MapPin, ClipboardCheck } from 'lucide-react';

const FEATURES = [
  { icon: Smartphone,    title: 'Purpose-Built Platform',     description: 'Our technicians use our own mobile app on every job — logging results, capturing photos, and collecting signatures in real time.' },
  { icon: FileBarChart2, title: 'Digital PDF Service Reports', description: 'A structured PDF is generated at job completion, documenting every asset inspected, result recorded, and defect found on site.' },
  { icon: ClipboardCheck, title: 'Per-Asset Inspection Log',   description: 'Every fire safety asset is individually logged with a Pass or Fail result, severity classification, and photo evidence.' },
  { icon: MapPin,        title: 'Multi-Site Management',       description: 'We manage multiple properties simultaneously — each with its own asset register, compliance history, and scheduled service dates.' },
];

export default function WhyUsSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.why-card');
    if (!cards) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }
      }),
      { threshold: 0.06 }
    );
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="why-us" className="section" style={{ background: 'white' }} ref={ref}>
      <div className="container">

        <div className="why-outer-grid">

          {/* Left: copy */}
          <div>
            <p className="section-eyebrow">Why UMA</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 24 }}>
              Technology-Backed<br />Building Services
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8, marginBottom: 18 }}>
              Unlike traditional building services companies using paper-based processes, UMA Building Services operates with its own purpose-built digital platform — built specifically for our workflow.
            </p>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8 }}>
              Every service visit produces a clear, structured digital record — giving our clients accurate documentation of what was inspected, what was found, and what was done about it.
            </p>
          </div>

          {/* Right: 2×2 feature cards */}
          <div className="why-cards-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="why-card"
                  style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    padding: '24px 22px',
                    opacity: 0,
                    transform: 'translateY(18px)',
                    transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(15,30,60,0.07)',
                    border: '1px solid rgba(15,30,60,0.09)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <Icon size={18} color="#0F1E3C" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 7, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 13.5, color: '#6B7280', lineHeight: 1.7 }}>
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      <style>{`
        .why-outer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }
        .why-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .why-outer-grid { grid-template-columns: 1fr; gap: 44px; }
        }
        @media (max-width: 480px) {
          .why-cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
