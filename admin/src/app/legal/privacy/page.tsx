import { ShieldAlert, Database, MapPin, EyeOff, Server, Lock, Activity, Users } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--accent)] selection:text-white">
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-[var(--primary)] to-transparent opacity-20 pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
        
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-slate-400 tracking-widest uppercase mb-6">
            <Lock size={14} className="text-cyan-400" />
            Effective Date: [Insert Date]
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            Master Privacy & Data <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Agreement</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto">
            The exhaustive legal framework governing the collection, processing, cross-border transfer, and cryptographic securing of telemetry and personal data under the Australian Privacy Act 1988.
          </p>
        </header>
        
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          
          <div className="p-8 sm:p-14 space-y-16 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            
            <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
              <p className="m-0 leading-loose">
                THIS MASTER DATA PROCESSING AND PRIVACY AGREEMENT OUTLINES THE COMPREHENSIVE AND EXHAUSTIVE LEGAL FRAMEWORK BY WHICH <strong className="text-white">[INSERT COMPANY NAME] PTY LTD</strong> (&quot;SITETRACK&quot;) COLLECTS, STORES, PROCESSES, AND SECURES PERSONAL INFORMATION. THIS DOCUMENT IS DRAFTED IN STRICT ACCORDANCE WITH THE <strong className="text-white">PRIVACY ACT 1988 (CTH)</strong>, THE <strong className="text-white">AUSTRALIAN PRIVACY PRINCIPLES (APPs)</strong>, AND APPLICABLE INTERNATIONAL DATA PROTECTION FRAMEWORKS. BY UTILIZING THE SITETRACK PLATFORM, YOU EXPLICITLY AND IRREVOCABLY CONSENT TO THE PROCESSING ACTIVITIES DETAILED HEREIN.
              </p>
            </div>

            {/* Section 1 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Database size={24} className="text-cyan-400" />
                1. Exhaustive Scope & Legal Definitions
              </h2>
              <ul className="space-y-4 pl-4 border-l-2 border-[var(--border)]">
                <li><strong className="text-white">1.1. &quot;Personal Information&quot;</strong> means information or an opinion about an identified individual, or an individual who is reasonably identifiable, whether the information or opinion is true or not, and whether the information or opinion is recorded in a material form or not (as strictly defined in the Privacy Act).</li>
                <li><strong className="text-white">1.2. &quot;Sensitive Information&quot;</strong> means a subset of Personal Information that includes health information, genetic information, biometric data, criminal records, racial or ethnic origin, or religious beliefs. SiteTrack unconditionally prohibits the collection of Sensitive Information unless explicitly mandated by statutory safety compliance law.</li>
                <li><strong className="text-white">1.3. &quot;Data Controller vs. Data Processor&quot;</strong> Under this Agreement, the Customer operates as the Data Controller (determining the purpose and means of processing Customer Data), and SiteTrack operates exclusively as a Data Processor (processing data solely on the Customer&apos;s documented instructions and for the provision of the Services).</li>
                <li><strong className="text-white">1.4. &quot;Anonymised Data&quot;</strong> means data that has been stripped of all personally identifiable markers such that it can no longer be attributed to a specific individual without the use of additional, separately stored cryptographic keys.</li>
              </ul>
            </section>

            {/* Section 2 - Geolocation & Telemetry */}
            <section className="relative p-8 rounded-2xl border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.05)] overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-400" />
              <h2 className="flex items-center gap-3 text-2xl font-bold text-cyan-400 mb-6">
                <MapPin size={28} />
                2. Exhaustive Classification of Data Collected
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">2.1. Geolocation & AS 1851-2012 Verification</strong> 
                  To explicitly combat location spoofing and ensure irrefutable physical presence during statutory fire safety inspections, the SiteTrack mobile application collects high-precision GPS coordinates, continuous altimeter data (where hardware permits), and hardware-level local timestamp telemetry. The Customer acknowledges that this hyper-accurate location tracking is a non-negotiable functional requirement of the AS 1851-2012 compliance validation module.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.2. Automated Infrastructure & Security Telemetry</strong> 
                  Our ingress servers and load balancers automatically log exhaustive access telemetry, including but not limited to: originating IP addresses, full User-Agent strings, API request payloads, cryptographic session tokens, timestamp matrices, operating system versions, and unique device hardware identifiers (UUIDs). This data is deemed absolutely critical for cybersecurity auditing, anomaly detection, rate-limiting, and the proactive prevention of distributed denial-of-service (DDoS) attacks.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.3. Statutory Professional Accreditation Data</strong> 
                  We collect and irrevocably bind professional accreditation numbers (e.g., Fire Protection Association Australia FPAS certification IDs, practitioner licenses) to Authorized Users to satisfy AS 1851-2012 reporting mandates. This data forms part of the immutable audit log and cannot be deleted while the corresponding inspection records remain statutorily active.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.4. Direct Account and Billing Telemetry</strong> 
                  During onboarding, we collect the full legal name, business email address, cryptographic password hashes (bcrypt/Argon2), corporate telephone numbers, and billing information (including corporate credit card details, which are tokenized and processed securely via PCI-DSS Level 1 compliant third-party gateways). SiteTrack does not store raw PAN (Primary Account Number) data on its own database architecture.
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Activity size={24} className="text-cyan-400" />
                3. Primary and Secondary Purposes of Processing
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">3.1. Primary Purpose</strong> 
                  The absolute primary and overriding purpose of data collection is the facilitation of a high-availability, secure cloud infrastructure for field service management, defect tracking, and AS 1851-2012 statutory compliance reporting.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.2. Secondary Processing Activities</strong> 
                  Secondary processing includes (a) aggregate, anonymized statistical analysis for infrastructure load balancing and software optimization, (b) the enforcement of the SiteTrack Master Terms of Service and Acceptable Use Policy, (c) the prevention, detection, and investigation of fraudulent, abusive, or unlawful activities on the platform, and (d) communicating product updates, scheduled maintenance windows, and security advisories to Authorised Users.
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Server size={24} className="text-cyan-400" />
                4. Subprocessors, Third-Party Disclosures & Cross-Border Transfers
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">4.1. Authorized Subprocessors</strong> 
                  To deliver enterprise-grade availability and geographic redundancy, SiteTrack utilizes highly vetted, SOC 2 and ISO 27001 certified third-party infrastructure providers (including, but not limited to, Supabase, Amazon Web Services, and Vercel). SiteTrack executes strict Data Processing Addendums (DPAs) with all subprocessors to ensure they uphold security and privacy standards strictly equivalent to or greater than those outlined in this Agreement.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.2. Absolute Prohibition on Monetization</strong> 
                  SiteTrack unconditionally guarantees that it does not, and will never, sell, rent, lease, or monetize your Personal Information or Customer Data to third-party data brokers, advertising networks, or marketing agencies under any circumstances.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.3. International Data Transfers (APP 8 Compliance)</strong> 
                  By accessing the Services, you explicitly consent to the cross-border transfer of data to regions such as the United States, European Union, and Singapore, subject to strict Standard Contractual Clauses (SCCs). SiteTrack warrants that it has taken all reasonable steps to ensure that overseas recipients do not breach the Australian Privacy Principles in relation to the information, in accordance with APP 8.1.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.4. Compelled Legal Disclosure</strong> 
                  SiteTrack reserves the right to disclose Personal Information if legally compelled by a valid subpoena, court order, or formal statutory request from a government law enforcement or regulatory agency (e.g., state fire brigades investigating compliance fraud), strictly in accordance with APP 6.2.
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <ShieldAlert size={24} className="text-cyan-400" />
                5. Data Breaches, NDB Scheme & Cryptographic Purging
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">5.1. Incident Response and NDB Reporting</strong> 
                  SiteTrack maintains a comprehensive, internally audited Incident Response Plan. If SiteTrack determines that an &quot;eligible data breach&quot; has occurred that is likely to result in serious harm to any individual, SiteTrack will, without undue delay, notify the affected Customer, the affected individuals (where practicable), and the Office of the Australian Information Commissioner (OAIC), precisely fulfilling our statutory obligations under the Notifiable Data Breaches (NDB) scheme outlined in Part IIIC of the Privacy Act.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">5.2. Cryptographic Data Purging Lifecycle</strong> 
                  Customer Data is retained in an active state for the duration of the subscription. Upon formal termination of the Master Subscription Agreement and the conclusion of the 30-day data retrieval window, SiteTrack initiates a cryptographic data purge. All Personal Information and Customer Data is permanently and irretrievably destroyed from our primary databases, subject only to encrypted, air-gapped system backups which are naturally overwritten during standard 90-day backup rotation cycles.
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Users size={24} className="text-cyan-400" />
                6. Rights of Access, Correction, and Deletion
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">6.1. Access and Correction (APP 12 & 13)</strong> 
                  Individuals hold the legal right to request access to the Personal Information SiteTrack holds about them, and to request correction of that information if it is inaccurate, out-of-date, incomplete, irrelevant, or misleading.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">6.2. Formal Request Procedures</strong> 
                  All formal requests for access, correction, or data deletion (&quot;Right to be Forgotten&quot;) must be submitted in writing to our designated Privacy Officer at privacy@[insertdomain].com. SiteTrack is legally obligated to respond to all authenticated requests within thirty (30) calendar days. SiteTrack reserves the right to deny requests that are frivolous, vexatious, or where disclosure would severely compromise the privacy of other individuals, reveal commercially sensitive source code, or impede active legal investigations.
                </div>
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </div>
  );
}
