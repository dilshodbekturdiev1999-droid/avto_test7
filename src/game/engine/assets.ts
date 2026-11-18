// Loads the Blender-built game assets shipped in public/game (bundled into the
// app, so the game works offline).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { gameFile, gameFileList, gameFileOptional, preloadGame, preloadProgress } from './preload';

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
  /** The Prava On campus around the fence (buildings, fence, street). */
  campus: GLTF | null;
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

/** Clear blue sky, no clouds: deep blue overhead fading to the pale haze of the fog at the horizon. */
function clearSky(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d')!;
  // equirect: row 0 = straight up, row 256 = horizon
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3f7fd6');
  grad.addColorStop(0.22, '#5b95e0');
  grad.addColorStop(0.4, '#8db6ea');
  grad.addColorStop(0.49, '#b9d0ec');
  grad.addColorStop(1, '#b9d0ec');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadGameAssets(
  onProgress: (p: number) => void,
  lowCar = false,
  carFile = 'car_cobalt',
  carHasLow = true,
): Promise<GameAssets> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const names = gameFileList(carFile, carHasLow && lowCar);
  void preloadGame(carFile, carHasLow);
  let done = false;
  const tick = () => {
    if (done) return;
    onProgress(Math.min(0.97, preloadProgress(names)));
    setTimeout(tick, 120);
  };
  tick();
  const carName = lowCar && carHasLow ? `${carFile}_low.glb` : `${carFile}.glb`;
  const json = async <T,>(name: string) => JSON.parse(new TextDecoder().decode(await gameFile(name))) as T;
  const blobUrl = async (name: string, type: string) => URL.createObjectURL(new Blob([await gameFile(name)], { type }));
  const texture = async (name: string, type: string) => {
    const url = await blobUrl(name, type);
    try {
      return await new THREE.TextureLoader().loadAsync(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const gltf = async (name: string) => loader.parseAsync(await gameFile(name), BASE);
  const loadTrees = async () => {
    const sprites = await json<GameAssets['treeSprites']>('trees/trees.json');
    const textures: Record<string, THREE.Texture> = {};
    await Promise.all(
      Object.keys(sprites).map(async (n) => {
        textures[n] = await texture(`trees/${n}.webp`, 'image/webp');
      }),
    );
    return { sprites, textures };
  };
  const loadEnv = async () => {
    const hdrUrl = await blobUrl('env/sky_1k.hdr', 'application/octet-stream');
    const [env, bg, info, skid] = await Promise.all([
      new RGBELoader().loadAsync(hdrUrl).finally(() => URL.revokeObjectURL(hdrUrl)),
      clearSky(),
      json<{ sun: [number, number, number] }>('env/sky.json'),
      texture('textures/skid.png', 'image/png'),
    ]);
    env.mapping = THREE.EquirectangularReflectionMapping;
    bg.mapping = THREE.EquirectangularReflectionMapping;
    bg.colorSpace = THREE.SRGBColorSpace;
    skid.wrapS = THREE.RepeatWrapping;
    return { env, bg, sun: new THREE.Vector3(...info.sun), skid };
  };
  const [autodrome, campus, campusInfo, trees, car, meta, env, carRigBuf] = await Promise.all([
    gltf('autodrome.glb'),
    gltf('campus.glb').catch(() => null),
    json<{ trees: TreeSpot[] }>('campus.json').catch(() => null),
    loadTrees(),
    gltf(carName).catch(() => gltf(`${carFile}.glb`)),
    json<AutodromeMeta>('autodrome.json'),
    loadEnv(),
    gameFileOptional(`${carFile}.json`),
  ]);
  done = true;
  onProgress(1);
  let carRig: import('./vehicles').CarRigJson | null = null;
  try {
    carRig = carRigBuf ? JSON.parse(new TextDecoder().decode(carRigBuf)) : null;
  } catch {
    carRig = null;
  }
  // the campus brings its own trees (streets, lawns, between the homes)
  if (campus && campusInfo) meta.trees = [...meta.trees.filter((t) => t.y > 0), ...campusInfo.trees];
  return {
    autodrome,
    campus,
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
