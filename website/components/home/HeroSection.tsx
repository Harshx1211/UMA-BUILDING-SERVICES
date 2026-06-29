'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const TRUST = [
  { short: 'Offline-First App',    full: 'Offline-First Technician App' },
  { short: 'Digital Forms',        full: 'AS1851 Digital Checklists' },
  { short: 'PDF Reports',          full: 'Automated PDF Reporting' },
  { short: 'Multi-Tenant',         full: 'Enterprise-Grade Security' },
];

export default function HeroSection() {
  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        paddingTop: 140,
        paddingBottom: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        overflow: 'hidden'
      }}
    >
      {/* ── Background Orbs ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
          width: '70%', height: '500px',
          background: 'radial-gradient(ellipse at top, rgba(249, 115, 22, 0.08), transparent 60%)',
          filter: 'blur(80px)'
        }} />
        <div style={{
          position: 'absolute', top: '35%', left: '15%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.05), transparent 60%)',
          filter: 'blur(100px)'
        }} />
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Eyebrow */}
        <div className="animate-slide-up-fade" style={{ animationDelay: '0ms' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 999, marginBottom: 24
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', boxShadow: '0 0 10px #F97316' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fdba74', letterSpacing: '0.04em' }}>
              SiteTrack Platform 2.0 is Live
            </span>
          </div>
        </div>

        {/* H1 */}
        <h1 className="hero-h1 animate-slide-up-fade" style={{ animationDelay: '100ms', letterSpacing: '-0.04em' }}>
          Run your Fire Safety <br/> business on <span className="text-gradient">Autopilot.</span>
        </h1>

        {/* Sub */}
        <p className="hero-sub animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
          Ditch the paper trails. Empower your technicians with an offline-first mobile app and generate instant, fully compliant AS1851 PDF reports the second a job is finished.
        </p>

        {/* CTAs */}
        <div className="animate-slide-up-fade" style={{ animationDelay: '300ms', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
          <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>
            Start Free Trial <ArrowRight size={18} />
          </Link>
          <Link href="/about" className="btn btn-outline" style={{ padding: '14px 32px', fontSize: 16 }}>
            Book a Demo
          </Link>
        </div>

        {/* ── CSS Abstract Dashboard Mockup ── */}
        {/* Mockup Halo Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ background: 'linear-gradient(90deg, #F97316, #ea6900)' }} />
        
        <div className="mockup-container animate-slide-up-fade" style={{ animationDelay: '500ms' }}>
          <div className="mockup-glass">
            
            {/* Mockup Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
              </div>
              <div style={{ width: 240, height: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 100, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #F97316, #ea6900)', border: '2px solid rgba(255,255,255,0.1)' }} />
            </div>

            {/* Mockup Body */}
            <div className="mockup-body" style={{ display: 'flex', padding: 20, gap: 20, height: 460, background: 'radial-gradient(circle at top right, rgba(249,115,22,0.03), transparent 50%)' }}>
              
              {/* Sidebar */}
              <div className="mockup-sidebar" style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid rgba(255,255,255,0.04)', paddingRight: 20 }}>
                {/* Logo skeleton */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingLeft: 4 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'white' }}>S</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>SiteTrack</span>
                </div>
                {/* Nav Items */}
                {[
                  { label: 'Dashboard', active: true },
                  { label: 'Inspections', active: false },
                  { label: 'Properties', active: false },
                  { label: 'Defects', active: false },
                ].map((item, i) => (
                  <div key={i} style={{ 
                    height: 36, borderRadius: 10, 
                    background: item.active ? 'linear-gradient(90deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))' : 'transparent',
                    border: item.active ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
                    display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: item.active ? '#F97316' : 'rgba(255,255,255,0.15)' }} />
                    <span style={{ fontSize: 13, fontWeight: item.active ? 600 : 500, color: item.active ? '#F97316' : 'rgba(255,255,255,0.5)' }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Main Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Stats Row */}
                <div className="mockup-stats-row" style={{ display: 'flex', gap: 16 }}>
                  {[
                    { color: '#F97316', label: 'Active Jobs', val: 80 },
                    { color: '#3b82f6', label: 'Pending Quotes', val: 50 },
                    { color: '#10b981', label: 'Compliance', val: 90 }
                  ].map((s, i) => (
                    <div key={i} className="mockup-stat-card">
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(${s.color === '#F97316' ? '249,115,22' : s.color === '#3b82f6' ? '59,130,246' : '16,185,129'}, 0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, opacity: 0.8 }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{s.label}</span>
                      <div className="mockup-bar" style={{ width: `${s.val}%`, background: s.color, boxShadow: `0 0 10px ${s.color}60` }} />
                    </div>
                  ))}
                </div>

                {/* Data List */}
                <div style={{ flex: 1, borderRadius: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}>
                  {/* Subtle Grid inside list */}
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.3 }} />
                  
                  {[
                    { title: 'Central Tower Inspection', type: 'Annual Audit', status: 'Completed', color: '#10b981' },
                    { title: 'Fire Extinguisher Fault', type: 'Defect Repair', status: 'In Progress', color: '#F97316' },
                    { title: 'Pump Room Maintenance', type: 'Scheduled', status: 'Pending', color: '#3b82f6' },
                    { title: 'Sprinkler System Check', type: 'Routine Test', status: 'Completed', color: '#10b981' },
                    { title: 'Emergency Exit Lighting', type: 'Defect Repair', status: 'In Progress', color: '#F97316' }
                  ].map((row, i) => (
                    <div key={i} className="mockup-list-item" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className="mockup-list-item-title" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.title}</span>
                      </div>
                      <span className="mockup-list-item-type" style={{ width: 100, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.type}</span>
                      <div style={{ 
                        width: 85, height: 24, borderRadius: 12, 
                        background: `${row.color}15`, border: `1px solid ${row.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>{row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Floating UI Badges */}
          <div className="mockup-floating-badge animate-float-a" style={{ top: 120, left: -60, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(10,22,40,0.9)' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <span style={{ color: '#10b981', fontSize: 12 }}>✓</span>
            </div>
            PDF Generated
          </div>
          <div className="mockup-floating-badge animate-float-b" style={{ bottom: 100, right: -50, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(10,22,40,0.9)' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <span style={{ color: '#F97316', fontSize: 12 }}>⚡</span>
            </div>
            Synced Offline
          </div>
        </div>

      </div>

      <style>{`
        .mockup-container {
          position: relative;
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          perspective: 1000px;
          text-align: left;
        }
        
        .mockup-glass {
          background: linear-gradient(135deg, rgba(20, 30, 48, 0.6), rgba(10, 15, 26, 0.8));
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.12);
          border-top: 1px solid rgba(255,255,255,0.25);
          border-left: 1px solid rgba(255,255,255,0.18);
          border-radius: 20px;
          box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1);
          overflow: hidden;
          transform: rotateX(12deg) rotateY(-4deg) scale(0.95);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mockup-container:hover .mockup-glass {
          transform: rotateX(8deg) rotateY(-2deg) scale(0.98);
        }

        .mockup-stat-card {
          flex: 1;
          height: 110px;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        
        .mockup-bar {
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
        }

        .mockup-floating-badge {
          position: absolute;
          background: rgba(10, 22, 40, 0.8);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 12px 20px;
          border-radius: 99px;
          color: white;
          font-weight: 600;
          font-size: 14px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          z-index: 10;
        }

        @media (max-width: 768px) {
          .mockup-glass { transform: none; border-radius: 12px; }
          .mockup-container { padding: 0 16px; margin-top: 20px; }
          .mockup-container:hover .mockup-glass { transform: none; }
          .mockup-sidebar { display: none !important; }
          
          /* Horizontal scroll for stats on mobile */
          .mockup-stats-row { 
            overflow-x: auto; 
            padding-bottom: 8px; 
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
            /* Hide scrollbar */
            -ms-overflow-style: none; scrollbar-width: none;
          }
          .mockup-stats-row::-webkit-scrollbar { display: none; }
          .mockup-stat-card { 
            flex-shrink: 0;
            min-width: 140px; 
            scroll-snap-align: start;
            height: auto; min-height: 90px;
          }
          
          /* Fix list items */
          .mockup-body { height: auto !important; padding: 16px !important; }
          .mockup-list-item { padding: 10px 12px !important; gap: 10px !important; }
          .mockup-list-item-type { display: none !important; }
          .mockup-list-item-title { font-size: 12px !important; }
          
          .mockup-floating-badge { display: none; }
        }
      `}</style>
    </section>
  );
}
