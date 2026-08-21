// supabase/functions/generate-report/pdfLayout.ts
// pdfmake document definition — AS1851 inspection report layout.

// ─── Colours ──────────────────────────────────────────────────────────────────
const NAVY     = '#1C3048';
const ORANGE   = '#E97316';
const SLATE    = '#475569';
const MUTED    = '#94A3B8';
const BORDER   = '#E2E8F0';
const GREEN    = '#065F46';
const GREEN_BG = '#D1FAE5';
const RED      = '#991B1B';
const RED_BG   = '#FEE2E2';
const GREY_BG  = '#F1F5F9';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso ?? '—'; }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${m} ${ap}`;
  } catch { return '—'; }
}

function fmtCurrency(v: number | string | null | undefined): string {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function fmtJobType(raw: string | null | undefined): string {
  if (!raw) return 'Service';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function sectionBar(title: string): Record<string, unknown> {
  return {
    table: { widths: ['*'], body: [[{ text: title, color: '#fff', bold: true, fontSize: 8.5, characterSpacing: 1 }]] },
    layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 5, paddingBottom: () => 5 },
    margin: [0, 10, 0, 0],
  };
}

function infoGrid(cells: { label: string; value: string; accent?: boolean }[]): Record<string, unknown> {
  return {
    table: {
      widths: cells.map(() => '*'),
      body: [[
        ...cells.map(c => ({
          stack: [
            { text: c.label.toUpperCase(), fontSize: 7, color: MUTED, bold: true, characterSpacing: 0.5, margin: [0, 0, 0, 2] },
            { text: c.value || '—', fontSize: 9.5, color: NAVY, bold: true },
          ],
          fillColor: c.accent ? '#FFFBF7' : '#FAFBFD',
          borderColor: [BORDER, c.accent ? ORANGE : BORDER, BORDER, BORDER],
          margin: [8, 8, 8, 8],
        })),
      ]],
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
    margin: [0, 0, 0, 8],
  };
}

function pillCell(result: string | null): Record<string, unknown> {
  const map: Record<string, { text: string; color: string; fill: string }> = {
    pass:       { text: 'PASS', color: GREEN, fill: GREEN_BG },
    fail:       { text: 'FAIL', color: RED,   fill: RED_BG   },
    not_tested: { text: 'N/T', color: SLATE,  fill: GREY_BG  },
  };
  const s = map[result ?? 'not_tested'] ?? map['not_tested'];
  return {
    table: { widths: ['*'], body: [[{ text: s.text, bold: true, fontSize: 7.5, color: s.color, alignment: 'center', margin: [2, 2, 2, 2] }]] },
    layout: { fillColor: () => s.fill, hLineWidth: () => 0, vLineWidth: () => 0 },
  };
}

function defectSeverityColor(sev: string): string {
  return sev === 'critical' ? '#DC2626' : sev === 'minor' ? '#CA8A04' : '#D97706';
}

// Safe image element — returns null if url is falsy so we can filter it out
// deno-lint-ignore no-explicit-any
function safeImage(url: string | null | undefined, width: number, height: number): any | null {
  if (!url || !url.startsWith('data:')) return null;
  try { return { image: url, width, height, margin: [0, 3, 4, 0] }; }
  catch { return null; }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export async function buildPdfDefinition(data: any): Promise<any> {
  const { job, assets, defects, signature, photos, timeLogs,
          techName, tech, reportId, approvedQuote, quoteItems, company } = data;

  const prop     = job.property ?? {};
  const propName = prop.name ?? '—';
  const address  = [prop.address, prop.suburb, prop.state, prop.postcode].filter(Boolean).join(', ') || '—';
  const perfDate = fmtDate(job.date_of_service ?? job.scheduled_date);
  const refNum   = (job.id ?? reportId ?? '').replace(/-/g, '').substring(0, 6).toUpperCase();
  const compName = company?.name ?? 'Company Name';
  const compAbn  = company?.abn ?? '';

  // ── Counts ────────────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const passCount = assets.filter((a: any) => a.result === 'pass').length;
  // deno-lint-ignore no-explicit-any
  const failCount = assets.filter((a: any) => a.result === 'fail').length;
  // deno-lint-ignore no-explicit-any
  const ntCount   = assets.filter((a: any) => !a.result || a.result === 'not_tested').length;

  // ── Time on site ──────────────────────────────────────────────────────────
  let timeOnSite = '—';
  if (timeLogs?.length > 0) {
    // deno-lint-ignore no-explicit-any
    const sorted = [...timeLogs].sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
    const firstIn = fmtTime(sorted[0].clock_in);
    const lastLog = sorted[sorted.length - 1];
    const lastOut = lastLog.clock_out ? fmtTime(lastLog.clock_out) : 'Active';
    timeOnSite = `${firstIn} → ${lastOut}`;
  }

  // ── Photo lookup by asset/defect id ──────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const photosByAsset  = new Map<string, any[]>();
  // deno-lint-ignore no-explicit-any
  const photosByDefect = new Map<string, any[]>();
  // deno-lint-ignore no-explicit-any
  for (const p of (photos ?? [])) {
    // Only include photos that were successfully encoded as base64 data URIs
    if (!p.photo_url || !p.photo_url.startsWith('data:')) continue;
    if (p.asset_id)  { const arr = photosByAsset.get(p.asset_id) ?? [];   arr.push(p); photosByAsset.set(p.asset_id, arr); }
    if (p.defect_id) { const arr = photosByDefect.get(p.defect_id) ?? []; arr.push(p); photosByDefect.set(p.defect_id, arr); }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const coverContent: any[] = [
    {
      columns: [
        { stack: [
          { text: compName, fontSize: 15, bold: true, color: NAVY },
          { text: 'FACILITY MANAGEMENT & MAINTENANCE', fontSize: 6.5, color: MUTED, bold: true, characterSpacing: 1.5, margin: [0, 2, 0, 0] },
        ]},
        { stack: [
          { text: `R-${refNum}`, fontSize: 13, bold: true, color: NAVY, alignment: 'right' },
          { text: 'SERVICE REPORT', fontSize: 6.5, color: MUTED, bold: true, alignment: 'right', characterSpacing: 0.5 },
        ]},
      ],
      margin: [0, 0, 0, 10],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BORDER }], margin: [0, 0, 0, 10] },

    sectionBar('SITE / PROPERTY INFORMATION'),
    infoGrid([
      { label: 'Site / Property', value: propName },
      { label: 'Address',         value: address },
      { label: 'Site Contact',    value: job.site_contact_name ?? '—' },
      { label: 'Date of Service', value: perfDate, accent: true },
    ]),

    sectionBar('JOB DETAILS'),
    infoGrid([
      { label: 'Technician',   value: techName },
      { label: 'Job Type',     value: fmtJobType(job.job_type) },
      { label: 'Time on Site', value: timeOnSite },
      { label: 'Reference',    value: refNum },
    ]),
    ...(tech?.fpas_number ? [infoGrid([
      { label: 'FPAS Number',   value: tech.fpas_number ?? '—' },
      { label: 'FPAS Class',    value: tech.fpas_class   ?? '—' },
      { label: 'State Licence', value: tech.state_license ?? '—' },
      { label: 'Company ABN',   value: compAbn || '—' },
    ])] : []),

    sectionBar('INSPECTION SUMMARY'),
    {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          { stack: [{ text: String(passCount), fontSize: 22, bold: true, color: '#059669' }, { text: 'PASS', fontSize: 7.5, bold: true, color: MUTED }], alignment: 'center', margin: [0, 8, 0, 8] },
          { stack: [{ text: String(failCount), fontSize: 22, bold: true, color: '#DC2626' }, { text: 'FAIL / DEFECT', fontSize: 7.5, bold: true, color: MUTED }], alignment: 'center', margin: [0, 8, 0, 8] },
          { stack: [{ text: String(ntCount),   fontSize: 22, bold: true, color: SLATE     }, { text: 'NOT TESTED', fontSize: 7.5, bold: true, color: MUTED }], alignment: 'center', margin: [0, 8, 0, 8] },
        ]],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
      margin: [0, 0, 0, 8],
    },

    sectionBar('SCOPE OF WORKS'),
    ...((() => {
      const groups: Record<string, number> = {};
      // deno-lint-ignore no-explicit-any
      for (const a of assets) { groups[a.asset_type ?? 'General'] = (groups[a.asset_type ?? 'General'] ?? 0) + 1; }
      return Object.entries(groups).map(([type, cnt], i) => ({
        text: `${String(i + 1).padStart(2, '0')}  Annual Inspection – ${titleCase(type)}  (${cnt})`,
        fontSize: 9.5, color: SLATE, margin: [12, 3, 0, 0],
      }));
    })()),
  ];

  // ── Asset inspection log ──────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const assetContent: any[] = [
    { text: '', pageBreak: 'before' },
    sectionBar('ASSET INSPECTION LOG'),
  ];

  // Group by asset_type
  // deno-lint-ignore no-explicit-any
  const assetGroups: Record<string, any[]> = {};
  // deno-lint-ignore no-explicit-any
  for (const a of assets) {
    const k = a.asset_type ?? 'General Asset';
    if (!assetGroups[k]) assetGroups[k] = [];
    assetGroups[k].push(a);
  }

  for (const [type, group] of Object.entries(assetGroups)) {
    assetContent.push({
      text: titleCase(type), bold: true, fontSize: 10.5, color: NAVY, margin: [0, 10, 0, 3],
    });

    // deno-lint-ignore no-explicit-any
    const rows = group.map((a: any, idx: number) => {
      // Get up to 3 photos per asset — filter to only valid base64 data URIs
      // deno-lint-ignore no-explicit-any
      const assetPhotos = (photosByAsset.get(a.id) ?? []).slice(0, 3);
      // deno-lint-ignore no-explicit-any
      const photoImages = assetPhotos.map((p: any) => safeImage(p.photo_url, 100, 75)).filter(Boolean);

      return [
        { text: a.asset_ref ?? String(idx + 1).padStart(3, '0'), fontSize: 8.5, bold: true, color: NAVY },
        { stack: [
          { text: a.description ?? a.asset_type ?? '—', fontSize: 9, color: '#334155' },
          ...(a.location_on_site ? [{ text: a.location_on_site, fontSize: 8, color: MUTED }] : []),
          ...(a.result === 'fail' && a.defect_reason ? [{ text: `Defect: ${a.defect_reason}`, fontSize: 8, color: '#DC2626', margin: [0, 2, 0, 0] }] : []),
          ...(photoImages.length > 0 ? [{ columns: photoImages, margin: [0, 4, 0, 0] }] : []),
        ]},
        pillCell(a.result),
      ];
    });

    assetContent.push({
      table: {
        widths: [36, '*', 52],
        body: [
          [
            { text: 'REF',                fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'ASSET / DESCRIPTION', fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'RESULT',             fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'center' },
          ],
          ...rows,
        ],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER,
        paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 5, paddingBottom: () => 5 },
      margin: [0, 0, 0, 6],
    });
  }

  // ── Defect section ────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const defectContent: any[] = [];
  if (defects?.length > 0) {
    // FIX: Do NOT use { text: '', pageBreak: 'before' } — it creates a blank page.
    // sectionBar uses margin which naturally starts a new visual section.
    // Only force page break if the defect section doesn't fit naturally.
    defectContent.push(sectionBar('DEFECT REPORT'));

    // deno-lint-ignore no-explicit-any
    for (const d of defects) {
      const sevColor = defectSeverityColor(d.severity ?? 'major');
      // deno-lint-ignore no-explicit-any
      const defPhotos = (photosByDefect.get(d.id) ?? []).slice(0, 6);
      // deno-lint-ignore no-explicit-any
      const photoImages = defPhotos.map((p: any) => safeImage(p.photo_url, 140, 105)).filter(Boolean);

      // FIX: Use a 2-column table instead of columns+canvas(h:999).
      // The old h:999 canvas forced every defect to occupy ~1 full A4 page.
      // The table auto-sizes the left colour accent cell to match the content height.
      defectContent.push({
        table: {
          widths: [4, '*'],
          body: [[
            {
              // Left accent bar — auto-height, no border
              fillColor: sevColor,
              text: '',
              border: [false, false, false, false],
            },
            {
              border: [false, false, false, false],
              margin: [10, 6, 0, 6],
              stack: [
                {
                  columns: [
                    { stack: [
                      { text: (d.severity ?? 'MAJOR').toUpperCase(), bold: true, fontSize: 8.5, color: sevColor },
                      { text: `Defect #${(d.id ?? '').substring(0, 6).toUpperCase()}`, fontSize: 7.5, color: MUTED },
                    ]},
                    { text: fmtDate(d.created_at), fontSize: 7.5, color: MUTED, alignment: 'right' },
                  ],
                  margin: [0, 0, 0, 4],
                },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 490, y2: 0, lineWidth: 0.5, lineColor: BORDER }] },
                {
                  text: [
                    { text: 'Description: ', bold: true, color: NAVY, fontSize: 9 },
                    { text: d.description ?? '—', color: SLATE, fontSize: 9 },
                  ],
                  margin: [0, 5, 0, 3],
                },
                ...(d.quote_price != null ? [{
                  text: [
                    { text: 'Quote: ', bold: true, color: NAVY, fontSize: 9 },
                    { text: fmtCurrency(d.quote_price), color: '#059669', bold: true, fontSize: 9 },
                  ],
                  margin: [0, 0, 0, 4],
                }] : []),
                // Photos in rows of 3
                ...(photoImages.length > 0 ? [{ columns: photoImages, margin: [0, 4, 0, 4] }] : []),
              ],
            },
          ]],
        },
        // Use noBorders layout since we handle borders per-cell above
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [0, 6, 0, 6],
      });
    }
  }

  // ── Quote section ─────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const quoteContent: any[] = [];
  if (approvedQuote && quoteItems?.length > 0) {
    quoteContent.push(sectionBar('APPROVED QUOTE'));
    quoteContent.push({
      table: {
        widths: ['*', 50, 70, 70],
        body: [
          [
            { text: 'ITEM',  fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'QTY',   fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'center' },
            { text: 'UNIT',  fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'right' },
            { text: 'TOTAL', fontSize: 7.5, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'right' },
          ],
          // deno-lint-ignore no-explicit-any
          ...quoteItems.map((item: any) => [
            { text: item.item_name ?? item.inventory_item?.name ?? '—', fontSize: 9.5, color: SLATE },
            { text: String(item.quantity), fontSize: 9.5, alignment: 'center' },
            { text: fmtCurrency(item.unit_price), fontSize: 9.5, alignment: 'right' },
            { text: fmtCurrency(item.quantity * item.unit_price), fontSize: 9.5, bold: true, alignment: 'right' },
          ]),
          [
            { text: 'Total (ex. GST)', colSpan: 3, bold: true, fontSize: 10.5, alignment: 'right', fillColor: '#F7F9FC', border: [false, true, false, false] },
            {}, {},
            { text: fmtCurrency(approvedQuote.total_amount), bold: true, fontSize: 12, color: '#059669', alignment: 'right', fillColor: '#F7F9FC', border: [false, true, false, false] },
          ],
        ],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER,
        paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 5, paddingBottom: () => 5 },
      margin: [0, 6, 0, 10],
    });
  }

  // ── Signature block ───────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  const sigContent: any[] = [];
  if (signature) {
    const isSigUrl = (v: unknown) => typeof v === 'string' && (v.startsWith('http') || v.startsWith('data:'));
    const clientSigUrl = isSigUrl(signature.signature_url)     ? (signature.signature_url as string)     : null;
    const techSigUrl   = isSigUrl(signature.tech_signature_url) ? (signature.tech_signature_url as string) : null;

    // deno-lint-ignore no-explicit-any
    const sigImage = (url: string | null, fallback: string): any =>
      url ? { image: url, maxWidth: 200, maxHeight: 60 }
          : { text: fallback, fontSize: 18, color: NAVY, italics: true };

    sigContent.push(sectionBar('SIGNATURES'));
    sigContent.push({
      table: {
        widths: ['*', '*'],
        body: [[
          { stack: [
            { text: 'CLIENT SIGN-OFF', fontSize: 7.5, bold: true, color: MUTED, margin: [0, 0, 0, 5] },
            sigImage(clientSigUrl, signature.signed_by_name ?? 'Signed'),
            { text: `Name: ${signature.signed_by_name ?? '—'}`, fontSize: 8.5, color: SLATE, margin: [0, 5, 0, 0] },
            { text: `Date: ${fmtDate(signature.signed_at)}`, fontSize: 8.5, color: MUTED },
          ], margin: [10, 10, 10, 10] },
          { stack: [
            { text: 'TECHNICIAN SIGN-OFF', fontSize: 7.5, bold: true, color: MUTED, margin: [0, 0, 0, 5] },
            sigImage(techSigUrl, techName),
            { text: `Name: ${techName}`, fontSize: 8.5, color: SLATE, margin: [0, 5, 0, 0] },
            { text: `Date: ${fmtDate(signature.signed_at)}`, fontSize: 8.5, color: MUTED },
          ], margin: [10, 10, 10, 10] },
        ]],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
      margin: [0, 6, 0, 0],
    });
  }

  // ── Document definition ───────────────────────────────────────────────────
  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 56],

    footer: (currentPage: number, pageCount: number) => ({
      table: {
        widths: ['*', 'auto', '*'],
        body: [[
          { text: `${compName}  |  ABN: ${compAbn || 'N/A'}`, fontSize: 7, color: '#fff', bold: true, margin: [12, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: ORANGE, bold: true, alignment: 'center' },
          { text: company?.phone ? `P: ${company.phone}  |  E: ${company.contact_email ?? ''}` : '', fontSize: 7, color: '#aaa', alignment: 'right', margin: [0, 0, 12, 0] },
        ]],
      },
      layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0,
        paddingTop: () => 10, paddingBottom: () => 10 },
      margin: [0, 6, 0, 0],
    }),

    content: [
      ...coverContent,
      ...assetContent,
      ...defectContent,
      ...quoteContent,
      ...sigContent,
    ],

    styles: {
      header: { fontSize: 15, bold: true, color: NAVY },
    },

    defaultStyle: {
      font: 'Roboto',
      fontSize: 9.5,
      color: '#1E293B',
      lineHeight: 1.35,
    },
  };
}
