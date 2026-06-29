// ─── CSV Utility Library ──────────────────────────────────────────────────────
// Shared helpers for CSV export and import across the admin portal.
// All imports use a strict column format so the schema never drifts.

// ─── Export ──────────────────────────────────────────────────────────────────

export interface CsvColumn<T = Record<string, unknown>> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/** Converts an array of rows to CSV text and triggers a browser download. */
export function exportToCsv<T = Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const escape = (val: string | number | null | undefined): string => {
    const s = val === null || val === undefined ? '' : String(val);
    // Wrap in quotes if it contains comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = columns.map(c => escape(c.header)).join(',');
  const body = rows
    .map(row => columns.map(c => escape(c.accessor(row))).join(','))
    .join('\n');

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import / Parse ───────────────────────────────────────────────────────────

/** Parses a CSV string into an array of objects keyed by the header row. */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] ?? '').trim();
    });
    result.push(obj);
  }
  return result;
}

/** Splits a single CSV line respecting quoted fields. */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Column Definitions ───────────────────────────────────────────────────────

/** Canonical columns for the Properties CSV export / import. */
export const PROPERTY_CSV_COLUMNS: CsvColumn[] = [
  { header: 'name',                accessor: r => (r as any).name },
  { header: 'address',             accessor: r => (r as any).address },
  { header: 'suburb',              accessor: r => (r as any).suburb },
  { header: 'state',               accessor: r => (r as any).state },
  { header: 'postcode',            accessor: r => (r as any).postcode },
  { header: 'site_contact_name',   accessor: r => (r as any).site_contact_name },
  { header: 'site_contact_phone',  accessor: r => (r as any).site_contact_phone },
  { header: 'compliance_status',   accessor: r => (r as any).compliance_status },
  { header: 'next_inspection_date',accessor: r => (r as any).next_inspection_date },
  { header: 'access_notes',        accessor: r => (r as any).access_notes },
  { header: 'hazard_notes',        accessor: r => (r as any).hazard_notes },
  { header: 'site_note',           accessor: r => (r as any).site_note },
];

/** Canonical columns for the Assets CSV export / import.
 *  Maps to the reference CSV format: no, equipment_code, level, location, status, details, serial_number, install_date
 */
export const ASSET_CSV_COLUMNS: CsvColumn[] = [
  { header: 'no',              accessor: r => (r as any).asset_ref ?? '' },
  { header: 'equipment_code', accessor: r => (r as any).asset_type },
  { header: 'level',          accessor: r => (r as any).variant },
  { header: 'location',       accessor: r => (r as any).location_on_site },
  { header: 'status',         accessor: r => (r as any).status },
  { header: 'details',        accessor: r => (r as any).notes },
  { header: 'serial_number',  accessor: r => (r as any).serial_number },
  { header: 'install_date',   accessor: r => (r as any).install_date },
  { header: 'last_service_date', accessor: r => (r as any).last_service_date },
  { header: 'asset_ref',      accessor: r => (r as any).asset_ref },
];

/** Canonical columns for the Jobs CSV export. */
export const JOB_CSV_COLUMNS: CsvColumn[] = [
  { header: 'job_id',          accessor: r => (r as any).id },
  { header: 'property',        accessor: r => (r as any).property?.name ?? '' },
  { header: 'title',           accessor: r => (r as any).title },
  { header: 'job_type',        accessor: r => (r as any).job_type },
  { header: 'scheduled_date',  accessor: r => (r as any).scheduled_date },
  { header: 'scheduled_time',  accessor: r => (r as any).scheduled_time },
  { header: 'priority',        accessor: r => (r as any).priority },
  { header: 'status',          accessor: r => (r as any).status },
  { header: 'technician',      accessor: r => (r as any).assigned_user?.full_name ?? '' },
  { header: 'report_url',      accessor: r => (r as any).report_url },
  { header: 'notes',           accessor: r => (r as any).notes },
];

// ─── Asset Row Mapper (CSV → DB) ──────────────────────────────────────────────

/** Status normaliser: maps short codes from the reference CSV to DB values. */
function normaliseStatus(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s === 'p' || s === 'pass') return 'active';
  if (s === 'f' || s === 'fail') return 'failed';
  if (s === 'na' || s === 'n/a') return 'inactive';
  // Anything else (rtc, hdc, seq, etc.) stored as-is in notes, status = active
  return 'active';
}

/** Maps one parsed CSV row → a DB asset row ready for insert. */
export function csvRowToAsset(
  row: Record<string, string>,
  propertyId: string,
  rowIndex: number,
): Record<string, unknown> {
  const statusRaw  = row['status'] || row['2023'] || '';
  const detailsRaw = row['details'] || '';
  const extraNotes = [
    row['details'] ? `Details: ${row['details']}` : '',
    row['2022']    ? `2022: ${row['2022']}`        : '',
  ].filter(Boolean).join(' | ');

  return {
    property_id:      propertyId,
    asset_type:       row['equipment_code'] || row['eq'] || row['type'] || '',
    variant:          row['level'] || row['lvl'] || '',
    location_on_site: row['location'] || '',
    serial_number:    row['serial_number'] || null,
    install_date:     row['install_date'] || null,
    last_service_date:row['last_service_date'] || null,
    asset_ref:        row['asset_ref'] || row['no'] || String(rowIndex + 1),
    status:           normaliseStatus(statusRaw),
    notes:            extraNotes || detailsRaw || null,
  };
}

/** Maps one parsed CSV row → a DB property row ready for insert. */
export function csvRowToProperty(row: Record<string, string>): Record<string, unknown> {
  return {
    name:               row['name'] || '',
    address:            row['address'] || null,
    suburb:             row['suburb'] || null,
    state:              row['state'] || 'NSW',
    postcode:           row['postcode'] || null,
    site_contact_name:  row['site_contact_name'] || null,
    site_contact_phone: row['site_contact_phone'] || null,
    access_notes:       row['access_notes'] || null,
    hazard_notes:       row['hazard_notes'] || null,
    site_note:          row['site_note'] || null,
    compliance_status:  row['compliance_status'] || 'pending',
    next_inspection_date: row['next_inspection_date'] || null,
  };
}
