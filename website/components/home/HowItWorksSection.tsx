'use client';
import { useEffect, useRef } from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Submit Your Enquiry',
    description: "Tell us your property address and the service frequency you need. We'll review your details and respond within one business day.",
  },
  {
    num: '02',
    title: 'We Schedule a Visit',
    description: 'Your property is registered in our platform, a technician is assigned, and a confirmed visit date is locked in at a time that suits you.',
  },
  {
    num: '03',
    title: 'Service & Digital Report',
    description: 'Our technician carries out the full inspection on-site, logs every asset, and generates a structured PDF service report at completion.',
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
    <section id="how-it-works" className="section" style={{ background: '#F9FAFB' }} ref={ref}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p className="section-eyebrow" style={{ textAlign: 'center' }}>How It Works</p>
          <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
            Simple. Transparent. Digital.
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 440, margin: '0 auto', lineHeight: 1.75 }}>
            From your first enquiry to a completed digital report. Here is exactly what to expect.
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
              <p style={{ fontSize: 52, fontWeight: 900, color: '#E5E7EB', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: 20 }}>
                {step.num}
              </p>

              {/* Orange rule */}
              <div style={{ width: 28, height: 2, background: '#F97316', borderRadius: 2, marginBottom: 22 }} />

              {/* Text */}
              <h3 style={{ fontSize: 19, fontWeight: 700, color: '#111827', marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.8 }}>
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
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          overflow: hidden;
        }
        .step-item {
          padding: 48px 40px;
          border-right: 1px solid #E5E7EB;
          background: white;
        }
        .step-item:last-child { border-right: none; }
        @media (max-width: 768px) {
          .how-grid { grid-template-columns: 1fr; }
          .step-item { border-right: none; border-bottom: 1px solid #E5E7EB; padding: 36px 28px; }
          .step-item:last-child { border-bottom: none; }
        }
      `}</style>
    </section>
  );
}
