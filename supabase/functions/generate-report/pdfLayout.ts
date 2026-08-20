// supabase/functions/generate-report/pdfLayout.ts
// pdfmake document definition — AS1851 inspection report layout.
// Mirrors the structure of lib/reportTemplate.ts but uses pdfmake's
// document definition format instead of HTML/CSS.

// ─── Colours ──────────────────────────────────────────────────────────────────
const NAVY   = '#1C3048';
const ORANGE = '#E97316';
const SLATE  = '#475569';
const MUTED  = '#94A3B8';
const BORDER = '#E2E8F0';
const GREEN  = '#065F46';
const GREEN_BG = '#D1FAE5';
const RED    = '#991B1B';
const RED_BG = '#FEE2E2';
const GREY_BG = '#F1F5F9';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso ?? '—'; }
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

function sectionBar(title: string): Record<string, unknown> {
  return {
    table: { widths: ['*'], body: [[{ text: title, color: '#fff', bold: true, fontSize: 9, characterSpacing: 1 }]] },
    layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0,
      paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 6, paddingBottom: () => 6 },
    margin: [0, 14, 0, 0],
  };
}

function infoGrid(cells: { label: string; value: string; accent?: boolean }[]): Record<string, unknown> {
  return {
    table: {
      widths: cells.map(() => '*'),
      body: [[
        ...cells.map(c => ({
          stack: [
            { text: c.label.toUpperCase(), fontSize: 7.5, color: MUTED, bold: true, characterSpacing: 0.5, margin: [0, 0, 0, 3] },
            { text: c.value || '—', fontSize: 10, color: NAVY, bold: true },
          ],
          fillColor: c.accent ? '#FFFBF7' : '#FAFBFD',
          borderColor: [BORDER, c.accent ? ORANGE : BORDER, BORDER, BORDER],
          margin: [10, 10, 10, 10],
        })),
      ]],
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
    margin: [0, 0, 0, 12],
  };
}

function pillCell(result: string | null): Record<string, unknown> {
  const map: Record<string, { text: string; color: string; fill: string }> = {
    pass:       { text: 'PASS', color: GREEN, fill: GREEN_BG },
    fail:       { text: 'FAIL', color: RED,   fill: RED_BG   },
    not_tested: { text: 'N/T', color: SLATE,  fill: GREY_BG  },
  };
  const s = map[result ?? 'not_tested'] ?? map['not_tested'];
  // fillColor only works inside a table cell — wrap in a 1-cell table for the pill look
  return {
    table: { widths: ['*'], body: [[{ text: s.text, bold: true, fontSize: 8, color: s.color, alignment: 'center', margin: [4, 3, 4, 3] }]] },
    layout: { fillColor: () => s.fill, hLineWidth: () => 0, vLineWidth: () => 0 },
  };
}

function defectSeverityColor(sev: string): string {
  return sev === 'critical' ? '#DC2626' : sev === 'minor' ? '#CA8A04' : '#D97706';
}

// ─── Main builder ─────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export async function buildPdfDefinition(data: any): Promise<any> {
  const { job, assets, defects, signature, photos, timeLogs,
          techName, tech, reportId, approvedQuote, quoteItems, company } = data;

  const prop       = job.property ?? {};
  const propName   = prop.name ?? '—';
  const address    = [prop.address, prop.suburb, prop.state, prop.postcode].filter(Boolean).join(', ') || '—';
  // FIX: Use date_of_service (set from completed_at/scheduled_date by the Edge Function).
  // DO NOT use updated_at — it is bumped by the handle_updated_at trigger every time
  // report_url changes, causing the "Date of Service" to drift to today on regeneration.
  const perfDate   = fmtDate(job.date_of_service ?? job.scheduled_date);
  const refNum     = (job.id ?? reportId ?? '').replace(/-/g, '').substring(0, 6).toUpperCase();
  const compName   = company?.name ?? 'Company Name';
  const compAbn    = company?.abn ?? '';

  const passCount = assets.filter((a: any) => a.result === 'pass').length;
  const failCount = assets.filter((a: any) => a.result === 'fail').length;
  const ntCount   = assets.filter((a: any) => a.result === 'not_tested' || !a.result).length;

  // ── Time on site ──────────────────────────────────────────────────────────
  let timeOnSite = '—';
  if (timeLogs?.length > 0) {
    const sorted = [...timeLogs].sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
    const firstIn = fmtTime(sorted[0].clock_in);
    const lastLog = sorted[sorted.length - 1];
    const lastOut = lastLog.clock_out ? fmtTime(lastLog.clock_out) : 'Active';
    timeOnSite = `${firstIn} → ${lastOut}`;
  }

  // ── Photo lookup by id ────────────────────────────────────────────────────
  const photosByAsset = new Map<string, any[]>();
  const photosByDefect = new Map<string, any[]>();
  for (const p of (photos ?? [])) {
    if (!p.photo_url) continue;
    if (p.asset_id)  { const arr = photosByAsset.get(p.asset_id) ?? []; arr.push(p); photosByAsset.set(p.asset_id, arr); }
    if (p.defect_id) { const arr = photosByDefect.get(p.defect_id) ?? []; arr.push(p); photosByDefect.set(p.defect_id, arr); }
  }

  // ── Cover page ────────────────────────────────────────────────────────────
  const coverContent: any[] = [
    // Header
    {
      columns: [
        { stack: [
          { text: compName, fontSize: 16, bold: true, color: NAVY },
          { text: 'FACILITY MANAGEMENT & MAINTENANCE', fontSize: 7, color: MUTED, bold: true, characterSpacing: 1.5, margin: [0, 2, 0, 0] },
        ]},
        { stack: [
          { text: `R-${refNum}`, fontSize: 14, bold: true, color: NAVY, alignment: 'right' },
          { text: 'SERVICE REPORT', fontSize: 7, color: MUTED, bold: true, alignment: 'right', characterSpacing: 0.5 },
        ]},
      ],
      margin: [0, 0, 0, 14],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BORDER }], margin: [0, 0, 0, 14] },

    // Property info grid
    sectionBar('SITE / PROPERTY INFORMATION'),
    infoGrid([
      { label: 'Site / Property', value: propName },
      { label: 'Address',         value: address },
      { label: 'Site Contact',    value: job.site_contact_name ?? '—' },
      { label: 'Date of Service', value: perfDate, accent: true },
    ]),

    // Technician + job info
    sectionBar('JOB DETAILS'),
    infoGrid([
      { label: 'Technician',   value: techName },
      { label: 'Job Type',     value: fmtJobType(job.job_type) },
      { label: 'Time on Site', value: timeOnSite },
      { label: 'Reference',    value: refNum },
    ]),
    ...(tech?.fpas_number ? [infoGrid([
      { label: 'FPAS Number', value: tech.fpas_number ?? '—' },
      { label: 'FPAS Class',  value: tech.fpas_class  ?? '—' },
      { label: 'State Licence', value: tech.state_license ?? '—' },
      { label: 'Company ABN', value: compAbn || '—' },
    ])] : []),

    // Compliance summary
    sectionBar('INSPECTION SUMMARY'),
    {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          { stack: [{ text: String(passCount), fontSize: 22, bold: true, color: '#059669' }, { text: 'PASS', fontSize: 8, bold: true, color: MUTED }], alignment: 'center', margin: [0, 10, 0, 10] },
          { stack: [{ text: String(failCount), fontSize: 22, bold: true, color: '#DC2626' }, { text: 'FAIL / DEFECT', fontSize: 8, bold: true, color: MUTED }], alignment: 'center', margin: [0, 10, 0, 10] },
          { stack: [{ text: String(ntCount),   fontSize: 22, bold: true, color: SLATE     }, { text: 'NOT TESTED', fontSize: 8, bold: true, color: MUTED }], alignment: 'center', margin: [0, 10, 0, 10] },
        ]],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
      margin: [0, 0, 0, 12],
    },

    // Scope of works
    sectionBar('SCOPE OF WORKS'),
    ...((() => {
      const groups: Record<string, number> = {};
      for (const a of assets) { groups[a.asset_type ?? 'General'] = (groups[a.asset_type ?? 'General'] ?? 0) + 1; }
      return Object.entries(groups).map(([type, cnt], i) => ({
        text: `${String(i + 1).padStart(2, '0')}  Annual Inspection – ${type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}  (${cnt})`,
        fontSize: 10, color: SLATE, margin: [12, 4, 0, 0],
      }));
    })()),
  ];

  // ── Asset maintenance log ─────────────────────────────────────────────────
  const assetContent: any[] = [sectionBar('ASSET INSPECTION LOG')];

  // Group by asset_type
  const assetGroups: Record<string, any[]> = {};
  for (const a of assets) {
    const k = a.asset_type ?? 'General Asset';
    if (!assetGroups[k]) assetGroups[k] = [];
    assetGroups[k].push(a);
  }

  for (const [type, group] of Object.entries(assetGroups)) {
    assetContent.push({ text: type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), bold: true, fontSize: 11, color: NAVY, margin: [0, 12, 0, 4] });

    const rows = group.map((a, idx) => {
      const assetPhotos = (photosByAsset.get(a.id) ?? []).filter((p: any) => p.photo_url).slice(0, 4);
      const photoRow: any[] = assetPhotos.map((p: any) => ({
        image: p.photo_url, width: 110, height: 82, margin: [0, 4, 4, 0],
      }));

      return [
        { text: a.asset_ref ?? String(idx + 1).padStart(3, '0'), fontSize: 9, bold: true, color: NAVY },
        { stack: [
          { text: a.description ?? a.asset_type ?? '—', fontSize: 10, color: '#334155' },
          ...(a.location_on_site ? [{ text: a.location_on_site, fontSize: 9, color: MUTED }] : []),
          ...(a.result === 'fail' && a.defect_reason ? [{ text: `Defect: ${a.defect_reason}`, fontSize: 9, color: '#DC2626', margin: [0, 2, 0, 0] }] : []),
          ...(photoRow.length > 0 ? [{ columns: photoRow, margin: [0, 4, 0, 0] }] : []),
        ]},
        pillCell(a.result),
      ];
    });

    assetContent.push({
      table: {
        widths: [36, '*', 60],
        body: [
          [
            { text: 'REF', fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'ASSET / DESCRIPTION', fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'RESULT', fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'center' },
          ],
          ...rows,
        ],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER,
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
      margin: [0, 0, 0, 8],
    });
  }

  // ── Defects section ───────────────────────────────────────────────────────
  const defectContent: any[] = [];
  if (defects?.length > 0) {
    defectContent.push({ text: '', pageBreak: 'before' });
    defectContent.push(sectionBar('DEFECT REPORT'));

    for (const d of defects) {
      const sevColor = defectSeverityColor(d.severity ?? 'major');
      const defPhotos = (photosByDefect.get(d.id) ?? []).filter((p: any) => p.photo_url).slice(0, 6);

      // Build photo rows — max 3 per row
      const photoChunks: any[][] = [];
      for (let i = 0; i < defPhotos.length; i += 3) {
        photoChunks.push(defPhotos.slice(i, i + 3).map((p: any) => ({
          image: p.photo_url, width: 150, height: 112, margin: [0, 4, 6, 4],
        })));
      }

      defectContent.push({
        columns: [
          { width: 4, canvas: [{ type: 'rect', x: 0, y: 0, w: 4, h: 999, color: sevColor }] },
          { width: '*', margin: [8, 0, 0, 0], stack: [
            { columns: [
              { stack: [
                { text: (d.severity ?? 'MAJOR').toUpperCase(), bold: true, fontSize: 9, color: sevColor },
                { text: `Defect #${d.id.substring(0, 6).toUpperCase()}`, fontSize: 8, color: MUTED },
              ]},
              { text: fmtDate(d.created_at), fontSize: 8, color: MUTED, alignment: 'right' },
            ], margin: [0, 6, 0, 4] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: BORDER }] },
            { text: [{ text: 'Description: ', bold: true, color: NAVY, fontSize: 10 }, { text: d.description ?? '—', color: SLATE, fontSize: 10 }], margin: [0, 6, 0, 4] },
            ...(d.quote_price != null ? [{ text: [{ text: 'Quote: ', bold: true, color: NAVY, fontSize: 10 }, { text: fmtCurrency(d.quote_price), color: '#059669', bold: true, fontSize: 10 }], margin: [0, 0, 0, 6] }] : []),
            ...photoChunks.map(chunk => ({ columns: chunk, margin: [0, 4, 0, 6] })),
          ]},
        ],
        margin: [0, 6, 0, 6],
      });
    }
  }

  // ── Quote section ─────────────────────────────────────────────────────────
  const quoteContent: any[] = [];
  if (approvedQuote && quoteItems?.length > 0) {
    quoteContent.push({ text: '', pageBreak: 'before' });
    quoteContent.push(sectionBar('APPROVED QUOTE'));
    quoteContent.push({
      table: {
        widths: ['*', 50, 70, 70],
        body: [
          [
            { text: 'ITEM', fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG },
            { text: 'QTY',  fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'center' },
            { text: 'UNIT',  fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'right' },
            { text: 'TOTAL', fontSize: 8, bold: true, color: MUTED, fillColor: GREY_BG, alignment: 'right' },
          ],
          ...quoteItems.map((item: any) => [
            { text: item.item_name ?? item.inventory_item?.name ?? '—', fontSize: 10, color: SLATE },
            { text: String(item.quantity), fontSize: 10, alignment: 'center' },
            { text: fmtCurrency(item.unit_price), fontSize: 10, alignment: 'right' },
            { text: fmtCurrency(item.quantity * item.unit_price), fontSize: 10, bold: true, alignment: 'right' },
          ]),
          [
            { text: 'Total (ex. GST)', colSpan: 3, bold: true, fontSize: 11, alignment: 'right', fillColor: '#F7F9FC', border: [false, true, false, false] },
            {}, {},
            { text: fmtCurrency(approvedQuote.total_amount), bold: true, fontSize: 13, color: '#059669', alignment: 'right', fillColor: '#F7F9FC', border: [false, true, false, false] },
          ],
        ],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER,
        paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
      margin: [0, 8, 0, 12],
    });
  }

  // ── Signature block ───────────────────────────────────────────────────────
  const sigContent: any[] = [];
  if (signature) {
    // signature_url from Supabase is an https:// URL — check for both https and data: URIs
    const isSigUrl = (v: unknown) => typeof v === 'string' && (v.startsWith('http') || v.startsWith('data:'));
    const clientSigUrl  = isSigUrl(signature.signature_url)     ? (signature.signature_url as string)     : null;
    const techSigUrl    = isSigUrl(signature.tech_signature_url) ? (signature.tech_signature_url as string) : null;

    const sigImage = (url: string | null, fallback: string) =>
      url ? { image: url, maxWidth: 220, maxHeight: 70 }
          : { text: fallback, fontSize: 22, color: NAVY, italics: true };

    sigContent.push(sectionBar('SIGNATURES'));
    sigContent.push({
      table: {
        widths: ['*', '*'],
        body: [[
          { stack: [
            { text: 'CLIENT SIGN-OFF', fontSize: 8, bold: true, color: MUTED, margin: [0, 0, 0, 6] },
            sigImage(clientSigUrl, signature.signed_by_name ?? 'Signed'),
            { text: `Name: ${signature.signed_by_name ?? '—'}`, fontSize: 9, color: SLATE, margin: [0, 6, 0, 0] },
            { text: `Date: ${fmtDate(signature.signed_at)}`, fontSize: 9, color: MUTED },
          ], margin: [12, 12, 12, 12] },
          { stack: [
            { text: 'TECHNICIAN SIGN-OFF', fontSize: 8, bold: true, color: MUTED, margin: [0, 0, 0, 6] },
            sigImage(techSigUrl, techName),
            { text: `Name: ${techName}`, fontSize: 9, color: SLATE, margin: [0, 6, 0, 0] },
            { text: `Date: ${fmtDate(signature.signed_at)}`, fontSize: 9, color: MUTED },
          ], margin: [12, 12, 12, 12] },
        ]],
      },
      layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => BORDER, vLineColor: () => BORDER },
      margin: [0, 8, 0, 0],
    });
  }

  // ── Document definition ───────────────────────────────────────────────────
  return {
    pageSize: 'A4',
    pageMargins: [36, 36, 36, 60],

    footer: (currentPage: number, pageCount: number) => ({
      table: {
        widths: ['*', 'auto', '*'],
        body: [[
          { text: `${compName}  |  ABN: ${compAbn || 'N/A'}`, fontSize: 7.5, color: '#fff', bold: true, margin: [14, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8.5, color: ORANGE, bold: true, alignment: 'center' },
          { text: company?.phone ? `P: ${company.phone}  |  E: ${company.contact_email ?? ''}` : '', fontSize: 7.5, color: '#aaa', alignment: 'right', margin: [0, 0, 14, 0] },
        ]],
      },
      layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0,
        paddingTop: () => 12, paddingBottom: () => 12 },
      margin: [0, 8, 0, 0],
    }),

    content: [
      ...coverContent,
      { text: '', pageBreak: 'before' },
      ...assetContent,
      ...defectContent,
      ...quoteContent,
      ...sigContent,
    ],

    styles: {
      header: { fontSize: 16, bold: true, color: NAVY },
    },

    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#1E293B',
      lineHeight: 1.4,
    },
  };
}
