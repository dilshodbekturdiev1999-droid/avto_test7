// Tyre marks and smoke. Marks are strips laid on the asphalt behind each
// sliding wheel (one ring-buffer mesh, one draw call, fading with age); smoke is
// a small pool of soft sprites thrown up by sliding rear tyres.
import * as THREE from 'three';

const MAX_SEGMENTS = 1800;
const LIFE = 40; // seconds a mark stays visible (fades over the last third)
const STEP = 0.14; // metres between mark segments
const HALF_WIDTH = 0.11;

const VERT = /* glsl */ `
attribute float birth;
attribute float strength;
uniform float uTime;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  float age = uTime - birth;
  float fade = 1.0 - smoothstep(${(LIFE * 0.6).toFixed(1)}, ${LIFE.toFixed(1)}, age);
  vA = strength * fade * step(0.0, age);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying float vA;
void main() {
  float a = texture2D(map, vUv).a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.02), a * 0.92);
}`;

export interface Skids {
  update(dt: number, time: number, wheels: { pos: THREE.Vector3 | null; strength: number; smoke: boolean }[], driftAmt: number, speed: number): void;
  dispose(): void;
}

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(235,235,235,0.55)');
  grad.addColorStop(0.5, 'rgba(225,225,225,0.22)');
  grad.addColorStop(1, 'rgba(220,220,220,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSkids(scene: THREE.Scene, skidTexture: THREE.Texture, smokeEnabled: boolean): Skids {
  // ---- marks ----
  const pos = new Float32Array(MAX_SEGMENTS * 4 * 3);
  const uv = new Float32Array(MAX_SEGMENTS * 4 * 2);
  const birth = new Float32Array(MAX_SEGMENTS * 4);
  const strength = new Float32Array(MAX_SEGMENTS * 4);
  const index = new Uint32Array(MAX_SEGMENTS * 6);
  for (let i = 0; i < MAX_SEGMENTS; i++) {
    const v = i * 4;
    index.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
    uv.set([0, 0, 0, 1, 1, 0, 1, 1], i * 8);
    birth.fill(1e9, i * 4, i * 4 + 4); // not yet born
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('birth', new THREE.BufferAttribute(birth, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('strength', new THREE.BufferAttribute(strength, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { map: { value: skidTexture }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const marks = new THREE.Mesh(geo, mat);
  marks.frustumCulled = false;
  marks.renderOrder = 0.5;
  scene.add(marks);

  let cursor = 0;
  const last: (THREE.Vector3 | null)[] = [null, null, null, null];
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const prevEdge: (THREE.Vector3[] | null)[] = [null, null, null, null];

  const lay = (w: number, p: THREE.Vector3, str: number, time: number) => {
    const prev = last[w];
    if (!prev) {
      last[w] = p.clone();
      prevEdge[w] = null;
      return;
    }
    dir.subVectors(p, prev);
    dir.y = 0;
    const len = dir.length();
    if (len < STEP) return;
    dir.divideScalar(len);
    side.set(-dir.z, 0, dir.x).multiplyScalar(HALF_WIDTH);
    const a0 = prevEdge[w]?.[0] ?? new THREE.Vector3().copy(prev).sub(side);
    const a1 = prevEdge[w]?.[1] ?? new THREE.Vector3().copy(prev).add(side);
    const b0 = new THREE.Vector3().copy(p).sub(side);
    const b1 = new THREE.Vector3().copy(p).add(side);
    const i = cursor;
    cursor = (cursor + 1) % MAX_SEGMENTS;
    const y = 0.016;
    pos.set([a0.x, y, a0.z, a1.x, y, a1.z, b0.x, y, b0.z, b1.x, y, b1.z], i * 12);
    for (let k = 0; k < 4; k++) {
      birth[i * 4 + k] = time;
      strength[i * 4 + k] = str * (k < 2 ? 0.8 : 1); // ramps up into the slide
    }
    prevEdge[w] = [b0, b1];
    last[w] = p.clone();
    const gp = geo.getAttribute('position') as THREE.BufferAttribute;
    gp.needsUpdate = true;
    (geo.getAttribute('birth') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('strength') as THREE.BufferAttribute).needsUpdate = true;
  };

  // ---- smoke ----
  const N = smokeEnabled ? 70 : 0;
  const sPos = new Float32Array(N * 3);
  const sVel = new Float32Array(N * 3);
  const sLife = new Float32Array(N).fill(0);
  const sMax = new Float32Array(N).fill(1);
  const sSize = new Float32Array(N);
  const sAlpha = new Float32Array(N);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  sGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: smokeTexture() }, scale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha; varying float vAlpha; uniform float scale;
      void main() {
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / max(-mv.z, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying float vAlpha;
      void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vAlpha); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true,
    depthWrite: false,
  });
  const smoke = new THREE.Points(sGeo, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 3;
  if (N > 0) scene.add(smoke);
  let sCursor = 0;
  let sTimer = 0;

  const spawn = (p: THREE.Vector3, vx: number, vz: number) => {
    const i = sCursor;
    sCursor = (sCursor + 1) % N;
    sPos.set([p.x + (Math.random() - 0.5) * 0.3, p.y + 0.15, p.z + (Math.random() - 0.5) * 0.3], i * 3);
    sVel.set([vx * 0.25 + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, vz * 0.25 + (Math.random() - 0.5) * 0.8], i * 3);
    sMax[i] = 1.1 + Math.random() * 0.8;
    sLife[i] = sMax[i];
    sSize[i] = 0.5;
  };

  return {
    update(dt, time, wheels, driftAmt, speed) {
      mat.uniforms.uTime.value = time;
      wheels.forEach((w, i) => {
        if (w.pos && w.strength > 0.25) lay(i, w.pos, Math.min(1, w.strength), time);
        else {
          last[i] = null;
          prevEdge[i] = null;
        }
      });
      if (N > 0) {
        sTimer += dt;
        const rate = 0.03;
        while (sTimer > rate) {
          sTimer -= rate;
          wheels.forEach((w, i) => {
            if (w.smoke && w.pos && w.strength > 0.45 && driftAmt > 0.15 && i >= 2) spawn(w.pos, 0, 0);
          });
        }
        for (let i = 0; i < N; i++) {
          if (sLife[i] <= 0) {
            sAlpha[i] = 0;
            continue;
          }
          sLife[i] -= dt;
          sPos[i * 3] += sVel[i * 3] * dt;
          sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt;
          sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
          const t = 1 - sLife[i] / sMax[i];
          sSize[i] = 0.6 + t * 2.6;
          sAlpha[i] = Math.min(1, speed / 6) * (1 - t) * Math.min(1, t * 6) * 0.65;
        }
        (sGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
        (sGeo.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
        (sGeo.getAttribute('alpha') as THREE.BufferAttribute).needsUpdate = true;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      sGeo.dispose();
      smokeMat.dispose();
      scene.remove(marks, smoke);
    },
  };
}
