// Traffic lights of the exam intersection (exercise 4). North-south and
// east-west take turns: green 15 s, yellow 3 s, then red while the other
// direction goes.
import * as THREE from 'three';
import type { Approach, Light } from './exam';
import type { Rect } from './course';

const CYCLE = 36;

export function lightAt(t: number, a: Approach): Light {
  const ph = ((t % CYCLE) + CYCLE) % CYCLE;
  const ns = ph < 15 ? 'green' : ph < 18 ? 'yellow' : 'red';
  const ew = ph < 18 ? 'red' : ph < 33 ? 'green' : 'yellow';
  return a === 'N' || a === 'S' ? ns : ew;
}

export function buildTrafficLights(scene: THREE.Scene, box: Rect) {
  const root = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.45 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 });
  const colors: Record<Light, number> = { red: 0xff2a1a, yellow: 0xffb000, green: 0x18e05a };
  const heads: { a: Approach; lamps: Record<Light, THREE.MeshBasicMaterial> }[] = [];
  // Light stands on the driver's right, just before the box, facing the approach.
  const place: { a: Approach; x: number; z: number; yaw: number }[] = [
    { a: 'N', x: box.x0 - 1.2, z: box.z0 - 1.6, yaw: Math.PI },
    { a: 'S', x: box.x1 + 1.2, z: box.z1 + 1.6, yaw: 0 },
    { a: 'W', x: box.x0 - 1.6, z: box.z1 + 1.2, yaw: -Math.PI / 2 },
    { a: 'E', x: box.x1 + 1.6, z: box.z0 - 1.2, yaw: Math.PI / 2 },
  ];
  const disc = new THREE.CircleGeometry(0.13, 20);
  for (const p of place) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 10), poleMat);
    pole.position.y = 1.5;
    pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.26), headMat);
    head.position.y = 3.2;
    head.castShadow = true;
    g.add(head);
    const lamps = {} as Record<Light, THREE.MeshBasicMaterial>;
    (['red', 'yellow', 'green'] as Light[]).forEach((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: colors[c], toneMapped: false });
      const d = new THREE.Mesh(disc, m);
      d.position.set(0, 3.53 - i * 0.33, 0.135);
      g.add(d);
      // visor
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16, 1, true, 0, Math.PI), headMat);
      v.rotation.set(Math.PI / 2, 0, 0);
      v.position.set(0, 3.53 - i * 0.33, 0.2);
      g.add(v);
      lamps[c] = m;
    });
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;
    root.add(g);
    heads.push({ a: p.a, lamps });
  }
  scene.add(root);
  const dim = 0.12;
  return {
    update(t: number) {
      for (const h of heads) {
        const on = lightAt(t, h.a);
        for (const c of ['red', 'yellow', 'green'] as Light[]) {
          h.lamps[c].color.setHex(colors[c]).multiplyScalar(c === on ? 1.6 : dim);
        }
      }
    },
  };
}
