export default function Footer() {
  return (
    <footer style={{ background: '#06101f', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg, #F97316 0%, #fb923c 50%, transparent 100%)' }} />

      <div className="container" style={{ padding: '36px 24px', textAlign: 'center' }}>

        <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.03em', marginBottom: 8 }}>
          UMA Building Services
        </p>

        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.28)', marginBottom: 16 }}>
          info@umabuildingservices.com.au &nbsp;·&nbsp; Servicing commercial and industrial properties across Australia
        </p>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.02em' }}>
          AS1851:2012 Compliant &nbsp;·&nbsp; © {new Date().getFullYear()} UMA Building Services Pty Ltd. All rights reserved.
        </p>

      </div>
    </footer>
  );
}
