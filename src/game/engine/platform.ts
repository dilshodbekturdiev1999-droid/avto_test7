// Phone-only bits that differ between the app and the site (this is the SITE copy).
// Site: browser APIs — fullscreen + screen orientation lock where the browser allows it
// (Android Chrome); elsewhere the game shows its "rotate the phone" screen.

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
