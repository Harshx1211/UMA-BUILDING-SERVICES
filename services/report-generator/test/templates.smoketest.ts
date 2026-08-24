// Renders every template against realistic fake data and checks the output is
// structurally well-formed HTML. Run with `npm run smoketest`.
//
// This exists specifically because a real bug shipped past manual review once
// already: every category switch in the asset log opened a new <table> without
// closing the previous one, producing invalid nested markup that browsers
// silently "fixed" by reordering rows — which is exactly what made the first
// preview look scrambled. A tag-balance check (not just "does this contain
// 'undefined'") is what would have caught it, so that's what this asserts.
import { renderCover } from '../src/templates/cover';
import { renderAssetLogChunk } from '../src/templates/assetLogChunk';
import { renderTableOfContents } from '../src/templates/tableOfContents';
import { renderUnlinkedDefects } from '../src/templates/unlinkedDefects';
import { renderRepairs } from '../src/templates/repairs';
import { renderYearlyConditionReport } from '../src/templates/yearlyConditionReport';
import { renderSignoff } from '../src/templates/signoff';
import { buildAssetLogChunksByCategory } from '../src/data/chunking';
import { parseCategory } from '../src/data/categoryGrouping';
import { computeSequentialRanges } from '../src/data/tableOfContents';
import { AssetTypeDefinition, AssetWithResult, Defect, InspectionPhoto, ReportData } from '../src/types';

// AS1851's real Section list stops at 14 — "15 - Emergency escape lighting" is an
// industry convention (matches the reference report), not a real Section, so it
// must come back with officialSection: null rather than a fabricated "15".
const numbered = parseCategory('04 - Fire Hydrant Systems (Annual)');
if (numbered.officialSection !== 4) {
  throw new Error(`FAIL: parseCategory — expected officialSection 4 for a real Section, got ${numbered.officialSection}`);
}
const unofficial = parseCategory('15 - Emergency escape lighting and exit signs (Annual)');
if (unofficial.officialSection !== null || unofficial.number !== 15) {
  throw new Error(`FAIL: parseCategory — expected number 15 but officialSection null, got number=${unofficial.number} officialSection=${unofficial.officialSection}`);
}
console.log('OK: parseCategory officialSection lookup (real Section verified, fake "15" correctly rejected)');

function assertBalanced(html: string, name: string, tag: string) {
  const open = (html.match(new RegExp(`<${tag}(\\s|>)`, 'g')) ?? []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
  if (open !== close) {
    throw new Error(`FAIL: ${name} — unbalanced <${tag}> tags (open=${open} close=${close})`);
  }
}

// Three categories so a single chunk has to switch category twice — this is
// the exact shape that exposed the unclosed-<table> bug.
const assetTypes: AssetTypeDefinition[] = [
  { value: 'extinguisher', label: 'Extinguisher', full_label: 'Fire Extinguisher - Portable', inspection_routine: '10 - Portable and Wheeled Fire Extinguishers (Annual)' },
  { value: 'smoke_alarm', label: 'Smoke Alarm', full_label: 'Smoke Alarm (SOU)', inspection_routine: '06 - Smoke and Heat Alarms (SOU) (Annual)' },
  { value: 'hose_reel', label: 'Fire Hose Reel', full_label: 'Fire Hose Reel', inspection_routine: '09 - Fire Hose Reels (Annual)' },
  { value: 'exit_light', label: 'Exit Light', full_label: 'Emergency - Exit Signs', inspection_routine: '15 - Emergency escape lighting and exit signs (Annual)' },
];
const byValue = new Map(assetTypes.map((t) => [t.value, t]));

const assets: AssetWithResult[] = [
  { id: 'a1', property_id: 'p1', asset_type: 'extinguisher', variant: 'DCP 4.5KG', asset_ref: '001', location_on_site: 'Level 1 Lobby', serial_number: null, result: 'fail', defect_reason: 'Past service life', technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null, categoryOfficialSection: null },
  { id: 'a2', property_id: 'p1', asset_type: 'smoke_alarm', variant: null, asset_ref: 'A101', location_on_site: 'Unit A101', serial_number: null, result: 'pass', defect_reason: null, technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null, categoryOfficialSection: null },
  { id: 'a3', property_id: 'p1', asset_type: 'hose_reel', variant: '36m - 25mm', asset_ref: '015', location_on_site: 'AG lobby', serial_number: null, result: 'not_tested', defect_reason: null, technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null, categoryOfficialSection: null },
  { id: 'a4', property_id: 'p1', asset_type: 'exit_light', variant: 'Box (Wall Mount)', asset_ref: 'E5', location_on_site: 'Level 5', serial_number: null, result: 'fail', defect_reason: 'Not illuminating', technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null, categoryOfficialSection: null },
];

const defects: Defect[] = [
  { id: 'd1', job_id: 'j1', asset_id: 'a1', description: 'Asset has reached or past the last year of its service life.', severity: 'non_conformance', status: 'open', defect_code: 'sl', quote_price: 45, created_at: new Date().toISOString(), updated_at: null },
  { id: 'd2', job_id: 'j1', asset_id: null, description: 'Unlinked general observation', severity: 'non_critical', status: 'repaired', defect_code: null, quote_price: null, created_at: new Date().toISOString(), updated_at: null },
  { id: 'd3', job_id: 'j1', asset_id: 'a4', description: 'Lamp not illuminating', severity: 'critical', status: 'open', defect_code: null, quote_price: null, created_at: new Date().toISOString(), updated_at: null },
];

const photosByAsset = new Map<string, InspectionPhoto[]>([
  ['a1', [{ id: 'ph1', job_id: 'j1', asset_id: 'a1', defect_id: null, photo_url: 'https://example.com/x.jpg', caption: null }]],
]);
const photosByDefect = new Map<string, InspectionPhoto[]>();
const signedPhotoUrls = new Map<string, string>([['ph1', 'https://signed.example.com/x.jpg?token=abc']]); // ph2 (if any) intentionally unsigned -> exercises the placeholder path

const data: ReportData = {
  job: {
    id: 'j1', company_id: 'c1', property_id: 'p1', assigned_to: 'u1', job_type: 'routine_service_annual',
    status: 'completed', scheduled_date: '2026-08-01', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    notes: null,
    property: { id: 'p1', name: '1-9 Buckingham Rd', address: '1-9 Buckingham Rd', suburb: 'Killara', state: 'NSW', postcode: '2071', site_contact_name: 'Raquel', site_contact_phone: null },
    assigned_user: { id: 'u1', full_name: 'Anup Patel', fpas_number: 'FP1234', fpas_class: 'Class 1', fpas_expiry: '2027-01-01', state_license: 'NSW-999', state_license_expiry: '2027-01-01' },
  },
  company: { id: 'c1', name: 'UMA Building Services', abn: '51602019081', address: null, phone: '0404226789', contact_email: 'info@uma.example', logo_url: null, accreditations: 'FPAA101D Certified' },
  assets,
  defects,
  photosByAsset,
  photosByDefect,
  signedPhotoUrls,
  signature: { id: 's1', job_id: 'j1', signature_url: 'https://signed.example.com/sig.png', tech_signature_url: 'https://signed.example.com/techsig.png', signed_by_name: 'Raquel', signed_at: new Date().toISOString() },
  timeLogUsers: [
    { user: { id: 'u1', full_name: 'Anup Patel', fpas_number: 'FP1234', fpas_class: 'Class 1', fpas_expiry: '2027-01-01', state_license: 'NSW-999', state_license_expiry: '2027-01-01' }, firstClockIn: new Date().toISOString(), lastClockOut: new Date().toISOString(), hasRealSession: true },
    { user: { id: 'u2', full_name: 'Rutvi Patel', fpas_number: null, fpas_class: null, fpas_expiry: null, state_license: null, state_license_expiry: null }, firstClockIn: new Date().toISOString(), lastClockOut: null, hasRealSession: true },
    { user: { id: 'u3', full_name: 'No-Session Tech', fpas_number: null, fpas_class: null, fpas_expiry: null, state_license: null, state_license_expiry: null }, firstClockIn: new Date().toISOString(), lastClockOut: null, hasRealSession: false },
  ],
  approvedQuote: { id: 'q1', job_id: 'j1', status: 'approved', total_amount: 45, items: [{ id: 'qi1', defect_id: 'd2', quantity: 1, unit_price: 45, item_name: 'New extinguisher', inventory_item: null }] },
  reportId: 'R-00001',
  dateOfService: '2026-08-01',
};

const defectsByAsset = new Map<string, Defect[]>([['a1', [defects[0]]], ['a4', [defects[2]]]]);
const categoryLogs = buildAssetLogChunksByCategory(assets, byValue, 200);

// Four assets in four different categories (Sections 6, 9, 10, plus the fake
// "15") should produce four separate category groups, each with exactly one
// chunk (well under maxPerChunk=200) — same-type assets never scattered
// across groups, which is the whole point of clubbing by category.
if (categoryLogs.length !== 4) {
  throw new Error(`FAIL: buildAssetLogChunksByCategory — expected 4 category groups, got ${categoryLogs.length}`);
}
if (categoryLogs.some((c) => c.chunks.length !== 1)) {
  throw new Error('FAIL: buildAssetLogChunksByCategory — expected exactly one chunk per category at this scale');
}
console.log('OK: buildAssetLogChunksByCategory groups four distinct categories, one chunk each');

// buildAssetLogChunksByCategory re-derives officialSection per group (not from
// the asset's own categoryOfficialSection field) — verify that path too:
// extinguisher (real Section 10) should carry it through, exit_light ("15")
// should not.
const allRows = categoryLogs.flatMap((c) => c.chunks.flatMap((chunk) => chunk.rows));
const extRow = allRows.find((r) => r.asset.id === 'a1');
const exitRow = allRows.find((r) => r.asset.id === 'a4');
if (extRow?.officialSection !== 10) {
  throw new Error(`FAIL: buildAssetLogChunksByCategory — expected officialSection 10 for extinguisher row, got ${extRow?.officialSection}`);
}
if (exitRow?.officialSection !== null) {
  throw new Error(`FAIL: buildAssetLogChunksByCategory — expected officialSection null for "15" exit-light row, got ${exitRow?.officialSection}`);
}
console.log('OK: buildAssetLogChunksByCategory officialSection threaded correctly per row');

// computeSequentialRanges is pure arithmetic (no rendering involved) — verify
// it turns measured page counts into correct, non-overlapping page ranges.
const ranges = computeSequentialRanges(
  [{ label: 'A', pageCount: 2 }, { label: 'B', pageCount: 1 }, { label: 'C', pageCount: 3 }],
  5,
);
const expected = [
  { label: 'A', startPage: 5, endPage: 6 },
  { label: 'B', startPage: 7, endPage: 7 },
  { label: 'C', startPage: 8, endPage: 10 },
];
if (JSON.stringify(ranges) !== JSON.stringify(expected)) {
  throw new Error(`FAIL: computeSequentialRanges — expected ${JSON.stringify(expected)}, got ${JSON.stringify(ranges)}`);
}
console.log('OK: computeSequentialRanges produces correct, non-overlapping page ranges');

const tocHtml = renderTableOfContents(ranges, [{ label: 'Sign-off', page: 11 }]);
if (!tocHtml.includes('Pages 5–6') || !tocHtml.includes('Page 7') || !tocHtml.includes('Pages 8–10')) {
  throw new Error('FAIL: renderTableOfContents — expected page-range labels not found in output');
}
console.log('OK: renderTableOfContents renders correct page-range labels');

const docs = [
  ['cover', renderCover(data, byValue)],
  ['tableOfContents', tocHtml],
  ...categoryLogs.flatMap((cat, ci) =>
    cat.chunks.map((chunk, bi) => [`category${ci}_chunk${bi}`, renderAssetLogChunk(chunk, defectsByAsset, photosByAsset, photosByDefect, signedPhotoUrls)] as const),
  ),
  ['unlinked', renderUnlinkedDefects(defects, photosByDefect, signedPhotoUrls) ?? '(null — no unlinked defects, unexpected here)'],
  ['repairs', renderRepairs(defects, data.approvedQuote, photosByDefect, signedPhotoUrls) ?? '(null — no repairs, unexpected here)'],
  ['yearlyConditionReport', renderYearlyConditionReport(data, byValue)],
  ['signoff', renderSignoff(data)],
] as const;

// Phase 4: defect cards in the asset log should show "AS 1851-2012 Section 10"
// on the extinguisher's card (real Section) and never fabricate a Section
// reference on the exit-light's card ("15" isn't real).
const chunkHtml = docs.filter(([name]) => name.includes('_chunk')).map(([, html]) => html).join('');
if (!chunkHtml.includes('AS 1851-2012 Section 10')) {
  throw new Error('FAIL: assetLogChunk — expected extinguisher defect card to show "AS 1851-2012 Section 10"');
}
if (chunkHtml.includes('AS 1851-2012 Section 15')) {
  throw new Error('FAIL: assetLogChunk — fabricated "AS 1851-2012 Section 15" appeared on a defect card');
}
console.log('OK: assetLogChunk defect cards show verified Section refs only');

// The fixture's assets cover Sections 6, 9, 10 (real) plus "15" (the fake
// emergency-lighting convention) — the checklist lists all 13 real Sections
// (2-14) but should only tick exactly those three, and must never fabricate
// a "Section 15" checkbox anywhere in the page.
const ycrHtml = docs.find(([name]) => name === 'yearlyConditionReport')![1];
const checkedCount = (ycrHtml.match(/&#10003;/g) ?? []).length;
if (checkedCount !== 3) {
  throw new Error(`FAIL: yearlyConditionReport — expected exactly 3 ticked Sections (6, 9, 10), found ${checkedCount}`);
}
if (/Section 15\b/.test(ycrHtml)) {
  throw new Error('FAIL: yearlyConditionReport — fabricated "Section 15" appeared in output');
}
console.log('OK: yearlyConditionReport checklist ticks real Sections only, no fabricated "Section 15"');

// Phase 5: Signoff shows the company's accreditations line when set.
const signoffHtml = docs.find(([name]) => name === 'signoff')![1];
if (!signoffHtml.includes('FPAA101D Certified')) {
  throw new Error('FAIL: signoff — expected company.accreditations to render when set');
}
console.log('OK: signoff renders Company Accreditations line');

for (const [name, html] of docs) {
  assertBalanced(html, name, 'html');
  assertBalanced(html, name, 'table');
  assertBalanced(html, name, 'tbody');
  assertBalanced(html, name, 'tr');
  assertBalanced(html, name, 'div');
  if (html.includes('undefined') || html.includes('[object Object]')) {
    throw new Error(`FAIL: ${name} — contains 'undefined' or '[object Object]', likely a bad interpolation`);
  }
  console.log(`OK: ${name} rendered (${html.length} chars, well-formed)`);
}

console.log('\nAll template smoke tests passed.');
