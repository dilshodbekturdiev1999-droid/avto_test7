// Traffic lights of the exam intersection (exercise 4), Uzbek sequence:
// green -> green blinking 3 s -> yellow 3 s -> red ... red + yellow 1.5 s -> green.
// North-south and east-west take turns with a 1 s all-red between them.
// Like a real junction with a vehicle detector, the light sees the student's car:
// when it waits on red, the cross direction ends its green early (after its
// minimum), so nobody waits long; a car about to cross on green keeps its green a bit.
import * as THREE from 'three';
import type { Approach, Light } from './exam';
import { onIsland, type Rect } from './course';

/** What a signal head shows (finer than the exam's red / yellow / green). */
export type Aspect = 'green' | 'greenBlink' | 'yellow' | 'red' | 'redYellow';

const MIN_GREEN = 4;
const GREEN = 12; // without a car waiting
const MAX_GREEN = 20;
const BLINK = 3;
const YELLOW = 3;
const ALL_RED = 1;
const RED_YELLOW = 1.5;

type Axis = 'NS' | 'EW';
type Phase = 'green' | 'blink' | 'yellow' | 'allRed' | 'redYellow';
const axisOf = (a: Approach): Axis => (a === 'N' || a === 'S' ? 'NS' : 'EW');

export interface LightController {
  /** Advance the lights; `car` is where the student's car is (plan x/z) and its heading vector. */
  update(dt: number, car: { x: number; z: number; dx: number; dz: number } | null): void;
  /** For the exam rules: blinking green counts as green, red + yellow as red. */
  light(a: Approach): Light;
  aspect(a: Approach): Aspect;
  /** Blinking green: lamp on in this half second. */
  blinkOn(): boolean;
  reset(): void;
}

export function createLightController(box: Rect): LightController {
  let axis: Axis = 'NS'; // the axis that has (or is about to get) right of way
  let phase: Phase = 'green';
  let t = 0;

  /** Which approach the car is driving up to, and how far it is from the stop line. */
  const approaching = (c: { x: number; z: number; dx: number; dz: number }): { a: Approach; d: number } | null => {
    const m = 3;
    if (c.x > box.x0 - m && c.x < box.x1 + m) {
      if (c.z < box.z0 && c.dz > 0.3) return { a: 'N', d: box.z0 - c.z };
      if (c.z > box.z1 && c.dz < -0.3) return { a: 'S', d: c.z - box.z1 };
    }
    if (c.z > box.z0 - m && c.z < box.z1 + m) {
      if (c.x < box.x0 && c.dx > 0.3) return { a: 'W', d: box.x0 - c.x };
      if (c.x > box.x1 && c.dx < -0.3) return { a: 'E', d: c.x - box.x1 };
    }
    return null;
  };

  const aspectFor = (a: Approach): Aspect => {
    const mine = axisOf(a) === axis;
    if (phase === 'redYellow') return mine ? 'redYellow' : 'red';
    if (!mine || phase === 'allRed') return 'red';
    return phase === 'green' ? 'green' : phase === 'blink' ? 'greenBlink' : 'yellow';
  };

  return {
    update(dt, car) {
      t += dt;
      const near = car ? approaching(car) : null;
      const waitingOnRed = !!near && near.d < 40 && axisOf(near.a) !== axis;
      const comingOnGreen = !!near && near.d < 25 && axisOf(near.a) === axis;
      switch (phase) {
        case 'green': {
          const end = waitingOnRed ? MIN_GREEN : comingOnGreen ? MAX_GREEN : GREEN;
          if (t >= end) {
            phase = 'blink';
            t = 0;
          }
          break;
        }
        case 'blink':
          if (t >= BLINK) {
            phase = 'yellow';
            t = 0;
          }
          break;
        case 'yellow':
          if (t >= YELLOW) {
            phase = 'allRed';
            t = 0;
          }
          break;
        case 'allRed':
          if (t >= ALL_RED) {
            axis = axis === 'NS' ? 'EW' : 'NS';
            phase = 'redYellow';
            t = 0;
          }
          break;
        case 'redYellow':
          if (t >= RED_YELLOW) {
            phase = 'green';
            t = 0;
          }
          break;
      }
    },
    blinkOn() {
      return phase !== 'blink' || t % 1 < 0.5;
    },
    light(a) {
      const s = aspectFor(a);
      return s === 'green' || s === 'greenBlink' ? 'green' : s === 'yellow' ? 'yellow' : 'red';
    },
    aspect: aspectFor,
    reset() {
      axis = 'NS';
      phase = 'green';
      t = 0;
    },
  };
}

// ---------------------------------------------------------------- 3D heads

function lensTexture(): THREE.CanvasTexture {
  // LED lens: fine dot pattern under a soft bright centre
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const rad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  rad.addColorStop(0, 'rgb(255,255,255)');
  rad.addColorStop(0.7, 'rgb(225,225,225)');
  rad.addColorStop(1, 'rgb(150,150,150)');
  g.fillStyle = rad;
  g.fillRect(0, 0, n, n);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 4; y < n; y += 8) for (let x = 4 + ((y / 8) % 2) * 4; x < n; x += 8) {
    g.beginPath();
    g.arc(x, y, 1.6, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function buildTrafficLights(scene: THREE.Scene, box: Rect, ctl: LightController, islands: [number, number][][] = []) {
  const root = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.38 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.2, roughness: 0.55 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.7 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const lens = lensTexture();
  const glowTex = glowTexture();
  const COLORS = { red: 0xff2a14, yellow: 0xffb100, green: 0x14e07a };
  const OFF = { red: 0x2a0a07, yellow: 0x2a1d05, green: 0x062616 };
  const heads: { a: Approach; lamps: Record<'red' | 'yellow' | 'green', { mat: THREE.MeshBasicMaterial; glow: THREE.Sprite }> }[] = [];

  // Signals stand on the driver's right, just before the box, facing the approach.
  const place: { a: Approach; x: number; z: number; yaw: number }[] = [
    { a: 'N', x: box.x0 - 1.2, z: box.z0 - 1.6, yaw: Math.PI },
    { a: 'S', x: box.x1 + 1.2, z: box.z1 + 1.6, yaw: 0 },
    { a: 'W', x: box.x0 - 1.6, z: box.z1 + 1.2, yaw: -Math.PI / 2 },
    { a: 'E', x: box.x1 + 1.6, z: box.z0 - 1.2, yaw: Math.PI / 2 },
  ];
  const poleGeo = new THREE.CylinderGeometry(0.055, 0.065, 3.2, 14);
  const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.12, 16);
  const housingGeo = new THREE.BoxGeometry(0.3, 0.3, 0.22);
  const boardGeo = new THREE.BoxGeometry(0.52, 1.12, 0.02);
  const rimGeo = new THREE.BoxGeometry(0.56, 1.16, 0.015);
  // open half-tube; thetaStart PI/2 + rotation.x PI/2 puts the shell ABOVE the lens (a sun hood)
  const visorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 18, 1, true, Math.PI / 2, Math.PI);
  const discGeo = new THREE.CircleGeometry(0.105, 28);
  const ringGeo = new THREE.TorusGeometry(0.112, 0.012, 6, 28);
  for (const p of place) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, poleMat);
    base.position.y = 0.06;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(base, pole);
    const head = new THREE.Group();
    head.position.set(0, 2.95, 0.12);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.z = -0.135;
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.z = -0.125;
    head.add(rim, board);
    const lamps = {} as (typeof heads)[number]['lamps'];
    (['red', 'yellow', 'green'] as const).forEach((c, i) => {
      const y = 0.34 - i * 0.34;
      const h = new THREE.Mesh(housingGeo, darkMat);
      h.position.set(0, y, 0);
      h.castShadow = true;
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.rotation.x = Math.PI / 2;
      visor.position.set(0, y, 0.22);
      const ring = new THREE.Mesh(ringGeo, darkMat);
      ring.position.set(0, y, 0.112);
      const mat = new THREE.MeshBasicMaterial({ color: OFF[c], map: lens, toneMapped: false });
      const disc = new THREE.Mesh(discGeo, mat);
      disc.position.set(0, y, 0.113);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: COLORS[c], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      glow.position.set(0, y, 0.2);
      glow.scale.setScalar(0.75);
      glow.visible = false;
      head.add(h, visor, ring, disc, glow);
      lamps[c] = { mat, glow };
    });
    g.add(head);
    // on the corner island, never on the carriageway or the kerb
    const spot = islands.length ? onIsland(islands, p.x, p.z, 0.9) : p;
    g.position.set(spot.x, 0.15, spot.z);
    g.rotation.y = p.yaw;
    root.add(g);
    heads.push({ a: p.a, lamps });
  }
  scene.add(root);
  const on = new THREE.Color();
  return {
    update() {
      const blinkOn = ctl.blinkOn();
      for (const h of heads) {
        const s = ctl.aspect(h.a);
        const lit = {
          red: s === 'red' || s === 'redYellow',
          yellow: s === 'yellow' || s === 'redYellow',
          green: s === 'green' || (s === 'greenBlink' && blinkOn),
        };
        for (const c of ['red', 'yellow', 'green'] as const) {
          const L = h.lamps[c];
          L.mat.color.copy(on.setHex(lit[c] ? COLORS[c] : OFF[c])).multiplyScalar(lit[c] ? 1.5 : 1);
          L.glow.visible = lit[c];
        }
      }
    },
  };
}
