// Level-crossing barriers. The map's own barrier meshes (build_autodrome.py, "Barrier")
// had the arm floating beside the post; they are hidden and rebuilt here in place:
// striped post, drive housing with the hinge, red-and-white arm standing raised
// (open) from the hinge with a counterweight stub, and the red signal lamps.
import * as THREE from 'three';

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#f4f4f2' : '#d4211b';
    g.fillRect(0, i * 16, 8, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function rebuildBarriers(root: THREE.Object3D, parent: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const old: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (/^Barrier/.test(o.name) && (o as THREE.Mesh).isMesh) old.push(o as THREE.Mesh);
  });
  if (!old.length) return;

  const stripes = stripeTexture();
  const postMap = stripes.clone();
  postMap.repeat.set(1, 3.0 / 0.5); // 0.25 m bands up the 3 m post
  postMap.needsUpdate = true;
  const armMap = stripes.clone();
  armMap.repeat.set(1, 5.2 / 1.0); // 0.5 m bands along the arm
  armMap.needsUpdate = true;
  const postMat = new THREE.MeshStandardMaterial({ map: postMap, roughness: 0.55 });
  const armMat = new THREE.MeshStandardMaterial({ map: armMap, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, metalness: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0x5a0a08, emissive: 0xff2a1a, emissiveIntensity: 0.25, roughness: 0.3 });

  const postGeo = new THREE.CylinderGeometry(0.07, 0.08, 3.0, 16).translate(0, 1.5, 0);
  const baseGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.12, 16).translate(0, 0.06, 0);
  const housingGeo = new THREE.BoxGeometry(0.34, 0.5, 0.42).translate(0, 0.25, 0);
  const hubGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16).rotateZ(Math.PI / 2);
  // arm: from the hinge up (local +Y), square tube with its stripes
  const armGeo = new THREE.BoxGeometry(0.09, 5.2, 0.09).translate(0, 2.6 + 0.05, 0);
  const weightGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16).translate(0, -0.3, 0);
  const lampBoxGeo = new THREE.BoxGeometry(0.62, 0.2, 0.16);
  const lensGeo = new THREE.CircleGeometry(0.075, 20);
  const hoodGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.1, 16, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, side: THREE.DoubleSide });

  for (const m of old) {
    // the post is the part of the old mesh below the arm: its footprint gives the spot
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const lo = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y < 2.0) lo.expandByPoint(v);
    }
    m.visible = false;
    if (lo.isEmpty()) continue;
    const x = (lo.min.x + lo.max.x) / 2;
    const z = (lo.min.z + lo.max.z) / 2;
    const y = lo.min.y;

    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.add(new THREE.Mesh(baseGeo, dark));
    const post = new THREE.Mesh(postGeo, postMat);
    post.castShadow = true;
    g.add(post);
    // drive housing at the foot of the post, on the road side (+z: the field)
    const housing = new THREE.Mesh(housingGeo, dark);
    housing.position.set(0, 0.0, 0.28);
    housing.castShadow = true;
    g.add(housing);
    // hinge on top of the housing; the arm stands raised (open), leaning a little away from the road
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.62, 0.28);
    hinge.rotation.x = -0.1;
    const hub = new THREE.Mesh(hubGeo, dark);
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.castShadow = true;
    const weight = new THREE.Mesh(weightGeo, dark);
    hinge.add(hub, arm, weight);
    g.add(hinge);
    // red signal lamps on the post, both faces (towards the road and away from it)
    const lamp = new THREE.Group();
    lamp.position.set(0, 2.4, 0);
    lamp.add(new THREE.Mesh(lampBoxGeo, dark));
    for (const s of [1, -1]) {
      for (const lx of [-0.2, 0.2]) {
        const lens = new THREE.Mesh(lensGeo, red);
        lens.position.set(lx, 0, 0.081 * s);
        if (s < 0) lens.rotation.y = Math.PI;
        const hood = new THREE.Mesh(hoodGeo, hoodMat);
        hood.position.set(lx, 0, (0.081 + 0.05) * s);
        if (s < 0) hood.rotation.y = Math.PI;
        lamp.add(lens, hood);
      }
    }
    g.add(lamp);
    parent.add(g);
  }
}
