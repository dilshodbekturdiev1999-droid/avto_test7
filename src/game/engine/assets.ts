// Loads the Blender-built game assets shipped in public/game (bundled into the
// app, so the game works offline).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface TreeSpot {
  k: 'leafy' | 'pine' | 'bush';
  x: number;
  z: number;
  y: number;
  s: number;
  r: number;
}

export interface AutodromeMeta {
  width: number;
  depth: number;
  islands: [number, number][][];
  start: { x: number; y: number; heading: number };
  plan?: { scale: number; origin: [number, number] };
  ramp?: { x0: number; x1: number; h: number; foot_s: number; top_s: number; top_n: number; foot_n: number; line: number };
  trees: TreeSpot[];
  sun: [number, number, number];
}

export interface GameAssets {
  autodrome: GLTF;
  car: GLTF;
  /** Rig measured by prepare_car.py (null for older cars). */
  carRig: import('./vehicles').CarRigJson | null;
  meta: AutodromeMeta;
  treeSprites: Record<string, { width: number; height: number; cols: number; rows: number }>;
  treeTextures: Record<string, THREE.Texture>;
  /** Real sky photo (Poly Haven CC0): reflections, background and where its sun sits. */
  envMap: THREE.Texture;
  skyBg: THREE.Texture;
  skySun: THREE.Vector3;
  skidTexture: THREE.Texture;
}

const BASE = `${import.meta.env.BASE_URL}game/`;

export async function loadGameAssets(
  onProgress: (p: number) => void,
  lowCar = false,
  carFile = 'car_cobalt',
  carHasLow = true,
): Promise<GameAssets> {
  const loader = new GLTFLoader();
  const parts = { autodrome: 0, trees: 0, car: 0 };
  const report = () => onProgress(parts.autodrome * 0.45 + parts.car * 0.4 + parts.trees * 0.15);
  const load = (file: string, key: 'autodrome' | 'car') =>
    new Promise<GLTF>((resolve, reject) =>
      loader.load(
        BASE + file,
        (g) => {
          parts[key] = 1;
          report();
          resolve(g);
        },
        (e) => {
          if (e.total) {
            parts[key] = e.loaded / e.total;
            report();
          }
        },
        reject,
      ),
    );
  const loadTrees = async () => {
    const sprites = (await fetch(BASE + 'trees/trees.json').then((r) => r.json())) as GameAssets['treeSprites'];
    const tl = new THREE.TextureLoader();
    const names = Object.keys(sprites);
    const textures: Record<string, THREE.Texture> = {};
    await Promise.all(
      names.map(async (n) => {
        textures[n] = await tl.loadAsync(`${BASE}trees/${n}.png`);
      }),
    );
    parts.trees = 1;
    report();
    return { sprites, textures };
  };
  const loadEnv = async () => {
    const [env, bg, info, skid] = await Promise.all([
      new RGBELoader().loadAsync(BASE + 'env/sky_1k.hdr'),
      new THREE.TextureLoader().loadAsync(BASE + 'env/sky_bg.jpg'),
      fetch(BASE + 'env/sky.json').then((r) => r.json() as Promise<{ sun: [number, number, number] }>),
      new THREE.TextureLoader().loadAsync(BASE + 'textures/skid.png'),
    ]);
    env.mapping = THREE.EquirectangularReflectionMapping;
    bg.mapping = THREE.EquirectangularReflectionMapping;
    bg.colorSpace = THREE.SRGBColorSpace;
    skid.wrapS = THREE.RepeatWrapping;
    return { env, bg, sun: new THREE.Vector3(...info.sun), skid };
  };
  const [autodrome, trees, car, meta, env, carRig] = await Promise.all([
    load('autodrome.glb', 'autodrome'),
    loadTrees(),
    lowCar && carHasLow ? load(`${carFile}_low.glb`, 'car').catch(() => load(`${carFile}.glb`, 'car')) : load(`${carFile}.glb`, 'car'),
    fetch(BASE + 'autodrome.json').then((r) => r.json() as Promise<AutodromeMeta>),
    loadEnv(),
    fetch(`${BASE}${carFile}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<import('./vehicles').CarRigJson | null>,
  ]);
  return {
    autodrome,
    car,
    carRig,
    meta,
    treeSprites: trees.sprites,
    treeTextures: trees.textures,
    envMap: env.env,
    skyBg: env.bg,
    skySun: env.sun,
    skidTexture: env.skid,
  };
}

/** World-space triangle soup of a mesh, for static trimesh colliders. */
export function meshTriangles(mesh: THREE.Mesh): { vertices: Float32Array; indices: Uint32Array } {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const vertices = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    vertices[i * 3] = v.x;
    vertices[i * 3 + 1] = v.y;
    vertices[i * 3 + 2] = v.z;
  }
  let indices: Uint32Array;
  if (g.index) {
    indices = new Uint32Array(g.index.array);
  } else {
    indices = new Uint32Array(pos.count);
    for (let i = 0; i < pos.count; i++) indices[i] = i;
  }
  return { vertices, indices };
}
