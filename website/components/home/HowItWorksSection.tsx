'use client';
import { useEffect, useRef } from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Provision Your Tenant',
    description: "Contact our sales team. We instantly provision your dedicated PostgreSQL tenant, completely isolated and secure.",
  },
  {
    num: '02',
    title: 'Invite Your Technicians',
    description: 'Add your staff to the platform. They simply download the SiteTrack app, log in, and all their scheduled jobs appear automatically.',
  },
  {
    num: '03',
    title: 'Automate Compliance',
    description: 'Technicians execute inspections offline. As soon as they hit complete, SiteTrack generates an AS1851 PDF and logs the compliance history.',
  },
];

export default function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>('.step-item');
    if (!items) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }
      }),
      { threshold: 0.1 }
    );
    items.forEach(i => obs.observe(i));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="section" style={{ background: 'transparent' }} ref={ref}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p className="section-eyebrow" style={{ textAlign: 'center', color: '#10b981' }}>How It Works</p>
          <h2 className="heading-lg" style={{ color: 'white', marginBottom: 16 }}>
            Onboard in minutes.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 440, margin: '0 auto', lineHeight: 1.75 }}>
            No messy migrations or complex setups. Just log in and start dispatching jobs.
          </p>
        </div>

        {/* Steps */}
        <div className="how-grid" ref={ref}>
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              id={`step-${step.num}`}
              className="step-item"
              style={{
                opacity: 0,
                transform: 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 130}ms, transform 0.5s ease ${i * 130}ms`,
              }}
            >
              {/* Large number */}
              <p style={{ fontSize: 52, fontWeight: 900, color: 'rgba(255,255,255,0.05)', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 20 }}>
                {step.num}
              </p>

              {/* Cyan rule */}
              <div style={{ width: 28, height: 2, background: '#06b6d4', borderRadius: 2, marginBottom: 22 }} />

              {/* Text */}
              <h3 style={{ fontSize: 19, fontWeight: 700, color: 'white', marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        .how-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
        }
        .step-item {
          padding: 48px 40px;
          border-right: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(12px);
        }
        .step-item:last-child { border-right: none; }
        @media (max-width: 768px) {
          .how-grid { grid-template-columns: 1fr; }
          .step-item { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 36px 28px; }
          .step-item:last-child { border-bottom: none; }
        }
      `}</style>
    </section>
  );
}
