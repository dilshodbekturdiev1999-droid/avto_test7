// Renderer + scene: physical sky, sun with soft shadows that follow the car,
// image-based reflections for the paint, the baked Blender autodrome, instanced
// trees and the Cobalt rig.
import * as THREE from 'three';
import type { GameAssets } from './assets';
import { buildTrees } from './trees';
import { COBALT, type VehicleProfile } from './vehicles';
import { gameFile } from './preload';

export type Quality = 'low' | 'medium' | 'high';

export interface CarLights {
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

/** Baked surface (unlit) with a tiled grain multiplied on top for close range. */
function bakedMaterial(map: THREE.Texture | null, detail: THREE.Texture, repeat: THREE.Vector2, strength: number) {
  const m = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.detailRepeat = { value: repeat };
    sh.uniforms.detailStrength = { value: strength };
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D detailMap;
uniform vec2 detailRepeat;
uniform float detailStrength;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.rgb *= mix(vec3(1.0), texture2D(detailMap, vMapUv * detailRepeat).rgb * 2.0, detailStrength);
#endif`,
      );
  };
  return m;
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
        asphaltMat ??= bakedMaterial(mat.map, asphaltGrain, asphaltRepeat, 0.4);
        mesh.material = asphaltMat;
      } else {
        grassMat ??= bakedMaterial(mat.map, grassGrain, grassRepeat, 0.55);
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
  scene.add(staticRoot);

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
  const lamp: Record<string, THREE.MeshPhysicalMaterial | undefined> = {};
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = quality === 'high';
    const m = mesh.material as THREE.MeshPhysicalMaterial;
    if (!m || !m.name) return;
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
        m.clearcoat = 1;
        m.clearcoatRoughness = 0.05;
        m.envMapIntensity = 1.2;
        paint.push(m);
      }
    }
    if (m.name === 'Glass') {
      if (!glassMats.includes(m)) glassMats.push(m);
      m.transparent = true;
      m.opacity = 0.8;
      m.depthWrite = false;
      m.envMapIntensity = 1.6;
      m.roughness = 0.03;
      mesh.renderOrder = 2;
      mesh.castShadow = false;
    }
    if (m.name === 'Chrome' || m.name === 'Rim') m.envMapIntensity = 1.4;
  });
  carRoot.add(model);
  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => {
    const w = model.getObjectByName(n)!;
    // Re-parent each wheel under a steering pivot so spin and steer compose cleanly.
    const pivot = new THREE.Object3D();
    pivot.position.copy(w.position);
    model.add(pivot);
    w.position.set(0, 0, 0);
    pivot.add(w);
    return pivot;
  });
  scene.add(carRoot);

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
        const blink = Math.floor(l.time * 3) % 2 === 0; // 1.5 Hz
        const left = (l.signal === -1 || l.signal === 2) && blink;
        const right = (l.signal === 1 || l.signal === 2) && blink;
        if (lamp.IndL) lamp.IndL.emissiveIntensity = left ? 2.6 : 0;
        if (lamp.IndR) lamp.IndR.emissiveIntensity = right ? 2.6 : 0;
        const tail = l.brake ? 2.4 : 0.35;
        if (lamp.Tail) lamp.Tail.emissiveIntensity = tail;
        if (lamp.TailLens) lamp.TailLens.emissiveIntensity = tail * 0.6;
        if (lamp.HeadBulb) lamp.HeadBulb.emissiveIntensity = l.reverse ? 1.6 : 0.5;
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
