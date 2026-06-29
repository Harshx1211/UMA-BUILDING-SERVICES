'use client';
import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle2, ChevronRight, Download } from 'lucide-react';
import { parseCSV } from '@/lib/csv';
import { adminApi } from '@/lib/admin-api';
import toast from 'react-hot-toast';

export interface CsvImportModalProps {
  /** Modal title, e.g. "Import Assets" */
  title: string;
  /** Short description shown under title */
  description?: string;
  /** Which DB table to insert into */
  table: string;
  /** Maps a parsed CSV row → a DB-ready object */
  rowMapper: (row: Record<string, string>, index: number) => Record<string, unknown>;
  /** Called after successful import */
  onSuccess: (inserted: number) => void;
  /** Called to close the modal */
  onClose: () => void;
  /** URL to the fixed template file (downloaded via anchor) */
  templateUrl?: string;
  /** Human-readable label for the required CSV headers */
  requiredHeaders?: string[];
}

type Step = 'upload' | 'preview' | 'result';

export default function CsvImportModal({
  title, description, table, rowMapper, onSuccess, onClose,
  templateUrl, requiredHeaders,
}: CsvImportModalProps) {
  const [step, setStep]       = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows]       = useState<Record<string, string>[]>([]);
  const [mapped, setMapped]   = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState<{ inserted: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) { toast.error('CSV is empty or has no data rows'); return; }
      const mappedRows = parsed.map((r, i) => rowMapper(r, i));
      setFileName(file.name);
      setRows(parsed);
      setMapped(mappedRows);
      setStep('preview');
    };
    reader.readAsText(file);
  }, [rowMapper]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const doImport = async () => {
    setImporting(true);
    // Filter out rows with no meaningful data
    const validRows = mapped.filter(r => Object.values(r).some(v => v !== null && v !== '' && v !== undefined));
    const res = await adminApi.bulkInsert(table, validRows);
    setImporting(false);
    setResult({ inserted: res.inserted, errors: res.errors });
    setStep('result');
    if (res.error) { toast.error(res.error); return; }
    if (res.inserted > 0) onSuccess(res.inserted);
  };

  // Preview headers from first mapped row
  const previewHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  const previewRows = rows.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[var(--card)] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="font-extrabold text-lg" style={{ color: 'var(--text)' }}>{title}</h3>
            {description && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          {(['upload', 'preview', 'result'] as Step[]).map((s, i) => {
            const done = (step === 'preview' && i < 1) || (step === 'result' && i < 2);
            const active = step === s;
            return (
              <div key={s} className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: active ? 'var(--primary)' : done ? '#dcfce7' : 'transparent',
                    color: active ? '#fff' : done ? '#16a34a' : 'var(--text-tertiary)',
                  }}>
                  {done ? <CheckCircle2 size={12} /> : null}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
                {i < 2 && <ChevronRight size={12} style={{ color: 'var(--border)' }} />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── STEP: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Template download */}
              {templateUrl && (
                <a href={templateUrl} download
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm w-full"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--primary-light)' }}>
                  <Download size={15} />
                  Download CSV Template
                  <span className="ml-auto text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                    Always use this template for imports
                  </span>
                </a>
              )}

              {requiredHeaders && (
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Required CSV columns:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {requiredHeaders.map(h => (
                      <code key={h} className="px-2 py-0.5 rounded-md text-xs font-mono" style={{ background: '#e8f0fe', color: '#1e3a8a' }}>{h}</code>
                    ))}
                  </div>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all"
                style={{
                  borderColor: dragging ? 'var(--accent)' : 'var(--border)',
                  background: dragging ? 'var(--primary-light)' : 'var(--bg)',
                }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: dragging ? '#e8f0fe' : 'var(--border)' }}>
                  <Upload size={24} style={{ color: dragging ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                </div>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                  {dragging ? 'Drop your CSV file here' : 'Drag & drop your CSV file'}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  or <span style={{ color: 'var(--accent)' }} className="font-semibold">click to browse</span>
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>.csv files only</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
            </div>
          )}

          {/* ── STEP: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #bbf7d0' }}>
                <FileText size={16} style={{ color: '#16a34a' }} />
                <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                  {fileName} — <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''} detected
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                  Preview (first {Math.min(5, rows.length)} rows)
                </p>
                <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        {previewHeaders.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          {previewHeaders.map(h => (
                            <td key={h} className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    + {rows.length - 5} more rows not shown
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl border" style={{ background: 'rgba(245,158,11,0.15)', borderColor: '#fde68a' }}>
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} style={{ color: '#d97706', marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#92400e' }}>
                    Rows with missing required fields will be skipped. Check the preview above before confirming.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: Result ── */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                {result.inserted > 0 ? (
                  <>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                      <CheckCircle2 size={32} style={{ color: '#22c55e' }} />
                    </div>
                    <p className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{result.inserted} rows imported!</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Data has been saved to the system.</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.15)' }}>
                      <AlertCircle size={32} style={{ color: '#ef4444' }} />
                    </div>
                    <p className="text-2xl font-extrabold" style={{ color: 'var(--text)' }}>Import failed</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>No rows were saved. Check the errors below.</p>
                  </>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#fecaca', background: 'rgba(239,68,68,0.15)' }}>
                  <p className="text-xs font-bold" style={{ color: '#dc2626' }}>Errors ({result.errors.length})</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs font-mono" style={{ color: '#991b1b' }}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          {step === 'upload' && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-white/5 transition-all"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('upload')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border hover:bg-white/5 transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>← Back</button>
              <button onClick={doImport} disabled={importing} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>
                {importing
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</>
                  : <>Import {rows.length} rows</>}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#1B2D4F,#243a65)' }}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}



