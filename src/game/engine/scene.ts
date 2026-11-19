// Renderer + scene: physical sky, sun with soft shadows that follow the car,
// image-based reflections for the paint, the baked Blender autodrome, instanced
// trees and the Cobalt rig.
import * as THREE from 'three';
import type { GameAssets } from './assets';
import { rebuildBarriers } from './barrier';
import { buildTrees } from './trees';
import { COBALT, type VehicleProfile } from './vehicles';
import { gameFile } from './preload';
import { depthInIsland, onIsland } from './course';

export type Quality = 'low' | 'medium' | 'high';

export interface CarLights {
  /** Engine running: daytime lights in front, position lights at the back. */
  engine: boolean;
  brake: boolean;
  reverse: boolean;
  /** -1 left, 1 right, 2 hazard (both), 0 off; blinking is driven by `time`. */
  signal: -1 | 0 | 1 | 2;
  time: number;
}

export interface MirrorRect {
  x: number;
  y: number; // CSS px from the TOP of the canvas
  w: number;
  h: number;
}

export interface CarRig {
  root: THREE.Group;
  glass: THREE.MeshPhysicalMaterial[];
  setLights(l: CarLights): void;
  wheels: THREE.Object3D[]; // fl, fr, rl, rr
  paint: THREE.MeshPhysicalMaterial[];
  setColor(hex: number): void;
}

export interface GameScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  car: CarRig;
  staticRoot: THREE.Object3D;
  fieldImage: CanvasImageSource | null;
  followSun(x: number, z: number): void;
  /** Render the main view and, when rects are given, both side mirrors. */
  renderFrame(mirrors: { left: MirrorRect; right: MirrorRect } | null, mirrorTick: boolean): void;
  setBlob(x: number, z: number, yaw: number, y?: number): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

type LampKind = 'head' | 'tail' | 'reverse' | 'indL' | 'indR';
const LAMP_COLOR: Record<LampKind, number> = { head: 0xfff4e6, tail: 0xff1408, reverse: 0xffffff, indL: 0xff8a00, indR: 0xff8a00 };

/** Soft round glow for the lamps (solid: an opaque bright core, for amber over a red lens). */
function glowTexture(solid = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  if (solid) {
    grad.addColorStop(0.28, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  } else {
    grad.addColorStop(0.18, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  }
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tileable grayscale grain (mean 0.5) used to add close-up detail on top of the bake. */
function grainTexture(kind: 'asphalt' | 'grass') {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const img = g.createImageData(n, n);
  let seed = kind === 'asphalt' ? 11 : 29;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n * n; i++) {
    const v = 128 + (rnd() - 0.5) * (kind === 'asphalt' ? 70 : 50);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (kind === 'asphalt') {
    // scattered light aggregate and darker pores
    for (let i = 0; i < 1400; i++) {
      const r = 0.6 + rnd() * 1.6;
      g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.12 + rnd() * 0.2})` : `rgba(0,0,0,${0.12 + rnd() * 0.25})`;
      g.beginPath();
      g.arc(rnd() * n, rnd() * n, r, 0, 7);
      g.fill();
    }
  } else {
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * n;
      const y = rnd() * n;
      g.strokeStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.15 + rnd() * 0.2})` : `rgba(0,0,0,${0.15 + rnd() * 0.25})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * Baked surface (unlit) with a tiled grain multiplied on top for close range.
 * kind 'asphalt': road paint is redrawn crisp from the bake (a threshold on the
 * filtered bake with screen-space anti-aliasing, so lines stay sharp up close),
 * and the asphalt gets a little sky sheen at grazing angles and a sun glint.
 * kind 'grass': the baked grass is calmed to a natural lawn green.
 */
function bakedMaterial(map: THREE.Texture | null, detail: THREE.Texture, repeat: THREE.Vector2, strength: number, kind: 'asphalt' | 'grass' = 'asphalt', sun = new THREE.Vector3(0, 1, 0)) {
  const m = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.detailRepeat = { value: repeat };
    sh.uniforms.detailStrength = { value: strength };
    sh.uniforms.sunDir = { value: sun };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`);
    const road = /* glsl */ `
  // values are linear (the bake is sRGB): asphalt ~0.16, white paint ~0.89, yellow (0.78, 0.66, 0.14)
  vec3 bk = diffuseColor.rgb;
  float mn = min(bk.r, min(bk.g, bk.b));
  float yl = (bk.r + bk.g) * 0.5 - bk.b;
  float fw = max(fwidth(mn), 1e-4) * 1.2;
  float fy = max(fwidth(yl), 1e-4) * 1.2;
  float mw = smoothstep(0.45 - fw, 0.45 + fw, mn);
  float my = smoothstep(0.3 - fy, 0.3 + fy, yl) * step(0.35, bk.r);
  // blurry bake pixels around the paint become asphalt, then the paint is laid on crisp
  float edge = clamp(smoothstep(0.19, 0.26, mn) + smoothstep(0.06, 0.12, yl) * step(0.2, bk.r), 0.0, 1.0);
  vec3 asph = vec3(0.156, 0.153, 0.18);
  vec3 col = mix(bk, asph, edge);
  col = mix(col, vec3(0.86, 0.86, 0.84), mw);
  col = mix(col, vec3(0.80, 0.58, 0.07), my);
  float paint = max(mw, my);
  diffuseColor.rgb = col * mix(vec3(1.0), texture2D(detailMap, vMapUv * detailRepeat).rgb * 2.0, detailStrength * (1.0 - 0.6 * paint));
  // sheen: sky reflection rises at grazing angles; a soft sun glint
  vec3 V = normalize(cameraPosition - vWPos);
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  float glint = pow(max(dot(R, sunDir), 0.0), 60.0);
  diffuseColor.rgb += (fres * vec3(0.30, 0.34, 0.40) * 0.45 + glint * vec3(1.0, 0.95, 0.85) * 0.05) * (1.0 - 0.5 * paint);`;
    const lawn = /* glsl */ `
  // calmer, natural lawn: less neon, a touch of blue-green, slight darkening
  vec3 g = diffuseColor.rgb;
  float l = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(vec3(l), g, 0.78) * vec3(0.86, 0.9, 0.82);
  diffuseColor.rgb = g * mix(vec3(1.0), texture2D(detailMap, vMapUv * detailRepeat).rgb * 2.0, detailStrength);`;
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D detailMap;
uniform vec2 detailRepeat;
uniform float detailStrength;
uniform vec3 sunDir;
varying vec3 vWPos;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
${kind === 'asphalt' ? road : lawn}
#endif`,
      );
  };
  return m;
}

/** Campus lawn: break the 7 m texture repeat with large, soft colour patches (world space). */
function lawnVariation(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLawnW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLawnW = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vLawnW;
float lawnN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float lawnV = lawnN(vLawnW / 23.0) * 0.6 + lawnN(vLawnW / 6.5) * 0.4;
diffuseColor.rgb *= mix(vec3(0.84, 0.86, 0.8), vec3(1.08, 1.06, 0.98), lawnV);`,
      );
  };
  m.customProgramCacheKey = () => 'campus-lawn';
}

export function buildScene(canvasHost: HTMLElement, assets: GameAssets, quality: Quality, profile: VehicleProfile = COBALT): GameScene {
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps colours vivid and bright
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  canvasHost.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';

  const scene = new THREE.Scene();
  const meta = assets.meta;
  const sunDir = new THREE.Vector3(...meta.sun).normalize();

  // Real sky photo for the background and the reflections; rotated so its sun
  // sits where the baked sun is (the shadows in the bake and on the car agree).
  const skyYaw = Math.atan2(assets.skySun.z, assets.skySun.x) - Math.atan2(sunDir.z, sunDir.x);
  scene.background = assets.skyBg;
  scene.backgroundRotation.set(0, skyYaw, 0);
  scene.backgroundIntensity = 1.0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(assets.envMap);
  scene.environment = envRT.texture;
  scene.environmentRotation.set(0, skyYaw, 0);
  scene.environmentIntensity = 1.0;
  pmrem.dispose();
  scene.fog = new THREE.Fog(0xb9d0ec, 140, 560);

  // Lights (props, car, trees). The field itself is baked.
  const hemi = new THREE.HemisphereLight(0xdcebff, 0x7a8a4c, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = quality !== 'low';
  const sm = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -14;
  sc.right = 14;
  sc.top = 14;
  sc.bottom = -14;
  sc.near = 1;
  sc.far = 140;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // Autodrome.
  const staticRoot = assets.autodrome.scene;
  let fieldImage: CanvasImageSource | null = null;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  // Close-up detail from the same Poly Haven photos the bake used (procedural grain until loaded).
  const asphaltGrain = grainTexture('asphalt');
  const grassGrain = grainTexture('grass');
  const photoDetail = (file: string, fallback: THREE.Texture) =>
    void gameFile(`textures/${file}`).then((buf) => {
      const url = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
      new THREE.TextureLoader().load(url, (t) => {
        URL.revokeObjectURL(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = Math.min(maxAniso, 8);
        fallback.image = t.image;
        fallback.needsUpdate = true;
      });
    });
  photoDetail('detail_asphalt.jpg', asphaltGrain);
  photoDetail('detail_grass.jpg', grassGrain);
  const asphaltRepeat = new THREE.Vector2(meta.width / 4.0, meta.depth / 4.0);
  const kerbs: THREE.MeshStandardMaterial[] = [];
  const grassRepeat = new THREE.Vector2(meta.width / 2.0, meta.depth / 2.0);
  let asphaltMat: THREE.Material | null = null;
  let grassMat: THREE.Material | null = null;
  staticRoot.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.name.startsWith('BAKED')) {
      if (mat.map) {
        mat.map.anisotropy = Math.min(maxAniso, quality === 'low' ? 2 : 8);
        fieldImage = mat.map.image as CanvasImageSource;
      }
      if (mesh.name === 'Ground') {
        asphaltMat ??= bakedMaterial(mat.map, asphaltGrain, asphaltRepeat, 0.4, 'asphalt', sunDir);
        mesh.material = asphaltMat;
      } else {
        grassMat ??= bakedMaterial(mat.map, grassGrain, grassRepeat, 0.55, 'grass', sunDir);
        mesh.material = grassMat;
      }
      mesh.receiveShadow = false;
      return;
    }
    if (mat.name === 'Chainlink') {
      mat.alphaTest = 0.5;
      mat.transparent = false;
      mat.side = THREE.DoubleSide;
      mesh.castShadow = false;
    } else {
      mesh.castShadow = quality === 'high' && !/^(Terrain|Hills|Apron)/.test(mesh.name);
    }
    if (mat.map) mat.map.anisotropy = Math.min(maxAniso, 4);
    if (mat.name === 'RampDeck') {
      // the deck reuses the grey grain texture; tint it to asphalt and tile it
      mat.color.setRGB(0.36, 0.36, 0.37);
      if (mat.map) {
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        mat.map.repeat.set(0.75, 0.75);
      }
    }
    if (mat.name === 'Curb' && !kerbs.includes(mat)) {
      // Painted kerbs stay bright and readable even in shade.
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = mat.map;
      mat.emissiveIntensity = 0.38;
      kerbs.push(mat);
    }
    mesh.receiveShadow = /^(Curb_|FieldKerb|Terrain|Apron|Platform)/.test(mesh.name);
  });
  // Outside the fence: the campus replaces the old meadow, chain-link fence and hedge.
  if (assets.campus) {
    const old = /^(Terrain|Hills|HedgeRows|FenceFrame|FenceNet)/;
    staticRoot.traverse((o) => {
      if (old.test(o.name)) o.visible = false;
    });
    const campus = assets.campus.scene;
    // soft sun shadows of the buildings and trees: a multiply layer on the ground whose vertex
    // colour is the light that is left (build_campus.py)
    const shadowMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending,
      premultipliedAlpha: true, toneMapped: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    campus.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (/Shadow/.test(m.name)) {
        mesh.material = shadowMat;
        mesh.renderOrder = 1;
        return;
      }
      if (m.map) m.map.anisotropy = Math.min(maxAniso, quality === 'low' ? 2 : 8);
      if (/Fence|Gate$/.test(m.name)) {
        m.alphaTest = 0.5;
        m.transparent = false;
      }
      if (/Lawn/.test(m.name)) lawnVariation(m);
      // clipped hedge: a calmer, deeper green than the raw texture
      if (/Hedge/.test(m.name)) m.color.setRGB(0.7, 0.76, 0.62);
      // windows glow softly from inside (no sky mirror); walls and trims catch a little sky
      m.envMapIntensity = /Glass|Logo|Sign/.test(m.name) ? 0.15 : 0.8;
      // layers laid on top of something (windows on walls, paths on the lawn) win the depth test
      // at any distance instead of flickering with what is under them
      const layer = /Glass|Logo|Sign$/.test(m.name) ? 2 : /Zebra|Mark/.test(m.name) ? 3 : /Paving|Plaza|Road|Flowers/.test(m.name) ? 1 : 0;
      if (layer) {
        m.polygonOffset = true;
        m.polygonOffsetFactor = -layer;
        m.polygonOffsetUnits = -2 * layer;
      }
    });
    scene.add(campus);
  }
  // Signs on the islands stand well in from the kerb (the plate must not hang over the road).
  staticRoot.updateMatrixWorld(true);
  staticRoot.traverse((o) => {
    if (!/^Sign_/.test(o.name) || !(o as THREE.Mesh).isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    if (depthInIsland(meta.islands, cx, cz) < 0) return; // apron signs are fine
    const p = onIsland(meta.islands, cx, cz, 0.9);
    o.position.x += p.x - cx;
    o.position.z += p.z - cz;
  });
  scene.add(staticRoot);
  // level-crossing barriers rebuilt in place (the map's arm floated beside its post)
  rebuildBarriers(staticRoot, scene);

  // Realtime car shadow onto the baked asphalt.
  const W = meta.width;
  const D = meta.depth;
  if (quality !== 'low') {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.ShadowMaterial({ opacity: 0.45 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(W / 2, 0.006, D / 2);
    catcher.receiveShadow = true;
    scene.add(catcher);
  }
  // Soft contact shadow (ambient occlusion) under the car, always on.
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(profile.halfWidth * 2 + 0.6, profile.bumperRear - profile.bumperFront + 0.55),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.75 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  scene.add(blob);

  // Photoreal tree impostors (Poly Haven models rendered in Blender).
  buildTrees(scene, meta.trees, assets.treeSprites, assets.treeTextures, quality);

  // Car.
  const carRoot = new THREE.Group();
  const model = assets.car.scene;
  const paint: THREE.MeshPhysicalMaterial[] = [];
  const glassMats: THREE.MeshPhysicalMaterial[] = [];
  const matte = new Map<string, THREE.MeshLambertMaterial>();
  // Lamps: every car names them the same (prepare_car.py); the Cobalt's own names map onto them.
  const LAMP_OF: Record<string, LampKind> = {
    HeadLamp: 'head', HeadBulb: 'head', TailLamp: 'tail', Tail: 'tail', TailLens: 'tail', ReverseLamp: 'reverse',
    IndFL: 'indL', IndRL: 'indL', IndL: 'indL', IndFR: 'indR', IndRR: 'indR', IndR: 'indR',
  };
  const lampMats: Record<LampKind, THREE.MeshStandardMaterial[]> = { head: [], tail: [], reverse: [], indL: [], indR: [] };
  const lampMeshes: { mesh: THREE.Mesh; kind: LampKind }[] = [];
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = quality === 'high';
    const m = mesh.material as THREE.MeshPhysicalMaterial;
    if (!m || !m.name) return;
    // Blender numbers repeated names on export (HeadLamp.001); the rig name is the part before
    m.name = m.name.replace(/\.\d{3}$/, '');
    const kind = /^Interior/.test(mesh.name) ? undefined : LAMP_OF[m.name];
    if (kind) {
      if (!lampMats[kind].includes(m)) {
        lampMats[kind].push(m);
        m.emissive = new THREE.Color(LAMP_COLOR[kind]);
        // headlamps keep their own pattern (projector, LED strip); the rest glow over the whole lens
        m.emissiveMap = kind === 'head' ? m.map : null;
        m.emissiveIntensity = 0;
        // a lit tail / indicator stays saturated in daylight; headlamps keep the normal tone
        // (a flat white lens would otherwise turn into a pure white block)
        m.toneMapped = kind === 'head';
        m.needsUpdate = true;
      }
      lampMeshes.push({ mesh, kind });
      mesh.castShadow = false;
      return;
    }
    if (/^(Seat|Dash|DashRed|Trim|Grille|Tire|UnderMetal)$/.test(m.name)) {
      // Matte plastics/rubber: no sky glare at grazing angles.
      let lm = matte.get(m.name);
      if (!lm) {
        lm = new THREE.MeshLambertMaterial({ color: m.color.clone().multiplyScalar(/^(Seat|Dash)$/.test(m.name) ? 0.45 : 1), name: m.name });
        matte.set(m.name, lm);
      }
      mesh.material = lm;
      return;
    }
    if (m.name === 'Paint') {
      if (!paint.includes(m)) {
        // satin factory paint: a soft clear coat, not a wet mirror
        m.metalness = Math.min(m.metalness, 0.25);
        m.roughness = Math.max(m.roughness, 0.38);
        m.clearcoat = 0.3;
        m.clearcoatRoughness = 0.3;
        m.envMapIntensity = 0.6;
        paint.push(m);
      }
    }
    if (m.name === 'Glass') {
      if (!glassMats.includes(m)) glassMats.push(m);
      m.transparent = true;
      m.opacity = 0.8;
      m.depthWrite = false;
      m.envMapIntensity = 0.85;
      m.roughness = 0.08;
      mesh.renderOrder = 2;
      mesh.castShadow = false;
    }
    if (m.name === 'Chrome' || m.name === 'Rim') m.envMapIntensity = 0.9;
    else if (m.name !== 'Glass' && m.name !== 'Paint' && m.envMapIntensity > 0.8) m.envMapIntensity = 0.8;
  });
  carRoot.add(model);
  const wheels = ['fl', 'fr', 'rl', 'rr'].map((k, i) => {
    const w = model.getObjectByName('wheel_' + k)!;
    // Re-parent each wheel under a steering pivot so spin and steer compose cleanly:
    // child 0 spins (tyre, rim, disc), the calliper (child 1) only steers.
    const pivot = new THREE.Object3D();
    pivot.position.copy(w.position);
    model.add(pivot);
    // The game puts the pivot on the rig's hub. When the wheel node sits off the hub
    // sideways (the Isuzu's dual rear wheels: the node is the centre of the whole rear
    // group, not of the tyre pair) keep the mesh where the model has it, so the tyres
    // stay under the body. Every other car has the node exactly on the hub (offset 0).
    const hubX = profile.wheels?.[i]?.x;
    const dx = hubX === undefined ? 0 : w.position.x - hubX;
    if (Math.abs(dx) > 0.02) {
      const s = w.scale.x || 1;
      if ((w as THREE.Mesh).isMesh) (w as THREE.Mesh).geometry.translate(dx / s, 0, 0);
      else w.children.forEach((c) => (c.position.x += dx / s));
    }
    w.position.set(0, 0, 0);
    pivot.add(w);
    const cal = model.getObjectByName('caliper_' + k);
    if (cal) {
      cal.position.set(0, 0, 0);
      pivot.add(cal);
    }
    return pivot;
  });
  scene.add(carRoot);

  // Glow around each lamp: one soft sprite per lamp cluster, just outside the lens,
  // brightest when the lamp faces the camera.
  model.updateMatrixWorld(true);
  const glowTex = glowTexture();
  const glows: { sprite: THREE.Sprite; kind: LampKind; dirZ: number; base: number }[] = [];
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const clusters = new Map<string, { sum: THREE.Vector3; n: number; min: THREE.Vector3; max: THREE.Vector3; kind: LampKind }>();
  const tv = new THREE.Vector3();
  for (const { mesh, kind } of lampMeshes) {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      tv.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      // one cluster per side and end (an indicator material can cover front and back)
      const key = `${kind}:${tv.x < 0 ? 'L' : 'R'}:${tv.z < 0 ? 'F' : 'B'}`;
      let g = clusters.get(key);
      if (!g) clusters.set(key, (g = { sum: new THREE.Vector3(), n: 0, min: tv.clone(), max: tv.clone(), kind }));
      g.sum.add(tv);
      g.n++;
      g.min.min(tv);
      g.max.max(tv);
    }
  }
  const coreTex = glowTexture(true);
  const addGlow = (kind: LampKind, p: THREE.Vector3, size: number, dirZ: number) => {
    // Indicators / reversing lights paint a solid core over the red lens. The red halo is
    // blended normally so it also shows on a white car; headlamps add light.
    const solid = kind !== 'head' && kind !== 'tail';
    const mat = new THREE.SpriteMaterial({
      map: solid ? coreTex : glowTex,
      color: LAMP_COLOR[kind],
      transparent: true,
      depthWrite: false,
      blending: kind === 'head' ? THREE.AdditiveBlending : THREE.NormalBlending,
      opacity: 0,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(p);
    sprite.scale.setScalar(size);
    sprite.renderOrder = 3;
    sprite.visible = false;
    model.add(sprite);
    glows.push({ sprite, kind, dirZ, base: size });
  };
  const spots: Record<string, { p: THREE.Vector3; size: number }> = {};
  for (const [key, g] of clusters) {
    if (g.n < 40) continue;
    const c = g.sum.divideScalar(g.n);
    const front = key.endsWith('F');
    c.z = front ? g.min.z - 0.03 : g.max.z + 0.03;
    const size = Math.max(0.14, Math.min(0.34, Math.max(g.max.x - g.min.x, g.max.y - g.min.y) * 1.1));
    spots[key] = { p: c, size };
    addGlow(g.kind, c, size, front ? -1 : 1);
  }
  // Lamps a model does not have as separate parts glow inside the nearest cluster:
  // rear indicators and reversing lights in the tail lamp, front indicators at the headlamp's outer edge.
  for (const side of ['L', 'R'] as const) {
    const ind: LampKind = side === 'L' ? 'indL' : 'indR';
    const tail = spots[`tail:${side}:B`];
    const head = spots[`head:${side}:F`];
    if (tail && !spots[`${ind}:${side}:B`]) addGlow(ind, tail.p.clone().add(new THREE.Vector3(side === 'L' ? -0.07 : 0.07, 0.03, 0.01)), 0.17, 1);
    if (tail && !spots[`reverse:${side}:B`]) addGlow('reverse', tail.p.clone().add(new THREE.Vector3(side === 'L' ? 0.09 : -0.09, -0.02, 0.012)), 0.14, 1);
    // a front indicator that is only a side repeater (behind the front wheel) does not count
    const frontInd = spots[`${ind}:${side}:F`];
    if (head && (!frontInd || frontInd.p.z > head.p.z + 0.6)) addGlow(ind, head.p.clone().add(new THREE.Vector3(side === 'L' ? -0.12 : 0.12, 0, 0.01)), 0.16, -1);
  }
  const lampLevel: Record<LampKind, number> = { head: 0, tail: 0, reverse: 0, indL: 0, indR: 0 };
  const camLocal = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 1200);

  // Side mirrors: two cameras on the car looking back, drawn into small viewports.
  const mirrorCams = [-1, 1].map((side) => {
    const c = new THREE.PerspectiveCamera(42, 1.8, 0.35, 700);
    c.position.set(side * profile.mirror.x, profile.mirror.y, profile.mirror.z);
    c.rotation.set(0, Math.PI - side * 0.32, 0, 'YXZ');
    carRoot.add(c);
    return c;
  });
  const renderMirror = (cam: THREE.PerspectiveCamera, r: MirrorRect) => {
    const size = renderer.getSize(new THREE.Vector2());
    cam.aspect = r.w / r.h;
    cam.updateProjectionMatrix();
    renderer.setViewport(r.x, size.y - r.y - r.h, r.w, r.h);
    renderer.setScissor(r.x, size.y - r.y - r.h, r.w, r.h);
    renderer.setScissorTest(true);
    renderer.render(scene, cam);
  };

  return {
    renderer,
    scene,
    camera,
    car: {
      root: carRoot,
      glass: glassMats,
      wheels,
      paint,
      setColor(hex) {
        for (const m of paint) m.color.setHex(hex);
      },
      setLights(l) {
        const blink = Math.floor(l.time * 3) % 2 === 0; // 1.5 Hz, in step with the relay click
        const left = (l.signal === -1 || l.signal === 2) && blink;
        const right = (l.signal === 1 || l.signal === 2) && blink;
        // daytime lights: the lens pattern stays readable (the truck's lamps are flat white panels
        // in the model, so they only get a faint glow; the halo sprite does the rest)
        lampLevel.head = l.engine ? (profile.category === 'C' ? 0.08 : 0.55) : 0;
        lampLevel.tail = l.brake ? 4.0 : l.engine ? 0.3 : 0;
        lampLevel.reverse = l.reverse && l.engine ? 2.6 : 0;
        lampLevel.indL = left ? 3.4 : 0;
        lampLevel.indR = right ? 3.4 : 0;
        for (const k of Object.keys(lampMats) as LampKind[]) for (const m of lampMats[k]) m.emissiveIntensity = lampLevel[k];
        camLocal.copy(camera.position);
        model.worldToLocal(camLocal);
        for (const g of glows) {
          const lv = lampLevel[g.kind];
          toCam.copy(camLocal).sub(g.sprite.position).normalize();
          const facing = Math.max(0, toCam.z * g.dirZ);
          const strength = g.kind === 'tail' ? (l.brake ? 0.85 : 0) : g.kind === 'head' ? (lv > 0 ? 0.75 : 0) : lv > 0 ? 1 : 0;
          const m = g.sprite.material as THREE.SpriteMaterial;
          m.opacity = strength * (0.15 + 0.85 * facing * facing);
          g.sprite.visible = m.opacity > 0.01;
          const grow = g.kind === 'tail' && l.brake ? 1.35 : 1;
          g.sprite.scale.setScalar(g.base * (0.7 + 0.6 * facing) * grow);
        }
      },
    },
    renderFrame(mirrors, mirrorTick) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
      renderer.render(scene, camera);
      if (mirrors && mirrorTick) {
        // The cheap mirror pass: no own car, no new shadow map.
        carRoot.visible = false;
        const auto = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        renderMirror(mirrorCams[0], mirrors.left);
        renderMirror(mirrorCams[1], mirrors.right);
        renderer.shadowMap.autoUpdate = auto;
        renderer.setScissorTest(false);
        carRoot.visible = true;
      }
    },
    staticRoot,
    fieldImage,
    followSun(x, z) {
      sun.target.position.set(x, 0, z);
      sun.position.set(x + sunDir.x * 60, sunDir.y * 60, z + sunDir.z * 60);
    },
    setBlob(x, z, yaw, y = 0) {
      blob.position.set(x, y + 0.012, z);
      blob.rotation.z = yaw;
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    dispose() {
      envRT.dispose();
      assets.envMap.dispose();
      assets.skyBg.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          (x as THREE.MeshStandardMaterial).map?.dispose();
          x.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
