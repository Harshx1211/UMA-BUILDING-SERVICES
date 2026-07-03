import { ShieldAlert, BookOpen, Clock, FileText, CheckCircle2, AlertTriangle, Scale, Lock, Globe } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-[var(--accent)] selection:text-white">
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-[var(--primary)] to-transparent opacity-20 pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
        
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-xs font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-6">
            <Clock size={14} className="text-[var(--accent)]" />
            Effective Date: [Insert Date]
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            Master Subscription <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--text)] to-[var(--text-muted)]">Agreement</span>
          </h1>
          <p className="text-lg text-[var(--text-muted)] max-w-3xl mx-auto">
            The definitive and exhaustive legal framework governing the commercial, operational, and liability obligations associated with the use of the SiteTrack Enterprise Platform.
          </p>
        </header>
        
        <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-[var(--shadow-xl)] overflow-hidden">
          
          <div className="p-8 sm:p-14 space-y-16 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            
            <div className="p-6 rounded-2xl bg-[var(--bg)] border border-[var(--border)]">
              <p className="m-0 leading-loose">
                THIS MASTER SUBSCRIPTION AGREEMENT (THE <strong className="text-white">&quot;AGREEMENT&quot;</strong>) CONSTITUTES A BINDING AND EXHAUSTIVE CONTRACT BETWEEN <strong className="text-white">[INSERT COMPANY NAME] PTY LTD</strong>, ABN <strong className="text-white">[INSERT ABN]</strong>, AN AUSTRALIAN PROPRIETARY COMPANY LIMITED BY SHARES (HEREINAFTER REFERRED TO AS <strong className="text-white">&quot;SITETRACK&quot;</strong>, <strong className="text-white">&quot;WE&quot;</strong>, <strong className="text-white">&quot;US&quot;</strong>, OR <strong className="text-white">&quot;OUR&quot;</strong>) AND THE BUSINESS ENTITY, SOLE TRADER, OR PERSON EXECUTING THIS AGREEMENT (HEREINAFTER REFERRED TO AS THE <strong className="text-white">&quot;CUSTOMER&quot;</strong>, <strong className="text-white">&quot;YOU&quot;</strong>, OR <strong className="text-white">&quot;YOUR&quot;</strong>). BY ACCEPTING THIS AGREEMENT, EITHER BY CLICKING A BOX INDICATING YOUR ACCEPTANCE, EXECUTING AN ORDER FORM THAT REFERENCES THIS AGREEMENT, OR CONTINUING TO ACCESS OR USE THE SERVICES FOLLOWING ANY NOTIFIED MODIFICATION, YOU UNCONDITIONALLY AGREE TO BE BOUND BY ITS TERMS. IF YOU DO NOT HAVE THE REQUISITE LEGAL AUTHORITY TO BIND YOUR ORGANIZATION, OR IF YOU DO NOT AGREE TO THE ENTIRETY OF THESE TERMS, YOU MUST NOT ACCEPT THIS AGREEMENT AND MAY NOT USE THE SERVICES.
              </p>
            </div>

            {/* Section 1 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <BookOpen size={24} className="text-[var(--accent)]" />
                1. Exhaustive Interpretation and Definitions
              </h2>
              <p className="mb-4">In this Agreement, the following definitions apply strictly and exclusively unless the context mandatorily requires otherwise:</p>
              <ul className="space-y-4 pl-4 border-l-2 border-[var(--border)]">
                <li><strong className="text-white">1.1. &quot;Affiliate&quot;</strong> means any entity that directly or indirectly controls, is controlled by, or is under common control with the subject entity. &quot;Control,&quot; for purposes of this definition, means direct or indirect ownership or control of more than 50% of the voting interests of the subject entity.</li>
                <li><strong className="text-white">1.2. &quot;Authorised User&quot;</strong> means an individual human being who is explicitly authorized by the Customer to use a Service, to whom the Customer (or SiteTrack at the Customer&apos;s request) has supplied a unique, non-transferable user identification and password. Authorised Users may include, for example, the Customer&apos;s employees, consultants, contractors, and agents, but explicitly excludes competitors of SiteTrack.</li>
                <li><strong className="text-white">1.3. &quot;Beta Services&quot;</strong> means SiteTrack services or functionality that may be made available to the Customer to try at its option at no additional charge which is clearly designated as beta, pilot, limited release, developer preview, non-production, evaluation, or by a similar description.</li>
                <li><strong className="text-white">1.4. &quot;Content&quot;</strong> means information obtained by SiteTrack from publicly available sources or third-party content providers and made available to the Customer through the Services, Beta Services or pursuant to an Order Form.</li>
                <li><strong className="text-white">1.5. &quot;Customer Data&quot;</strong> means electronic data and information, including text, photographs, and telemetry, submitted by or for the Customer to the Services, excluding Content and Non-SiteTrack Applications.</li>
                <li><strong className="text-white">1.6. &quot;Malicious Code&quot;</strong> means code, files, scripts, agents, or programs intended to do harm, including, for example, viruses, worms, time bombs, Trojan horses, ransomware, and spyware.</li>
                <li><strong className="text-white">1.7. &quot;Non-SiteTrack Application&quot;</strong> means a Web-based, mobile, offline or other software application functionality that interoperates with a Service, that is provided by the Customer or a third party (e.g., Xero, MYOB).</li>
                <li><strong className="text-white">1.8. &quot;Order Form&quot;</strong> means an ordering document or online order specifying the Services to be provided hereunder that is entered into between the Customer and SiteTrack, including any addenda and supplements thereto.</li>
                <li><strong className="text-white">1.9. &quot;Services&quot;</strong> means the products, APIs, and services that are ordered by the Customer under an Order Form and made available online by SiteTrack, including associated offline or mobile components.</li>
                <li><strong className="text-white">1.10. &quot;Statutory Telemetry&quot;</strong> means any data pertaining to the compliance, inspection, maintenance, or defect status of physical fire safety systems governed by AS 1851-2012 or corresponding state regulations.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <CheckCircle2 size={24} className="text-[var(--accent)]" />
                2. Grant of License, Service Provision & Operational Restrictions
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">2.1. Provision of Services</strong> 
                  SiteTrack will (a) make the Services and Content available to the Customer pursuant to this Agreement and the applicable Order Forms, (b) provide applicable SiteTrack standard support for the Services to the Customer at no additional charge, and/or upgraded support if purchased, (c) use commercially reasonable efforts to make the online Services available 24 hours a day, 7 days a week, except for: (i) planned downtime (of which SiteTrack shall give advance electronic notice), and (ii) any unavailability caused by circumstances beyond SiteTrack’s reasonable control.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.2. Subscriptions & Usage Limits</strong> 
                  Services and Content are purchased as subscriptions. Subscriptions may be added during a subscription term at the same pricing as the underlying subscription pricing, prorated for the portion of that subscription term remaining. Services are subject to usage limits, including limits on the number of Authorised Users, API requests per minute, and aggregate storage volume. If the Customer exceeds a contractual usage limit, SiteTrack reserves the unilateral right to automatically execute an Order Form for additional quantities and invoice the Customer for excess usage.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">2.3. Exhaustive Usage Restrictions</strong> 
                  The Customer shall not, and shall not permit any Authorised User or third party to:
                  <ul className="list-[circle] pl-8 mt-2 space-y-1">
                    <li>Make any Service or Content available to anyone other than the Customer or its Affiliates.</li>
                    <li>Sell, resell, license, sublicense, distribute, make available, rent or lease any Service or Content.</li>
                    <li>Use a Service or Non-SiteTrack Application to store or transmit infringing, libelous, or otherwise unlawful or tortious material, or material in violation of third-party privacy rights.</li>
                    <li>Use a Service to store or transmit Malicious Code.</li>
                    <li>Interfere with or disrupt the integrity or performance of any Service or third-party data contained therein.</li>
                    <li>Attempt to gain unauthorized access to any Service or Content or its related systems or networks.</li>
                    <li>Permit direct or indirect access to or use of any Services in a way that circumvents a contractual usage limit.</li>
                    <li>Copy a Service or any part, feature, function or user interface thereof.</li>
                    <li>Frame or mirror any part of any Service or Content, other than framing on the Customer&apos;s own intranets or otherwise for its own internal business purposes.</li>
                    <li>Access any Service or Content in order to build a competitive product or service or to benchmark with a Non-SiteTrack product or service.</li>
                    <li>Reverse engineer any Service (to the extent such restriction is permitted by law).</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 - Critical Warning */}
            <section className="relative p-8 rounded-2xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
              <h2 className="flex items-center gap-3 text-2xl font-bold text-red-500 mb-6">
                <ShieldAlert size={28} />
                3. Statutory Compliance, Fire Safety, and Total Assumption of Liability
              </h2>
              <div className="space-y-6 text-red-100">
                <p className="font-semibold text-[15px]">THE FOLLOWING CLAUSES CONSTITUTE A FUNDAMENTAL CONDITION PRECEDENT TO THE PROVISION OF SERVICES. READ CAREFULLY.</p>
                <div>
                  <strong className="text-white block mb-2 text-base">3.1. Absolute Non-Regulatory Status</strong> 
                  The Customer expressly, irrevocably, and unconditionally acknowledges that SiteTrack is exclusively a digital software provider and data conduit. SiteTrack is <strong className="text-white">NOT</strong> an engineering firm, fire safety certifier, regulatory compliance body, or building surveyor. SiteTrack does not, and cannot, verify the physical accuracy, reality, technical validity, or legal sufficiency of any inspection data, defect reports, or compliance telemetry entered into the platform by the Customer&apos;s personnel.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.2. Customer&apos;s Sole Statutory Responsibility</strong> 
                  The Customer assumes 100% total, exclusive, and unmitigated statutory liability for the physical inspection, functional testing, maintenance, defect rectification, and ongoing legal compliance of all fire protection systems, essential safety measures (ESMs), and physical assets managed via the platform. This must be conducted strictly in accordance with Australian Standard AS 1851-2012, the Building Code of Australia (BCA), and any superseding or corresponding state-based legislation (including but not limited to the Environmental Planning and Assessment Regulation 2000 (NSW) and the Building Regulations 2018 (VIC)).
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">3.3. Complete Nullification of Software Reliance for Life Safety</strong> 
                  The Customer accepts that all software systems, including SiteTrack, are subject to inherent technological limitations, bugs, latency, and catastrophic network outages. The Customer formally covenants that it shall <strong className="text-white">never</strong> rely solely on the Services for critical life-safety alerting, automated dispatching of emergency repairs, or statutory deadlines. The Customer warrants that it maintains robust, independent, failsafe physical and manual operational procedures to ensure building compliance, occupant safety, and defect rectification in the event of any software failure, data corruption, or synchronization error within the SiteTrack platform.
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <FileText size={24} className="text-[var(--accent)]" />
                4. Fees, Invoicing, Taxes and Financial Terms
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">4.1. Invoicing and Payment</strong> 
                  Fees will be invoiced in advance and otherwise in accordance with the relevant Order Form. Unless otherwise stated in the Order Form, fees are due net 14 days from the invoice date. The Customer is responsible for providing complete and accurate billing and contact information to SiteTrack and notifying SiteTrack of any changes to such information.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.2. Overdue Charges and Late Penalties</strong> 
                  If any invoiced amount is not received by SiteTrack by the due date, then without limiting SiteTrack&apos;s rights or remedies, (a) those charges may accrue late interest at the rate of 1.5% of the outstanding balance per month, or the maximum rate permitted by law, whichever is lower, and/or (b) SiteTrack may condition future subscription renewals and Order Forms on payment terms shorter than those specified in Section 4.1.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.3. Suspension of Service and Acceleration</strong> 
                  If any amount owing by the Customer under this or any other agreement for SiteTrack&apos;s services is 14 or more days overdue, SiteTrack may, without limiting its other rights and remedies, accelerate the Customer&apos;s unpaid fee obligations under such agreements so that all such obligations become immediately due and payable, and suspend SiteTrack&apos;s services to the Customer until such amounts are paid in full. SiteTrack will give the Customer at least 7 days&apos; prior notice that its account is overdue before suspending services.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">4.4. Taxes and GST</strong> 
                  SiteTrack&apos;s fees do not include any taxes, levies, duties or similar governmental assessments of any nature, including, for example, value-added, sales, use or withholding taxes, assessable by any jurisdiction whatsoever (collectively, &quot;Taxes&quot;). The Customer is responsible for paying all Taxes associated with its purchases hereunder. If SiteTrack has the legal obligation to pay or collect Taxes for which the Customer is responsible, SiteTrack will invoice the Customer and the Customer will pay that amount unless the Customer provides SiteTrack with a valid tax exemption certificate. Specifically regarding Australian Goods and Services Tax (GST), all prices quoted are exclusive of GST unless explicitly stated otherwise.
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Lock size={24} className="text-[var(--accent)]" />
                5. Confidentiality and Security
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">5.1. Definition of Confidential Information</strong> 
                  &quot;Confidential Information&quot; means all information disclosed by a party (&quot;Disclosing Party&quot;) to the other party (&quot;Receiving Party&quot;), whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. SiteTrack&apos;s Confidential Information includes the Services and Content; Customer Confidential Information includes Customer Data.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">5.2. Protection of Confidential Information</strong> 
                  As between the parties, each party retains all ownership rights in and to its Confidential Information. The Receiving Party will use the same degree of care that it uses to protect the confidentiality of its own confidential information of like kind (but not less than reasonable care) to (i) not use any Confidential Information of the Disclosing Party for any purpose outside the scope of this Agreement and (ii) except as otherwise authorized by the Disclosing Party in writing, limit access to Confidential Information of the Disclosing Party to those of its and its Affiliates&apos; employees and contractors who need that access for purposes consistent with this Agreement.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">5.3. Compelled Disclosure</strong> 
                  The Receiving Party may disclose Confidential Information of the Disclosing Party to the extent compelled by law to do so, provided the Receiving Party gives the Disclosing Party prior notice of the compelled disclosure (to the extent legally permitted) and reasonable assistance, at the Disclosing Party&apos;s cost, if the Disclosing Party wishes to contest the disclosure.
                </div>
              </div>
            </section>

            {/* Section 6 - Mutual Indemnification */}
            <section className="relative p-8 rounded-2xl border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.05)] overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--accent)]" />
              <h2 className="flex items-center gap-3 text-2xl font-bold text-[var(--accent)] mb-6">
                <ShieldAlert size={28} />
                6. Mutual Indemnification
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">6.1. Indemnification by SiteTrack</strong> 
                  SiteTrack will defend the Customer against any claim, demand, suit or proceeding made or brought against the Customer by a third party alleging that any Service infringes or misappropriates such third party&apos;s intellectual property rights, and will indemnify the Customer from any damages, attorney fees and costs finally awarded against the Customer as a result of, or for amounts paid by the Customer under a settlement approved by SiteTrack in writing.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">6.2. Exhaustive Indemnification by Customer</strong> 
                  The Customer will unconditionally defend, indemnify, and hold SiteTrack, its Affiliates, directors, officers, employees, and agents harmless against any claim, demand, suit, or proceeding made or brought against SiteTrack by a third party (including but not limited to building owners, strata managers, state fire brigades, regulatory bodies, or insurance companies) alleging that (a) any Customer Data or Customer&apos;s use of Customer Data with the Services, (b) a Non-SiteTrack Application provided by the Customer, or (c) the combination of a Non-SiteTrack Application and the Services, infringes or misappropriates such third party&apos;s intellectual property rights, or arising from the Customer&apos;s use of the Services in an unlawful manner or in violation of the Agreement, the Acceptable Use Policy, or arising from property damage, personal injury, death, or regulatory fines resulting from faulty physical works, lapsed maintenance schedules, or data falsification committed by the Customer&apos;s personnel. The Customer shall indemnify SiteTrack for any damages, legal fees (on a full indemnity basis), regulatory fines, and costs incurred by SiteTrack in connection with any such claim.
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <AlertTriangle size={24} className="text-yellow-500" />
                7. Limitation of Liability
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">7.1. Limitation of Liability</strong> 
                  IN NO EVENT SHALL THE AGGREGATE LIABILITY OF EACH PARTY TOGETHER WITH ALL OF ITS AFFILIATES ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED THE TOTAL AMOUNT PAID BY THE CUSTOMER AND ITS AFFILIATES HEREUNDER FOR THE SERVICES GIVING RISE TO THE LIABILITY IN THE TWELVE (12) MONTHS PRECEDING THE FIRST INCIDENT OUT OF WHICH THE LIABILITY AROSE. THE FOREGOING LIMITATION WILL APPLY WHETHER AN ACTION IS IN CONTRACT OR TORT AND REGARDLESS OF THE THEORY OF LIABILITY, BUT WILL NOT LIMIT THE CUSTOMER&apos;S AND ITS AFFILIATES&apos; PAYMENT OBLIGATIONS UNDER THE &quot;FEES AND PAYMENT&quot; SECTION ABOVE.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">7.2. Exclusion of Consequential and Related Damages</strong> 
                  IN NO EVENT WILL EITHER PARTY OR ITS AFFILIATES HAVE ANY LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT FOR ANY LOST PROFITS, REVENUES, GOODWILL, OR INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, COVER, BUSINESS INTERRUPTION OR PUNITIVE DAMAGES, WHETHER AN ACTION IS IN CONTRACT OR TORT AND REGARDLESS OF THE THEORY OF LIABILITY, EVEN IF A PARTY OR ITS AFFILIATES HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES OR IF A PARTY&apos;S OR ITS AFFILIATES&apos; REMEDY OTHERWISE FAILS OF ITS ESSENTIAL PURPOSE.
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Globe size={24} className="text-[var(--accent)]" />
                8. Term, Termination, and Offboarding
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">8.1. Term of Agreement</strong> 
                  This Agreement commences on the date the Customer first accepts it and continues until all subscriptions hereunder have expired or have been terminated.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">8.2. Termination</strong> 
                  A party may terminate this Agreement for cause (i) upon 30 days written notice to the other party of a material breach if such breach remains uncured at the expiration of such period, or (ii) if the other party becomes the subject of a petition in bankruptcy or any other proceeding relating to insolvency, receivership, liquidation or assignment for the benefit of creditors.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">8.3. Data Retrieval and Destruction</strong> 
                  Upon request by the Customer made within 30 days after the effective date of termination or expiration of this Agreement, SiteTrack will make Customer Data available to the Customer for export or download. After such 30-day period, SiteTrack will have no obligation to maintain or provide any Customer Data, and as provided in the Privacy Policy will thereafter delete or destroy all copies of Customer Data in its systems or otherwise in its possession or control, unless legally prohibited.
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6 pb-4 border-b border-[var(--border)]">
                <Scale size={24} className="text-[var(--accent)]" />
                9. Dispute Resolution & General Provisions
              </h2>
              <div className="space-y-6">
                <div>
                  <strong className="text-white block mb-2 text-base">9.1. Governing Law and Arbitration</strong> 
                  This Agreement, and any disputes arising out of or related hereto, shall be governed exclusively by the internal laws of the State of New South Wales, Australia, without regard to its conflicts of laws rules. Any dispute, controversy or claim arising out of, relating to or in connection with this contract, including any question regarding its existence, validity or termination, shall be resolved by arbitration in accordance with the ACICA Arbitration Rules. The seat of arbitration shall be Sydney, Australia.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">9.2. Class Action Waiver</strong> 
                  THE PARTIES AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">9.3. Force Majeure</strong> 
                  Neither party shall be liable to the other for any delay or failure to perform any obligation under this Agreement (except for a failure to pay fees) if the delay or failure is due to unforeseen events which occur after the signing of this Agreement and which are beyond the reasonable control of such party, such as a strike, blockade, war, act of terrorism, riot, natural disaster, failure or diminishment of power or telecommunications or data networks or services, or refusal of a license by a government agency.
                </div>
                <div>
                  <strong className="text-white block mb-2 text-base">9.4. Severability</strong> 
                  If any provision of this Agreement is held by a court of competent jurisdiction to be contrary to law, the provision will be deemed null and void, and the remaining provisions of this Agreement will remain in effect.
                </div>
              </div>
            </section>
            
          </div>
          
          <div className="bg-[rgba(0,0,0,0.2)] p-8 border-t border-[var(--border)] text-center">
            <p className="text-sm font-bold text-[var(--text-secondary)] italic max-w-4xl mx-auto">
              Nothing in this Agreement excludes, restricts, or modifies any consumer guarantee, right, or remedy under the Australian Consumer Law (ACL) contained in Schedule 2 of the Competition and Consumer Act 2010 (Cth) that cannot lawfully be excluded, restricted, or modified.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
