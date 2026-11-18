// Rapier physics: static autodrome colliders + a ray-cast vehicle (real
// suspension, tyre grip, front-wheel drive). Car forward is local -Z.
import type RapierNS from '@dimforge/rapier3d-compat';
import { loadRapier } from './platform';
import * as THREE from 'three';
import { meshTriangles, type AutodromeMeta } from './assets';
import { COBALT, type VehicleProfile } from './vehicles';

export type Gear = 'R' | 'N' | '1' | '2';
export type SurfaceKind = 'ground' | 'curb' | 'island' | 'obstacle';

export interface DriveInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 left .. 1 right
  gear: Gear;
  /** Parking brake on (rear wheels locked). */
  handbrake?: boolean;
  /** Engine running; when off there is no drive force. Default on. */
  engineOn?: boolean;
}

// Handling comes from the vehicle profile (vehicles.ts); the Cobalt is calibrated
// against a 1.2 t car: 0-50 km/h ~6 s, 8 m/s^2 braking.
export const WHEEL_RADIUS = COBALT.radius;

// --- Drift: brake + steer at speed unloads the rear grip so the tail steps out. ---
export const DRIFT_ENABLED = true;
const GRIP_SLIP = 2.2; // normal tyre grip (friction slip)
const GRIP_SIDE = 1.0; // normal lateral stiffness
const DRIFT_REAR_SLIP = 0.32;
const DRIFT_FRONT_SLIP = 1.3; // rear grip while drifting
const DRIFT_REAR_SIDE = 0.2;
const DRIFT_MIN_MS = 2.6; // ~9 km/h
const DRIFT_YAW_RATE = 1.15; // rad/s at full lock while drifting
const SLIDE_TARGET = 0.5; // rad (~29 deg) of slide angle at full lock
const COUNTER_STEER = 1.0; // auto counter-steer per radian of slip angle

export interface Physics {
  world: RapierNS.World;
  vehicle: RapierNS.DynamicRayCastVehicleController;
  chassis: RapierNS.RigidBody;
  surfaceOf(collider: RapierNS.Collider | null): SurfaceKind;
  /** Steps the simulation; returns contacts that happened this step. */
  step(input: DriveInput, dt: number): StepEvents;
  speedKmh(): number;
  steerAngle(): number;
  wheelLocal(i: number, target: THREE.Vector3): THREE.Vector3;
  wheelSpin(i: number): number;
  /** World contact point of a wheel (null when airborne). */
  wheelContact(i: number, target: THREE.Vector3): THREE.Vector3 | null;
  reset(x: number, z: number, heading: number): void;
  dispose(): void;
}

export interface StepEvents {
  wheelOnCurb: boolean;
  wheelOnIsland: boolean;
  bodyHit: boolean;
  /** 0..1 how deep into a drift the car is. */
  drift: number;
  /** Lateral slide speed in m/s (local x). */
  slide: number;
  /** Per wheel 0..1: how hard the tyre is smearing rubber (slide or lock-up). */
  skid: [number, number, number, number];
  onRoad: [boolean, boolean, boolean, boolean];
}

// the physics library is loaded at runtime (site: from a fast public CDN, app: bundled)
let RAPIER!: typeof RapierNS;
let rapierReady: Promise<void> | null = null;
export function initRapier() {
  rapierReady ??= loadRapier().then(async (m) => {
    RAPIER = m;
    await m.init();
  });
  return rapierReady;
}

export function createPhysics(
  staticRoot: THREE.Object3D,
  meta: AutodromeMeta,
  start: { x: number; z: number; heading: number },
  profile: VehicleProfile = COBALT,
): Physics {
  const P = profile;
  const MASS = P.mass;
  // Each wheel at its own hub (front and rear track and tyre size differ).
  const hubs = P.wheels ?? [
    { x: -P.track, z: P.axleFront, r: P.radius },
    { x: P.track, z: P.axleFront, r: P.radius },
    { x: -P.track, z: P.axleRear, r: P.radius },
    { x: P.track, z: P.axleRear, r: P.radius },
  ];
  const REST = P.suspension.rest;
  // connection height keeps the chassis origin at road level at rest
  const WHEELS = hubs.map((h, i) => ({ x: h.x, z: h.z, r: h.r, front: i < 2, conY: h.r + REST - 0.066 }));
  const MAX_STEER = P.maxSteer;
  const ENGINE_FORCE = P.engineForce;
  const BRAKE_FORCE = P.brakeForce;
  const GEAR_LIMIT_KMH = P.gearLimit;
  const GEAR_FORCE = P.gearForce;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const kinds = new Map<number, SurfaceKind>();
  const add = (desc: RapierNS.ColliderDesc, kind: SurfaceKind) => {
    const c = world.createCollider(desc);
    kinds.set(c.handle, kind);
    return c;
  };

  const W = meta.width;
  const D = meta.depth;
  // Flat ground well beyond the fence.
  add(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(W / 2, -0.5, D / 2).setFriction(1.0), 'ground');

  staticRoot.updateMatrixWorld(true);
  staticRoot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const n = mesh.name;
    let kind: SurfaceKind | null = null;
    if (/^(Curb_|FieldKerb|PlatformKerb)/.test(n)) kind = 'curb';
    else if (/^(IslandTop_|Platform$)/.test(n)) kind = n === 'Platform' ? 'curb' : 'island';
    else if (/^Ramp_deck/.test(n)) kind = 'ground';
    else if (/^Ramp_wall/.test(n)) kind = 'obstacle';
    if (kind) {
      const { vertices, indices } = meshTriangles(mesh);
      add(RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(0.9), kind);
    } else if (/^Pavilion/.test(n)) {
      const box = new THREE.Box3().setFromObject(mesh);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      add(RAPIER.ColliderDesc.cuboid(s.x / 2, s.y / 2, s.z / 2).setTranslation(c.x, c.y, c.z), 'obstacle');
    }
  });

  // Fence line around the apron.
  const m = 2.5;
  const wall = (cx: number, cz: number, hx: number, hz: number) =>
    add(RAPIER.ColliderDesc.cuboid(hx, 1.2, hz).setTranslation(cx, 1.2, cz), 'obstacle');
  wall(W / 2, -m - 0.2, W / 2 + m, 0.2);
  wall(W / 2, D + m + 0.2, W / 2 + m, 0.2);
  wall(-m - 0.2, D / 2, 0.2, D / 2 + m);
  wall(W + m + 0.2, D / 2, 0.2, D / 2 + m);

  // Tree trunks on the islands.
  for (const t of meta.trees) {
    if (t.y > 0 && t.k !== 'bush') {
      add(RAPIER.ColliderDesc.cylinder(1.5, 0.18 * t.s).setTranslation(t.x, t.y + 1.5, t.z), 'obstacle');
    }
  }

  // Chassis: lower body + cabin.
  const chassis = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(start.x, 0.05, start.z)
      .setRotation(yawQuat(start.heading))
      .setLinearDamping(0.04)
      .setAngularDamping(0.8)
      .setCanSleep(false)
      .setCcdEnabled(true),
  );
  const body = world.createCollider(
    RAPIER.ColliderDesc.cuboid(P.body.hx, P.body.hy, P.body.hz).setTranslation(0, P.body.y, P.body.z).setMass(MASS).setFriction(0.4)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    chassis,
  );
  const cabin = world.createCollider(
    RAPIER.ColliderDesc.cuboid(P.cabin.hx, P.cabin.hy, P.cabin.hz).setTranslation(0, P.cabin.y, P.cabin.z).setDensity(0).setFriction(0.4)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    chassis,
  );
  const own = new Set([body.handle, cabin.handle]);

  const vehicle = world.createVehicleController(chassis);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;
  WHEELS.forEach((w, i) => {
    vehicle.addWheel({ x: w.x, y: w.conY, z: w.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, w.r);
    vehicle.setWheelSuspensionStiffness(i, P.suspension.stiffness);
    vehicle.setWheelSuspensionCompression(i, 3.2);
    vehicle.setWheelSuspensionRelaxation(i, 3.8);
    vehicle.setWheelMaxSuspensionTravel(i, P.suspension.travel);
    vehicle.setWheelMaxSuspensionForce(i, P.suspension.maxForce);
    vehicle.setWheelFrictionSlip(i, 2.2);
    vehicle.setWheelSideFrictionStiffness(i, 1.0);
  });

  const events = new RAPIER.EventQueue(true);
  let steer = 0;
  let drift = 0;
  const qInv = new THREE.Quaternion();
  const lv = new THREE.Vector3();

  const surfaceOf = (c: RapierNS.Collider | null): SurfaceKind => (c ? kinds.get(c.handle) ?? 'ground' : 'ground');

  return {
    world,
    vehicle,
    chassis,
    surfaceOf,
    step(input, dt) {
      const v = -vehicle.currentVehicleSpeed(); // m/s, + forward
      const kmh = v * 3.6;
      const limit = GEAR_LIMIT_KMH[input.gear];
      const dir = input.gear === 'R' ? -1 : 1;

      // Engine: full pull at low speed, easing off smoothly towards the gear's limit
      // (like a real engine running out of revs, no wall at the top).
      let force = 0;
      const engineOn = input.engineOn !== false;
      if (engineOn && input.gear !== 'N' && input.throttle > 0) {
        const u = Math.max(0, (kmh * dir) / (limit * 1.06));
        const pull = kmh * dir >= limit ? 0 : u < 0.7 ? 1 : Math.max(0, 1 - Math.pow((u - 0.7) / 0.3, 4));
        force = ENGINE_FORCE * GEAR_FORCE[input.gear] * input.throttle * pull * dir;
      }
      let brake = input.brake * BRAKE_FORCE;
      // On a slope (estakada) an idle car rolls back unless the brake or the
      // parking brake holds it; on the flat it settles as before.
      const rotQ = chassis.rotation();
      const pitchUp = 2 * (rotQ.x * rotQ.w + rotQ.y * rotQ.z); // ~sin(pitch)
      const onSlope = Math.abs(pitchUp) > 0.03;
      if (input.throttle === 0 || !engineOn) {
        const hold = onSlope ? 0 : Math.abs(v) < 0.4 ? 6 : 1.2;
        brake = Math.max(brake, input.gear === 'N' || !engineOn ? (onSlope ? 0 : Math.abs(v) < 0.4 ? 6 : 0.4) : hold);
        if (onSlope && input.gear !== 'N' && engineOn && Math.abs(v) > 0.4) brake = Math.max(brake, 0.6);
      }
      const parking = input.handbrake ? BRAKE_FORCE * 0.9 : 0;

      // Velocity in the car's own axes: forward = -z, lateral = x.
      const lin = chassis.linvel();
      const rot = chassis.rotation();
      qInv.set(rot.x, rot.y, rot.z, rot.w).invert();
      lv.set(lin.x, lin.y, lin.z).applyQuaternion(qInv);
      const vForward = -lv.z;
      const vSide = lv.x;
      const speed = Math.hypot(lin.x, lin.z);

      // Drift state: brake + steering at speed -> rear tyres let go.
      const wantsDrift = DRIFT_ENABLED && input.brake > 0.3 && Math.abs(input.steer) > 0.2 && speed > DRIFT_MIN_MS && vForward > 0;
      const k = wantsDrift ? 4.5 : 2.6;
      drift += ((wantsDrift ? 1 : 0) - drift) * Math.min(1, dt * k);
      if (drift < 0.001) drift = 0;
      const slipAngle = Math.atan2(vSide, Math.max(Math.abs(vForward), 1));

      // Auto counter-steer keeps a slide controllable instead of spinning out.
      let steerIn = input.steer;
      if (drift > 0.25 && vForward > 1) steerIn = Math.max(-1, Math.min(1, steerIn + COUNTER_STEER * slipAngle * drift));

      const lock = MAX_STEER / (1 + Math.abs(v) * 0.035);
      const target = -steerIn * lock;
      const rate = (2.6 + drift * 2.4) * dt;
      steer += Math.max(-rate, Math.min(rate, target - steer));

      const rearSlip = GRIP_SLIP + (DRIFT_REAR_SLIP - GRIP_SLIP) * drift;
      const rearSide = GRIP_SIDE + (DRIFT_REAR_SIDE - GRIP_SIDE) * drift;
      for (let i = 0; i < 4; i++) {
        const front = WHEELS[i].front;
        vehicle.setWheelEngineForce(i, front === (P.driven === 'front') ? -force : 0);
        vehicle.setWheelSteering(i, front ? steer : 0);
        // While sliding the fronts keep rolling so the car can still be steered.
        vehicle.setWheelBrake(i, Math.max(brake * (front ? 1 - 0.9 * drift : 1 - 0.88 * drift), front ? 0 : parking));
        if (!front) {
          vehicle.setWheelFrictionSlip(i, rearSlip);
          vehicle.setWheelSideFrictionStiffness(i, rearSide);
        } else {
          vehicle.setWheelFrictionSlip(i, GRIP_SLIP + (DRIFT_FRONT_SLIP - GRIP_SLIP) * drift);
        }
      }
      if (drift > 0.05) {
        // Slide controller: the yaw rate follows the steering, and a PD term holds the slide angle
        // near a target proportional to the steering (so it neither straightens nor spins out).
        const av = chassis.angvel();
        const speedF = Math.min(1, speed / 9);
        const betaTarget = -input.steer * SLIDE_TARGET;
        const yawTarget = Math.max(-2.3, Math.min(2.3, (-input.steer * DRIFT_YAW_RATE + 2.2 * (betaTarget - slipAngle)) * speedF));
        const kk = Math.min(1, dt * 5) * drift;
        chassis.setAngvel({ x: av.x, y: av.y + (yawTarget - av.y) * kk, z: av.z }, true);
      }
      vehicle.updateVehicle(dt);
      world.step(events);

      const out: StepEvents = {
        wheelOnCurb: false,
        wheelOnIsland: false,
        bodyHit: false,
        drift,
        slide: Math.abs(vSide),
        skid: [0, 0, 0, 0],
        onRoad: [false, false, false, false],
      };
      const slideAmt = Math.max(0, Math.min(1, (Math.abs(vSide) - 1.0) / 2.6));
      const lockAmt = input.brake > 0.8 && speed > 3.5 ? 0.55 : 0;
      for (let i = 0; i < 4; i++) {
        if (!vehicle.wheelIsInContact(i)) continue;
        const kind = surfaceOf(vehicle.wheelGroundObject(i));
        if (kind === 'curb') out.wheelOnCurb = true;
        if (kind === 'island') out.wheelOnIsland = true;
        out.onRoad[i] = kind === 'ground';
        out.skid[i] = Math.max(slideAmt * (WHEELS[i].front ? 0.7 : 1), lockAmt * (WHEELS[i].front ? 0.7 : 1));
      }
      events.drainCollisionEvents((h1, h2, started) => {
        if (!started) return;
        const other = own.has(h1) ? h2 : h1;
        const k = kinds.get(other);
        if (k === 'obstacle' || k === 'curb') out.bodyHit = true;
      });
      return out;
    },
    speedKmh() {
      return -vehicle.currentVehicleSpeed() * 3.6;
    },
    steerAngle() {
      return steer;
    },
    wheelLocal(i, target) {
      const w = WHEELS[i];
      const len = vehicle.wheelSuspensionLength(i) ?? REST;
      return target.set(w.x, w.conY - len, w.z);
    },
    wheelSpin(i) {
      return vehicle.wheelRotation(i) ?? 0;
    },
    wheelContact(i, target) {
      if (!vehicle.wheelIsInContact(i)) return null;
      const c = vehicle.wheelContactPoint(i);
      return c ? target.set(c.x, c.y, c.z) : null;
    },
    reset(x, z, heading) {
      chassis.setTranslation({ x, y: 0.4, z }, true);
      chassis.setRotation(yawQuat(heading), true);
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true);
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true);
      steer = 0;
      drift = 0;
    },
    dispose() {
      events.free();
      world.free();
    },
  };
}

/** Heading in plan degrees (0 = +x, -90 = up the plan / -z) -> rotation about Y. */
export function yawQuat(headingDeg: number) {
  // Car forward is -Z (= plan heading -90). Rotate by the difference.
  const yaw = -((headingDeg + 90) * Math.PI) / 180;
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
