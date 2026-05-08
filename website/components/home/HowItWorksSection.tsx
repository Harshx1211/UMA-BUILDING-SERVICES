'use client';
import { useEffect, useRef } from 'react';
import { ClipboardList, SearchCheck, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STEPS = [
  {
    num: '01',
    icon: ClipboardList,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.20)',
    title: 'Submit Your Enquiry',
    description:
      "Tell us your property address, location, and the service frequency you need. We'll review your details and respond within one business day.",
  },
  {
    num: '02',
    icon: SearchCheck,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.20)',
    title: 'We Schedule a Visit',
    description:
      'Your property and job are registered in our platform, an assigned technician is notified, and a visit date is locked in at a time that suits you.',
  },
  {
    num: '03',
    icon: FileText,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    title: 'Service & Digital Report',
    description:
      'Our technician carries out the full inspection on-site, logs every asset result, and generates a structured PDF service report at job completion.',
  },
];

export default function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>('.step-item');
    if (!items) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = '1';
            (e.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.10 }
    );
    items.forEach(i => observer.observe(i));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="section" style={{ background: 'white' }} ref={ref}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="section-label">How It Works</div>
          <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
            Simple. Transparent. Digital.
          </h2>
          <p className="body-md" style={{ color: '#64748b', maxWidth: 480, margin: '0 auto' }}>
            From your first enquiry to a completed digital PDF report — here&apos;s exactly what to expect when you work with us.
          </p>
        </div>

        {/* Steps */}
        <div style={{ position: 'relative' }}>
          {/* Connector line — desktop */}
          <div className="step-connector-line" />

          <div className="step-grid">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  id={`step-${step.num}`}
                  className="step-item"
                  style={{
                    opacity: 0,
                    transform: 'translateY(28px)',
                    transition: `opacity 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 140}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 140}ms`,
                  }}
                >
                  {/* Number badge */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: step.bg,
                    border: `2px solid ${step.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900, color: step.color,
                    marginBottom: 24, position: 'relative', zIndex: 2,
                  }}>
                    {step.num}
                  </div>

                  {/* Icon */}
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: step.bg,
                    border: `1px solid ${step.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20,
                  }}>
                    <Icon size={24} color={step.color} strokeWidth={1.8} />
                  </div>

                  <div style={{
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: step.color, marginBottom: 10,
                  }}>
                    Step {step.num}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F1E3C', marginBottom: 12, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>
                    {step.description}
                  </p>

                  {/* Arrow between steps on desktop */}
                  {i < STEPS.length - 1 && (
                    <div className="step-arrow">
                      <ArrowRight size={18} color={step.color} style={{ opacity: 0.4 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: 'center', marginTop: 56 }}>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15 }}>
            Start with a Free Enquiry <ArrowRight size={16} />
          </Link>
        </div>

      </div>

      <style>{`
        .step-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0 32px;
          position: relative;
        }
        .step-item {
          background: #F8FAFC;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 32px 28px;
          position: relative;
        }
        .step-connector-line {
          display: none;
        }
        .step-arrow {
          position: absolute;
          right: -26px;
          top: 44px;
          z-index: 3;
        }
        @media (max-width: 768px) {
          .step-grid { grid-template-columns: 1fr; gap: 16px; }
          .step-arrow { display: none; }
        }
      `}</style>
    </section>
  );
}
