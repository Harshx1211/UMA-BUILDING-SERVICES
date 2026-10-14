// useSyncStrip — what the thin status strip under every screen header shows
// (components/SyncStrip.tsx). One shared tracker for the whole app: every
// mounted header reads the same state, and only one timer polls.
//
// The strip only ever states what is true, read from the sync queue itself:
//   offline   — no internet; how many changes are saved on this phone
//   uploading — catching up after being offline (or work stuck > 8 s);
//               "N of M" counts real queue items reaching the server
//   done      — the queue actually reached zero after an upload it showed
//   failed    — changes that gave up; tap retries them
// Ordinary single edits made online upload within a second or two and
// never show the strip, the same way Teams/Outlook stay quiet when online.
import { useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { getSyncQueueCounts } from '@/lib/database';
import { isSyncActive } from '@/lib/sync';

export type SyncStripState =
  | { kind: 'hidden' }
  | { kind: 'offline'; unsynced: number }
  | { kind: 'uploading'; done: number; total: number }
  | { kind: 'done' }
  | { kind: 'failed'; failed: number };

const FAST_MS = 1000;
const SLOW_MS = 4000;
const STUCK_MS = 8000;     // online work still waiting this long is worth showing
const DONE_SHOW_MS = 3000;

let state: SyncStripState = { kind: 'hidden' };
let online = true;
let cameFromOffline = false;
let waitingSince: number | null = null;
let batchTotal = 0;
let doneUntil = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeNet: (() => void) | null = null;
const listeners = new Set<() => void>();

function isOnlineState(s: NetInfoState): boolean {
  return s.isConnected === true && s.isInternetReachable !== false;
}

function same(a: SyncStripState, b: SyncStripState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function setState(next: SyncStripState) {
  if (same(state, next)) return;
  state = next;
  listeners.forEach((l) => l());
}

function evaluate(): SyncStripState {
  const { unsynced, failed } = getSyncQueueCounts();
  const now = Date.now();

  if (!online) {
    cameFromOffline = true;
    waitingSince = null;
    // Count the catch-up upload from everything saved while offline.
    batchTotal = unsynced;
    return { kind: 'offline', unsynced };
  }
  if (failed > 0 && unsynced === 0) return { kind: 'failed', failed };

  if (unsynced > 0) {
    if (waitingSince === null) waitingSince = now;
    const show = cameFromOffline || batchTotal > 0 || now - waitingSince >= STUCK_MS;
    if (!show) return { kind: 'hidden' };
    batchTotal = Math.max(batchTotal, unsynced);
    return { kind: 'uploading', done: batchTotal - unsynced, total: batchTotal };
  }

  // Queue empty.
  waitingSince = null;
  if (batchTotal > 0 || cameFromOffline) {
    // Only claim success for an upload the strip actually showed.
    const shownUpload = batchTotal > 0;
    batchTotal = 0;
    cameFromOffline = false;
    if (shownUpload) doneUntil = now + DONE_SHOW_MS;
  }
  if (failed > 0) return { kind: 'failed', failed };
  if (now < doneUntil) return { kind: 'done' };
  return { kind: 'hidden' };
}

function tick() {
  timer = null;
  setState(evaluate());
  if (listeners.size === 0) return;
  const busy = state.kind === 'uploading' || state.kind === 'done' || isSyncActive();
  timer = setTimeout(tick, busy ? FAST_MS : SLOW_MS);
}

function refreshSoon() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(tick, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    unsubscribeNet = NetInfo.addEventListener((s) => {
      const next = isOnlineState(s);
      if (next !== online) { online = next; refreshSoon(); }
    });
    refreshSoon();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeNet?.();
      unsubscribeNet = null;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

/** Re-check right away — after a manual retry, say. */
export function refreshSyncStrip(): void {
  refreshSoon();
}

export function useSyncStrip(): SyncStripState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
