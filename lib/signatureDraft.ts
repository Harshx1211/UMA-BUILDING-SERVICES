import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The technician's step-1 signature, held per job until the client signs
 * (app/(app)/jobs/[id]/signature.tsx). Survives leaving the screen and app
 * restarts; swept on sign-out by authStore's sweepDraftSignatureKeys(),
 * which matches on DRAFT_PREFIX — keep the two in step.
 */
export const DRAFT_PREFIX = 'draft_tech_sig_';

/**
 * A draft older than this is discarded rather than resumed: a technician
 * signature attests to the visit it was captured on, so it shouldn't be
 * silently reused on a later day.
 */
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const key = (jobId: string) => `${DRAFT_PREFIX}${jobId}`;

/** The saved draft for this job, or null if none / expired / unreadable. */
export async function readTechDraft(jobId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(key(jobId));
    if (!raw) return null;
    // Drafts written before this format were a bare data URL with no
    // timestamp — they can't be dated, so treat them as expired.
    const parsed = JSON.parse(raw) as { sig?: unknown; savedAt?: unknown };
    if (typeof parsed.sig === 'string' && typeof parsed.savedAt === 'number'
        && Date.now() - parsed.savedAt < DRAFT_TTL_MS) {
      return parsed.sig;
    }
  } catch { /* unparsable (old format) — fall through and clear it */ }
  await clearTechDraft(jobId);
  return null;
}

/** Best-effort: the in-memory copy still works for this visit if this fails. */
export async function writeTechDraft(jobId: string, sig: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(jobId), JSON.stringify({ sig, savedAt: Date.now() }));
  } catch { /* storage full/unavailable — not worth blocking the signer */ }
}

export async function clearTechDraft(jobId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(jobId));
  } catch { /* nothing more to do */ }
}
