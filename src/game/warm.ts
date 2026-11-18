// Start downloading the Avtodrom (code, physics, 3D files) in the background, so the
// game opens at once when the player taps it. Safe to call many times.
let started = false;
export function warmUpAvtodrom() {
  if (started) return;
  started = true;
  void import('./AvtodromPage');
  void import('./GameView');
  void import('./engine/physics').then((m) => m.initRapier()).catch(() => {});
  void import('./engine/preload').then((m) => m.preloadGame());
}
