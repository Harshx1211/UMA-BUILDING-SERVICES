'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarClock, Wrench, FileText, CheckSquare, ArrowRight } from 'lucide-react';

const SERVICES = [
  { id: 'svc-monthly',  icon: CalendarClock, schedule: 'Monthly',    title: 'Monthly Routine Service',    description: 'Regular monthly inspections of fire safety assets. Suited to high-traffic commercial properties requiring frequent compliance visits.' },
  { id: 'svc-3monthly', icon: CalendarClock, schedule: '3-Monthly',   title: '3-Monthly Routine Service',  description: 'Quarterly inspections covering required periodic checks across all installed fire safety assets on site.' },
  { id: 'svc-6monthly', icon: CalendarClock, schedule: '6-Monthly',   title: '6-Monthly Routine Service',  description: 'Bi-annual inspections for properties requiring half-yearly compliance visits, common for commercial and industrial sites.' },
  { id: 'svc-annual',   icon: CheckSquare,   schedule: 'Annual',      title: 'Annual Routine Service',     description: 'Comprehensive yearly inspections covering all fire safety assets, with a full digital PDF service report at completion.' },
  { id: 'svc-5yearly',  icon: FileText,      schedule: '5-Yearly',    title: '5-Yearly Routine Service',   description: 'Major periodic inspections at 5-year intervals covering extended compliance checks beyond standard annual requirements.' },
  { id: 'svc-defect',   icon: Wrench,        schedule: 'On Request',  title: 'Quote / Defect Repair',      description: 'Site visits to assess and repair defects found during inspections. We quote and carry out repairs upon your written approval.' },
];

export default function ServicesSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.bento-card');
    if (!cards) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)';
        }
      }),
      { threshold: 0.1 }
    );
    cards.forEach(c => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="section" ref={ref}>
      <div className="container">

        {/* Header */}
        <div style={{ maxWidth: 640, marginBottom: 64, textAlign: 'center', margin: '0 auto 64px' }}>
          <p className="section-eyebrow" style={{ color: '#06b6d4' }}>Features</p>
          <h2 className="heading-lg" style={{ color: 'white', marginBottom: 16 }}>
            Everything you need to scale.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
            SiteTrack replaces your messy spreadsheets and paper forms with an enterprise-grade operating system designed exclusively for Fire Safety.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="bento-grid">
          
          {/* Card 1: Offline App (Large) */}
          <div className="bento-card bento-item-large card-glass" style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'rgba(249,115,22,0.2)', filter: 'blur(50px)' }} />
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckSquare color="#F97316" size={24} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>True Offline-First Mobile App</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.6, maxWidth: 400 }}>
                Your technicians work in basements and concrete bunkers. The SiteTrack mobile app stores a local SQLite database that syncs perfectly the moment they regain signal. Never lose a digital form again.
              </p>
            </div>
          </div>

          {/* Card 2: PDF Reports */}
          <div className="bento-card card-glass" style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <FileText color="#06b6d4" size={24} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 12 }}>Instant AS1851 PDFs</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6 }}>
              The moment a technician clicks complete, the system compiles all checklists and photos into a professional, AS1851-compliant PDF report ready to send to your clients.
            </p>
          </div>

          {/* Card 3: Multi-Tenant */}
          <div className="bento-card card-glass" style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Wrench color="#10b981" size={24} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 12 }}>Enterprise Security</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.6 }}>
              Built with strict PostgreSQL Row-Level Security (RLS). Your data is cryptographically isolated and impenetrable by other tenants on the platform.
            </p>
          </div>

          {/* Card 4: Scheduling (Large) */}
          <div className="bento-card bento-item-large card-glass" style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, background: 'rgba(6,182,212,0.15)', filter: 'blur(50px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CalendarClock color="white" size={24} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>Automated Job Dispatch</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.6, maxWidth: 400 }}>
                Manage all routine maintenance frequencies (1-Monthly to 5-Yearly). Instantly assign jobs to technicians, track their real-time progress, and capture customer signatures digitally on site.
              </p>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .bento-card {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s cubic-bezier(0.2,0.8,0.2,1), transform 0.6s cubic-bezier(0.2,0.8,0.2,1), border-color 0.3s;
        }
      `}</style>
    </section>
  );
}
