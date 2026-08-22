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
import { renderUnlinkedDefects } from '../src/templates/unlinkedDefects';
import { renderRepairs } from '../src/templates/repairs';
import { renderSignoff } from '../src/templates/signoff';
import { buildAssetLogChunks } from '../src/data/chunking';
import { AssetTypeDefinition, AssetWithResult, Defect, InspectionPhoto, ReportData } from '../src/types';

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
];
const byValue = new Map(assetTypes.map((t) => [t.value, t]));

const assets: AssetWithResult[] = [
  { id: 'a1', property_id: 'p1', asset_type: 'extinguisher', variant: 'DCP 4.5KG', asset_ref: '001', location_on_site: 'Level 1 Lobby', serial_number: null, result: 'fail', defect_reason: 'Past service life', technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null },
  { id: 'a2', property_id: 'p1', asset_type: 'smoke_alarm', variant: null, asset_ref: 'A101', location_on_site: 'Unit A101', serial_number: null, result: 'pass', defect_reason: null, technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null },
  { id: 'a3', property_id: 'p1', asset_type: 'hose_reel', variant: '36m - 25mm', asset_ref: '015', location_on_site: 'AG lobby', serial_number: null, result: 'not_tested', defect_reason: null, technician_notes: null, actioned_at: new Date().toISOString(), categoryLabel: '', categoryNumber: null },
];

const defects: Defect[] = [
  { id: 'd1', job_id: 'j1', asset_id: 'a1', description: 'Asset has reached or past the last year of its service life.', severity: 'minor', status: 'open', defect_code: 'sl', quote_price: 45, created_at: new Date().toISOString(), updated_at: null },
  { id: 'd2', job_id: 'j1', asset_id: null, description: 'Unlinked general observation', severity: 'major', status: 'repaired', defect_code: null, quote_price: null, created_at: new Date().toISOString(), updated_at: null },
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
  company: { id: 'c1', name: 'UMA Building Services', abn: '51602019081', address: null, phone: '0404226789', contact_email: 'info@uma.example', logo_url: null },
  assets,
  defects,
  photosByAsset,
  photosByDefect,
  signedPhotoUrls,
  signature: { id: 's1', job_id: 'j1', signature_url: 'https://signed.example.com/sig.png', tech_signature_url: 'https://signed.example.com/techsig.png', signed_by_name: 'Raquel', signed_at: new Date().toISOString() },
  timeLogUsers: [
    { user: { id: 'u1', full_name: 'Anup Patel', fpas_number: 'FP1234', fpas_class: 'Class 1', fpas_expiry: '2027-01-01', state_license: 'NSW-999', state_license_expiry: '2027-01-01' }, firstClockIn: new Date().toISOString(), lastClockOut: new Date().toISOString() },
    { user: { id: 'u2', full_name: 'Rutvi Patel', fpas_number: null, fpas_class: null, fpas_expiry: null, state_license: null, state_license_expiry: null }, firstClockIn: new Date().toISOString(), lastClockOut: null },
  ],
  approvedQuote: { id: 'q1', job_id: 'j1', status: 'approved', total_amount: 45, items: [{ id: 'qi1', defect_id: 'd2', quantity: 1, unit_price: 45, item_name: 'New extinguisher', inventory_item: null }] },
  reportId: 'R-00001',
  dateOfService: '2026-08-01',
};

const defectsByAsset = new Map<string, Defect[]>([['a1', [defects[0]]]]);
const chunks = buildAssetLogChunks(assets, byValue, 200);

const docs = [
  ['cover', renderCover(data, byValue)],
  ...chunks.map((c, i) => [`chunk${i}`, renderAssetLogChunk(c, defectsByAsset, photosByAsset, photosByDefect, signedPhotoUrls)] as const),
  ['unlinked', renderUnlinkedDefects(defects, photosByDefect, signedPhotoUrls) ?? '(null — no unlinked defects, unexpected here)'],
  ['repairs', renderRepairs(defects, data.approvedQuote, photosByDefect, signedPhotoUrls) ?? '(null — no repairs, unexpected here)'],
  ['signoff', renderSignoff(data)],
] as const;

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
