// "Exam day" follows the student between devices: the device keeps a local copy
// (instant), and the date is saved on the server (study-sync, column
// app_users.exam_date). A change that could not be sent (offline, signed out) is
// flagged and goes out later; after sign-in the server's date replaces the local
// one unless a local change is still waiting to be sent.
import { useEffect, useState } from 'react';
import { invokeFunction } from '@/integrations/supabase/functionsClient';
import { getDeviceId } from '@/lib/deviceId';
import { safeStorage } from '@/lib/safeStorage';
import { isOnline, onNetworkChange } from '@/lib/network';

export const EXAM_DATE_KEY = 'exam_date';
const PENDING_KEY = 'exam_date_pending';
export const EXAM_DATE_EVENT = 'exam-date-changed';

const session = () => ({ session_token: safeStorage.getItem('session_token'), device_id: getDeviceId() });
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function writeLocal(date: string): void {
  if (date) safeStorage.setItem(EXAM_DATE_KEY, date);
  else safeStorage.removeItem(EXAM_DATE_KEY);
  window.dispatchEvent(new Event(EXAM_DATE_EVENT));
}

let sending = false;

/** Send a waiting local change. Stops quietly when offline or signed out. */
export async function flushExamDate(): Promise<void> {
  if (sending || !safeStorage.getItem(PENDING_KEY)) return;
  const { session_token, device_id } = session();
  if (!session_token || !isOnline()) return;
  sending = true;
  try {
    const date = safeStorage.getItem(EXAM_DATE_KEY) ?? '';
    const { error } = await invokeFunction('study-sync', { action: 'set-exam-date', session_token, device_id, exam_date: date });
    if (error) return; // keep the flag, try again later
    // A newer edit made while sending keeps its own flag.
    if ((safeStorage.getItem(EXAM_DATE_KEY) ?? '') === date) safeStorage.removeItem(PENDING_KEY);
  } finally {
    sending = false;
  }
  if (safeStorage.getItem(PENDING_KEY)) void flushExamDate();
}

/** The student picked (or cleared) the date. */
export function saveExamDate(date: string): void {
  writeLocal(date);
  safeStorage.setItem(PENDING_KEY, '1');
  void flushExamDate();
}

/** After sign-in: send what is waiting, then take the server's date. */
export async function hydrateExamDate(): Promise<void> {
  await flushExamDate();
  if (safeStorage.getItem(PENDING_KEY)) return; // an unsent change must not be overwritten
  const { session_token, device_id } = session();
  if (!session_token) return;
  const { data, error } = await invokeFunction<{ exam_date?: string | null }>('study-sync', {
    action: 'get-exam-date',
    session_token,
    device_id,
  });
  if (error || !data) return;
  const server = isDate(data.exam_date) ? data.exam_date : '';
  const local = safeStorage.getItem(EXAM_DATE_KEY) ?? '';
  if (server) {
    if (server !== local) writeLocal(server);
  } else if (local) {
    // Nothing on the server yet: the date typed before this feature existed goes up.
    safeStorage.setItem(PENDING_KEY, '1');
    void flushExamDate();
  }
}

let started = false;
export function initExamDateSync(): void {
  if (started) return;
  started = true;
  onNetworkChange((online) => {
    if (online) void flushExamDate();
  });
  void flushExamDate();
}

/** Forget the local copy (sign-out / account switch). */
export function clearExamDate(): void {
  safeStorage.removeItem(EXAM_DATE_KEY);
  safeStorage.removeItem(PENDING_KEY);
  window.dispatchEvent(new Event(EXAM_DATE_EVENT));
}

/** The date for screens: updates when it is changed here or pulled from the server. */
export function useExamDate(): string {
  const [date, setDate] = useState(() => safeStorage.getItem(EXAM_DATE_KEY) ?? '');
  useEffect(() => {
    const sync = () => setDate(safeStorage.getItem(EXAM_DATE_KEY) ?? '');
    window.addEventListener(EXAM_DATE_EVENT, sync);
    sync();
    return () => window.removeEventListener(EXAM_DATE_EVENT, sync);
  }, []);
  return date;
}
