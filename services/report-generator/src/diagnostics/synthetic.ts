import sharp from 'sharp';
import { AssetTypeDefinition, AssetWithResult, Defect, InspectionPhoto, ReportData } from '../types';

/**
 * Synthetic report data for scale testing — N assets with real-sized inline
 * JPEG thumbnails (like photos/prepareInlinePhotos.ts produces), spread over
 * five categories, a quarter failed with defects. Used by
 * test/render.localtest.ts and by the opt-in /internal/diag endpoints
 * (ENABLE_DIAGNOSTICS=1), which render it on the real Cloud Run instance
 * without touching any Supabase data.
 */
export async function makeThumb(seed: number): Promise<string> {
  // Random noise compresses badly, like a real photo does — a flat colour
  // would make every thumbnail unrealistically tiny.
  const w = 200;
  const h = 150;
  const raw = Buffer.alloc(w * h * 3);
  let x = seed * 2654435761;
  for (let i = 0; i < raw.length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    raw[i] = (x >>> 16) & 0xff;
  }
  const jpg = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).blur(1.2).jpeg({ quality: 58 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}


export async function buildSyntheticReport(assetCount: number): Promise<{
  data: ReportData;
  byValue: Map<string, AssetTypeDefinition>;
  photoCount: number;
  defectCount: number;
}> {
  const assetTypes: AssetTypeDefinition[] = [
    { value: 'extinguisher', label: 'Extinguisher', full_label: 'Fire Extinguisher - Portable', inspection_routine: '10 - Portable and Wheeled Fire Extinguishers (Annual)' },
    { value: 'smoke_alarm', label: 'Smoke Alarm', full_label: 'Smoke Alarm (SOU)', inspection_routine: '06 - Smoke and Heat Alarms (SOU) (Annual)' },
    { value: 'hose_reel', label: 'Fire Hose Reel', full_label: 'Fire Hose Reel', inspection_routine: '09 - Fire Hose Reels (Annual)' },
    { value: 'exit_light', label: 'Exit Light', full_label: 'Emergency - Exit Signs', inspection_routine: '15 - Emergency escape lighting and exit signs (Annual)' },
    { value: 'fire_door', label: 'Fire Door', full_label: 'Fire Door Set', inspection_routine: '13 - Fire and Smoke Doors (Annual)' },
  ];
  const byValue = new Map(assetTypes.map((t) => [t.value, t]));

  // A handful of distinct thumbnails reused — same per-photo byte size as
  // real ones, without spending a minute generating 2000 unique images.
  const thumbs = await Promise.all(Array.from({ length: 12 }, (_, i) => makeThumb(i + 1)));

  const now = new Date().toISOString();
  const assets: AssetWithResult[] = [];
  const defects: Defect[] = [];
  const photosByAsset = new Map<string, InspectionPhoto[]>();
  const photosByDefect = new Map<string, InspectionPhoto[]>();
  const signedPhotoUrls = new Map<string, string>();
  const fullResPhotoUrls = new Map<string, string>();
  let photoN = 0;

  for (let i = 0; i < assetCount; i++) {
    const type = assetTypes[i % assetTypes.length].value;
    const fail = i % 4 === 0;
    const id = `a${i}`;
    assets.push({
      id, property_id: 'p1', asset_type: type, variant: 'Standard', asset_ref: String(i + 1).padStart(4, '0'),
      location_on_site: `Level ${(i % 12) + 1} - Corridor ${i % 7}`, serial_number: null, description: null,
      result: fail ? 'fail' : i % 9 === 0 ? 'not_tested' : 'pass',
      defect_reason: fail ? 'Pressure gauge reading outside operating range' : null,
      technician_notes: i % 5 === 0 ? 'Checked and tagged. Access via service corridor.' : null,
      actioned_at: now, actionedByName: 'Test Technician',
      categoryLabel: '', categoryNumber: null, categoryOfficialSection: null,
    });

    const photos: InspectionPhoto[] = [];
    const photoCount = fail ? 2 : 1; // ~1.25 photos/asset on average
    for (let p = 0; p < photoCount; p++) {
      const pid = `ph${photoN++}`;
      photos.push({ id: pid, job_id: 'j1', asset_id: id, defect_id: null, photo_url: `https://example.invalid/${pid}.jpg`, caption: null, stage: null });
      signedPhotoUrls.set(pid, thumbs[photoN % thumbs.length]);
      fullResPhotoUrls.set(pid, `https://example.invalid/full/${pid}.jpg`);
    }
    photosByAsset.set(id, photos);

    if (fail) {
      const did = `d${i}`;
      defects.push({ id: did, job_id: 'j1', asset_id: id, description: 'Pressure gauge reading outside operating range — replace.', severity: 'non_conformance', status: 'open', defect_code: null, quote_price: 45, created_at: now, updated_at: null, resolved_on_site: false });
      photosByDefect.set(did, []);
    }
  }

  const user = { id: 'u1', full_name: 'Test Technician', fpas_number: 'FP1234', fpas_class: 'Class 1', fpas_expiry: '2027-01-01', state_license: 'NSW-999', state_license_expiry: '2027-01-01' };
  const data = {
    job: {
      id: 'j1', company_id: 'c1', property_id: 'p1', assigned_to: 'u1', job_type: 'routine_service_annual',
      status: 'completed', scheduled_date: '2026-08-01', created_at: now, updated_at: now, notes: 'Synthetic render test.',
      property: { id: 'p1', name: 'Render Test Tower', address: '1 Test St', suburb: 'Testville', state: 'NSW', postcode: '2000', site_contact_name: 'Site Manager', site_contact_phone: null },
      assigned_user: user,
    },
    company: { id: 'c1', name: 'UMA Building Services', abn: '51602019081', address: null, phone: '0404226789', contact_email: 'info@uma.example', logo_url: null, accreditations: 'FPAA101D Certified' },
    assets, defects, photosByAsset, photosByDefect, signedPhotoUrls, fullResPhotoUrls,
    signature: null,
    assignedUsers: [user],
    timeLogUsers: [{ user, firstClockIn: now, lastClockOut: now, hasRealSession: true }],
    approvedQuote: null,
    reportId: 'R-TEST',
    dateOfService: '2026-08-01',
  } as unknown as ReportData;

  return { data, byValue, photoCount: photoN, defectCount: defects.length };
}
