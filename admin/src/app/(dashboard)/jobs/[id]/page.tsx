/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi, adminReadBatch } from '@/lib/admin-api';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils';
import { getJobTypeLabel } from '@/constants/jobTypes';
import Badge from '@/components/ui/Badge';
import { ArrowLeft, XCircle, Edit3, FileText, Download, Clock, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = ['overview','assets','defects','photos','signature','report'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [defects, setDefects] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [signature, setSignature] = useState<any>(null);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [jobAssets, setJobAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function load() {
      const results = await adminReadBatch([
        { table: 'jobs', options: { select: '*, property:properties(*), assigned_user:users(*)', filters: { id } } },
        { table: 'defects', options: { select: '*, asset:assets(asset_type,variant)', filters: { job_id: id } } },
        { table: 'inspection_photos', options: { filters: { job_id: id } } },
        { table: 'signatures', options: { filters: { job_id: id } } },
        { table: 'time_logs', options: { filters: { job_id: id } } },
        { table: 'job_assets', options: { select: '*, asset:assets(asset_type,variant,location_on_site,asset_ref)', filters: { job_id: id } } },
      ]);
      const [
        { data: jData },
        { data: dData },
        { data: phData },
        { data: sigData },
        { data: tlData },
        { data: jaData }
      ] = results;
      const j = jData?.[0] ?? null;
      setJob(j); setNotes(String(j?.notes ?? ''));
      setDefects(dData??[]); setPhotos(phData??[]);
      setSignature(sigData?.[0] ?? null); setTimeLogs(tlData??[]); setJobAssets(jaData??[]);
      setLoading(false);
    }
    load();
  }, [id]);

  const saveNotes = async () => {
    const { error } = await adminApi.update('jobs', { notes }, id);
    if (error) toast.error(error);
    else { toast.success('Notes saved'); setEditNotes(false); setJob((j: any) => ({ ...j, notes })); }
  };

  const updateStatus = async (status: string) => {
    const { error } = await adminApi.update('jobs', { status }, id);
    if (error) { toast.error(error); return; }
    toast.success(`Status → ${status}`);
    setJob((j: any) => ({ ...j, status }));
  };

  // ── Report download ──────────────────────────────────────────────────────────
  function renderReportButton() {
    if (job?.status !== 'completed') {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)', background: 'var(--bg)' }}>
          <Clock size={14} /> Report available after completion
        </div>
      );
    }
    if (job?.report_url) {
      return (
        <a
          href={job.report_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent))', boxShadow: '0 4px 14px rgba(232,101,10,0.35)' }}
        >
          <Download size={14} /> Download PDF Report
        </a>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)', background: 'var(--bg)' }}>
        <Clock size={14} /> No report uploaded yet
      </div>
    );
  }

  if (loading) return (
    <div className="animate-fade-in max-w-5xl space-y-4">
      <div className="h-5 w-24 rounded-lg animate-pulse" style={{ background: 'var(--card)' }} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-xl animate-pulse" style={{ background: 'var(--card)' }} />
          <div className="h-4 w-48 rounded-lg animate-pulse" style={{ background: 'var(--card)', animationDelay: '60ms' }} />
        </div>
        <div className="flex gap-2">
          {[1,2].map(i => <div key={i} className="h-8 w-20 rounded-lg animate-pulse" style={{ background: 'var(--card)', animationDelay: `${i*60}ms` }} />)}
        </div>
      </div>
      <div className="flex gap-2">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 w-24 rounded-xl animate-pulse" style={{ background: 'var(--card)', animationDelay: `${i*40}ms` }} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl h-48 animate-pulse" style={{ background: 'var(--card)' }} />
        <div className="rounded-2xl h-48 animate-pulse" style={{ background: 'var(--card)', animationDelay: '80ms' }} />
      </div>
    </div>
  );
  if (!job) return <p className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>Job not found.</p>;

  return (
    <div className="animate-fade-in max-w-5xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-4 hover:opacity-70" style={{ color:'var(--text-secondary)' }}>
        <ArrowLeft size={15}/> Back to Jobs
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {job.property?.name ?? 'Unknown Property'}
          </h1>
          <p className="text-sm font-medium flex items-center gap-2 mt-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              {job.id.split('-')[0].toUpperCase()}
            </span>
            {getJobTypeLabel(job.job_type)} · Scheduled {formatDate(job.scheduled_date)}
            {(job.status === 'completed' || job.status === 'in_progress') && job.updated_at ? (
              <span style={{ color: job.status === 'completed' ? '#16a34a' : 'var(--primary)' }}>
                {' '}· {job.status === 'completed' ? 'Completed' : 'Started'} {formatDate(job.updated_at as string)}
              </span>
            ) : job.scheduled_time ? (
              ` at ${formatTime(job.scheduled_time)}`
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex gap-2"><Badge value={job.priority}/><Badge value={job.status}/></div>
          {renderReportButton()}
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {job.status!=='cancelled' && (
          <button onClick={()=>updateStatus('cancelled')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium" style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>
            <XCircle size={14}/> Cancel
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-xl border bg-[var(--card)] w-fit" style={{ borderColor:'var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={tab===t?{ background:'var(--primary)', color:'#fff' }:{ color:'var(--text-secondary)' }}>
            {t}{t==='assets'?` (${jobAssets.length})`:t==='defects'?` (${defects.length})`:t==='photos'?` (${photos.length})`:''}
          </button>
        ))}
      </div>

      {tab==='overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
            <p className="font-semibold mb-3" style={{ color:'var(--text)' }}>Property</p>
            {[['Address',job.property?.address],['Suburb',job.property?.suburb],['State',job.property?.state],['Contact',job.property?.site_contact_name],['Phone',job.property?.site_contact_phone]].filter(([,v])=>v).map(([k,v])=>(
              <div key={String(k)} className="flex gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor:'var(--border)' }}>
                <span className="w-20 flex-shrink-0" style={{ color:'var(--text-tertiary)' }}>{k}</span>
                <span style={{ color:'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
              <p className="font-semibold mb-3" style={{ color:'var(--text)' }}>Technician</p>
              {[['Name',job.assigned_user?.full_name],['Email',job.assigned_user?.email],['Phone',job.assigned_user?.phone]].map(([k,v])=>(
                <div key={String(k)} className="flex gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor:'var(--border)' }}>
                  <span className="w-20 flex-shrink-0" style={{ color:'var(--text-tertiary)' }}>{k}</span>
                  <span style={{ color:'var(--text)' }}>{v??'—'}</span>
                </div>
              ))}
            </div>
            {timeLogs.length>0 && (
              <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
                <p className="font-semibold mb-3" style={{ color:'var(--text)' }}>Time Logs</p>
                {timeLogs.map(tl=>(
                  <div key={tl.id} className="text-sm py-2 border-b last:border-0" style={{ borderColor:'var(--border)' }}>
                    <p style={{ color:'var(--text)' }}>In: {formatDateTime(tl.clock_in)}</p>
                    <p style={{ color:'var(--text-secondary)' }}>Out: {tl.clock_out?formatDateTime(tl.clock_out):'Still active'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-2 bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color:'var(--text)' }}>Notes</p>
              <button onClick={()=>editNotes?saveNotes():setEditNotes(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background:editNotes?'var(--primary)':'var(--bg)', color:editNotes?'#fff':'var(--text-secondary)' }}>
                <Edit3 size={12}/>{editNotes?'Save':'Edit'}
              </button>
            </div>
            {editNotes
              ?<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor:'var(--border)' }}/>
              :<p className="text-sm" style={{ color:notes?'var(--text)':'var(--text-tertiary)' }}>{notes||'No notes.'}</p>
            }
          </div>
        </div>
      )}

      {tab==='assets' && (
        <div className="bg-[var(--card)] rounded-2xl border overflow-hidden" style={{ borderColor:'var(--border)' }}>
          {jobAssets.length===0?<p className="text-center py-12 text-sm" style={{ color:'var(--text-tertiary)' }}>No assets inspected</p>:(
            <table><thead><tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg)' }}>
              {['Ref','Type','Location','Result','Compliant'].map(h=><th key={h} className="px-4 py-3 text-xs font-semibold text-left" style={{ color:'var(--text-secondary)' }}>{h}</th>)}
            </tr></thead><tbody>
              {jobAssets.map((ja:any,i:number)=>(
                <tr key={ja.id} style={{ borderBottom:i<jobAssets.length-1?'1px solid var(--border)':'none' }}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color:'var(--text-secondary)' }}>{ja.asset?.asset_ref??'—'}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color:'var(--text)' }}>{ja.asset?.asset_type}</td>
                  <td className="px-4 py-3 text-sm" style={{ color:'var(--text-secondary)' }}>{ja.asset?.location_on_site??'—'}</td>
                  <td className="px-4 py-3">{ja.result?<Badge value={ja.result}/>:<span style={{ color:'var(--text-tertiary)' }}>—</span>}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color:ja.is_compliant?'#16a34a':'#ef4444' }}>{ja.is_compliant?'✓ Yes':'✗ No'}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {tab==='defects' && (
        <div className="space-y-3">
          {defects.length===0?<div className="bg-[var(--card)] rounded-2xl border p-12 text-center" style={{ borderColor:'var(--border)' }}><p className="text-sm" style={{ color:'var(--text-tertiary)' }}>No defects recorded</p></div>
          :defects.map((d:any)=>{
            const defectPhotos = photos.filter((p:any) => p.defect_id === d.id);
            return (
              <div key={d.id} className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-medium text-sm" style={{ color:'var(--text)' }}>{d.description}</p>
                  <div className="flex gap-2 flex-shrink-0"><Badge value={d.severity}/><Badge value={d.status}/></div>
                </div>
                <p className="text-xs mb-3" style={{ color:'var(--text-secondary)' }}>{d.asset?.asset_type}</p>
                {defectPhotos.length>0&&<div className="flex gap-2 flex-wrap">{defectPhotos.slice(0,6).map((p:any,i:number)=>{
                  const isPending = p.photo_url.startsWith('file://') || p.photo_url.startsWith('content://');
                  if (isPending) return null;
                  return (
                    <a key={i} href={p.photo_url} target="_blank" rel="noreferrer">
                      <img src={p.photo_url} alt="" className="w-16 h-16 object-cover rounded-lg border hover:opacity-90 transition-opacity" style={{ borderColor:'var(--border)' }}/>
                    </a>
                  );
                })}</div>}
              </div>
            );
          })}
        </div>
      )}

      {tab==='photos' && (
        <div className="bg-[var(--card)] rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
          {photos.length===0?<p className="text-center py-12 text-sm" style={{ color:'var(--text-tertiary)' }}>No photos</p>
          :<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p:any)=>{
              const isPending = p.photo_url.startsWith('file://') || p.photo_url.startsWith('content://');
              return isPending ? (
                <div key={p.id} className="w-full h-32 flex flex-col items-center justify-center rounded-xl border border-dashed bg-white/5" style={{ borderColor:'var(--border)' }}>
                  <ImageIcon size={24} style={{ color:'var(--text-tertiary)' }} />
                  <p className="text-[10px] mt-2 font-medium" style={{ color:'var(--text-secondary)' }}>Pending Sync</p>
                </div>
              ) : (
                <a key={p.id} href={p.photo_url} target="_blank" rel="noreferrer">
                  <img src={p.photo_url} alt="" className="w-full h-32 object-cover rounded-xl border hover:opacity-90 transition-opacity" style={{ borderColor:'var(--border)' }}/>
                </a>
              );
            })}
          </div>}
        </div>
      )}

      {tab==='signature' && (
        <div className="bg-[var(--card)] rounded-2xl border p-5 max-w-md" style={{ borderColor:'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color:'var(--text)' }}>Client Signature</p>
          {signature?(()=>{
            const isPending = signature.signature_url?.startsWith('file://') || signature.signature_url?.startsWith('content://');
            if (isPending) return (
              <div className="w-full h-32 flex flex-col items-center justify-center rounded-xl border border-dashed bg-white/5" style={{ borderColor:'var(--border)' }}>
                <ImageIcon size={24} style={{ color:'var(--text-tertiary)' }} />
                <p className="text-[10px] mt-2 font-medium" style={{ color:'var(--text-secondary)' }}>Signature Pending Sync</p>
              </div>
            );
            return (
              <div className="space-y-3">
                <img src={signature.signature_url} alt="Signature" className="w-full border rounded-xl p-4 bg-white/5" style={{ borderColor:'var(--border)' }}/>
                <p className="text-sm"><span style={{ color:'var(--text-tertiary)' }}>Signed by: </span><strong style={{ color:'var(--text)' }}>{signature.signed_by_name}</strong></p>
                <p className="text-sm" style={{ color:'var(--text-secondary)' }}>{formatDateTime(signature.signed_at)}</p>
              </div>
            );
          })():<p className="text-sm text-center py-8" style={{ color:'var(--text-tertiary)' }}>No signature captured</p>}
        </div>
      )}

      {tab==='report' && (
        <div className="space-y-4">
          {job.report_url ? (
            // Report uploaded — show inline viewer (whether draft or final)
            <div className="space-y-3">
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color:'var(--text)' }}>
                    {job.status === 'completed' ? 'Inspection Report' : 'Draft Inspection Report'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>Generated by technician · Tap Download to save or share</p>
                </div>
                <a
                  href={`${job.report_url}#t=${new Date(job.updated_at).getTime()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background:'linear-gradient(135deg,var(--accent),var(--accent))', boxShadow:'0 4px 14px rgba(232,101,10,0.3)' }}
                >
                  <Download size={14}/> Download / Share PDF
                </a>
              </div>
              {/* Inline PDF viewer — loads the exact file the technician uploaded */}
              <div className="rounded-2xl overflow-hidden border relative" style={{ height:'75vh', borderColor:'var(--border)', background:'var(--bg)', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                <object
                  data={`${job.report_url}#t=${new Date(job.updated_at).getTime()}`}
                  type="application/pdf"
                  className="w-full h-full border-0"
                >
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center" style={{ background: 'var(--card)' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background:'rgba(232,101,10,0.15)' }}>
                      <FileText size={28} style={{ color:'var(--accent)' }}/>
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      Your browser does not support inline PDFs.
                    </p>
                    <a
                      href={job.report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background:'linear-gradient(135deg,var(--accent),var(--accent))', boxShadow:'0 4px 14px rgba(232,101,10,0.3)' }}
                    >
                      <Download size={14}/> Download PDF
                    </a>
                  </div>
                </object>
              </div>
            </div>
          ) : job.status !== 'completed' ? (
            // Job not yet complete and no draft report
            <div className="bg-[var(--card)] rounded-2xl border p-12 flex flex-col items-center gap-4" style={{ borderColor:'var(--border)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:'var(--bg)' }}>
                <FileText size={28} style={{ color:'var(--text-tertiary)' }}/>
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color:'var(--text)' }}>Report Not Available Yet</p>
                <p className="text-sm mt-1.5" style={{ color:'var(--text-secondary)' }}>
                  The inspection report will appear here once the technician generates the PDF on their device.
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor:'var(--border)', color:'var(--text-tertiary)', background:'var(--bg)' }}>
                Current status: <strong>{job.status.replace(/_/g,' ')}</strong>
              </div>
            </div>
          ) : (
            // Job complete but report not uploaded yet
            <div className="bg-[var(--card)] rounded-2xl border p-12 flex flex-col items-center gap-4" style={{ borderColor:'var(--border)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:'rgba(232,101,10,0.15)' }}>
                <FileText size={28} style={{ color:'var(--accent)' }}/>
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color:'var(--text)' }}>Report Not Uploaded</p>
                <p className="text-sm mt-1.5" style={{ color:'var(--text-secondary)' }}>
                  Job is marked complete but the PDF has not been uploaded from the technician&apos;s device yet. Ask the technician to open the job and tap &quot;View Report&quot;.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


