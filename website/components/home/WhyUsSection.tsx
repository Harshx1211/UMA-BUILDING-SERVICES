'use client';
import { useEffect, useRef } from 'react';
import { Smartphone, FileBarChart2, MapPin, ClipboardCheck } from 'lucide-react';

const FEATURES = [
  { icon: Smartphone,    title: 'Offline-First App',          description: 'Our mobile app caches all checklists and data locally, seamlessly syncing to the cloud when signal returns.' },
  { icon: FileBarChart2, title: 'Instant PDF Generation',     description: 'No more evening paperwork. Generate professional AS1851 PDFs directly from the field the moment a job is done.' },
  { icon: ClipboardCheck, title: 'Digital Asset Registers',   description: 'Build complete digital histories of every fire safety asset across all your client sites.' },
  { icon: MapPin,        title: 'Multi-Tenant Architecture',  description: 'Enterprise-grade security using advanced Row-Level Security ensuring your data is completely isolated.' },
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
    <section id="why-us" className="section" style={{ background: 'transparent' }} ref={ref}>
      <div className="container">

        <div className="why-outer-grid">

          {/* Left: copy */}
          <div>
            <p className="section-eyebrow" style={{ color: '#F97316' }}>Why SiteTrack</p>
            <h2 className="heading-lg" style={{ color: 'white', marginBottom: 24 }}>
              Built for<br />Modern Businesses
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginBottom: 18 }}>
              Unlike generic field service software, SiteTrack is built specifically for the Fire Safety industry. We know that compliance is everything, and paperwork is the enemy.
            </p>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
              Equip your technicians with the tools they need to complete AS1851 inspections accurately and efficiently, while giving your admin team the oversight they need to scale the business.
            </p>
          </div>

          {/* Right: 2×2 feature cards */}
          <div className="why-cards-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="why-card card-glass"
                  style={{
                    padding: '24px 22px',
                    opacity: 0,
                    transform: 'translateY(18px)',
                    transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms, border-color 0.2s`,
                    cursor: 'default',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(249,115,22,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <Icon size={18} color="#F97316" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 7, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
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
