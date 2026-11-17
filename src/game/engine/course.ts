// Where the exam exercises are on the autodrome. Numbers are plan pixels of
// Desktop\avtodrom\IMG_2019.JPG (the same ones blender/trace_plan.py and
// build_autodrome.py use); they are turned into metres with the plan scale
// stored in autodrome.json. World x = plan x, world z = plan y (down the plan).
import type { AutodromeMeta } from './assets';
import type { Category } from './vehicles';

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Course {
  /** Start road and the start line (cars drive north, -z). */
  start: Rect;
  startLine: number; // z
  /** Exercise 2: zebra stop line on the start road (northbound). */
  zebra: Rect;
  zebraLine: number;
  /** Exercise 1: estakada (northbound climb). */
  ramp: Rect;
  rampLine: number;
  rampTopS: number;
  rampFootS: number;
  /** Exercise 3 and 5: yellow-line corridors with a 2 minute limit. */
  turns90: Rect;
  snake: Rect;
  /** Exercise 4: intersection box with traffic lights; approaches by side. */
  cross: Rect;
  /** Exercise 6: boxes (reverse in, rear wheels on the line). Line is a z. */
  box: Record<Category, { rect: Rect; line: number }>;
  /** Exercise 7: railway crossing, westbound stop line (x). */
  rail: Rect;
  railLine: number;
  /** Exercise 8: acceleration lane (southbound). */
  accel: Rect;
  /** Emergency stop stretch after the acceleration lane. */
  emergency: Rect;
  /** Exercise 9: parallel parking (right wheels on the line). Line is an x. */
  parallel: Record<Category, { rect: Rect; line: number }>;
  /** Finish line (southbound), z. */
  finish: Rect;
  finishLine: number;
  /** Island outlines in metres, for the yellow-line checks. */
  islands: [number, number][][];
  yellowZones: Rect[];
  /** Painted edge line: centre offset from the kerb and width (m). */
  edgeOff: number;
  edgeW: number;
}

export function buildCourse(meta: AutodromeMeta): Course {
  const S = meta.plan?.scale ?? 0.22;
  const [ox, oy] = meta.plan?.origin ?? [57, 122];
  const mx = (px: number) => (px - ox) * S;
  const mz = (py: number) => (py - oy) * S;
  const R = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x0: mx(x0), z0: mz(y0), x1: mx(x1), z1: mz(y1) });
  const ramp = meta.ramp;
  return {
    start: R(578, 556, 642, 680),
    startLine: mz(556),
    zebra: R(578, 476, 642, 600),
    zebraLine: mz(520),
    ramp: ramp ? { x0: ramp.x0, z0: ramp.foot_n, x1: ramp.x1, z1: ramp.foot_s } : R(584, 225, 632, 465),
    rampLine: ramp ? ramp.line : mz(430),
    rampTopS: ramp ? ramp.top_s : mz(390),
    rampFootS: ramp ? ramp.foot_s : mz(465),
    turns90: R(398, 196, 552, 486),
    snake: R(140, 196, 346, 468),
    cross: R(305, 455, 370, 523),
    box: {
      C: { rect: R(219, 542, 254, 592), line: mz(543 + 1.4 / S) },
      B: { rect: R(178, 662, 213, 713), line: mz(711.7 - 1.4 / S) },
    },
    rail: R(140, 122, 245, 165),
    railLine: mx(197),
    accel: R(57, 290, 118, 505),
    emergency: R(57, 515, 118, 640),
    parallel: {
      B: { rect: R(420, 562, 449, 634), line: mx(421.7 + 0.9 / S) },
      C: { rect: R(388, 669, 419, 741), line: mx(416.7 - 0.9 / S) },
    },
    finish: R(440, 640, 508, 760),
    finishLine: mz(695),
    islands: meta.islands,
    yellowZones: [R(120, 150, 320, 470), R(330, 150, 580, 470), R(90, 500, 330, 790), R(375, 520, 470, 798)],
    edgeOff: 0.45,
    edgeW: 0.16,
  };
}

export const inRect = (r: Rect, x: number, z: number, pad = 0) =>
  x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad;

/** Distance from a point to the closest island outline (0 inside an island). */
export function distToIslands(islands: [number, number][][], x: number, z: number): number {
  let best = 1e9;
  for (const poly of islands) {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, az] = poly[j];
      const [bx, bz] = poly[i];
      if ((az > z) !== (bz > z) && x < ax + ((z - az) * (bx - ax)) / (bz - az)) inside = !inside;
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / Math.max(dx * dx + dz * dz, 1e-9)));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) best = d;
    }
    if (inside) return 0;
  }
  return best;
}
