// Avtodrom files are fetched ahead of time (while the player is still on the
// practice page or the car menu) and kept on the device in Cache Storage, so
// the game opens at once and, after the first time, works without internet.
// No three.js here: this module is tiny and safe to import from any page.

/** Bump when anything in public/game changes, so devices fetch the new files. */
export const GAME_VERSION = '2026-11-18a';
const CACHE = `avtodrom-${GAME_VERSION}`;
const BASE = `${import.meta.env.BASE_URL}game/`;

const files = new Map<string, Promise<ArrayBuffer>>();
const sizes = new Map<string, { loaded: number; total: number }>();

/** Weak phones get the lighter car model (same rule as the game's quality pick). */
export function lowDevice() {
  const forced = new URLSearchParams(window.location.search).get('q');
  if (forced) return forced === 'low';
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return mem <= 2 || cores <= 4;
}

async function openCache(): Promise<Cache | null> {
  try {
    if (!('caches' in window)) return null;
    // drop older versions once
    void caches.keys().then((keys) => keys.filter((k) => k.startsWith('avtodrom-') && k !== CACHE).forEach((k) => caches.delete(k)));
    return await caches.open(CACHE);
  } catch {
    return null;
  }
}
let cacheP: Promise<Cache | null> | null = null;

async function readStream(url: string, res: Response): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length')) || 0;
  sizes.set(url, { loaded: 0, total });
  if (!res.body) {
    const b = await res.arrayBuffer();
    sizes.set(url, { loaded: b.byteLength, total: b.byteLength });
    return b;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    sizes.set(url, { loaded, total: Math.max(total, loaded) });
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  sizes.set(url, { loaded, total: loaded });
  return out.buffer;
}

/** One game file as bytes: from the device cache if it is there, else the network (then cached). */
export function gameFile(name: string): Promise<ArrayBuffer> {
  const url = BASE + name;
  let p = files.get(url);
  if (p) return p;
  p = (async () => {
    cacheP ??= openCache();
    const cache = await cacheP;
    const hit = cache ? await cache.match(url).catch(() => undefined) : undefined;
    if (hit) return readStream(url, hit);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    if (cache) void cache.put(url, res.clone()).catch(() => {});
    return readStream(url, res);
  })();
  p.catch(() => files.delete(url));
  files.set(url, p);
  return p;
}

export function gameFileOptional(name: string): Promise<ArrayBuffer | null> {
  return gameFile(name).catch(() => null);
}

export const TREE_FILES = ['trees/fir.webp', 'trees/fir_b.webp', 'trees/leafy_b.webp'];

export function gameFileList(carFile: string, carHasLow: boolean) {
  const low = lowDevice() && carHasLow;
  return [
    'autodrome.glb',
    'autodrome.json',
    low ? `${carFile}_low.glb` : `${carFile}.glb`,
    'trees/trees.json',
    ...TREE_FILES,
    'env/sky_1k.hdr',
    'env/sky_bg.jpg',
    'env/sky.json',
    'textures/skid.png',
    'textures/detail_asphalt.jpg',
    'textures/detail_grass.jpg',
    'minimap.jpg',
  ];
}

/** Start downloading everything the game needs (call it early; repeated calls are free). */
export function preloadGame(carFile = 'car_cobalt', carHasLow = true) {
  const list = gameFileList(carFile, carHasLow);
  void gameFileOptional(`${carFile}.json`);
  return Promise.allSettled(list.map((f) => gameFile(f)));
}

/** 0..1 over the files requested so far. */
export function preloadProgress(names: string[]) {
  let loaded = 0;
  let total = 0;
  for (const n of names) {
    const s = sizes.get(BASE + n);
    if (!s) {
      total += 1;
      continue;
    }
    loaded += s.loaded;
    total += Math.max(s.total, s.loaded, 1);
  }
  return total ? loaded / total : 0;
}
