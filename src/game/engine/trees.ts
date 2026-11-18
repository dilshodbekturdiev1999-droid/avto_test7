// Photoreal trees as 8-view impostors: one camera-facing quad per tree that
// shows the pre-rendered view (Blender, Poly Haven CC0 models) closest to the
// viewing angle. Lighting is baked into the frames with the autodrome's sun.
import * as THREE from 'three';
import type { TreeSpot } from './assets';

export interface SpriteInfo {
  width: number;
  height: number;
  cols: number;
  rows: number;
}

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute float iScale;
attribute float iTint;
uniform vec2 frameSize;
varying vec2 vUv0;
varying vec2 vUv1;
varying float vW;
varying float vTint;
#include <common>
#include <fog_pars_vertex>
vec2 frameUv(float k, vec2 uv) {
  float col = mod(k, 4.0);
  float row = floor(k / 4.0);
  return vec2((col + uv.x) / 4.0, 1.0 - (row + 1.0 - uv.y) / 2.0);
}
void main() {
  vec3 toCam = cameraPosition - iPos;
  toCam.y = 0.0;
  float a = atan(toCam.x, toCam.z);
  // the two pre-rendered views either side of the viewing angle, blended (no popping)
  float f = a / (PI / 4.0);
  float k0 = floor(f);
  vW = f - k0;
  vec3 dir = normalize(toCam + vec3(1e-5, 0.0, 0.0));
  vec3 right = vec3(dir.z, 0.0, -dir.x);
  vec3 p = iPos + right * position.x * frameSize.x * iScale + vec3(0.0, position.y * frameSize.y * iScale, 0.0);
  vUv0 = frameUv(mod(k0 + 8.0, 8.0), uv);
  vUv1 = frameUv(mod(k0 + 9.0, 8.0), uv);
  vTint = iTint;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec2 texSize;
uniform float a2c;
varying vec2 vUv0;
varying vec2 vUv1;
varying float vW;
varying float vTint;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec4 c0 = texture2D(map, vUv0);
  vec4 c1 = texture2D(map, vUv1);
  float t = smoothstep(0.2, 0.8, vW);
  vec4 c = mix(c0, c1, t);
  // colour weighted by each view's own coverage (a gap in one view must not darken the other)
  vec3 rgb = (c0.rgb * c0.a * (1.0 - t) + c1.rgb * c1.a * t) / max(c.a, 1e-3);
  // far away the mipmaps average the leaves with the empty gaps and the crown would
  // thin out and vanish: lift the alpha with the mip level, then cut it sharp
  vec2 dx = dFdx(vUv0 * texSize);
  vec2 dy = dFdy(vUv0 * texSize);
  float lod = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  float al = c.a * (1.0 + lod * 0.3);
  if (a2c > 0.5) {
    al = clamp((al - 0.45) / max(fwidth(al), 1e-4) + 0.5, 0.0, 1.0);
    if (al < 0.02) discard;
  } else {
    if (al < 0.45) discard;
    al = 1.0;
  }
  gl_FragColor = vec4(rgb * vTint, al);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildTrees(
  scene: THREE.Scene,
  spots: TreeSpot[],
  sprites: Record<string, SpriteInfo>,
  textures: Record<string, THREE.Texture>,
  quality: 'low' | 'medium' | 'high',
) {
  // Which sprite each placement uses.
  const byName: Record<string, { pos: number[]; scale: number[]; tint: number[] }> = {};
  spots.forEach((t, i) => {
    if (quality === 'low' && t.y === 0 && i % 2) return; // thin the forest belt on weak phones
    let name = 'leafy_b';
    let s = t.s;
    if (t.k === 'pine') name = i % 3 === 0 ? 'fir_b' : 'fir';
    if (t.k === 'bush') s = t.s * 0.48;
    if (!sprites[name]) return;
    const b = (byName[name] ??= { pos: [], scale: [], tint: [] });
    b.pos.push(t.x, t.y, t.z);
    b.scale.push(s);
    const h = (((t.x * 12.9898 + t.z * 78.233) % 1) + 1) % 1;
    b.tint.push(0.88 + h * 0.2);
  });

  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const meshes: THREE.Mesh[] = [];
  for (const [name, b] of Object.entries(byName)) {
    const info = sprites[name];
    const tex = textures[name];
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    geo.attributes.uv = quad.attributes.uv;
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(b.pos), 3));
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(new Float32Array(b.scale), 1));
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(b.tint), 1));
    geo.instanceCount = b.scale.length;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          map: { value: null },
          frameSize: { value: new THREE.Vector2(info.width, info.height) },
          texSize: { value: new THREE.Vector2((tex.image as { width?: number })?.width ?? 2048, (tex.image as { height?: number })?.height ?? 1024) },
          a2c: { value: quality !== 'low' ? 1 : 0 },
        },
      ]),
      fog: true,
      side: THREE.DoubleSide,
      alphaToCoverage: quality !== 'low',
    });
    mat.uniforms.map.value = tex;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
