// Shared 3D toolkit for the Prava On celebration scenes (v2).
// Everything is a pure function of time t (seconds), so HyperFrames can seek any frame
// and the app can later play the same scenes live from requestAnimationFrame.
// @ts-nocheck
/* eslint-disable */
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const W = 1080, H = 1920;

// ---------------------------------------------------------------- math
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, x) => a + (b - a) * x;
export const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x) => x * x * x;
export const easeOutQuint = (x) => 1 - Math.pow(1 - x, 5);
export const easeOutBack = (x, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
// damped spring from 0 to 1: overshoots and settles, like a real needle or a dropped object
export const spring = (x, k = 6, f = 1.6) => (x <= 0 ? 0 : 1 - Math.exp(-k * x) * Math.cos(2 * Math.PI * f * x));
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// position of a body thrown with velocity v under gravity g and air drag k (closed form)
export function ballistic(out, p0, v, g, k, t) {
  const e = (1 - Math.exp(-k * t)) / k;
  out.set(
    p0.x + v.x * e + (g.x / k) * (t - e),
    p0.y + v.y * e + (g.y / k) * (t - e),
    p0.z + v.z * e + (g.z / k) * (t - e),
  );
  return out;
}

// ---------------------------------------------------------------- stage
const BG_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const BG_FRAG = `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform vec2 uGlowPos; uniform float uGlowSize; uniform float uGlowStrength; uniform float uFlash; uniform vec3 uFlashColor;
varying vec2 vUv;
void main(){
  vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
  vec2 d = (vUv - uGlowPos) * vec2(1.0, 1.7778);
  c += uGlow * uGlowStrength * exp(-dot(d, d) / (uGlowSize * uGlowSize));
  c += uFlashColor * uFlash;
  gl_FragColor = vec4(c, 1.0);
}`;

const GRADE_FRAG = `
uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; uniform float uAberration;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 37.0) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5;
  float r = dot(c, c);
  vec2 off = c * uAberration * r;
  vec3 col;
  col.r = texture2D(tDiffuse, vUv + off).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv - off).b;
  col *= 1.0 - uVignette * smoothstep(0.08, 0.62, r);
  col += (h(vUv * vec2(1080.0, 1920.0)) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createStage(opts = {}) {
  const canvas = opts.canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  const q = opts.quality ?? 1;
  renderer.setPixelRatio(q);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (opts.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = opts.envIntensity ?? 1.0;

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 32, W / H, 0.1, 200);
  camera.position.set(0, 0, 10);
  scene.add(camera);

  // full-screen background (gradient + soft glow + flash), drawn behind everything
  const bgUniforms = {
    uTop: { value: new THREE.Color(opts.top ?? '#0b1638') },
    uBottom: { value: new THREE.Color(opts.bottom ?? '#03060f') },
    uGlow: { value: new THREE.Color(opts.glow ?? '#2a4bff') },
    uGlowPos: { value: new THREE.Vector2(...(opts.glowPos ?? [0.5, 0.6])) },
    uGlowSize: { value: opts.glowSize ?? 0.45 },
    uGlowStrength: { value: opts.glowStrength ?? 0.35 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(opts.flashColor ?? '#ffffff') },
  };
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: bgUniforms, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -1000;
  scene.add(bg);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W * q, H * q, { type: THREE.HalfFloatType, samples: q > 0.75 ? 4 : 0 }));
  composer.setPixelRatio(q);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2((W * q) / 2, (H * q) / 2), opts.bloomStrength ?? 0.9, opts.bloomRadius ?? 0.55, opts.bloomThreshold ?? 0.82);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uGrain: { value: opts.grain ?? 0.03 },
      uVignette: { value: opts.vignette ?? 0.55 },
      uAberration: { value: opts.aberration ?? 0.012 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: GRADE_FRAG,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  return {
    THREE, renderer, scene, camera, bloom, bgUniforms, grade,
    dispose() { composer.dispose?.(); renderer.dispose(); pmrem.dispose(); },
    quality: q,
    render(t) {
      grade.uniforms.uTime.value = Math.floor(t * 30) / 30;
      composer.render();
    },
  };
}

// pixels per world unit at a given distance from the camera
export function pxPerUnit(camera, dist) {
  return H / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

// project a world point to screen pixels (for placing HTML text over 3D)
export function toScreen(camera, v) {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H };
}

// ---------------------------------------------------------------- glowing particles (sparks, embers, fireworks, dust)
const SPARK_VERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor; varying float vAlpha;
void main(){
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = exp(-d * d * 9.0);
  float halo = exp(-d * d * 2.2) * 0.35;
  float a = (core + halo) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

export class Sparks {
  constructor(stage, capacity, intensity = 1) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const scale = (H * (stage.quality ?? 1)) / (2 * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: scale } },
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g; this.cap = capacity; this.n = 0; this.intensity = intensity;
    stage.scene.add(this.points);
  }
  begin() { this.n = 0; }
  push(x, y, z, color, size, alpha) {
    if (this.n >= this.cap || alpha <= 0.002) return;
    const i = this.n++, k = this.intensity;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = color.r * k; this.col[i * 3 + 1] = color.g * k; this.col[i * 3 + 2] = color.b * k;
    this.size[i] = size; this.alpha[i] = alpha;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    for (const name of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[name].needsUpdate = true;
  }
}

// ---------------------------------------------------------------- fireworks
// shells: [{ t0, from:[x,y,z], to:[x,y,z], rise, color:'#hex', count, speed, kind:'peony'|'willow'|'crackle' }]
export function fireworks(shells, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Vector3(0, -2.2, 0);
  const tmp = new THREE.Vector3(), white = new THREE.Color('#fff4d6');
  const data = shells.map((s) => {
    const parts = [];
    for (let i = 0; i < s.count; i++) {
      // even spread on a sphere, a little jitter so it reads organic
      const y = 1 - (2 * (i + 0.5)) / s.count, rad = Math.sqrt(1 - y * y), th = i * 2.399963 + r() * 0.3;
      const sp = s.speed * (0.82 + r() * 0.36);
      parts.push({ v: new THREE.Vector3(Math.cos(th) * rad * sp, y * sp, Math.sin(th) * rad * sp * 0.6), life: 1.5 + r() * 0.9, tw: r() * 100 });
    }
    return { ...s, color: new THREE.Color(s.color), from: new THREE.Vector3(...s.from), to: new THREE.Vector3(...s.to), parts };
  });
  return {
    // returns how bright the sky should flash at time t
    emit(t, sparks) {
      let flash = 0;
      for (const s of data) {
        const tb = s.t0 + s.rise;
        if (t < s.t0) continue;
        if (t < tb) {
          // rising shell with a short fading trail
          for (let j = 0; j < 14; j++) {
            const tt = t - j * 0.018;
            if (tt < s.t0) break;
            const x = easeOutCubic(seg(tt, s.t0, tb));
            tmp.lerpVectors(s.from, s.to, x);
            sparks.push(tmp.x, tmp.y, tmp.z, white, 0.07 * (1 - j / 16), 0.9 * (1 - j / 14));
          }
          continue;
        }
        const a = t - tb;
        flash += Math.exp(-a * 5) * 0.12;
        const k = s.kind === 'willow' ? 1.6 : 2.4;
        for (let i = 0; i < s.parts.length; i++) {
          const p = s.parts[i];
          if (a > p.life) continue;
          const fade = 1 - seg(a, p.life * 0.55, p.life);
          let tw = 1;
          if (s.kind === 'crackle' && a > 0.5) tw = hash(p.tw + Math.floor(a * 24)) > 0.45 ? 1.4 : 0.15;
          // streak: the current point plus a few earlier ones
          for (let j = 0; j < 5; j++) {
            const aa = a - j * 0.028;
            if (aa < 0) break;
            ballistic(tmp, s.to, p.v, s.kind === 'willow' ? new THREE.Vector3(0, -3.2, 0) : g, k, aa);
            const heat = Math.exp(-aa * 3.2);
            const col = s.color.clone().lerp(white, heat * 0.85);
            sparks.push(tmp.x, tmp.y, tmp.z, col, (0.085 - j * 0.012) * (0.6 + heat * 0.7), fade * tw * (1 - j / 5.5));
          }
        }
      }
      return flash;
    },
  };
}

// ---------------------------------------------------------------- confetti (lit, metallic, tumbling)
export const CONFETTI_COLORS = ['#ffd166', '#f7b733', '#ffffff', '#5eead4', '#60a5fa', '#f472b6', '#a78bfa'];
export function confetti(stage, opts) {
  const n = opts.count;
  const geo = new THREE.PlaneGeometry(opts.w ?? 0.07, opts.h ?? 0.13);
  const mat = new THREE.MeshStandardMaterial({ metalness: 0.55, roughness: 0.32, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  const r = rng(opts.seed ?? 7);
  const pal = (opts.colors ?? CONFETTI_COLORS).map((c) => new THREE.Color(c));
  const items = [];
  for (let i = 0; i < n; i++) {
    const origin = opts.origins[i % opts.origins.length];
    const dir = new THREE.Vector3(...origin.dir).normalize();
    // random direction inside a cone around dir
    const cone = origin.cone ?? 0.6;
    const v = dir.clone()
      .add(new THREE.Vector3((r() - 0.5) * 2 * cone, (r() - 0.5) * 2 * cone, (r() - 0.5) * 2 * cone))
      .normalize()
      .multiplyScalar(origin.speed * (0.55 + r() * 0.6));
    items.push({
      p0: new THREE.Vector3(...origin.at), v, t0: origin.t0 + r() * (origin.spread ?? 0.08),
      axis: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), spin: 6 + r() * 14,
      ph: r() * 6.28, fl: 0.6 + r() * 1.2, life: opts.life ?? 4.5,
    });
    mesh.setColorAt(i, pal[Math.floor(r() * pal.length)]);
  }
  mesh.instanceColor.needsUpdate = true;
  stage.scene.add(mesh);
  const dummy = new THREE.Object3D(), g = new THREE.Vector3(0, -(opts.gravity ?? 3.4), 0), k = opts.drag ?? 1.6, p = new THREE.Vector3();
  return {
    mesh,
    update(t) {
      for (let i = 0; i < n; i++) {
        const it = items[i], a = t - it.t0;
        if (a < 0 || a > it.life) { dummy.scale.setScalar(0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); continue; }
        ballistic(p, it.p0, it.v, g, k, a);
        // paper flutters sideways as it falls
        const fall = seg(a, 0.4, 1.4);
        p.x += Math.sin(a * it.fl * 4 + it.ph) * 0.22 * fall;
        p.z += Math.cos(a * it.fl * 3 + it.ph) * 0.12 * fall;
        dummy.position.copy(p);
        dummy.quaternion.setFromAxisAngle(it.axis, it.spin * a);
        dummy.scale.setScalar(1 - seg(a, it.life - 0.6, it.life));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- arc tube that draws itself
export function arcTube(radius, tube, from, to, segments, material) {
  const curve = new THREE.Curve();
  curve.getPoint = (u, target = new THREE.Vector3()) => {
    const a = from + (to - from) * u;
    return target.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  };
  const geo = new THREE.TubeGeometry(curve, segments, tube, 24, false);
  const mesh = new THREE.Mesh(geo, material);
  const total = geo.index.count;
  return {
    mesh,
    set(progress) { geo.setDrawRange(0, Math.floor(total * clamp(progress) / 6) * 6); },
  };
}

// ---------------------------------------------------------------- text (HTML layer over the 3D, driven by GSAP)
// letters rise out of a soft blur, one after another
export function revealText(tl, el, at, opts = {}) {
  const text = el.textContent;
  el.textContent = '';
  const spans = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? ' ' : ch;
    s.style.display = 'inline-block';
    el.appendChild(s);
    spans.push(s);
  }
  gsap.set(spans, { opacity: 0, y: opts.y ?? 46, filter: 'blur(14px)' });
  tl.to(spans, { opacity: 1, y: 0, filter: 'blur(0px)', duration: opts.dur ?? 0.9, ease: 'expo.out', stagger: opts.stagger ?? 0.028 }, at);
}

// an odometer: every digit rolls on its own drum and lands on the final value
export function odometer(tl, el, value, at, dur, opts = {}) {
  const str = String(value);
  const h = opts.height;
  el.innerHTML = '';
  el.style.display = 'flex';
  el.style.justifyContent = 'center';
  el.style.alignItems = 'flex-start';
  const cols = [];
  str.split('').forEach((d, i) => {
    const win = document.createElement('div');
    win.style.cssText = `height:${h}px;overflow:hidden;line-height:${h}px;-webkit-mask-image:linear-gradient(transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(transparent,#000 18%,#000 82%,transparent)`;
    const strip = document.createElement('div');
    const turns = (str.length - i) * 1 + 1; // the right-most digit spins the most
    const digit = parseInt(d, 10);
    for (let k = 0; k <= turns * 10 + digit; k++) {
      const row = document.createElement('div');
      row.textContent = String(k % 10);
      row.style.height = h + 'px';
      strip.appendChild(row);
    }
    win.appendChild(strip);
    el.appendChild(win);
    cols.push({ strip, steps: turns * 10 + digit });
  });
  if (opts.suffix) {
    const s = document.createElement('div');
    s.className = opts.suffixClass || '';
    s.textContent = opts.suffix;
    s.style.lineHeight = h + 'px';
    el.appendChild(s);
  }
  cols.forEach((c, i) => {
    gsap.set(c.strip, { y: 0 });
    tl.to(c.strip, { y: -c.steps * h, duration: dur + (cols.length - i) * 0.08, ease: 'expo.out' }, at + i * 0.05);
  });
}
