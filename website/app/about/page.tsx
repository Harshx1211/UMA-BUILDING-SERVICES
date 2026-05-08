import type { Metadata } from 'next';
import { Smartphone, FileBarChart2, Building2, Users, Target, Cpu, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'UMA Building Services is a building maintenance company delivering routine fire safety inspections and defect repair services, tracked through our own purpose-built digital platform.',
};

const PLATFORM_FEATURES = [
  'Mobile app used by technicians on-site',
  'Per-asset inspection logging (Pass / Fail)',
  'Photo evidence capture during jobs',
  'Client signature collection at completion',
  'Digital PDF report generated per job',
  'Real-time job and compliance status tracking',
  'Defect management with severity classification',
  'Multi-property site register',
];

const WHAT_WE_MANAGE = [
  { icon: Building2,     label: 'Properties',         desc: 'Client sites registered with full asset registers and compliance status.' },
  { icon: Users,         label: 'Technicians',         desc: 'Field technicians assigned jobs via our platform with real-time updates.' },
  { icon: Smartphone,    label: 'Mobile Inspections',  desc: 'Technicians log results on-site using our custom mobile application.' },
  { icon: FileBarChart2, label: 'Digital Reports',     desc: 'PDF service reports generated and stored for every completed job.' },
];

const PILLARS = [
  { num: '01', title: 'Accountable', body: 'Every asset checked, every result recorded, every job documented — no guesswork.' },
  { num: '02', title: 'Transparent', body: 'Clients receive a clear digital PDF report at the end of every service visit.' },
  { num: '03', title: 'Digital-First', body: 'Our entire operation runs through our own platform — no paper-based processes.' },
];

export default function AboutPage() {
  return (
    <>
      <style>{`
        .about-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
        }
        .about-manage-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        .about-platform-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
        }
        .about-pillars {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px;
        }
        @media (max-width: 900px) {
          .about-grid { grid-template-columns: 1fr; gap: 40px; }
          .about-pillars { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .about-manage-grid { grid-template-columns: 1fr; }
          .about-platform-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0F1E3C 55%, #1B2D4F 100%)',
        padding: '130px 0 88px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(249,115,22,0.10)', filter: 'blur(90px)',
          top: '-100px', right: '-80px', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '52px 52px', pointerEvents: 'none',
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', marginBottom: 22,
            background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: 999,
          }}>
            <Building2 size={13} color="#F97316" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#fdba74' }}>
              Who We Are
            </span>
          </div>
          <h1 className="heading-xl" style={{ color: 'white', marginBottom: 18, maxWidth: 560 }}>
            About UMA<br />Building Services
          </h1>
          <p className="body-lg" style={{ color: 'rgba(255,255,255,0.60)', maxWidth: 520 }}>
            A building maintenance company delivering routine fire safety inspections and defect repairs — backed by our own purpose-built digital tracking platform.
          </p>
        </div>
      </section>

      {/* Who we are */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div className="about-grid">
            <div>
              <div className="section-label">Our Story</div>
              <h2 className="heading-md" style={{ color: '#0F1E3C', marginBottom: 22 }}>
                Building Maintenance,<br />Done Digitally
              </h2>
              <p className="body-md" style={{ color: '#64748b', marginBottom: 18, lineHeight: 1.85 }}>
                UMA Building Services was established to provide reliable, accountable building maintenance services for commercial and industrial property owners — focused specifically on routine fire safety inspections and defect repair services.
              </p>
              <p className="body-md" style={{ color: '#64748b', marginBottom: 18, lineHeight: 1.85 }}>
                What sets us apart is that we manage our entire operation through our own custom-built digital platform — developed specifically for our workflow. Our technicians use a dedicated mobile app to log inspection results, capture photos, and generate PDF reports on-site.
              </p>
              <p className="body-md" style={{ color: '#64748b', lineHeight: 1.85 }}>
                Every job we carry out produces a clear, structured digital record — giving our clients accurate documentation of what was inspected, what was found, and what was done.
              </p>
            </div>

            <div className="about-manage-grid">
              {WHAT_WE_MANAGE.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} style={{
                    background: '#F8FAFC', border: '1px solid #e2e8f0',
                    borderRadius: 18, padding: 24,
                    transition: 'box-shadow 200ms, border-color 200ms',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'rgba(249,115,22,0.10)',
                      border: '1px solid rgba(249,115,22,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      <Icon size={20} color="#F97316" />
                    </div>
                    <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0F1E3C', marginBottom: 6, letterSpacing: '-0.015em' }}>{item.label}</p>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Our Platform */}
      <section className="section" style={{ background: '#F8FAFC' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="section-label" style={{ margin: '0 auto 20px', width: 'fit-content' }}>
              Our Platform
            </div>
            <h2 className="heading-md" style={{ color: '#0F1E3C', marginBottom: 16 }}>
              Purpose-Built Digital System
            </h2>
            <p className="body-md" style={{ color: '#64748b', maxWidth: 520, margin: '0 auto' }}>
              We built our own end-to-end platform — an admin portal, mobile app, and digital reporting engine — to manage all our operations.
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #0F1E3C 0%, #1B2D4F 100%)',
            borderRadius: 24, padding: '40px 36px',
            position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(15,30,60,0.22)',
          }}>
            <div style={{
              position: 'absolute', top: -60, right: -40, width: 280, height: 280, borderRadius: '50%',
              background: 'rgba(249,115,22,0.10)', filter: 'blur(60px)', pointerEvents: 'none',
            }} />
            <div className="about-platform-grid" style={{ position: 'relative', zIndex: 1 }}>
              {PLATFORM_FEATURES.map((feat, i) => (
                <div key={feat} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i < PLATFORM_FEATURES.length - 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <CheckCircle size={15} color="#F97316" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6 }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Three pillars */}
          <div className="about-pillars">
            {PILLARS.map(p => (
              <div key={p.num} style={{
                background: 'white', borderRadius: 18, padding: '28px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 900, color: '#F97316',
                  letterSpacing: '0.07em', marginBottom: 10,
                }}>{p.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F1E3C', marginBottom: 10, letterSpacing: '-0.02em' }}>{p.title}</h3>
                <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.75 }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Focus */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(249,115,22,0.10)',
              border: '1px solid rgba(249,115,22,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <Target size={28} color="#F97316" />
            </div>
            <div className="section-label" style={{ margin: '0 auto 20px', width: 'fit-content' }}>Our Commitment</div>
            <h2 className="heading-md" style={{ color: '#0F1E3C', marginBottom: 20 }}>Our Standard on Every Job</h2>
            <p className="body-lg" style={{ color: '#64748b', lineHeight: 1.9 }}>
              We are focused on delivering clear, accurate, and well-documented building maintenance services. Every job we carry out is recorded digitally — every asset checked, every defect logged, every report generated. That is our standard for every site we service.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
