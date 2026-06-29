import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getJobById, getDefectsForJob, getSignatureForJob, getCompanySettings, getRecord } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { C } from '@/constants/Config';
import type { Job, Defect, Signature, CompanySettings, User } from '@/types';

type JobFull = Job & {
  property_name?: string; address?: string; suburb?: string; state?: string; postcode?: string;
  client_name?: string; building_class?: string; site_contact_name?: string;
};

type Stage = 'idle' | 'loading' | 'generating' | 'uploading' | 'done' | 'error';

const STAGE_LABEL: Record<Stage, string> = {
  idle:       'Ready to generate',
  loading:    'Loading job data…',
  generating: 'Generating PDF…',
  uploading:  'Uploading to cloud…',
  done:       'Report ready!',
  error:      'Error occurred',
};

function fmtAbn(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 11) return raw;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

function buildHtml(
  job: JobFull,
  defects: Defect[],
  sig: Signature | null,
  company: CompanySettings | null,
  tech: User | null,
): string {
  const companyName = company?.company_name ?? 'UMA Building Services Pty Ltd';
  const abn         = company?.abn ? `ABN: ${fmtAbn(company.abn)}` : '';
  const address     = [company?.address_line1, company?.address_line2].filter(Boolean).join(', ');
  const phone       = company?.phone ?? '';
  const email       = company?.email ?? '';

  const criticalCount = defects.filter(d => d.severity === 'critical').length;
  const majorCount    = defects.filter(d => d.severity === 'major').length;
  const minorCount    = defects.filter(d => d.severity === 'minor').length;

  const defectRows = defects.map(d => `
    <tr>
      <td>${d.defect_code ?? '—'}</td>
      <td>${d.description}</td>
      <td style="color:${d.severity === 'critical' ? '#dc2626' : d.severity === 'major' ? '#e8650a' : '#d97706'};font-weight:700">
        ${d.severity.toUpperCase()}
      </td>
      <td>${d.status.toUpperCase()}</td>
      <td>${d.quote_price != null ? `$${d.quote_price.toFixed(2)}` : '—'}</td>
    </tr>
  `).join('');

  const sigBlock = sig
    ? `<div class="sig-block">
        <img src="${sig.signature_url}" class="sig-img" alt="Signature"/>
        <div class="sig-meta">
          <strong>${sig.signed_by_name}</strong><br/>
          ${new Date(sig.signed_at).toLocaleString('en-AU')}<br/>
          ${sig.device_info ?? ''}
        </div>
       </div>`
    : '<p class="no-sig">No signature captured for this job.</p>';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;margin:0;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f1e3c;padding-bottom:16px;margin-bottom:24px}
  .company h1{font-size:18pt;color:#0f1e3c;margin:0}
  .company p{margin:2px 0;font-size:9pt;color:#64748b}
  .doc-title{text-align:right}
  .doc-title h2{font-size:14pt;font-weight:700;color:#0f1e3c;margin:0}
  .doc-title .report-no{font-size:10pt;color:#64748b;margin-top:4px}
  .section{margin-bottom:24px}
  .section-title{font-size:10pt;font-weight:700;color:#0f1e3c;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
  .field label{font-size:8.5pt;color:#64748b;font-weight:600}
  .field span{display:block;font-size:10.5pt;color:#1e293b;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:9.5pt}
  th{background:#0f1e3c;color:#fff;padding:8px;text-align:left;font-size:8.5pt}
  td{padding:7px 8px;border-bottom:1px solid #e2e8f0}
  tr:nth-child(even)td{background:#f8fafc}
  .kpi-row{display:flex;gap:16px;margin-bottom:20px}
  .kpi{flex:1;background:#f1f5f9;border-radius:8px;padding:12px;text-align:center}
  .kpi .val{font-size:18pt;font-weight:700}
  .kpi .lbl{font-size:8pt;color:#64748b;text-transform:uppercase}
  .kpi.critical .val{color:#dc2626}
  .kpi.major .val{color:#e8650a}
  .kpi.minor .val{color:#d97706}
  .sig-block{margin-top:12px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;display:flex;gap:24px;align-items:center}
  .sig-img{max-width:200px;max-height:80px;border-bottom:1px solid #0f1e3c}
  .sig-meta{font-size:9pt;color:#64748b;line-height:1.6}
  .no-sig{color:#dc2626;font-style:italic}
  .as1851{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;font-size:8.5pt;color:#0369a1;margin-top:20px}
  .fpas-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:9pt}
  footer{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:8pt;color:#94a3b8;text-align:center}
</style>
</head>
<body>

<div class="header">
  <div class="company">
    <h1>${companyName}</h1>
    <p>${abn}</p>
    ${address ? `<p>${address}</p>` : ''}
    ${phone ? `<p>Phone: ${phone}</p>` : ''}
    ${email ? `<p>Email: ${email}</p>` : ''}
  </div>
  <div class="doc-title">
    <h2>FIRE SAFETY INSPECTION REPORT</h2>
    <div class="report-no">Report No: ${job.report_number ?? 'PENDING'}</div>
    <div class="report-no">AS 1851:2012 Routine Service</div>
    <div class="report-no">Date: ${job.scheduled_date}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Property Details</div>
  <div class="grid">
    <div class="field"><label>Property Name</label><span>${job.property_name ?? '—'}</span></div>
    <div class="field"><label>Client / Owner</label><span>${job.client_name ?? '—'}</span></div>
    <div class="field"><label>Address</label><span>${[job.address, job.suburb, job.state, job.postcode].filter(Boolean).join(', ') || '—'}</span></div>
    <div class="field"><label>NCC Building Class</label><span>${job.building_class ?? '—'}</span></div>
    <div class="field"><label>Site Contact</label><span>${job.site_contact_name ?? '—'}</span></div>
    <div class="field"><label>Inspection Date</label><span>${job.scheduled_date}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Defect Summary</div>
  <div class="kpi-row">
    <div class="kpi critical"><div class="val">${criticalCount}</div><div class="lbl">Critical</div></div>
    <div class="kpi major"><div class="val">${majorCount}</div><div class="lbl">Major</div></div>
    <div class="kpi minor"><div class="val">${minorCount}</div><div class="lbl">Minor</div></div>
    <div class="kpi"><div class="val">${defects.length}</div><div class="lbl">Total</div></div>
  </div>
  ${defects.length > 0 ? `
  <table>
    <thead><tr><th>Code</th><th>Description</th><th>Severity</th><th>Status</th><th>Est. Cost</th></tr></thead>
    <tbody>${defectRows}</tbody>
  </table>` : '<p style="color:#16a34a;font-weight:600">✅ No defects recorded — all items compliant.</p>'}
</div>

${tech ? `
<div class="section">
  <div class="section-title">Technician &amp; FPAS Accreditation</div>
  <div class="fpas-box">
    <div class="grid">
      <div class="field"><label>Technician</label><span>${tech.full_name}</span></div>
      <div class="field"><label>FPAS Number</label><span>${tech.fpas_number ?? '—'}</span></div>
      <div class="field"><label>FPAS Class</label><span>${tech.fpas_class ?? '—'}</span></div>
      <div class="field"><label>FPAS Expiry</label><span>${tech.fpas_expiry ?? '—'}</span></div>
      <div class="field"><label>State Licence</label><span>${tech.state_license ?? '—'}</span></div>
    </div>
  </div>
</div>
` : ''}

<div class="section">
  <div class="section-title">Client Sign-Off</div>
  ${sigBlock}
</div>

<div class="as1851">
  This inspection report has been prepared in accordance with <strong>AS 1851:2012 — Routine service of fire protection systems and equipment</strong>.
  All work is carried out by accredited FPAS technicians. This report is intended for the building owner/manager and relevant
  regulatory authorities. Defects classified as <strong>Critical</strong> require immediate rectification.
</div>

<footer>
  ${companyName}  ${abn ? '• ' + abn : ''}  •  Generated by SiteTrack Field Operations System<br/>
  Report No: ${job.report_number ?? 'PENDING'}  •  ${new Date().toLocaleString('en-AU')}
</footer>

</body>
</html>`;
}

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [stage, setStage]     = useState<Stage>('idle');
  const [pdfUri, setPdfUri]   = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => { _generate(); }, []);

  async function _generate() {
    if (!id) return;
    setStage('loading');
    try {
      const job      = getJobById<JobFull>(id);
      const defects  = getDefectsForJob<Defect>(id);
      const sig      = getSignatureForJob<Signature>(id);
      const company  = getCompanySettings<CompanySettings>();
      const tech     = job ? getRecord<User>('users', job.assigned_to) : null;

      if (!job) { setStage('error'); return; }

      setStage('generating');
      const html = buildHtml(job, defects, sig, company, tech);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      setPdfUri(uri);

      // Try to upload to Supabase Storage
      setStage('uploading');
      const fileName = `${job.report_number ?? id}.pdf`;
      const content  = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { data: upload } = await supabase.storage
        .from('job-reports')
        .upload(fileName, _b64ToUint8(content), { contentType: 'application/pdf', upsert: true });

      if (upload?.path) {
        const { data: pub } = supabase.storage.from('job-reports').getPublicUrl(upload.path);
        setReportUrl(pub.publicUrl);
      }
      setStage('done');
    } catch (err) {
      console.error('[Preview] Error:', err);
      setStage('error');
    }
  }

  function _b64ToUint8(b64: string): Uint8Array {
    // React Native (Hermes) does not have atob — use manual decode
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean  = b64.replace(/=+$/, '');
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 4) {
      const a = chars.indexOf(clean[i]);
      const b = chars.indexOf(clean[i + 1]);
      const c = chars.indexOf(clean[i + 2] ?? 'A');
      const d = chars.indexOf(clean[i + 3] ?? 'A');
      bytes.push((a << 2) | (b >> 4));
      if (clean[i + 2]) bytes.push(((b & 15) << 4) | (c >> 2));
      if (clean[i + 3]) bytes.push(((c & 3) << 6) | d);
    }
    return new Uint8Array(bytes);
  }

  async function _share() {
    if (!pdfUri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf' });
    else Alert.alert('Sharing not available on this device');
  }

  async function _print() {
    if (!pdfUri) return;
    await Print.printAsync({ uri: pdfUri });
  }

  const isDone  = stage === 'done';
  const isError = stage === 'error';
  const isWorking = !isDone && !isError;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Inspection Report</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {/* Stage indicator */}
        <View style={styles.stageCard}>
          <View style={[styles.stageIcon, isDone && styles.stageIconDone, isError && styles.stageIconError]}>
            {isWorking && <ActivityIndicator color={C.accent} size="large" />}
            {isDone  && <Text style={styles.stageEmoji}>✅</Text>}
            {isError && <Text style={styles.stageEmoji}>❌</Text>}
          </View>
          <Text style={[styles.stageLabel, isDone && { color: C.success }, isError && { color: C.danger }]}>
            {STAGE_LABEL[stage]}
          </Text>

          {/* Progress steps */}
          <View style={styles.steps}>
            {(['loading', 'generating', 'uploading', 'done'] as Stage[]).map((s, i) => {
              const stages: Stage[] = ['loading', 'generating', 'uploading', 'done'];
              const currentIdx = stages.indexOf(stage);
              const thisIdx    = stages.indexOf(s);
              const done       = isError ? false : thisIdx < currentIdx || (isDone && thisIdx <= currentIdx);
              const active     = s === stage && !isDone && !isError;
              return (
                <View key={s} style={styles.stepWrap}>
                  <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]} />
                  <Text style={[styles.stepLabel, done && { color: C.success }, active && { color: C.accent }]}>
                    {STAGE_LABEL[s]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Actions */}
        {isDone && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionShare]} onPress={_share}>
              <Text style={styles.actionBtnText}>Share PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrint]} onPress={_print}>
              <Text style={styles.actionBtnText}>Print</Text>
            </TouchableOpacity>
          </View>
        )}
        {isDone && reportUrl && (
          <Text style={styles.cloudNote}>☁️  Report uploaded to cloud storage</Text>
        )}
        {isError && (
          <TouchableOpacity style={styles.retryBtn} onPress={_generate}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.primary },
  header:           {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:          { paddingVertical: 4 },
  backText:         { color: C.accent, fontSize: 14, fontWeight: '600' },
  title:            { color: C.textLight, fontSize: 17, fontWeight: '700' },
  body:             { flex: 1, padding: 24, justifyContent: 'center' },
  stageCard:        { backgroundColor: C.surface, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stageIcon:        {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: C.border,
  },
  stageIconDone:    { borderColor: C.success, backgroundColor: 'rgba(22,163,74,0.1)' },
  stageIconError:   { borderColor: C.danger, backgroundColor: 'rgba(220,38,38,0.1)' },
  stageEmoji:       { fontSize: 32 },
  stageLabel:       { color: C.textLight, fontSize: 18, fontWeight: '700', marginBottom: 24 },
  steps:            { width: '100%', gap: 12 },
  stepWrap:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: C.border },
  stepDotDone:      { backgroundColor: C.success },
  stepDotActive:    { backgroundColor: C.accent },
  stepLabel:        { color: C.textMuted, fontSize: 13 },
  actions:          { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn:        { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionShare:      { backgroundColor: C.accent },
  actionPrint:      { backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.border },
  actionBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  cloudNote:        { textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 12 },
  retryBtn:         { marginTop: 16, backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.danger },
  retryText:        { color: C.danger, fontWeight: '700' },
});
