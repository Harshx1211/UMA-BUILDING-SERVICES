'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarClock, Wrench, FileText, CheckSquare, ArrowRight } from 'lucide-react';

const SERVICES = [
  {
    id: 'svc-monthly',
    icon: CalendarClock,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.20)',
    tag: 'Monthly',
    title: 'Monthly Routine Service',
    description:
      'Regular monthly inspections of fire safety assets and building systems. Ideal for high-traffic commercial properties requiring frequent compliance visits.',
  },
  {
    id: 'svc-3monthly',
    icon: CalendarClock,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.20)',
    tag: '3-Monthly',
    title: '3-Monthly Routine Service',
    description:
      'Quarterly inspections at regular 3-month intervals. Covers required periodic checks across all installed fire safety assets on site.',
  },
  {
    id: 'svc-6monthly',
    icon: CalendarClock,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.20)',
    tag: '6-Monthly',
    title: '6-Monthly Routine Service',
    description:
      'Bi-annual inspections for properties requiring half-yearly compliance visits — a common schedule for many commercial and industrial sites.',
  },
  {
    id: 'svc-annual',
    icon: CheckSquare,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    tag: 'Annual',
    title: 'Annual Routine Service',
    description:
      'Comprehensive yearly inspections covering all fire safety assets on site. Includes a full digital PDF service report generated at job completion.',
    featured: true,
  },
  {
    id: 'svc-5yearly',
    icon: FileText,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.10)',
    border: 'rgba(14,165,233,0.20)',
    tag: '5-Yearly',
    title: '5-Yearly Routine Service',
    description:
      'Major periodic inspections required at 5-year intervals. Covers extended compliance checks beyond standard annual requirements.',
  },
  {
    id: 'svc-defect',
    icon: Wrench,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.20)',
    tag: 'Defect Repair',
    title: 'Quote / Defect Repair',
    description:
      'Site visits to assess and repair defects found during inspections. We quote the work and carry out the repair upon your written approval.',
  },
];

export default function ServicesSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.svc-card');
    if (!cards) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
    );
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="services-section" className="section" ref={ref} style={{ background: '#F8FAFC', paddingTop: 72 }}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="section-label">What We Offer</div>
          <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
            Routine Inspections &amp;<br />Defect Repair Services
          </h2>
          <p className="body-md" style={{ color: '#64748b', maxWidth: 540, margin: '0 auto 28px' }}>
            Scheduled compliance inspections across every service frequency, plus defect assessment and repair — all fully tracked and digitally reported.
          </p>
          <Link href="/services" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 14, fontWeight: 700, color: '#F97316',
            textDecoration: 'none', letterSpacing: '-0.01em',
          }}>
            View full service details <ArrowRight size={15} />
          </Link>
        </div>

        {/* Grid */}
        <div className="services-grid">
          {SERVICES.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <div
                key={svc.id}
                id={svc.id}
                className="svc-card"
                style={{
                  background: 'white',
                  borderRadius: 18,
                  border: `1px solid ${svc.featured ? svc.border : '#e2e8f0'}`,
                  boxShadow: svc.featured
                    ? `0 4px 24px ${svc.color}18, 0 1px 4px rgba(0,0,0,0.04)`
                    : '0 1px 4px rgba(0,0,0,0.04)',
                  padding: '28px 26px',
                  opacity: 0,
                  transform: 'translateY(24px)',
                  transition: `opacity 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 65}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 65}ms`,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top accent line */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: svc.color, borderRadius: '18px 18px 0 0', opacity: svc.featured ? 1 : 0.35 }} />

                {/* Icon + Tag row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: svc.bg,
                    border: `1px solid ${svc.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={19} color={svc.color} strokeWidth={1.9} />
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 999,
                    background: svc.bg,
                    border: `1px solid ${svc.border}`,
                    fontSize: 11, fontWeight: 700,
                    color: svc.color, letterSpacing: '0.03em',
                  }}>
                    {svc.tag}
                  </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F1E3C', marginBottom: 10, letterSpacing: '-0.02em', lineHeight: 1.3 }}>{svc.title}</h3>
                <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.75, flex: 1 }}>{svc.description}</p>

                {/* Bottom indicator */}
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 2, borderRadius: 2, background: `${svc.color}20` }}>
                    <div style={{ width: '60%', height: '100%', borderRadius: 2, background: svc.color }} />
                  </div>
                  <span style={{ fontSize: 11, color: svc.color, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Includes PDF Report
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
