// Phone-only bits that differ between the app and the site (this is the SITE copy).
// Site: browser APIs — fullscreen + screen orientation lock where the browser allows it
// (Android Chrome); elsewhere the game shows its "rotate the phone" screen.

/** App: game files are inside the APK (full-detail cars). Site: downloaded, so lighter ones. */
export const ASSETS_LOCAL = false;

type RapierModule = typeof import('@dimforge/rapier3d-compat');
const RAPIER_CDN = 'https://unpkg.com/@dimforge/rapier3d-compat@0.21.0/dist/rapier.mjs';

/** Physics library: from a fast public CDN (cached by the browser for a year), bundled copy if that fails. */
export async function loadRapier(): Promise<RapierModule['default']> {
  try {
    const m = (await import(/* @vite-ignore */ RAPIER_CDN)) as RapierModule;
    return m.default ?? (m as unknown as RapierModule['default']);
  } catch {
    return (await import('@dimforge/rapier3d-compat')).default;
  }
}

/** Short vibration on a penalty. */
export function buzz() {
  try {
    navigator.vibrate?.(40);
  } catch {
    /* not supported */
  }
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** The game is played in landscape only. */
export async function lockLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    /* fullscreen refused */
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
  } catch {
    /* lock refused (iPhone, desktop) */
  }
}

export async function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}
