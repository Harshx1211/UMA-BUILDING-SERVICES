import { ShieldAlert, AlertOctagon, Terminal, FileCode, Users, Database, Globe } from 'lucide-react';

export default function AcceptableUsePolicy() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--accent)] selection:text-white">
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-[var(--primary)] to-transparent opacity-20 pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
        
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-6">
            <AlertOctagon size={14} className="text-red-500" />
            Effective Date: [Insert Date]
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            Master Acceptable Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Policy</span>
          </h1>
          <p className="text-lg text-[var(--text-muted)] max-w-3xl mx-auto">
            The strict behavioral, cybersecurity, and operational standards unconditionally required to access the SiteTrack platform and APIs. Any violation constitutes a material breach resulting in immediate suspension and potential liability.
          </p>
        </header>
        
        <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-[var(--shadow-xl)] overflow-hidden">
          
          <div className="p-8 sm:p-14 space-y-16 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            
            <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
              <p className="m-0 leading-loose">
                THIS MASTER ACCEPTABLE USE POLICY (THE <strong className="text-white">&quot;AUP&quot;</strong>) EXHAUSTIVELY GOVERNS AND RESTRICTS THE MANNER IN WHICH CUSTOMERS, AFFILIATES, AND THEIR AUTHORISED USERS MAY ACCESS AND UTILIZE THE SITETRACK CLOUD PLATFORM, MOBILE APPLICATIONS, AND ASSOCIATED APPLICATION PROGRAMMING INTERFACES (APIS). STRICT COMPLIANCE WITH THIS AUP IS A BINDING, NON-NEGOTIABLE CONDITION PRECEDENT OF THE MASTER SUBSCRIPTION AGREEMENT. ANY DETECTED VIOLATION OF THIS AUP WILL RESULT IN THE IMMEDIATE, UNILATERAL SUSPENSION OR PERMANENT TERMINATION OF YOUR ACCOUNT WITHOUT NOTICE, ALONGSIDE POTENTIAL CIVIL LITIGATION AND CRIMINAL REPORTING TO STATUTORY AUTHORITIES.
              </p>
            </div>

            {/* Section 1 - Critical Zero-Tolerance Section */}
            <section className="relative p-8 rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
              <h2 className="flex items-center gap-3 text-2xl font-bold text-red-500 mb-6">
                <ShieldAlert size={28} />
                1. Strict Zero-Tolerance for Fire Safety Fraud & AS 1851 Integrity
              </h2>
              <div className="space-y-6 text-red-100">
                <p className="mb-2 font-semibold text-[15px]">SiteTrack explicitly facilitates statutory compliance documentation under AS 1851-2012. The mathematical and temporal integrity of this data is a matter of critical life-safety. Therefore, the following actions are unconditionally and irrevocably prohibited:</p>
                <div>
                  <strong className="text-white block mb-2 text-base">1.1. Data Falsification, Forgery, and Willful Blindness</strong> 
                  No user shall enter, submit, upload, or propagate fraudulent, fabricated, modified, or materially inaccurate data regarding the status, functionality, defect state, or inspection results of any fire safety asset or essential safety measure. Willful blindness or negligent &quot;batch passing&quot; of critical defects is strictly prohibited.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">1.2. Telemetry, Timestamp, and Geolocation Spoofing</strong> 
                  No user shall bypass, intercept, spoof, manipulate, or artificially alter GPS location telemetry or immutable timestamp data captured by the mobile application. The deployment or utilization of GPS spoofing applications, Virtual Private Networks (VPNs) designed specifically to mask physical inspection locations, or unauthorized Android/iOS emulators to submit field data is classified as severe compliance fraud.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">1.3. Credential Sharing, Collusion, and Ghost Sign-offs</strong> 
                  Authorised Users must uniquely and irrevocably identify individual, living humans. Credential sharing, generic accounts (e.g., &quot;admin@company&quot;), and role-sharing are explicitly banned. No technician, manager, or supervisor shall digitally sign off on fire safety tests, defect rectifications, or compliance certificates using the account, PIN, or biometric login credentials of another person.
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Terminal size={24} className="text-orange-500" />
                2. Cybersecurity, Network Integrity, and Infrastructure Abuse
              </h2>
              <div className="space-y-6">
                <p className="mb-2">You unconditionally covenant that you will not, nor will you permit any third party to, jeopardize the security boundaries of the SiteTrack infrastructure:</p>
                <div>
                  <strong className="text-white block mb-2 text-base">2.1. Reverse Engineering and Decompilation</strong> 
                  Attempt to reverse engineer, decompile, hack, disable, interfere with, disassemble, modify, copy, translate, or disrupt the features, functionality, source code, cryptographic mechanisms, or security controls of the Service.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.2. Automated Scraping, Botnets, and API Abuse</strong> 
                  Deploy automated systems, botnets, spiders, scrapers, or programmatic agents to extract mass data, monitor system uptime, execute bulk unauthorized actions, or aggressively poll the SiteTrack APIs without explicit written consent and a formal Enterprise API License.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.3. Malicious Code and Payload Injection</strong> 
                  Upload, transmit, distribute, or execute any viruses, worms, malware, trojan horses, ransomware, spyware, logic bombs, or any other destructive or malicious payloads into the defect management system, document vaults, or associated databases.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.4. Unauthorized Penetration Testing</strong> 
                  Conduct vulnerability scans, penetration tests, load testing, or stress testing (including DDoS simulations) on SiteTrack production servers, staging environments, or cloud endpoints without prior, explicit, written authorization from the SiteTrack Chief Information Security Officer (CISO).
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <FileCode size={24} className="text-orange-500" />
                3. Content Standards, Fair Use, and Prohibited Material
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">3.1. Prohibited Uploads and Media Content</strong> 
                  Any media, photos, CAD drawings, PDFs, or free-text notes uploaded to the platform must strictly relate to professional compliance, facility management, and field service operations. You must not upload content that is unlawful, defamatory, harassing, abusive, discriminatory, pornographic, or highly offensive.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.2. Intellectual Property Infringement</strong> 
                  You shall not upload, distribute, or share proprietary floor plans, engineering schematics, or compliance documentation that infringes upon the copyright, trademark, patent, or intellectual property rights of third parties, rival engineering firms, or building owners without explicit licensing rights.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.3. Sensitive Health and Financial Data Embargo</strong> 
                  The platform is architected exclusively for building and compliance data. You must unconditionally refrain from uploading unredacted Personal Health Information (PHI, HIPAA-regulated data), credit card numbers (PANs), or raw financial data into free-text fields, defect notes, or document vaults.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.4. Fair Bandwidth and Storage Utilization</strong> 
                  While SiteTrack offers comprehensive storage for your subscription tier, you agree not to use the Service as a generic file-hosting repository or off-site backup vault for non-compliance-related massive media (e.g., 4K drone footage not related to defects), resulting in abusive or grossly disproportionate bandwidth and storage utilization compared to a standard enterprise user. SiteTrack reserves the right to throttle bandwidth for abusive tenants.
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Globe size={24} className="text-orange-500" />
                4. Communication Infrastructure Abuse
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">4.1. Unsolicited Communications (Spam)</strong> 
                  You shall not weaponize the SiteTrack automated notification engine, email dispatchers, or SMS gateways to send unsolicited emails, spam, promotional material, or phishing links to third parties, building owners, or unregistered contractors.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.2. Impersonation and Phishing</strong> 
                  You shall not impersonate SiteTrack support staff, regulatory officials, or other Authorised Users in any communications facilitated by the platform.
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Users size={24} className="text-orange-500" />
                5. Exhaustive Monitoring, Auditing, and Enforcement Rights
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">5.1. Right to Monitor and Audit</strong> 
                  SiteTrack employs advanced automated heuristic and algorithmic monitoring to detect violations of this AUP (including anomalous login patterns across geographies, impossible travel speeds between GPS scan points, rapid-fire API abuses, and brute-force login attempts). You explicitly consent to this continuous security auditing.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">5.2. Right to Suspend and Terminate</strong> 
                  SiteTrack reserves the absolute, unchallengeable, and unilateral right to throttle, suspend, or permanently terminate access to any specific Authorised User, or the entire Customer Tenant Account, found to be in violation of this AUP. Such enforcement actions may be executed effective immediately and without prior notice to protect the integrity of the network.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">5.3. Right to Report to Authorities and Statutory Bodies</strong> 
                  SiteTrack is not a law enforcement agency. However, if SiteTrack uncovers irrefutable digital evidence of severe fraud involving critical life-safety systems (e.g., deliberately fabricating a pass result for a critically failed fire pump, widespread forging of AS 1851-2012 Annual Condition Reports), SiteTrack explicitly reserves the right to report such conduct, and hand over corresponding cryptographic evidence and audit logs, to relevant statutory authorities (including but not limited to State Fire Brigades, Building Surveyors, WorkSafe authorities, or Police) without notifying the offending Customer.
                </div>
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </div>
  );
}
