// Connectivity on the website: the browser's own online/offline signal.
// (The app has a native version of this file with the same exports.)
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
const listeners = new Set<(online: boolean) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('offline', () => {
    online = false;
    listeners.forEach((l) => l(false));
  });
}

export function isOnline(): boolean {
  return online;
}

export function onNetworkChange(listener: (online: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
