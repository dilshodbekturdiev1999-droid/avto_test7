// A student's own study state: "My mistakes" and bookmarks.
//
// Mistakes follow one rule: a question is in the list while the LAST answer
// given to it was wrong. Wrong -> it enters, right -> it leaves, wrong again ->
// it comes back. The student cannot delete one by hand.
//
// Stored on the device (safeStorage mirrors to native storage in the app) and,
// once a session exists, synced to the server through ./studySync. Question ids
// are UUIDs and unique across the UZ and RU banks, so the id alone is the key.
import { useSyncExternalStore } from 'react';
import { safeStorage } from '@/lib/safeStorage';

const KEY = 'pdd_study';

export type SavedKind = 'question' | 'cheatsheet' | 'sign';

interface StudyState {
  /** question id -> time of the last wrong answer */
  mistakes: Record<string, number>;
  /** `${kind}:${itemKey}` -> time saved */
  saved: Record<string, number>;
}

let state: StudyState | null = null;
let version = 0;
const listeners = new Set<() => void>();

/** Sync hook: called for every local change, set by studySync. */
type ChangeHandler = (op:
  | { type: 'answer'; questionId: string; correct: boolean }
  | { type: 'save'; kind: SavedKind; key: string; saved: boolean }) => void;
let changeHandler: ChangeHandler | null = null;
export function setStudyChangeHandler(handler: ChangeHandler | null): void {
  changeHandler = handler;
}

function read(): StudyState {
  if (state) return state;
  try {
    const raw = safeStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = {
      mistakes: parsed && typeof parsed.mistakes === 'object' && parsed.mistakes ? parsed.mistakes : {},
      saved: parsed && typeof parsed.saved === 'object' && parsed.saved ? parsed.saved : {},
    };
  } catch {
    state = { mistakes: {}, saved: {} };
  }
  return state;
}

function commit(): void {
  try {
    safeStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked -- the in-memory copy still works this session */
  }
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call in any component that reads study state during render. */
export function useStudyVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Record one answer. The last answer to a question decides whether it is a mistake. */
export function recordAnswer(questionId: string, correct: boolean): void {
  const s = read();
  const wasMistake = questionId in s.mistakes;
  if (correct) {
    if (!wasMistake) return changeHandler?.({ type: 'answer', questionId, correct });
    delete s.mistakes[questionId];
  } else {
    s.mistakes[questionId] = Date.now();
  }
  commit();
  changeHandler?.({ type: 'answer', questionId, correct });
}

/** Mistake ids, newest first. */
export function getMistakeIds(): string[] {
  const m = read().mistakes;
  return Object.keys(m).sort((a, b) => m[b] - m[a]);
}

export function isMistake(questionId: string): boolean {
  return questionId in read().mistakes;
}

const savedKey = (kind: SavedKind, key: string) => `${kind}:${key}`;

export function isSaved(kind: SavedKind, key: string): boolean {
  return savedKey(kind, key) in read().saved;
}

export function toggleSaved(kind: SavedKind, key: string): boolean {
  const s = read();
  const k = savedKey(kind, key);
  const nowSaved = !(k in s.saved);
  if (nowSaved) s.saved[k] = Date.now();
  else delete s.saved[k];
  commit();
  changeHandler?.({ type: 'save', kind, key, saved: nowSaved });
  return nowSaved;
}

/** Saved item keys of one kind, newest first. */
export function getSavedKeys(kind: SavedKind): string[] {
  const s = read().saved;
  const prefix = `${kind}:`;
  return Object.keys(s)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => s[b] - s[a])
    .map((k) => k.slice(prefix.length));
}

export function getSavedCount(): number {
  return Object.keys(read().saved).length;
}

/** Replace the local copy with what the server holds (after login). */
export function replaceStudyState(next: { mistakes: Record<string, number>; saved: Record<string, number> }): void {
  state = { mistakes: { ...next.mistakes }, saved: { ...next.saved } };
  commit();
}

/** Forget everything on this device (logout). */
export function clearStudyState(): void {
  state = { mistakes: {}, saved: {} };
  commit();
}

export function getStudySnapshot(): StudyState {
  const s = read();
  return { mistakes: { ...s.mistakes }, saved: { ...s.saved } };
}
