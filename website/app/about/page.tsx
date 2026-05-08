import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileText, Smartphone, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us | UMA Building Services',
  description: 'UMA Building Services provides professional fire safety inspections and defect repair services, managed through our own purpose-built digital platform.',
};

const PILLARS = [
  { icon: Shield,      title: 'Accountable',    description: 'Every inspection is logged individually — per asset, per visit. Nothing is approximated or estimated. The record is the record.' },
  { icon: FileText,    title: 'Transparent',    description: 'A structured PDF service report is generated at job completion. Clients receive clear documentation of exactly what was done and what was found.' },
  { icon: Smartphone,  title: 'Digital-First',  description: 'Our technicians use our own purpose-built mobile platform on every job. No paper processes. No delays in documentation.' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(145deg,#060f1e 0%,#0A1628 40%,#0F1E3C 100%)', paddingTop: 72 }}>
        <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#F97316', marginBottom: 20 }}>
            About Us
          </p>
          <h1 style={{ fontSize: 'clamp(36px,5vw,58px)', fontWeight: 900, color: 'white', letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 22, maxWidth: 600 }}>
            Professional Building Services, Built on Accountability
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.50)', lineHeight: 1.8, maxWidth: 480, marginBottom: 36 }}>
            UMA Building Services is a specialist fire safety and building compliance company operating across commercial and industrial properties in Australia.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}>
            Get in Touch <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Who we are */}
      <section className="section" style={{ background: 'white' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <p className="section-eyebrow">Who We Are</p>
              <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 24 }}>
                A Building Services Company That Operates Differently
              </h2>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8, marginBottom: 16 }}>
                UMA Building Services was founded on the belief that routine fire safety inspections and building compliance should be managed digitally — with clear records and structured reporting as the standard, not the exception.
              </p>
              <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.8 }}>
                We built our own platform from the ground up to support every part of our workflow — from job scheduling and technician dispatch through to on-site inspection logging and final PDF report generation.
              </p>
            </div>
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 16, padding: '40px 36px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 24 }}>Our Platform Manages</p>
              {[
                'Properties & site asset registers',
                'Scheduled jobs & assigned technicians',
                'Per-asset inspection results (Pass/Fail)',
                'Defect logging with severity classification',
                'Photo evidence captured on-site',
                'Client signatures at job completion',
                'Digital PDF service reports per job',
              ].map((item, i, arr) => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: i < arr.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316', flexShrink: 0, marginTop: 7 }} />
                  <span style={{ fontSize: 14.5, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="section" style={{ background: '#F9FAFB' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p className="section-eyebrow" style={{ textAlign: 'center' }}>Our Approach</p>
            <h2 className="heading-lg" style={{ color: '#0F1E3C', marginBottom: 16 }}>How We Work</h2>
            <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 460, margin: '0 auto', lineHeight: 1.75 }}>
              Three principles that define how every job is carried out.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {PILLARS.map(p => {
              const Icon = p.icon;
              return (
                <div key={p.title} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(15,30,60,0.07)', border: '1px solid rgba(15,30,60,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Icon size={20} color="#0F1E3C" strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 10, letterSpacing: '-0.015em' }}>{p.title}</h3>
                  <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.75 }}>{p.description}</p>
                </div>
              );
            })}
          </div>
        </div>
        <style>{`@media(max-width:800px){.pillars-grid{grid-template-columns:1fr!important}}`}</style>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg,#0A1628 0%,#0F1E3C 50%,#1B2D4F 100%)', padding: '96px 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)', marginBottom: 20 }}>Work With Us</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, maxWidth: 520, margin: '0 auto 20px' }}>
            Ready to Get Your Property Serviced?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 400, margin: '0 auto 40px', lineHeight: 1.75 }}>
            Send us your details and we&apos;ll be in touch within one business day.
          </p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: 15.5, padding: '14px 32px' }}>
            Get a Free Quote <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
