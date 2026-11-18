// The cars you can drive. Each model is prepared in Blender to the same rig
// contract (blender/prepare_car.py): materials "Paint" / "Glass", nodes
// wheel_fl, wheel_fr, wheel_rl, wheel_rr at the hubs, car forward = -Z,
// origin on the ground between the axles. Sizes below are in metres.
import type { Gear } from './physics';

export type Category = 'B' | 'C';
export type EngineKind = 'petrol4' | 'turbo3' | 'turbo4' | 'diesel4';
export type LampName = 'HeadLamp' | 'TailLamp' | 'ReverseLamp' | 'IndFL' | 'IndFR' | 'IndRL' | 'IndRR';

export interface VehicleProfile {
  id: string;
  name: string;
  category: Category;
  file: string; // public/game/<file>.glb, optional <file>_low.glb
  hasLow: boolean;
  credit: string;
  defaultColor: number | null; // null = keep the model's own paint
  mass: number;
  /** Half track (x, front axle) and half wheelbase (z) of the axles. */
  track: number;
  /** Each wheel's hub in car space (fl, fr, rl, rr) and its radius: front and rear
   *  track / tyre size differ on most cars. Filled from the measured rig. */
  wheels?: { x: number; z: number; r: number }[];
  /** Tyre width (m), for the tyre marks. */
  tyreWidth?: number;
  /** Lamp centres in car space (three.js axes), for the glow. */
  lamps?: Partial<Record<LampName, [number, number, number]>>;
  base: number;
  /** Signed z of the axles (front is negative). */
  axleFront: number;
  axleRear: number;
  radius: number;
  /** Bumper z (front negative, rear positive). */
  bumperFront: number;
  bumperRear: number;
  halfWidth: number;
  /** Body collider: half extents and centre (y up). */
  body: { hx: number; hy: number; hz: number; y: number; z: number };
  cabin: { hx: number; hy: number; hz: number; y: number; z: number };
  maxSteer: number;
  engineForce: number;
  /** Engine sound character (sound.ts). */
  engine: EngineKind;
  driven: 'front' | 'rear';
  gearLimit: Record<Gear, number>;
  gearForce: Record<Gear, number>;
  brakeForce: number;
  /** Driver's eye in car space. */
  eye: [number, number, number];
  mirror: { x: number; y: number; z: number };
  chaseDist: number;
  chaseHeight: number;
  suspension: { rest: number; stiffness: number; travel: number; maxForce: number };
}

/** Every car tops out at 50 km/h in 2nd; how fast it gets there differs (see the
 *  0-50 table printed by scripts/test-accel.ts). */
export const TOP_KMH = 50;
const gears = (first: number, reverse = 15, f2 = 0.62): Pick<VehicleProfile, 'gearLimit' | 'gearForce'> => ({
  gearLimit: { R: reverse, N: 0, '1': first, '2': TOP_KMH },
  gearForce: { R: 0.75, N: 0, '1': 1, '2': f2 },
});

export const COBALT: VehicleProfile = {
  id: 'cobalt',
  name: 'Chevrolet Cobalt',
  category: 'B',
  file: 'car_cobalt',
  hasLow: true,
  credit: 'Chevrolet Cobalt LTZ — uzb_rx7 (Sketchfab, CC BY 4.0)',
  defaultColor: 0xeeeeea,
  mass: 1200,
  track: 0.7,
  base: 1.359,
  axleFront: -1.359,
  axleRear: 1.359,
  radius: 0.322,
  bumperFront: -2.25,
  bumperRear: 2.11,
  halfWidth: 0.86,
  body: { hx: 0.84, hy: 0.3, hz: 2.18, y: 0.62, z: -0.07 },
  cabin: { hx: 0.68, hy: 0.26, hz: 1.0, y: 1.18, z: 0.35 },
  maxSteer: 0.56,
  engineForce: 1500,
  engine: 'petrol4',
  driven: 'front',
  ...gears(26),
  brakeForce: 40,
  eye: [-0.36, 1.24, 0.36],
  mirror: { x: 0.98, y: 1.02, z: -0.42 },
  chaseDist: 6.4,
  chaseHeight: 2.35,
  suspension: { rest: 0.22, stiffness: 34, travel: 0.2, maxForce: 12000 },
};

// Prepared by blender/prepare_car.py: car_<id>.json holds the measured rig
// (wheels, bumpers, size, lamps) and replaces the geometry numbers below; what
// stays from here is the handling.
export const TRACKER: VehicleProfile = {
  ...COBALT,
  id: 'tracker',
  name: 'Chevrolet Tracker',
  file: 'car_tracker',
  credit: '2022 Chevrolet Tracker RS 335T (Sketchfab, CC BY 4.0)',
  defaultColor: 0xeeeeea,
  mass: 1300,
  engineForce: 1800,
  engine: 'turbo3',
  ...gears(28),
  maxSteer: 0.56,
  eye: [-0.37, 1.36, 0.25],
  mirror: { x: 1.0, y: 1.12, z: -0.45 },
  chaseDist: 6.6,
  chaseHeight: 2.5,
};

export const MALIBU: VehicleProfile = {
  ...COBALT,
  id: 'malibu',
  name: 'Chevrolet Malibu',
  file: 'car_malibu',
  credit: 'Chevrolet Malibu 2021 — ItsDiyor (Sketchfab, CC BY 4.0)',
  defaultColor: 0x0d0e10,
  mass: 1450,
  engineForce: 2300,
  engine: 'turbo4',
  ...gears(30),
  maxSteer: 0.54,
  eye: [-0.38, 1.2, 0.3],
  mirror: { x: 1.02, y: 1.0, z: -0.5 },
  chaseDist: 6.8,
};

export const ISUZU: VehicleProfile = {
  ...COBALT,
  id: 'isuzu',
  name: 'Isuzu Elf',
  category: 'C',
  file: 'car_isuzu',
  credit: 'Isuzu Elf series — Romanov13 (Sketchfab, CC BY 4.0)',
  defaultColor: null,
  mass: 4500,
  engineForce: 4800,
  engine: 'diesel4',
  driven: 'rear',
  maxSteer: 0.62,
  gearLimit: { R: 10, N: 0, '1': 20, '2': TOP_KMH },
  gearForce: { R: 0.8, N: 0, '1': 1, '2': 0.6 },
  brakeForce: 110,
  eye: [-0.45, 1.85, -1.95],
  mirror: { x: 1.15, y: 1.7, z: -2.15 },
  chaseDist: 10.5,
  chaseHeight: 3.6,
  suspension: { rest: 0.26, stiffness: 46, travel: 0.22, maxForce: 45000 },
};

export const VEHICLES: VehicleProfile[] = [COBALT, TRACKER, MALIBU, ISUZU];

/** Rig measured by prepare_car.py (wheel hubs, bumpers, width, height). */
export interface CarRigJson {
  wheel_fl: [number, number, number];
  wheel_fr: [number, number, number];
  wheel_rl: [number, number, number];
  wheel_rr: [number, number, number];
  radius: number;
  bumperFront?: number;
  bumperRear?: number;
  halfWidth?: number;
  height?: number;
  tyreWidth?: number;
  lamps?: Partial<Record<LampName, [number, number, number]>>;
  /** Per-wheel radius (old rigs: one radius for all). */
  radii?: [number, number, number, number];
}

/** Apply the measured rig to a profile (keeps the handling numbers). */
export function withRig(p: VehicleProfile, rig: CarRigJson | null): VehicleProfile {
  if (!rig || !rig.wheel_fl) return p;
  const track = Math.abs(rig.wheel_fr[0]);
  const axleFront = rig.wheel_fl[2];
  const axleRear = rig.wheel_rl[2];
  const bumperFront = rig.bumperFront ?? p.bumperFront;
  const bumperRear = rig.bumperRear ?? p.bumperRear;
  const halfWidth = rig.halfWidth ?? p.halfWidth;
  const len = bumperRear - bumperFront;
  const height = rig.height ?? p.body.y * 2 + p.cabin.hy * 2;
  const isTruck = p.category === 'C';
  const hubs = [rig.wheel_fl, rig.wheel_fr, rig.wheel_rl, rig.wheel_rr];
  const wheels = hubs.map((h, i) => ({ x: h[0], z: h[2], r: rig.radii?.[i] ?? (h[1] > 0.05 ? h[1] : rig.radius) }));
  return {
    ...p,
    track,
    wheels,
    tyreWidth: rig.tyreWidth ?? p.tyreWidth,
    lamps: rig.lamps ?? p.lamps,
    axleFront,
    axleRear,
    base: (axleRear - axleFront) / 2,
    radius: rig.radius,
    bumperFront,
    bumperRear,
    halfWidth,
    body: {
      hx: halfWidth - 0.04,
      hy: isTruck ? 0.45 : 0.3,
      hz: len / 2 - 0.08,
      y: rig.radius + (isTruck ? 0.55 : 0.3),
      z: (bumperFront + bumperRear) / 2,
    },
    cabin: isTruck
      ? { hx: halfWidth - 0.08, hy: (height - rig.radius - 1.0) / 2, hz: len / 2 - 0.1, y: rig.radius + 1.0 + (height - rig.radius - 1.0) / 2, z: (bumperFront + bumperRear) / 2 }
      : { hx: halfWidth - 0.18, hy: 0.26, hz: len * 0.23, y: height - 0.3, z: (bumperFront + bumperRear) / 2 + 0.3 },
  };
}
