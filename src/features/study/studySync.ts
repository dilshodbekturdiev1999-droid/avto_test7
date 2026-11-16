// Keeps "My mistakes" and bookmarks the same on every device and on the website.
//
// Every local change is queued on the device and sent to the server (function
// study-sync); the queue survives offline use and app restarts. After sign-in the
// device first sends what it still has queued, then takes the server's copy.
import { invokeFunction } from '@/integrations/supabase/functionsClient';
import { getDeviceId } from '@/lib/deviceId';
import { safeStorage } from '@/lib/safeStorage';
import { isOnline, onNetworkChange } from '@/lib/network';
import { replaceStudyState, setStudyChangeHandler, type SavedKind } from './studyState';

type QueuedOp =
  | { type: 'answer'; question_id: string; correct: boolean; at: number }
  | { type: 'save'; kind: SavedKind; key: string; saved: boolean; at: number };

const QUEUE_KEY = 'pdd_study_queue';
const MAX_QUEUE = 1000;
const BATCH = 200;

function readQueue(): QueuedOp[] {
  try {
    const raw = safeStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOp[]): void {
  try {
    safeStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage full: the local copy is still right, only the sync is delayed */
  }
}

export function clearStudyQueue(): void {
  safeStorage.removeItem(QUEUE_KEY);
}

const session = () => ({ session_token: safeStorage.getItem('session_token'), device_id: getDeviceId() });

let flushing = false;

/** Send everything queued. Stops quietly when offline or signed out. */
export async function flushStudyQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const queue = readQueue();
      if (queue.length === 0) break;
      const { session_token, device_id } = session();
      if (!session_token || !isOnline()) break;

      const batch = queue.slice(0, BATCH);
      const { error } = await invokeFunction('study-sync', { action: 'sync', session_token, device_id, ops: batch });
      if (error) break; // network or server trouble: keep the queue, try again later
      writeQueue(readQueue().slice(batch.length));
    }
  } finally {
    flushing = false;
  }
}

/** After sign-in: push local changes first, then take what the server holds. */
export async function hydrateStudyFromServer(): Promise<void> {
  await flushStudyQueue();
  if (readQueue().length > 0) return; // unsent changes would be lost by replacing the local copy
  const { session_token, device_id } = session();
  if (!session_token) return;
  const { data, error } = await invokeFunction<{ mistakes: Record<string, number>; saved: Record<string, number> }>(
    'study-sync',
    { action: 'get', session_token, device_id },
  );
  if (error || !data) return;
  replaceStudyState({ mistakes: data.mistakes ?? {}, saved: data.saved ?? {} });
}

let started = false;

/** Call once at start-up. */
export function initStudySync(): void {
  if (started) return;
  started = true;
  setStudyChangeHandler((op) => {
    if (!safeStorage.getItem('session_token')) return;
    const queued: QueuedOp =
      op.type === 'answer'
        ? { type: 'answer', question_id: op.questionId, correct: op.correct, at: Date.now() }
        : { type: 'save', kind: op.kind, key: op.key, saved: op.saved, at: Date.now() };
    writeQueue([...readQueue(), queued]);
    void flushStudyQueue();
  });
  onNetworkChange((online) => {
    if (online) void flushStudyQueue();
  });
  void flushStudyQueue();
}
