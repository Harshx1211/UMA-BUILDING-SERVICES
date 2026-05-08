'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarClock, Wrench, FileText, CheckSquare, ArrowRight } from 'lucide-react';

const SERVICES = [
  { id: 'svc-monthly',  icon: CalendarClock, schedule: 'Monthly',    title: 'Monthly Routine Service',    description: 'Regular monthly inspections of fire safety assets. Suited to high-traffic commercial properties requiring frequent compliance visits.' },
  { id: 'svc-3monthly', icon: CalendarClock, schedule: '3-Monthly',   title: '3-Monthly Routine Service',  description: 'Quarterly inspections covering required periodic checks across all installed fire safety assets on site.' },
  { id: 'svc-6monthly', icon: CalendarClock, schedule: '6-Monthly',   title: '6-Monthly Routine Service',  description: 'Bi-annual inspections for properties requiring half-yearly compliance visits — common for commercial and industrial sites.' },
  { id: 'svc-annual',   icon: CheckSquare,   schedule: 'Annual',      title: 'Annual Routine Service',     description: 'Comprehensive yearly inspections covering all fire safety assets, with a full digital PDF service report at completion.' },
  { id: 'svc-5yearly',  icon: FileText,      schedule: '5-Yearly',    title: '5-Yearly Routine Service',   description: 'Major periodic inspections at 5-year intervals covering extended compliance checks beyond standard annual requirements.' },
  { id: 'svc-defect',   icon: Wrench,        schedule: 'On Request',  title: 'Quote / Defect Repair',      description: 'Site visits to assess and repair defects found during inspections. We quote and carry out repairs upon your written approval.' },
];

export default function ServicesSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.svc-card');
    if (!cards) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }
      }),
      { threshold: 0.05 }
    );
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="services-section" className="section" ref={ref} style={{ background: 'white' }}>
      <div className="container">

        {/* Left-aligned header */}
        <div style={{ maxWidth: 580, marginBottom: 52 }}>
          <p className="section-eyebrow">Our Services</p>
          <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>
            Routine Inspections &amp;<br />Defect Repair Services
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.75 }}>
            Scheduled compliance inspections across every service frequency, plus defect assessment and repair — fully tracked and digitally reported.
          </p>
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
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  padding: '28px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: 0,
                  transform: 'translateY(20px)',
                  transition: `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'default',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(15,30,60,0.07)',
                  border: '1px solid rgba(15,30,60,0.09)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 18,
                }}>
                  <Icon size={20} color="#0F1E3C" strokeWidth={1.8} />
                </div>

                {/* Title */}
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.35 }}>
                  {svc.title}
                </h3>

                {/* Description */}
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, flex: 1 }}>
                  {svc.description}
                </p>

                {/* Footer */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9CA3AF' }}>
                    {svc.schedule}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 40 }}>
          <Link href="/services" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: '#0F1E3C', letterSpacing: '-0.01em' }}>
            View full service details <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
