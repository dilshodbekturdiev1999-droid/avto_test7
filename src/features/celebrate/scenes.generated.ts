// GENERATED from D:/prava-animations/v2/build2.py by export_scenes.py. Do not edit by hand.
/* eslint-disable */
// @ts-nocheck

export interface SceneDef { dur: number; css: string; body: string; run: (L: any, THREE: any, gsap: any, tl: any, document: any, P: any) => (t: number) => void }

export const SCENES: Record<string, SceneDef> = {
  "passed": {
    dur: 5.2,
    css: "\n  #n { top: 835px; height: 250px; font-size: 230px; }\n  #title { top: 1500px; font-size: 96px; }\n  #sub { top: 1625px; font-size: 42px; }\n",
    body: "\n  <div id=\"n\" class=\"ui num\"></div>\n  <div id=\"title\" class=\"ui title\">Табриклаймиз!</div>\n  <div id=\"sub\" class=\"ui sub\">Мавзу топширилди. Кейинги мавзу очилди</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#0c1a4a', bottom: '#02040d', glow: '#1e46ff', glowPos: [0.5, 0.52], glowSize: 0.42, glowStrength: 0.3, bloomStrength: 0.45, bloomThreshold: 0.88, bloomRadius: 0.45, fov: 32 });
const { scene, camera } = st;
const VALUE = __P.value / 100, R = 1.18;
scene.add(new THREE.AmbientLight('#8ea2ff', 0.25));
const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-3, 4, 6); scene.add(key);

// track: dark polished metal
const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 32, 220), new THREE.MeshStandardMaterial({ color: '#182660', metalness: 0.95, roughness: 0.28 }));
scene.add(track);
// the progress itself: light running through glass
const prog = L.arcTube(R, 0.07, Math.PI / 2, Math.PI / 2 - Math.PI * 2 * VALUE, 360,
  new THREE.MeshStandardMaterial({ color: '#063b2a', emissive: '#2fe0a0', emissiveIntensity: 1.15, metalness: 0.2, roughness: 0.25 }));
scene.add(prog.mesh);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('#eafff6').multiplyScalar(2.2) }));
scene.add(head);

// badge: an emerald disc with a check, flips in
const badge = new THREE.Group();
const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 64), new THREE.MeshPhysicalMaterial({ color: '#0fb57f', metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, emissive: '#0a6b4b', emissiveIntensity: 0.15 }));
disc.rotation.x = Math.PI / 2; badge.add(disc);
const tick = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.1, roughness: 0.3 });
const c1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.13, 8, 16), tick); c1.position.set(-0.07, -0.02, 0.07); c1.rotation.z = 0.8; badge.add(c1);
const c2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.27, 8, 16), tick); c2.position.set(0.06, 0.05, 0.07); c2.rotation.z = -0.68; badge.add(c2);
badge.position.set(Math.cos(Math.PI / 4) * R, Math.sin(Math.PI / 4) * R, 0.25);
scene.add(badge);

// shockwave when the ring closes
const wave = new THREE.Mesh(new THREE.TorusGeometry(R, 0.02, 16, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7dffd0').multiplyScalar(1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(wave);

const sparks = new L.Sparks(st, 4000, 0.8);
const conf = L.confetti(st, { count: 340, seed: 11, origins: [{ at: [0, 0, -0.4], dir: [0, 1, 0.35], cone: 1.15, speed: 9.5, t0: 2.25, spread: 0.06 }], life: 3.6, gravity: 3.6, drag: 1.5 });
const dust = []; { const r = L.rng(3); for (let i = 0; i < 90; i++) dust.push([ (r() - 0.5) * 7, (r() - 0.5) * 12, -2 - r() * 6, r() * 6.28, 0.02 + r() * 0.03 ]); }
const mint = new THREE.Color('#7dffd0'), soft = new THREE.Color('#9db4ff');
const T_CLOSE = 2.25;

L.odometer(tl, document.getElementById('n'), Math.round(VALUE * 100), 0.45, 1.75, { height: 250, suffix: '%', suffixClass: 'pct' });
gsap.set('#n', { opacity: 0 }); tl.to('#n', { opacity: 1, duration: 0.5 }, 0.35);
L.revealText(tl, document.getElementById('title'), 2.55);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 2.95);
tl.to({}, { duration: 5.2 }, 0);

function renderAt(t) {
  const p = L.easeInOutCubic(L.seg(t, 0.35, T_CLOSE));
  prog.set(p);
  const a = Math.PI / 2 - Math.PI * 2 * VALUE * p;
  head.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.02);
  head.visible = t > 0.35 && t < T_CLOSE + 0.15;
  head.scale.setScalar(1 + Math.sin(t * 20) * 0.08);

  // the ring breathes in once when it closes
  const hit = Math.exp(-Math.max(0, t - T_CLOSE) * 4) * (t > T_CLOSE ? 1 : 0);
  prog.mesh.material.emissiveIntensity = 1.15 + hit * 1.2;
  const pulse = 1 + hit * 0.05;
  prog.mesh.scale.setScalar(pulse); track.scale.setScalar(pulse);
  const w = L.seg(t, T_CLOSE, T_CLOSE + 1.1);
  wave.scale.setScalar(1 + L.easeOutExpo(w) * 0.95);
  wave.material.opacity = t > T_CLOSE ? (1 - w) * 0.6 : 0;
  st.bloom.strength = 0.45 + hit * 0.35;
  st.bgUniforms.uFlash.value = hit * 0.02;

  const b = L.seg(t, 2.35, 3.4);
  badge.scale.setScalar(L.spring(b * 1.05, 5.5, 1.5) * (t > 2.35 ? 1 : 0));
  badge.rotation.y = (1 - L.easeOutExpo(b)) * -Math.PI * 1.5;

  sparks.begin();
  // a comet trail behind the moving head
  if (t > 0.35 && t < T_CLOSE + 0.2) {
    for (let j = 0; j < 60; j++) {
      const pj = L.easeInOutCubic(L.seg(t - j * 0.012, 0.35, T_CLOSE));
      const aj = Math.PI / 2 - Math.PI * 2 * VALUE * pj;
      const jit = L.hash(j * 13.7 + Math.floor(t * 30)) - 0.5;
      sparks.push(Math.cos(aj) * (R + jit * 0.05), Math.sin(aj) * (R + jit * 0.05), 0.05, mint, 0.09 * (1 - j / 60), (1 - j / 60) * 0.6);
    }
  }
  // radial sparks at the close
  if (t > T_CLOSE) {
    const r = L.rng(91), ag = t - T_CLOSE;
    for (let i = 0; i < 160; i++) {
      const ang = r() * 6.283, sp = 2 + r() * 3.2, life = 0.7 + r() * 0.6;
      if (ag > life) continue;
      const d = R + sp * (1 - Math.exp(-ag * 3)) / 3 * 1.4;
      sparks.push(Math.cos(ang) * d, Math.sin(ang) * d - ag * ag * 0.3, (r() - 0.5) * 0.4, mint, 0.07, (1 - ag / life) * 0.9);
    }
  }
  for (const d of dust) sparks.push(d[0] + Math.sin(t * 0.3 + d[3]) * 0.2, d[1] + t * 0.08, d[2], soft, d[4] * 2.2, 0.25);
  sparks.end();
  conf.update(t);

  camera.position.set(Math.sin(t * 0.25) * 0.15, -0.05, 9.6 - L.easeOutCubic(L.seg(t, 0, 3)) * 0.55);
  camera.lookAt(0, 0, 0);
  st.render(t);
}

      return renderAt;
    },
  },
  "failed": {
    dur: 4.8,
    css: "\n  #n { top: 1120px; height: 210px; font-size: 190px; color: #ffc46b; }\n  #lbl { font-size: 30px; font-weight: 600; color: #6ee7b7; letter-spacing: .04em; width: 140px; left: 0; }\n  #title { top: 1440px; font-size: 88px; }\n  #sub { top: 1560px; font-size: 40px; }\n",
    body: "\n  <div id=\"lbl\" class=\"ui\">95%</div>\n  <div id=\"n\" class=\"ui num\"></div>\n  <div id=\"title\" class=\"ui title\">Қайта уриниб кўринг</div>\n  <div id=\"sub\" class=\"ui sub\">Ўтиш учун 95% керак. Сиз жуда яқинсиз</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#171a22', bottom: '#040507', glow: '#ff8a1f', glowPos: [0.5, 0.6], glowSize: 0.38, glowStrength: 0.06, bloomStrength: 0.5, bloomThreshold: 0.9, fov: 32, envIntensity: 0.35, exposure: 0.9 });
const { scene, camera } = st;
const VALUE = __P.value / 100, R = 1.18, CY = 0.05;
scene.add(new THREE.AmbientLight('#ffffff', 0.15));
const key = new THREE.SpotLight('#ffffff', 18, 30, 0.5, 0.7); key.position.set(-3, 5, 7); key.target.position.set(0, CY, 0); scene.add(key, key.target);
const rim = new THREE.PointLight('#ffb36b', 3, 12); rim.position.set(3, 2, 2); scene.add(rim);

const g = new THREE.Group(); g.position.y = CY; g.scale.setScalar(0.78); scene.add(g);
const ang = (p) => Math.PI - Math.PI * p;               // 0% left, 100% right
// face and chrome bezel
const face = new THREE.Mesh(new THREE.CircleGeometry(R + 0.2, 128, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.55, metalness: 0.3 }));
face.position.z = -0.08; g.add(face);
const bezel = L.arcTube(R + 0.24, 0.07, Math.PI + 0.08, -0.08, 200, new THREE.MeshStandardMaterial({ color: '#9aa3b2', metalness: 1, roughness: 0.32 }));
bezel.set(1); g.add(bezel.mesh);
// zones: they power on one after another
const zones = [[0, 0.6, '#ff3b4e'], [0.6, 0.95, '#ffb020'], [0.95, 1, '#22e39b']].map(([a, b, c]) => {
  const z = L.arcTube(R - 0.02, 0.06, ang(a) - 0.005, ang(b) + 0.005, 120, new THREE.MeshStandardMaterial({ color: '#111', emissive: c, emissiveIntensity: 0, roughness: 0.4 }));
  z.set(1); g.add(z.mesh); return z;
});
// ticks
const tickMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', emissive: '#cbd5e1', emissiveIntensity: 0.05, metalness: 0.4, roughness: 0.4 });
for (let i = 0; i <= 20; i++) {
  const p = i / 20, a = ang(p), major = i % 5 === 0, len = major ? 0.17 : 0.09;
  const m = new THREE.Mesh(new THREE.BoxGeometry(major ? 0.022 : 0.012, len, 0.02), tickMat);
  m.position.set(Math.cos(a) * (R - 0.2 - len / 2), Math.sin(a) * (R - 0.2 - len / 2), 0);
  m.rotation.z = a - Math.PI / 2; g.add(m);
}
// needle
const needle = new THREE.Group(); g.add(needle);
const nMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.6, roughness: 0.25 });
const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, R - 0.12, 24), nMat); blade.position.y = (R - 0.12) / 2; blade.position.z = 0.04; needle.add(blade);
const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb020').multiplyScalar(2) })); tip.position.set(0, R - 0.16, 0.05); needle.add(tip);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 64), new THREE.MeshStandardMaterial({ color: '#a7afbd', metalness: 1, roughness: 0.3 }));
hub.rotation.x = Math.PI / 2; hub.position.z = 0.08; g.add(hub);
const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 32), new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.5, roughness: 0.3 }));
cap.rotation.x = Math.PI / 2; cap.position.z = 0.1; g.add(cap);

const sparks = new L.Sparks(st, 600, 1);
const dust = []; { const r = L.rng(5); for (let i = 0; i < 70; i++) dust.push([(r() - 0.5) * 7, (r() - 0.5) * 11, -1 - r() * 5, r() * 6.28]); }
const warm = new THREE.Color('#ffcf9a');

camera.position.set(0, -0.35, 9.2); camera.lookAt(0, 0.25, 0); camera.updateMatrixWorld();
const lp = L.toScreen(camera, new THREE.Vector3(Math.cos(ang(0.95)) * (R + 0.55) * 0.78, CY + Math.sin(ang(0.95)) * (R + 0.55) * 0.78, 0));
const lbl = document.getElementById('lbl'); lbl.style.left = (lp.x - 70) + 'px'; lbl.style.top = (lp.y - 20) + 'px';
gsap.set(lbl, { opacity: 0 }); tl.to(lbl, { opacity: 1, duration: 0.6 }, 0.9);

L.odometer(tl, document.getElementById('n'), Math.round(VALUE * 100), 0.75, 1.6, { height: 210, suffix: '%', suffixClass: 'pct' });
gsap.set('#n', { opacity: 0 }); tl.to('#n', { opacity: 1, duration: 0.5 }, 0.7);
L.revealText(tl, document.getElementById('title'), 2.35);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 2.75);
tl.to({}, { duration: 4.8 }, 0);

function renderAt(t) {
  zones.forEach((z, i) => { z.mesh.material.emissiveIntensity = 0.9 * L.easeOutCubic(L.seg(t, 0.15 + i * 0.18, 0.55 + i * 0.18)); });
  // the needle swings past the mark, then settles where the score is
  const x = Math.max(0, t - 0.7);
  const p = VALUE * L.spring(x, 3.4, 0.95);
  needle.rotation.z = (0.5 - p) * Math.PI;
  tip.material.color.set(p > 0.6 ? '#ffb020' : '#ff3b4e').multiplyScalar(2);
  sparks.begin();
  for (const d of dust) sparks.push(d[0] + Math.sin(t * 0.4 + d[3]) * 0.15, d[1] + Math.sin(t * 0.2 + d[3]) * 0.1, d[2], warm, 0.05, 0.22);
  sparks.end();
  camera.position.set(Math.sin(t * 0.3) * 0.12, -0.35, 9.2 - L.easeOutCubic(L.seg(t, 0, 4)) * 0.35);
  camera.lookAt(0, 0.25, 0);
  st.render(t);
}

      return renderAt;
    },
  },
  "final": {
    dur: 5.6,
    css: "\n  #title { top: 1600px; font-size: 76px; }\n  #sub { top: 1705px; font-size: 42px; }\n",
    body: "\n  <div id=\"title\" class=\"ui title\">Якуний тест топширилди</div>\n  <div id=\"sub\" class=\"ui sub\">Сиз имтиҳонга тайёрсиз</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#0d1633', bottom: '#03050c', glow: '#3157ff', glowPos: [0.5, 0.55], glowSize: 0.5, glowStrength: 0.14, bloomStrength: 0.35, bloomThreshold: 1.2, fov: 30, shadows: true, envIntensity: 0.25, exposure: 0.85 });
const { scene, camera, renderer } = st;
const VALUE = __P.value;
scene.add(new THREE.AmbientLight('#b8c4ff', 0.35));
const key = new THREE.DirectionalLight('#fff4e0', 1.5); key.position.set(-2.5, 3.5, 8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5; key.shadow.radius = 6; key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight('#7f9bff', 0.6); fill.position.set(4, -2, 5); scene.add(fill);

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

// the desk
const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#0c1430', roughness: 0.85, metalness: 0.1 }));
desk.position.z = -0.03; desk.receiveShadow = true; scene.add(desk);

// the sheet: an exam form, slightly curled
const PW = 2.7, PH = 3.6;
const paperTex = canvasTex(1080, 1440, (c, w, h) => {
  c.fillStyle = '#ecebe5'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#255dff'; c.fillRect(90, 100, 420, 46);
  c.fillStyle = '#0f172a'; c.font = '700 64px "IBM Plex Sans"'; c.fillText(__P.text.paper, 90, 250);
  c.fillStyle = '#64748b'; c.font = '500 30px "IBM Plex Sans"'; c.fillText(__P.text.paperSub, 90, 305);
  c.strokeStyle = '#e2e8f0'; c.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const y = 400 + i * 74; c.beginPath(); c.moveTo(90, y); c.lineTo(w - 90, y); c.stroke();
    c.fillStyle = '#cbd5e1'; c.fillRect(90, y - 40, 26, 26); c.fillStyle = '#94a3b8'; c.fillRect(140, y - 34, 380 + ((i * 97) % 300), 14); }
});
const pg = new THREE.PlaneGeometry(PW, PH, 40, 50);
{ const pos = pg.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / (PW / 2), y = pos.getY(i) / (PH / 2); pos.setZ(i, 0.05 * x * x + 0.03 * Math.max(0, -y) * y * y); } pg.computeVertexNormals(); }
const paper = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.92, metalness: 0 }));
paper.castShadow = true; paper.receiveShadow = true; scene.add(paper);

// the ink mark, grainy like a real stamp
const R0 = 340;
const inkTex = canvasTex(1024, 1024, (c, w, h) => {
  const ink = '#0e8f5a';
  c.translate(w / 2, h / 2); c.strokeStyle = ink; c.fillStyle = ink;
  c.lineWidth = 26; c.beginPath(); c.arc(0, 0, R0 + 120, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 8; c.beginPath(); c.arc(0, 0, R0 + 72, 0, Math.PI * 2); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '700 260px "IBM Plex Sans"'; c.fillText(VALUE + '%', 0, -30);
  c.font = '700 92px "IBM Plex Sans"'; c.fillText(__P.text.stamp, 0, 170);
  const word = __P.text.ring;
  c.font = '600 46px "IBM Plex Sans"';
  for (let i = 0; i < word.length; i++) { c.save(); c.rotate(-Math.PI / 2 + (i / word.length) * Math.PI * 2); c.translate(0, -(R0 + 96) + 0); c.fillText(word[i], 0, 0); c.restore(); }
  // wear: knock out specks of ink
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out';
  const r = L.rng(42);
  for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = r() * r() * 9; c.globalAlpha = 0.35 + r() * 0.65; c.beginPath(); c.arc(x, y, s, 0, 6.283); c.fill(); }
});
const ink = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.95), new THREE.MeshStandardMaterial({ map: inkTex, transparent: true, roughness: 0.6, depthWrite: false }));
ink.position.set(0.12, -0.25, 0.072); ink.rotation.z = -0.22; scene.add(ink);

// the stamp: lacquered wooden handle, black block, rubber pad
const stamp = new THREE.Group();
const wood = new THREE.MeshPhysicalMaterial({ color: '#5a2f17', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
const lathe = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.18, 0.05], [0.13, 0.25], [0.12, 0.55], [0.2, 0.75], [0.26, 0.95], [0.22, 1.12], [0.1, 1.2], [0, 1.21]].map(([x, y]) => new THREE.Vector2(x, y)), 64);
const handle = new THREE.Mesh(lathe, wood); handle.rotation.x = Math.PI / 2; handle.position.z = 0.36; handle.castShadow = true; stamp.add(handle);
const block = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 96), new THREE.MeshPhysicalMaterial({ color: '#111827', metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }));
block.rotation.x = Math.PI / 2; block.position.z = 0.2; block.castShadow = true; stamp.add(block);
const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.07, 96), new THREE.MeshStandardMaterial({ color: '#0b3d2a', roughness: 0.8 }));
pad.rotation.x = Math.PI / 2; pad.position.z = 0.035; stamp.add(pad);
scene.add(stamp);

const sparks = new L.Sparks(st, 2000, 1);
const conf = L.confetti(st, { count: 380, seed: 21, origins: [
  { at: [-2.4, -3.4, 1.2], dir: [0.55, 1, 0.5], cone: 0.4, speed: 10, t0: 2.35, spread: 0.12 },
  { at: [2.4, -3.4, 1.2], dir: [-0.55, 1, 0.5], cone: 0.4, speed: 10, t0: 2.4, spread: 0.12 }], life: 3.4, gravity: 3.8, drag: 1.4 });
const inkCol = new THREE.Color('#2bd88f'), dustCol = new THREE.Color('#cbd5ff');
const T_HIT = 1.55;

L.revealText(tl, document.getElementById('title'), 2.6);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 3.0);
tl.to({}, { duration: 5.6 }, 0);

function renderAt(t) {
  // the sheet slides in and settles
  const sp = L.easeOutQuint(L.seg(t, 0, 0.9));
  paper.position.set(0, -0.15 + (1 - sp) * -5.5, 0.02);
  paper.rotation.z = -0.05 + (1 - sp) * 0.3;
  // the stamp: falls faster and faster, hits, holds, lifts away
  let z, x = 0.12, y = -0.25, sq = 1;
  if (t < T_HIT) { const f = L.easeInCubic(L.seg(t, 0.75, T_HIT)); z = L.lerp(7.5, 0.075, f); x = L.lerp(1.6, 0.12, f); y = L.lerp(1.2, -0.25, f); }
  else if (t < T_HIT + 0.35) { z = 0.075; const s = L.seg(t, T_HIT, T_HIT + 0.35); sq = 1 - 0.12 * Math.sin(s * Math.PI) * Math.exp(-s * 2); }
  else { const f = L.easeInOutCubic(L.seg(t, T_HIT + 0.35, T_HIT + 1.1)); z = L.lerp(0.075, 8.5, f); x = L.lerp(0.12, 2.5, f); y = L.lerp(-0.25, 1.4, f); }
  stamp.position.set(x, y, z); stamp.scale.set(1, 1, sq); stamp.rotation.z = -0.22 + (z - 0.075) * 0.04;
  stamp.visible = t > 0.7 && z < 8.4;
  ink.material.opacity = t >= T_HIT ? 0.93 : 0;
  ink.scale.setScalar(t >= T_HIT ? 1 + 0.03 * Math.exp(-(t - T_HIT) * 8) : 1);

  const a = t - T_HIT;
  sparks.begin();
  if (a > 0) {
    const r = L.rng(77);
    for (let i = 0; i < 140; i++) {
      const ang = r() * 6.283, sp2 = 0.8 + r() * 1.8, life = 0.5 + r() * 0.7; if (a > life) continue;
      const d = 1.0 + sp2 * (1 - Math.exp(-a * 4)) / 4 * 2.2;
      sparks.push(0.12 + Math.cos(ang) * d, -0.25 + Math.sin(ang) * d, 0.1 + a * 0.6 * r(), i % 3 ? dustCol : inkCol, 0.05 + r() * 0.04, (1 - a / life) * 0.55);
    }
  }
  sparks.end();
  conf.update(t);
  st.bloom.strength = 0.55 + Math.max(0, Math.exp(-a * 6)) * (a > 0 ? 0.6 : 0);

  // camera: slow push, a hard jolt on impact, then a gentle pull back
  const shake = a > 0 ? Math.exp(-a * 7) * 0.09 : 0;
  camera.position.set(0.35 + Math.sin(a * 55) * shake, -2.3 + Math.cos(a * 47) * shake, 13.2 - L.easeOutCubic(L.seg(t, 0, 1.6)) * 0.9 + L.easeInOutCubic(L.seg(t, 2.3, 5.6)) * 0.7);
  camera.lookAt(0, -0.9, 0);
  st.render(t);
}

      return renderAt;
    },
  },
  "q200": {
    dur: 5.2,
    css: "\n  #n { top: 830px; height: 230px; font-size: 210px; text-shadow: 0 0 60px rgba(255,140,40,.55); }\n  #lbl { top: 1060px; font-size: 40px; font-weight: 500; color: rgba(255,214,170,.85); }\n  #title { top: 1520px; font-size: 96px; }\n  #sub { top: 1640px; font-size: 42px; }\n",
    body: "\n  <div id=\"n\" class=\"ui num\"></div>\n  <div id=\"lbl\" class=\"ui\">савол ечилди</div>\n  <div id=\"title\" class=\"ui title\">200 та савол!</div>\n  <div id=\"sub\" class=\"ui sub\">Марафон тугади. Сизни тўхтатиб бўлмайди</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#1c0904', bottom: '#020100', glow: '#ff5a00', glowPos: [0.5, 0.5], glowSize: 0.36, glowStrength: 0.16, bloomStrength: 0.85, bloomThreshold: 0.6, bloomRadius: 0.55, fov: 32 });
const { scene, camera } = st;
const R = 1.2, N = 3200, T_CLOSE = 2.9;
const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.012, 12, 220), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a1a').multiplyScalar(0.35) }));
scene.add(track);
const sparks = new L.Sparks(st, N + 1600, 1.0);
const r = L.rng(17);
const P = []; for (let i = 0; i < N; i++) P.push([i / N, 0.7 + r() * 1.3, r(), r() < 0.5 ? -1 : 1, r(), r()]);
const E = []; for (let i = 0; i < 300; i++) E.push([(r() - 0.5) * 7, r(), 0.3 + r() * 0.5, r() * 6.28, -1 - r() * 4]);
const ramp = [new THREE.Color('#fffbe8'), new THREE.Color('#ffd36b'), new THREE.Color('#ff8a1f'), new THREE.Color('#e3360b'), new THREE.Color('#3a0a02')];
const col = new THREE.Color();
function fire(x) { const k = Math.min(3.999, x * 4), i = Math.floor(k); return col.copy(ramp[i]).lerp(ramp[i + 1], k - i); }

L.odometer(tl, document.getElementById('n'), 200, 0.35, 2.4, { height: 230 });
gsap.set(['#n', '#lbl'], { opacity: 0 }); tl.to('#n', { opacity: 1, duration: 0.5 }, 0.3); tl.to('#lbl', { opacity: 1, duration: 0.8 }, 0.9);
L.revealText(tl, document.getElementById('title'), 3.05);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 3.45);
tl.to('#n', { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, T_CLOSE);
tl.to({}, { duration: 5.2 }, 0);

function renderAt(t) {
  const prog = L.easeInOutCubic(L.seg(t, 0.3, T_CLOSE));
  const hit = t > T_CLOSE ? Math.exp(-(t - T_CLOSE) * 3) : 0;
  sparks.begin();
  for (const p of P) {
    if (p[0] > prog) continue;
    const age = (t * p[1] + p[2]) % 1;
    const a = Math.PI / 2 - p[0] * Math.PI * 2 - age * 0.22;
    const out = R + p[3] * Math.pow(age, 1.4) * (0.18 + p[4] * 0.22) * (1 + hit);
    const rise = age * age * 0.35;
    const flick = 0.75 + 0.25 * Math.sin(t * 30 + p[5] * 40);
    const c = fire(age);
    sparks.push(Math.cos(a) * out + (p[5] - 0.5) * 0.04, Math.sin(a) * out + rise, (p[4] - 0.5) * 0.25, c, 0.09 + age * 0.2, (1 - age) * flick * 0.9);
  }
  // the burning head of the ring
  if (t < T_CLOSE + 0.1) { const a = Math.PI / 2 - prog * Math.PI * 2; for (let j = 0; j < 8; j++) sparks.push(Math.cos(a) * R, Math.sin(a) * R, 0.05, ramp[0], 0.3 - j * 0.02, 0.9); }
  // embers drifting up the whole screen
  for (const e of E) { const age = (t * e[2] + e[1]) % 1; sparks.push(e[0] + Math.sin(t * 1.3 + e[3]) * 0.25, -6 + age * 12, e[4], fire(0.2 + age * 0.6), 0.05, (1 - age) * 0.8); }
  // the flare when the ring closes
  if (t > T_CLOSE) { const rr = L.rng(5), ag = t - T_CLOSE; for (let i = 0; i < 260; i++) { const an = rr() * 6.283, sp = 1.5 + rr() * 3.5, life = 0.6 + rr() * 0.8; if (ag > life) continue; const d = R + sp * (1 - Math.exp(-ag * 3)) / 3 * 1.6; sparks.push(Math.cos(an) * d, Math.sin(an) * d - ag * ag * 0.6, (rr() - 0.5) * 0.6, fire(ag / life * 0.8), 0.08, (1 - ag / life)); } }
  sparks.end();
  track.material.color.set('#ff7a1a').multiplyScalar(0.35 + hit * 2);
  st.bloom.strength = 0.85 + hit * 0.5;
  st.bgUniforms.uGlowStrength.value = 0.12 + prog * 0.08 + hit * 0.15;
  camera.position.set(Math.sin(t * 0.4) * 0.25, Math.cos(t * 0.3) * 0.1, 9.4 - L.easeOutCubic(L.seg(t, 0, 3)) * 0.4);
  camera.lookAt(0, 0, 0);
  st.render(t);
}

      return renderAt;
    },
  },
  "q1200": {
    dur: 6.2,
    css: "\n  #n { top: 850px; height: 200px; font-size: 176px; color: #ffe2a3; text-shadow: 0 0 50px rgba(255,190,90,.45); }\n  #title { top: 1500px; font-size: 80px; }\n  #sub { top: 1610px; font-size: 42px; }\n",
    body: "\n  <div id=\"n\" class=\"ui num\"></div>\n  <div id=\"title\" class=\"ui title\">Барча саволлар ечилди</div>\n  <div id=\"sub\" class=\"ui sub\">1200 дан ортиқ савол ортда қолди</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#0a0f26', bottom: '#010208', glow: '#ffb14a', glowPos: [0.5, 0.52], glowSize: 0.35, glowStrength: 0.12, bloomStrength: 1.0, bloomThreshold: 0.6, bloomRadius: 0.6, fov: 32 });
const { scene, camera } = st;
const N = 1200, r = L.rng(12), T_ALL = 3.4;
const pts = [];
for (let i = 0; i < N; i++) {
  const ring = i % 3, k = Math.floor(i / 3), ang = Math.PI / 2 - (k / (N / 3)) * Math.PI * 2 + ring * 0.006;
  const rad = 1.04 + ring * 0.13;
  // start somewhere in a wide cloud, arrive in index order
  const s = new THREE.Vector3((r() - 0.5) * 12, (r() - 0.5) * 18, -6 + r() * 9);
  pts.push({ s, ang, rad, t0: 0.25 + (k / (N / 3)) * 2.6 + r() * 0.35, dur: 0.9 + r() * 0.5, tw: r() * 6.28, c: r() < 0.82 ? 0 : 1 });
}
const gold = new THREE.Color('#ffc861'), white = new THREE.Color('#fff7e6');
const sparks = new L.Sparks(st, N * 2 + 600, 1.2);
const tilt = new THREE.Euler(), m = new THREE.Matrix4(), v = new THREE.Vector3(), tgt = new THREE.Vector3();
const conf = L.confetti(st, { count: 260, seed: 31, colors: ['#ffd166', '#f7b733', '#fff1c1', '#ffffff'], origins: [{ at: [0, 0, -0.6], dir: [0, 1, 0.4], cone: 1.4, speed: 9, t0: T_ALL + 0.25, spread: 0.1 }], life: 3, gravity: 3.6, drag: 1.5 });
const stars = []; for (let i = 0; i < 160; i++) stars.push([(r() - 0.5) * 30, (r() - 0.5) * 50, -18 - r() * 10, r() * 6.28]);

L.odometer(tl, document.getElementById('n'), 1200, 0.4, 3.0, { height: 200, suffix: '+', suffixClass: 'pct' });
gsap.set('#n', { opacity: 0 }); tl.to('#n', { opacity: 1, duration: 0.6 }, 0.35);
L.revealText(tl, document.getElementById('title'), 3.75);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 4.15);
tl.to({}, { duration: 6.2 }, 0);

function renderAt(t) {
  // the halo turns from a tilted plane to face us as it completes
  const face = L.easeInOutCubic(L.seg(t, 1.0, T_ALL + 0.6));
  tilt.set((1 - face) * 1.05, (1 - face) * 0.35, t * 0.05);
  m.makeRotationFromEuler(tilt);
  const wave = t > T_ALL + 0.4 ? ((t - T_ALL - 0.4) * 2.2) % 6.283 : -9;
  sparks.begin();
  for (const p of pts) {
    const x = L.seg(t, p.t0, p.t0 + p.dur);
    if (x <= 0) continue;
    tgt.set(Math.cos(p.ang + (1 - face) * 0.0) * p.rad, Math.sin(p.ang) * p.rad, 0).applyMatrix4(m);
    const e = L.easeInOutCubic(x);
    // spiral in rather than fly straight
    const sw = (1 - e) * 1.8;
    v.copy(p.s).lerp(tgt, e);
    const cx = v.x * Math.cos(sw) - v.y * Math.sin(sw), cy = v.x * Math.sin(sw) + v.y * Math.cos(sw);
    let a = 0.25 + 0.75 * e;
    let size = 0.05 + (1 - e) * 0.05;
    const d = Math.abs(((p.ang - Math.PI / 2 + wave + 9.42) % 6.283) - 3.14);
    if (wave > -1) { const w = Math.exp(-d * d * 14); a += w * 1.4; size += w * 0.05; }
    a *= 0.75 + 0.25 * Math.sin(t * 6 + p.tw);
    sparks.push(cx, cy, v.z, p.c ? white : gold, size, Math.min(1.6, a));
    // a short glowing tail while flying
    if (x < 1) { const e2 = L.easeInOutCubic(L.seg(t - 0.05, p.t0, p.t0 + p.dur)); v.copy(p.s).lerp(tgt, e2); sparks.push(v.x, v.y, v.z, gold, size * 0.7, 0.35 * (1 - e)); }
  }
  for (const s of stars) sparks.push(s[0], s[1], s[2], white, 0.06, 0.25 + 0.2 * Math.sin(t * 2 + s[3]));
  sparks.end();
  conf.update(t);
  const hit = t > T_ALL + 0.25 ? Math.exp(-(t - T_ALL - 0.25) * 3) : 0;
  st.bloom.strength = 1.0 + hit * 1.0;
  st.bgUniforms.uGlowStrength.value = 0.12 + face * 0.18 + hit * 0.25;
  const orbit = (1 - L.easeOutCubic(L.seg(t, 0, 4))) * 0.6;
  camera.position.set(Math.sin(orbit) * 9.6, 0.2, Math.cos(orbit) * 9.6);
  camera.lookAt(0, 0, 0);
  st.render(t);
}

      return renderAt;
    },
  },
  "examday": {
    dur: 6.0,
    css: "\n  #title { top: 640px; font-size: 250px; font-weight: 700; letter-spacing: -0.04em;\n           background: linear-gradient(100deg, #fff1c7 0%, #ffcf6e 35%, #fff8e5 48%, #ffc04a 62%, #e9a33a 100%);\n           background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }\n  #sub { top: 940px; font-size: 46px; color: rgba(255,255,255,.82); }\n",
    body: "\n  <div id=\"title\" class=\"ui title\">Омад!</div>\n  <div id=\"sub\" class=\"ui sub\">Бугун имтиҳон куни. Сиз тайёрсиз</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#03040d', bottom: '#11163a', glow: '#3b4cff', glowPos: [0.5, 0.05], glowSize: 0.55, glowStrength: 0.25, bloomStrength: 1.1, bloomThreshold: 0.55, bloomRadius: 0.65, fov: 34, flashColor: '#5b4a8a' });
const { scene, camera } = st;
// a far city on the horizon: dark blocks with a few lit windows
const city = document.createElement('canvas'); city.width = 2048; city.height = 512;
{ const c = city.getContext('2d'), r = L.rng(9); c.fillStyle = 'rgba(0,0,0,0)'; c.fillRect(0, 0, 2048, 512);
  let x = 0; while (x < 2048) { const w = 40 + r() * 110, h = 80 + r() * 300; c.fillStyle = '#04050c'; c.fillRect(x, 512 - h, w, h);
    for (let wy = 512 - h + 14; wy < 500; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (r() < 0.16) { c.fillStyle = r() < 0.7 ? 'rgba(255,214,150,.85)' : 'rgba(170,200,255,.8)'; c.fillRect(wx, wy, 5, 8); }
    x += w + 2; } }
const ct = new THREE.CanvasTexture(city); ct.colorSpace = THREE.SRGBColorSpace;
const skyline = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: ct, transparent: true }));
skyline.position.set(0, -4.4, -4); scene.add(skyline);
const sparks = new L.Sparks(st, 9000, 1.2);
const fw = L.fireworks([
  { t0: 0.15, from: [-1.2, -7, -6], to: [-1.6, 3.2, -6], rise: 0.9, color: '#ffcf6e', count: 150, speed: 3.4, kind: 'peony' },
  { t0: 0.55, from: [1.6, -7, -7], to: [1.9, 4.6, -7], rise: 1.0, color: '#ff5c8a', count: 150, speed: 3.6, kind: 'peony' },
  { t0: 1.05, from: [0, -7, -8], to: [0.2, 5.6, -8], rise: 1.05, color: '#ffd98a', count: 190, speed: 4.2, kind: 'willow' },
  { t0: 1.9, from: [-2, -7, -5], to: [-2.3, 1.2, -5], rise: 0.8, color: '#5cc8ff', count: 130, speed: 3.0, kind: 'crackle' },
  { t0: 2.4, from: [2.2, -7, -5.5], to: [2.4, 1.6, -5.5], rise: 0.85, color: '#6ee7b7', count: 130, speed: 3.0, kind: 'peony' },
  { t0: 3.0, from: [-0.6, -7, -9], to: [-0.9, 6.4, -9], rise: 1.1, color: '#b794ff', count: 170, speed: 4.4, kind: 'peony' },
  { t0: 3.6, from: [1.2, -7, -7], to: [1.4, 3.8, -7], rise: 0.95, color: '#ffcf6e', count: 170, speed: 3.8, kind: 'crackle' },
  { t0: 4.2, from: [-1.6, -7, -8], to: [-1.8, 5.0, -8], rise: 1.0, color: '#ff8fb1', count: 160, speed: 4.0, kind: 'willow' },
], 33);
const r = L.rng(4), stars = []; for (let i = 0; i < 260; i++) stars.push([(r() - 0.5) * 30, -2 + r() * 26, -20, r() * 6.28, 0.03 + r() * 0.05]);
const starCol = new THREE.Color('#dfe6ff');

gsap.set('#title', { opacity: 0, y: 70, scale: 0.92, filter: 'blur(18px)' });
tl.to('#title', { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out' }, 1.7);
tl.fromTo('#title', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 2.6, ease: 'power2.inOut' }, 2.3);
gsap.set('#sub', { opacity: 0, y: 28 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, 2.5);
tl.to({}, { duration: 6.0 }, 0);

function renderAt(t) {
  sparks.begin();
  for (const s of stars) sparks.push(s[0], s[1], s[2], starCol, s[4] * 3, 0.35 + 0.3 * Math.sin(t * 2.4 + s[3]));
  const flash = fw.emit(t, sparks);
  sparks.end();
  st.bgUniforms.uFlash.value = Math.min(0.12, flash);
  skyline.material.color.setScalar(1 + flash * 3);
  camera.position.set(Math.sin(t * 0.2) * 0.2, -0.6 + L.easeOutCubic(L.seg(t, 0, 5)) * 0.5, 10);
  camera.lookAt(0, 0.6, -4);
  st.render(t);
}

      return renderAt;
    },
  },
  "alllessons": {
    dur: 7.4,
    css: "\n  #n { top: 1420px; height: 150px; font-size: 136px; color: #ffe2a3; }\n  #title { top: 1590px; font-size: 84px; }\n  #sub { top: 1700px; font-size: 44px; color: #ffd98a; font-weight: 500; }\n",
    body: "\n  <div id=\"n\" class=\"ui num\"></div>\n  <div id=\"title\" class=\"ui title\">Барча дарслар тугади</div>\n  <div id=\"sub\" class=\"ui sub\">Сиз чемпионсиз</div>\n",
    run: (L, THREE, gsap, tl, document, __P) => {

const st = L.createStage({ top: '#0d0818', bottom: '#000000', glow: '#ffb84d', glowPos: [0.5, 0.62], glowSize: 0.42, glowStrength: 0.16, bloomStrength: 0.45, bloomThreshold: 0.95, bloomRadius: 0.5, fov: 30, envIntensity: 0.55, exposure: 0.9 });
const { scene, camera } = st;
scene.add(new THREE.AmbientLight('#ffffff', 0.08));
const key = new THREE.SpotLight('#fff1d6', 45, 40, 0.24, 0.7); key.position.set(-2.5, 7, 6); key.target.position.set(0, 0.8, 0); scene.add(key, key.target);
const rimL = new THREE.SpotLight('#7aa2ff', 30, 30, 0.5, 0.6); rimL.position.set(-5, 3, -4); rimL.target.position.set(0, 1, 0); scene.add(rimL, rimL.target);
const rimR = new THREE.SpotLight('#ffb36b', 30, 30, 0.5, 0.6); rimR.position.set(5, 3, -4); rimR.target.position.set(0, 1, 0); scene.add(rimR, rimR.target);

// the trophy
const gold = new THREE.MeshPhysicalMaterial({ color: '#e9b04a', metalness: 1, roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
const stone = new THREE.MeshPhysicalMaterial({ color: '#0b0b10', metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
const trophy = new THREE.Group();
const V = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
const cup = new THREE.Mesh(new THREE.LatheGeometry(V([[0, 1.05], [0.16, 1.06], [0.3, 1.14], [0.48, 1.36], [0.6, 1.68], [0.66, 2.02], [0.68, 2.3], [0.71, 2.34], [0.69, 2.38], [0.63, 2.35], [0.6, 2.05], [0.52, 1.7], [0.0, 1.5]]), 96), gold);
trophy.add(cup);
const stem = new THREE.Mesh(new THREE.LatheGeometry(V([[0, 0.3], [0.32, 0.3], [0.33, 0.36], [0.16, 0.46], [0.08, 0.62], [0.07, 0.86], [0.14, 0.98], [0.2, 1.06], [0, 1.08]]), 64), gold);
trophy.add(stem);
for (const s of [-1, 1]) {
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 24, 64, Math.PI), gold);
  h.position.set(s * 0.6, 1.86, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; trophy.add(h);
}
const base1 = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 0.85), stone); base1.position.y = 0.15; trophy.add(base1);
const base2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 1.0), stone); base2.position.y = -0.08; trophy.add(base2);
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.02), gold); plate.position.set(0, 0.15, 0.43); trophy.add(plate);
scene.add(trophy);

// polished floor that catches the light
const fadeC = document.createElement('canvas'); fadeC.width = fadeC.height = 512;
{ const c = fadeC.getContext('2d'), g = c.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#fff'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, 512, 512); }
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 96), new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0.0, roughness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.3, transparent: true, alphaMap: new THREE.CanvasTexture(fadeC), depthWrite: false }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.16; scene.add(floor);

// light beams behind, slowly turning
const beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uA: { value: 0 }, uColor: { value: new THREE.Color('#ffc861') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec2 vUv; uniform float uA; uniform vec3 uColor; void main(){ float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x); float len = pow(1.0 - vUv.y, 1.6); gl_FragColor = vec4(uColor * edge * len * uA, edge * len * uA); }' });
const beams = new THREE.Group(); beams.position.set(0, 1.5, -2.5); scene.add(beams);
for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 9), beamMat); b.geometry.translate(0, 4.5, 0); b.rotation.z = (i / 9) * Math.PI * 2; beams.add(b); }

const sparks = new L.Sparks(st, 9000, 1.2);
const fw = L.fireworks([
  { t0: 2.4, from: [-2.5, -6, -10], to: [-3, 4.5, -10], rise: 0.9, color: '#ffcf6e', count: 160, speed: 4, kind: 'peony' },
  { t0: 2.9, from: [2.6, -6, -11], to: [3.2, 5.2, -11], rise: 0.95, color: '#ff5c8a', count: 160, speed: 4.2, kind: 'peony' },
  { t0: 3.5, from: [0, -6, -13], to: [0.4, 7, -13], rise: 1.05, color: '#ffd98a', count: 200, speed: 5, kind: 'willow' },
  { t0: 4.3, from: [-3, -6, -9], to: [-3.4, 3.2, -9], rise: 0.85, color: '#5cc8ff', count: 140, speed: 3.6, kind: 'crackle' },
  { t0: 4.8, from: [3, -6, -9], to: [3.5, 3.6, -9], rise: 0.85, color: '#6ee7b7', count: 140, speed: 3.6, kind: 'peony' },
  { t0: 5.5, from: [0, -6, -12], to: [-0.6, 6.2, -12], rise: 1.0, color: '#b794ff', count: 180, speed: 4.6, kind: 'crackle' },
], 77);
const conf = L.confetti(st, { count: 420, seed: 41, colors: ['#ffd166', '#f7b733', '#fff1c1', '#ffffff', '#ffb4c8'],
  origins: [-2.5, -1.2, 0, 1.2, 2.5].map((x, i) => ({ at: [x, 6.5, 0.5], dir: [0, -1, 0.1], cone: 0.5, speed: 1.2, t0: 3.2 + i * 0.12, spread: 1.6 })), life: 4.2, gravity: 1.6, drag: 1.2 });
const glints = [[0.55, 2.1, 0.4, 2.9], [-0.45, 1.5, 0.45, 3.8], [0.2, 0.62, 0.15, 4.6], [-0.6, 2.25, 0.3, 5.3]];
const white = new THREE.Color('#fff8e6');

L.odometer(tl, document.getElementById('n'), 100, 2.7, 1.6, { height: 150, suffix: '%', suffixClass: 'pct' });
gsap.set('#n', { opacity: 0 }); tl.to('#n', { opacity: 1, duration: 0.6 }, 2.6);
L.revealText(tl, document.getElementById('title'), 3.4);
gsap.set('#sub', { opacity: 0, y: 24 }); tl.to('#sub', { opacity: 1, y: 0, duration: 1.0, ease: 'expo.out' }, 3.8);
tl.to({}, { duration: 7.4 }, 0);

function renderAt(t) {
  // rises into the light while turning, settles facing us
  const up = L.easeOutExpo(L.seg(t, 0.4, 2.3));
  trophy.position.y = L.lerp(0.9, 0, up);
  trophy.scale.setScalar(L.lerp(0.55, 1, up));
  trophy.visible = t > 0.4;
  trophy.rotation.y = (1 - L.spring(L.seg(t, 0.4, 3.2) * 1.6, 3.5, 0.9)) * Math.PI * 1.4 + Math.sin(t * 0.6) * 0.06;
  beamMat.uniforms.uA.value = 0.11 * L.easeOutCubic(L.seg(t, 1.2, 2.8));
  beams.rotation.z = t * 0.08;
  sparks.begin();
  const flash = fw.emit(t, sparks);
  for (const g of glints) { const a = t - g[3]; if (a > 0 && a < 0.6) { const k = Math.sin(a / 0.6 * Math.PI); sparks.push(g[0], g[1] + trophy.position.y, g[2], white, 0.22 * k, 1.5 * k); sparks.push(g[0], g[1] + trophy.position.y, g[2], white, 0.6 * k, 0.25 * k); } }
  sparks.end();
  conf.update(t);
  st.bgUniforms.uFlash.value = Math.min(0.08, flash * 0.6);
  // the camera starts low and to the side, glides to the front
  const c = L.easeInOutCubic(L.seg(t, 0, 3.6));
  const ang = L.lerp(-0.7, 0, c);
  camera.position.set(Math.sin(ang) * 12.5, L.lerp(0.2, 1.6, c), Math.cos(ang) * 12.5);
  camera.lookAt(0, L.lerp(1.9, 0.15, c), 0);
  st.render(t);
}

      return renderAt;
    },
  },
};
