'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminApi, adminRead } from '@/lib/admin-api';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getJobTypeLabel } from '@/constants/jobTypes';
import Badge from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle2, XCircle, Edit3, FileText, Download, Clock } from 'lucide-react';
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
      const [{ data: j },{ data: d },{ data: ph },{ data: sig },{ data: tl },{ data: ja }] = await Promise.all([
        supabase.from('jobs').select('*, property:properties(*), assigned_user:users(*)').eq('id',id).single(),
        supabase.from('defects').select('*, asset:assets(asset_type,variant)').eq('job_id',id),
        supabase.from('inspection_photos').select('*').eq('job_id',id),
        supabase.from('signatures').select('*').eq('job_id',id).maybeSingle(),
        supabase.from('time_logs').select('*').eq('job_id',id),
        supabase.from('job_assets').select('*, asset:assets(asset_type,variant,location_on_site,asset_ref)').eq('job_id',id),
      ]);
      setJob(j); setNotes(j?.notes??'');
      setDefects(d??[]); setPhotos(ph??[]);
      setSignature(sig); setTimeLogs(tl??[]); setJobAssets(ja??[]);
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
  function ReportButton() {
    if (job?.status !== 'completed') {
      return (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)', background: '#f8fafc' }}>
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
          style={{ background: 'linear-gradient(135deg,#F97316,#ea580c)', boxShadow: '0 4px 14px rgba(249,115,22,0.35)' }}
        >
          <Download size={14} /> Download PDF Report
        </a>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)', background: '#f8fafc' }}>
        <Clock size={14} /> No report uploaded yet
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor:'var(--accent)' }} />
    </div>
  );
  if (!job) return <p className="text-center py-16" style={{ color:'var(--text-secondary)' }}>Job not found.</p>;

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
            <span className="px-2 py-0.5 rounded-md text-xs font-bold" style={{ background: '#f1f5f9', color: 'var(--text)' }}>
              {job.id.split('-')[0].toUpperCase()}
            </span>
            {getJobTypeLabel(job.job_type)} · {formatDate(job.scheduled_date)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex gap-2"><Badge value={job.priority}/><Badge value={job.status}/></div>
          <ReportButton />
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {job.status!=='cancelled' && (
          <button onClick={()=>updateStatus('cancelled')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium" style={{ background:'#fef2f2', color:'#ef4444' }}>
            <XCircle size={14}/> Cancel
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-xl border bg-white w-fit" style={{ borderColor:'var(--border)' }}>
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
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
            <p className="font-semibold mb-3" style={{ color:'var(--text)' }}>Property</p>
            {[['Address',job.property?.address],['Suburb',job.property?.suburb],['State',job.property?.state],['Contact',job.property?.site_contact_name],['Phone',job.property?.site_contact_phone]].filter(([,v])=>v).map(([k,v])=>(
              <div key={String(k)} className="flex gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor:'var(--border)' }}>
                <span className="w-20 flex-shrink-0" style={{ color:'var(--text-tertiary)' }}>{k}</span>
                <span style={{ color:'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
              <p className="font-semibold mb-3" style={{ color:'var(--text)' }}>Technician</p>
              {[['Name',job.assigned_user?.full_name],['Email',job.assigned_user?.email],['Phone',job.assigned_user?.phone]].map(([k,v])=>(
                <div key={String(k)} className="flex gap-3 py-2 border-b last:border-0 text-sm" style={{ borderColor:'var(--border)' }}>
                  <span className="w-20 flex-shrink-0" style={{ color:'var(--text-tertiary)' }}>{k}</span>
                  <span style={{ color:'var(--text)' }}>{v??'—'}</span>
                </div>
              ))}
            </div>
            {timeLogs.length>0 && (
              <div className="bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
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
          <div className="md:col-span-2 bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
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
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor:'var(--border)' }}>
          {jobAssets.length===0?<p className="text-center py-12 text-sm" style={{ color:'var(--text-tertiary)' }}>No assets inspected</p>:(
            <table><thead><tr style={{ borderBottom:'1px solid var(--border)', background:'#fafafa' }}>
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
          {defects.length===0?<div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor:'var(--border)' }}><p className="text-sm" style={{ color:'var(--text-tertiary)' }}>No defects recorded</p></div>
          :defects.map((d:any)=>(
            <div key={d.id} className="bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-medium text-sm" style={{ color:'var(--text)' }}>{d.description}</p>
                <div className="flex gap-2 flex-shrink-0"><Badge value={d.severity}/><Badge value={d.status}/></div>
              </div>
              <p className="text-xs mb-3" style={{ color:'var(--text-secondary)' }}>{d.asset?.asset_type}</p>
              {d.photos?.length>0&&<div className="flex gap-2 flex-wrap">{d.photos.slice(0,6).map((url:string,i:number)=>(
                <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" style={{ borderColor:'var(--border)' }}/>
              ))}</div>}
            </div>
          ))}
        </div>
      )}

      {tab==='photos' && (
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor:'var(--border)' }}>
          {photos.length===0?<p className="text-center py-12 text-sm" style={{ color:'var(--text-tertiary)' }}>No photos</p>
          :<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p:any)=><a key={p.id} href={p.photo_url} target="_blank" rel="noreferrer">
              <img src={p.photo_url} alt="" className="w-full h-32 object-cover rounded-xl border hover:opacity-90 transition-opacity" style={{ borderColor:'var(--border)' }}/>
            </a>)}
          </div>}
        </div>
      )}

      {tab==='signature' && (
        <div className="bg-white rounded-2xl border p-5 max-w-md" style={{ borderColor:'var(--border)' }}>
          <p className="font-semibold mb-4" style={{ color:'var(--text)' }}>Client Signature</p>
          {signature?(<div className="space-y-3">
            <img src={signature.signature_url} alt="Signature" className="w-full border rounded-xl p-4 bg-gray-50" style={{ borderColor:'var(--border)' }}/>
            <p className="text-sm"><span style={{ color:'var(--text-tertiary)' }}>Signed by: </span><strong style={{ color:'var(--text)' }}>{signature.signed_by_name}</strong></p>
            <p className="text-sm" style={{ color:'var(--text-secondary)' }}>{formatDateTime(signature.signed_at)}</p>
          </div>):<p className="text-sm text-center py-8" style={{ color:'var(--text-tertiary)' }}>No signature captured</p>}
        </div>
      )}

      {tab==='report' && (
        <div className="space-y-4">
          {job.status !== 'completed' ? (
            // Job not yet complete
            <div className="bg-white rounded-2xl border p-12 flex flex-col items-center gap-4" style={{ borderColor:'var(--border)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:'#f8fafc' }}>
                <FileText size={28} style={{ color:'var(--text-tertiary)' }}/>
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color:'var(--text)' }}>Report Not Available Yet</p>
                <p className="text-sm mt-1.5" style={{ color:'var(--text-secondary)' }}>
                  The inspection report will appear here once the technician completes the job and generates the PDF on their device.
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor:'var(--border)', color:'var(--text-tertiary)', background:'#f8fafc' }}>
                Current status: <strong>{job.status.replace(/_/g,' ')}</strong>
              </div>
            </div>
          ) : job.report_url ? (
            // Job complete and report uploaded — show inline viewer
            <div className="space-y-3">
              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color:'var(--text)' }}>Inspection Report</p>
                  <p className="text-xs mt-0.5" style={{ color:'var(--text-secondary)' }}>Generated by technician · Tap Download to save or share</p>
                </div>
                <a
                  href={job.report_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background:'linear-gradient(135deg,#F97316,#ea580c)', boxShadow:'0 4px 14px rgba(249,115,22,0.3)' }}
                >
                  <Download size={14}/> Download / Share PDF
                </a>
              </div>
              {/* Inline PDF viewer — loads the exact file the technician uploaded */}
              <div className="bg-gray-100 rounded-2xl overflow-hidden border" style={{ height:'75vh', borderColor:'var(--border)' }}>
                <iframe
                  src={job.report_url}
                  className="w-full h-full border-0"
                  title="Inspection Report PDF"
                />
              </div>
            </div>
          ) : (
            // Job complete but report not uploaded yet
            <div className="bg-white rounded-2xl border p-12 flex flex-col items-center gap-4" style={{ borderColor:'var(--border)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:'#fff7ed' }}>
                <FileText size={28} style={{ color:'#f97316' }}/>
              </div>
              <div className="text-center">
                <p className="font-semibold text-base" style={{ color:'var(--text)' }}>Report Not Uploaded</p>
                <p className="text-sm mt-1.5" style={{ color:'var(--text-secondary)' }}>
                  Job is marked complete but the PDF has not been uploaded from the technician's device yet. Ask the technician to open the job and tap &quot;View Report&quot;.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
