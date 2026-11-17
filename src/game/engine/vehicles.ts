// The cars you can drive. Each model is prepared in Blender to the same rig
// contract (blender/prepare_car.py): materials "Paint" / "Glass", nodes
// wheel_fl, wheel_fr, wheel_rl, wheel_rr at the hubs, car forward = -Z,
// origin on the ground between the axles. Sizes below are in metres.
import type { Gear } from './physics';

export type Category = 'B' | 'C';

export interface VehicleProfile {
  id: string;
  name: string;
  category: Category;
  file: string; // public/game/<file>.glb, optional <file>_low.glb
  hasLow: boolean;
  credit: string;
  defaultColor: number | null; // null = keep the model's own paint
  mass: number;
  /** Half track (x) and half wheelbase (z) of the axles. */
  track: number;
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

const CAR_GEARS = {
  gearLimit: { R: 15, N: 0, '1': 26, '2': 55 } as Record<Gear, number>,
  gearForce: { R: 0.75, N: 0, '1': 1, '2': 0.62 } as Record<Gear, number>,
};

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
  engineForce: 2200,
  driven: 'front',
  ...CAR_GEARS,
  brakeForce: 40,
  eye: [-0.36, 1.24, 0.36],
  mirror: { x: 0.98, y: 1.02, z: -0.42 },
  chaseDist: 6.4,
  chaseHeight: 2.35,
  suspension: { rest: 0.22, stiffness: 34, travel: 0.2, maxForce: 12000 },
};

/** Cars prepared by prepare_car.py write their measured rig into car_<id>.json;
 *  these are the fallbacks and the handling numbers. */
export const VEHICLES: VehicleProfile[] = [COBALT];

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
  return {
    ...p,
    track,
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
