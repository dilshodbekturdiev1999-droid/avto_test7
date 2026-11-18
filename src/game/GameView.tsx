import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buzz, lockLandscape, unlockOrientation } from './engine/platform';
import { isTouchDevice, pickQuality } from './engine/device';
import { ArrowBigLeft, ArrowBigRight, ArrowLeft, Camera, CircleParking, FlipHorizontal2, KeyRound, Menu, RotateCcw, Smartphone, TriangleAlert, Volume2, VolumeX } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { loadGameAssets } from './engine/assets';
import { buildCourse, type Rect } from './engine/course';
import { createExam, type Approach, type Exam, type ExamFrame, type ExamStatus, type Penalty } from './engine/exam';
import { buildTrafficLights, createLightController } from './engine/lights';
import { createPhysics, initRapier, type DriveInput, type Gear } from './engine/physics';
import { buildScene, type MirrorRect } from './engine/scene';
import { createSkids } from './engine/skids';
import { EngineSound } from './engine/sound';
import { VEHICLES, withRig } from './engine/vehicles';
import { gameFile, lowDevice } from './engine/preload';
import ResultScreen from './ui/ResultScreen';
import { COLORS, type GameSetup } from './ui/SetupScreen';

type CamMode = 'chase' | 'cockpit' | 'top';

function BeltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M7 21v-6.5A4.5 4.5 0 0 1 11.5 10h1A4.5 4.5 0 0 1 17 14.5V21" />
      <path d="M8.5 9.5 16 20" strokeWidth="2.6" />
    </svg>
  );
}

/** Where the two side-mirror windows go (CSS px, origin top-left). Landscape only. */
function mirrorRects(vw: number): { left: MirrorRect; right: MirrorRect } {
  const w = Math.round(Math.min(vw * 0.22, 240));
  const h = Math.round(w * 0.5);
  const y = 96;
  return { left: { x: 12, y, w, h }, right: { x: vw - 12 - w, y, w, h } };
}

/** Prava On look for the in-game controls: white panels, blue = on. */
const BLUE = '#2563EB';
const panel = 'bg-white/90 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.22)]';
const roundBtn = 'grid h-10 w-10 place-items-center rounded-full transition-colors active:scale-95';

export default function GameView({
  setup,
  onExit,
  onSetup,
  onRestart,
}: {
  setup: GameSetup;
  onExit: () => void;
  onSetup: () => void;
  onRestart: () => void;
}) {
  const t = useT();
  const exam = setup.mode === 'exam';
  const baseProfile = VEHICLES.find((v) => v.id === setup.vehicleId) ?? VEHICLES[0];
  const hostRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const input = useRef<DriveInput>({ throttle: 0, brake: 0, steer: 0, gear: exam ? 'N' : '1', handbrake: exam, engineOn: !exam });
  const keys = useRef<Record<string, boolean>>({});
  const colorRef = useRef<number | null>(setup.color);
  const camRef = useRef<CamMode>('chase');
  const pausedRef = useRef(false);
  const resetRef = useRef<() => void>(() => {});
  const soundRef = useRef<EngineSound | null>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [gear, setGearState] = useState<Gear>(exam ? 'N' : '1');
  const [cam, setCam] = useState<CamMode>('chase');
  const [menu, setMenu] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<{ total: number; list: Penalty[]; reason: 'finish' | 'fail' } | null>(null);
  const [colorHex, setColorHex] = useState<number | null>(setup.color);
  const [belt, setBelt] = useState(!exam);
  const [engineOn, setEngineOn] = useState(!exam);
  const [handbrake, setHandbrake] = useState(exam);
  const [examView, setExamView] = useState<Pick<ExamStatus, 'where' | 'alarm' | 'finishTodo' | 'next'>>({ where: null, alarm: false, finishTodo: null, next: null });
  const [startFlash, setStartFlash] = useState(exam);
  const beltRef = useRef(belt);
  const engineRef = useRef(engineOn);
  const handbrakeRef = useRef(handbrake);
  const [muted, setMuted] = useState(false);
  const touch = useRef(isTouchDevice()).current;
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const wheelSvgRef = useRef<SVGSVGElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const penRef = useRef<HTMLSpanElement>(null);
  const rotateBlock = touch && portrait;
  const [mirrors, setMirrors] = useState(false);
  const [signal, setSignalState] = useState<-1 | 0 | 1>(0);
  const [hazard, setHazard] = useState(false);
  const mirrorsRef = useRef(false);
  const signalRef = useRef<-1 | 0 | 1>(0);
  const hazardRef = useRef(false);
  const rectsRef = useRef(mirrorRects(window.innerWidth));
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelDrag = useRef<{ id: number; last: number; angle: number } | null>(null);

  const setGear = useCallback((g: Gear) => {
    input.current.gear = g;
    setGearState(g);
  }, []);

  useEffect(() => {
    pausedRef.current = menu || finished || rotateBlock;
  }, [menu, finished, rotateBlock]);
  // phones: landscape only
  useEffect(() => {
    if (!touch) return;
    void lockLandscape();
    return () => {
      void unlockOrientation();
    };
  }, [touch]);
  useEffect(() => {
    colorRef.current = colorHex;
  }, [colorHex]);
  useEffect(() => {
    beltRef.current = belt;
  }, [belt]);
  useEffect(() => {
    engineRef.current = engineOn;
    input.current.engineOn = engineOn;
  }, [engineOn]);
  useEffect(() => {
    handbrakeRef.current = handbrake;
    input.current.handbrake = handbrake;
  }, [handbrake]);
  useEffect(() => {
    if (!startFlash) return;
    const id = setTimeout(() => setStartFlash(false), 2200);
    return () => clearTimeout(id);
  }, [startFlash]);
  useEffect(() => {
    camRef.current = cam;
  }, [cam]);
  useEffect(() => {
    soundRef.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    mirrorsRef.current = mirrors;
  }, [mirrors]);
  useEffect(() => {
    signalRef.current = signal;
  }, [signal]);
  useEffect(() => {
    hazardRef.current = hazard;
  }, [hazard]);
  useEffect(() => {
    rectsRef.current = mirrorRects(vp.w);
  }, [vp]);

  // Phones are played in landscape; when held upright the game waits behind a "rotate" screen.
  useEffect(() => {
    const update = () => {
      setPortrait(window.innerHeight > window.innerWidth);
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Keyboard for desktop testing.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'Digit1') setGear('1');
      if (e.code === 'Digit2') setGear('2');
      if (e.code === 'KeyR') setGear('R');
      if (e.code === 'KeyN') setGear('N');
      if (e.code === 'KeyC') setCam((c) => (c === 'chase' ? 'cockpit' : c === 'cockpit' ? 'top' : 'chase'));
      if (e.code === 'KeyB') setBelt((v) => !v);
      if (e.code === 'KeyE') setEngineOn((v) => !v);
      if (e.code === 'KeyH') setHandbrake((v) => !v);
      if (e.code === 'KeyQ') setSignalState((v) => (v === -1 ? 0 : -1));
      if (e.code === 'KeyF') setSignalState((v) => (v === 1 ? 0 : 1));
      if (e.code === 'KeyZ') setHazard((v) => !v);
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setGear]);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let cleanup = () => {};
    const host = hostRef.current!;

    (async () => {
      try {
        await initRapier();
        const quality = pickQuality();
        const assets = await loadGameAssets((p) => !disposed && setProgress(p), lowDevice(), baseProfile.file, baseProfile.hasLow);
        if (disposed) return;
        const profile = withRig(baseProfile, assets.carRig);
        const gs = buildScene(host, assets, quality, profile);
        const start = { x: assets.meta.start.x, z: assets.meta.start.y, heading: assets.meta.start.heading };
        const phys = createPhysics(gs.staticRoot, assets.meta, start, profile);
        const course = buildCourse(assets.meta);
        const signals = createLightController(course.cross);
        const lights = buildTrafficLights(gs.scene, course.cross, signals, assets.meta.islands);
        let examRun: Exam | null = exam ? createExam(setup.category, course) : null;
        let lastStatus: ExamStatus | null = null;
        if (import.meta.env.DEV) (window as unknown as { __game: unknown }).__game = { gs, phys, input: input.current, course, exam: () => examRun, profile, quality };
        const sound = new EngineSound(profile);
        soundRef.current = sound;
        const skids = createSkids(gs.scene, assets.skidTexture, quality !== 'low');
        let clock = 0;
        let lastBlink = false;
        let signalTurned = false;
        const contact = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
        let lastEv: ReturnType<typeof phys.step> | null = null;
        const skidIn = [0, 1, 2, 3].map((i) => ({ pos: null as THREE.Vector3 | null, strength: 0, smoke: i >= 2 }));
        const tmpV = new THREE.Vector3();

        // Sharp picture at the screen's density; lowered only if the frame rate really
        // drops (measured over 3 s), raised back at most once, so it never pumps.
        const maxRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 2 : 1.25);
        const minRatio = Math.min(quality === 'low' ? 1 : 1.25, maxRatio);
        let ratio = Math.min(maxRatio, quality === 'low' ? 1 : quality === 'medium' ? 1.75 : 2);
        gs.renderer.setPixelRatio(ratio);
        let frames = 0;
        let frameClock = 0;
        let runClock = 0;
        let raised = false;
        // physics pose before / after the last step, drawn interpolated
        const prevP = new THREE.Vector3();
        const curP = new THREE.Vector3();
        const prevQ = new THREE.Quaternion();
        const curQ = new THREE.Quaternion();
        const readPose = (pv: THREE.Vector3, qv: THREE.Quaternion) => {
          const a = phys.chassis.translation();
          const b = phys.chassis.rotation();
          pv.set(a.x, a.y, a.z);
          qv.set(b.x, b.y, b.z, b.w);
        };
        readPose(curP, curQ);
        prevP.copy(curP);
        prevQ.copy(curQ);
        const STEP = 1 / 60;
        const resize = () => gs.resize(host.clientWidth, host.clientHeight);
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        // Free look by dragging the scene.
        let look: { id: number; x: number; y: number } | null = null;
        let lookYaw = 0;
        let lookPitch = 0;
        const el = gs.renderer.domElement;
        const onDown = (e: PointerEvent) => {
          look = { id: e.pointerId, x: e.clientX, y: e.clientY };
          sound.unlock();
        };
        const onMove = (e: PointerEvent) => {
          if (!look || e.pointerId !== look.id) return;
          lookYaw -= (e.clientX - look.x) * 0.006;
          lookPitch = Math.max(-0.35, Math.min(0.6, lookPitch + (e.clientY - look.y) * 0.004));
          look.x = e.clientX;
          look.y = e.clientY;
        };
        const onUp = (e: PointerEvent) => {
          if (look && e.pointerId === look.id) look = null;
        };
        el.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);

        let penalty = 0;
        let elapsed = 0;
        let curbCooldown = 0;
        let hitCooldown = 0;
        let toastTimer = 0;
        let alarmClock = 0;
        let stallT = 0;
        const flash = (msg: string, points: number) => {
          setToast(`${msg}  +${points}`);
          toastTimer = 2.8;
          sound.penalty();
          buzz();
        };
        if (exam) {
          // start signal
          setTimeout(() => {
            sound.unlock();
            sound.beep(1046, 0.5, 0.14);
          }, 300);
        }
        resetRef.current = () => {
          phys.reset(start.x, start.z, start.heading);
          signals.reset();
          penalty = 0;
          elapsed = 0;
          examRun = exam ? createExam(setup.category, course) : null;
          lastStatus = null;
          setResult(null);
          setFinished(false);
          if (exam) {
            setBelt(false);
            setEngineOn(false);
            setHandbrake(true);
            setGear('N');
            setSignalState(0);
            setHazard(false);
            setStartFlash(true);
            sound.beep(1046, 0.5, 0.14);
          }
        };
        // exam helpers: key points of the car in plan axes
        const carPt = (lx: number, lz: number) => {
          tmpV.set(lx, 0, lz).applyQuaternion(gs.car.root.quaternion).add(gs.car.root.position);
          return { x: tmpV.x, z: tmpV.z };
        };
        const contacts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
        const wheelLocalX = profile.wheels ? profile.wheels.map((w) => w.x) : [-profile.track, profile.track, -profile.track, profile.track];
        const wheelLocalZ = profile.wheels ? profile.wheels.map((w) => w.z) : [profile.axleFront, profile.axleFront, profile.axleRear, profile.axleRear];

        const camPos = new THREE.Vector3();
        const camLook = new THREE.Vector3();
        const tmpQ = new THREE.Quaternion();
        const tmpE = new THREE.Euler();
        const fwd = new THREE.Vector3();
        const wheelPos = new THREE.Vector3();
        let camInit = false;
        let acc = 0;
        let hudTimer = 0;
        let statusClock = 0;
        let last = performance.now();
        let lastCam: CamMode = camRef.current;

        const miniImg = new Image();
        void gameFile('minimap.jpg').then((buf) => {
          miniImg.src = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
        });
        const W = assets.meta.width;
        const D = assets.meta.depth;

        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          frames++;
          frameClock += dt;
          runClock += dt;
          if (frameClock >= 3) {
            const fps = frames / frameClock;
            frames = 0;
            frameClock = 0;
            let next = ratio;
            if (fps < 42) next = Math.max(minRatio, ratio - 0.25);
            else if (fps > 58 && !raised && runClock > 8 && ratio < maxRatio) {
              next = Math.min(maxRatio, ratio + 0.25);
              raised = true;
            }
            if (next !== ratio) {
              ratio = next;
              gs.renderer.setPixelRatio(ratio);
              resize();
            }
          }
          const k = keys.current;
          const inp = input.current;
          const drive: DriveInput = {
            gear: inp.gear,
            handbrake: handbrakeRef.current,
            engineOn: engineRef.current,
            throttle: Math.max(inp.throttle, k.ArrowUp || k.KeyW ? 1 : 0),
            brake: Math.max(inp.brake, k.ArrowDown || k.KeyS || k.Space ? 1 : 0),
            steer: (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0) || inp.steer,
          };

          if (!pausedRef.current) {
            acc += dt;
            while (acc >= STEP) {
              prevP.copy(curP);
              prevQ.copy(curQ);
              const ev = phys.step(drive, STEP);
              readPose(curP, curQ);
              lastEv = ev;
              acc -= STEP;
              if (!exam && ev.wheelOnCurb && curbCooldown <= 0) {
                setToast(t('Бордюрга чиқиш', 'Наезд на бордюр'));
                toastTimer = 1.6;
                curbCooldown = 2.5;
              }
              if (!exam && ev.bodyHit && hitCooldown <= 0 && Math.abs(phys.speedKmh()) > 2) {
                setToast(t('Тўқнашув', 'Столкновение'));
                toastTimer = 1.6;
                hitCooldown = 2.5;
              }
            }
            curbCooldown -= dt;
            hitCooldown -= dt;
            elapsed += dt;
            {
              const cp = phys.chassis.translation();
              const cq = phys.chassis.rotation();
              const fw = tmpV.set(0, 0, -1).applyQuaternion(tmpQ.set(cq.x, cq.y, cq.z, cq.w));
              const fl = Math.hypot(fw.x, fw.z) || 1;
              signals.update(dt, { x: cp.x, z: cp.z, dx: fw.x / fl, dz: fw.z / fl });
            }
            lights.update();

            // Engine stall (exam): pulling away on the parking brake, or from rest in 2nd gear.
            if (exam && engineRef.current) {
              const kmhNow = Math.abs(phys.speedKmh());
              const lugging =
                (drive.gear !== 'N' && handbrakeRef.current && drive.throttle > 0.3 && kmhNow < 2) ||
                (drive.gear === '2' && drive.throttle > 0.3 && kmhNow < 3);
              stallT = lugging ? stallT + dt : 0;
              if (stallT > (handbrakeRef.current ? 3 : 2)) {
                stallT = 0;
                engineRef.current = false;
                input.current.engineOn = false;
                setEngineOn(false);
                setToast(t('Двигатель ўчиб қолди', 'Двигатель заглох'));
                toastTimer = 2;
              }
            }

            if (examRun) {
              // pose straight from the physics body (the mesh is updated after this block)
              const ct = phys.chassis.translation();
              const cr = phys.chassis.rotation();
              gs.car.root.position.set(ct.x, ct.y, ct.z);
              gs.car.root.quaternion.set(cr.x, cr.y, cr.z, cr.w);
              const q = gs.car.root.quaternion;
              const f3 = fwd.set(0, 0, -1).applyQuaternion(q);
              const fl = Math.hypot(f3.x, f3.z) || 1;
              const wheels = [0, 1, 2, 3].map((i) => {
                const c = phys.wheelContact(i, contacts[i]);
                return c ? { x: c.x, z: c.z } : carPt(wheelLocalX[i], wheelLocalZ[i]);
              }) as ExamFrame['wheels'];
              const frame: ExamFrame = {
                dt,
                pos: { x: gs.car.root.position.x, z: gs.car.root.position.z },
                dir: { x: f3.x / fl, z: f3.z / fl },
                bumperFront: carPt(0, profile.bumperFront),
                bumperRear: carPt(0, profile.bumperRear),
                axleFront: carPt(0, profile.axleFront),
                axleRear: carPt(0, profile.axleRear),
                wheels,
                kmh: phys.speedKmh(),
                gear: drive.gear,
                throttle: drive.throttle,
                handbrake: handbrakeRef.current,
                engineOn: engineRef.current,
                belt: beltRef.current,
                signal: hazardRef.current ? 0 : signalRef.current,
                hazard: hazardRef.current,
                light: (a: Approach) => signals.light(a),
              };
              const got = examRun.update(frame);
              for (const p of got) flash(t(p.uz, p.ru), p.points);
              statusClock -= dt;
              if (statusClock <= 0 || got.length) {
                statusClock = 0.1;
                lastStatus = examRun.status(frame);
                penalty = lastStatus.total;
              }
              if (lastStatus.alarm) {
                alarmClock -= dt;
                if (alarmClock <= 0) {
                  sound.beep(1320, 0.22, 0.16, 'square');
                  alarmClock = 0.45;
                }
              }
              if (lastStatus.ended) {
                const ls = lastStatus;
                examRun = null;
                setTimeout(() => {
                  setResult({ total: ls.total, list: ls.list, reason: ls.ended ?? 'fail' });
                  setFinished(true);
                }, ls.ended === 'fail' ? 900 : 300);
              }
            }
          } else {
            acc = 0;
            prevP.copy(curP);
            prevQ.copy(curQ);
          }
          if (toastTimer > 0) {
            toastTimer -= dt;
            if (toastTimer <= 0) setToast(null);
          }

          // Car pose, interpolated between the last two physics steps (smooth at any refresh rate).
          const alpha = Math.min(1, acc / STEP);
          gs.car.root.position.lerpVectors(prevP, curP, alpha);
          gs.car.root.quaternion.slerpQuaternions(prevQ, curQ, alpha);
          const tr = gs.car.root.position;
          if (colorRef.current !== null) gs.car.setColor(colorRef.current);
          const steer = phys.steerAngle();
          gs.car.wheels.forEach((w, i) => {
            phys.wheelLocal(i, wheelPos);
            w.position.copy(wheelPos);
            w.rotation.set(0, i < 2 ? steer : 0, 0);
            const spinner = w.children[0];
            if (spinner) spinner.rotation.x = phys.wheelSpin(i);
          });
          fwd.set(0, 0, -1).applyQuaternion(gs.car.root.quaternion);
          const yaw = Math.atan2(-fwd.x, -fwd.z);
          gs.setBlob(tr.x, tr.z, yaw, Math.max(0, tr.y - 0.05));
          gs.followSun(tr.x, tr.z);

          // Camera.
          const mode = camRef.current;
          if (mode !== lastCam) {
            for (const g of gs.car.glass) g.opacity = mode === 'cockpit' ? 0.18 : 0.8;
            camInit = false;
            lookYaw = 0;
            lookPitch = 0;
            lastCam = mode;
          }
          const kmh = phys.speedKmh();
          const tall = gs.camera.aspect < 1;
          // Keep the same horizontal view on a tall screen (vertical fov grows as it narrows).
          const fovFor = (landscapeFov: number) =>
            tall ? Math.min(88, (2 * Math.atan(Math.tan((72 * Math.PI) / 360) / gs.camera.aspect) * 180) / Math.PI) : landscapeFov;
          if (mode === 'cockpit') {
            tmpV.set(profile.eye[0], profile.eye[1], profile.eye[2]).applyQuaternion(gs.car.root.quaternion).add(gs.car.root.position);
            gs.camera.position.copy(tmpV);
            tmpQ.setFromEuler(tmpE.set(lookPitch * 0.6 - 0.05, lookYaw, 0, 'YXZ'));
            gs.camera.quaternion.copy(gs.car.root.quaternion).multiply(tmpQ);
            gs.camera.fov = fovFor(72);
          } else {
            const heading = yaw + lookYaw;
            const dist = (mode === 'top' ? 16 + profile.chaseDist - 6.4 : profile.chaseDist + Math.min(Math.abs(kmh) * 0.03, 1.5)) * (tall && mode !== 'top' ? 1.1 : 1);
            const height = (mode === 'top' ? 15 : profile.chaseHeight + lookPitch * 5) + (tall && mode !== 'top' ? 0.8 : 0);
            tmpV.set(tr.x + Math.sin(heading) * dist, height + Math.max(0, tr.y), tr.z + Math.cos(heading) * dist);
            if (!camInit) {
              camPos.copy(tmpV);
              camInit = true;
            } else {
              camPos.lerp(tmpV, 1 - Math.exp(-dt * (mode === 'top' ? 3 : 5)));
            }
            gs.camera.position.copy(camPos);
            camLook.set(tr.x - Math.sin(yaw) * 2.5, tr.y + 0.9, tr.z - Math.cos(yaw) * 2.5);
            gs.camera.lookAt(camLook);
            gs.camera.fov = fovFor(55 + Math.min(Math.abs(kmh) * 0.12, 6));
          }
          if (import.meta.env.DEV) {
            // screenshot scripts: window.__cam = { p: [x,y,z], l: [x,y,z], fov }
            const o = (window as unknown as { __cam?: { p: number[]; l: number[]; fov?: number } }).__cam;
            if (o) {
              gs.camera.position.set(o.p[0], o.p[1], o.p[2]);
              gs.camera.lookAt(o.l[0], o.l[1], o.l[2]);
              gs.camera.fov = o.fov ?? 50;
            }
          }
          if (!look) {
            lookYaw *= Math.exp(-dt * 1.8);
            lookPitch *= Math.exp(-dt * 1.8);
          }
          gs.camera.updateProjectionMatrix();

          // Lights, indicators (auto-cancel after the turn), tyre marks, smoke, squeal.
          clock += dt;
          const sig = signalRef.current;
          if (sig !== 0) {
            const sa = phys.steerAngle();
            if (Math.abs(sa) > 0.22 && Math.sign(-sa) === sig) signalTurned = true;
            else if (signalTurned && Math.abs(sa) < 0.06) {
              signalTurned = false;
              signalRef.current = 0;
              setSignalState(0);
            }
          } else signalTurned = false;
          const mode2: -1 | 0 | 1 | 2 = hazardRef.current ? 2 : signalRef.current;
          const blinkOn = mode2 !== 0 && Math.floor(clock * 3) % 2 === 0;
          if (blinkOn !== lastBlink) {
            lastBlink = blinkOn;
            if (mode2 !== 0) sound.tick();
          }
          gs.car.setLights({ engine: engineRef.current, brake: drive.brake > 0.15, reverse: drive.gear === 'R', signal: mode2, time: clock });
          const ev2 = lastEv;
          skids.update(
            dt,
            clock,
            skidIn.map((w, i) => {
              w.pos = ev2 && ev2.onRoad[i] ? phys.wheelContact(i, contact[i]) : null;
              w.strength = ev2 ? ev2.skid[i] : 0;
              return w;
            }),
            ev2 ? ev2.drift : 0,
            Math.abs(kmh) / 3.6,
          );
          sound.setSlide(ev2 ? Math.max(ev2.skid[2], ev2.skid[3]) : 0, Math.abs(kmh));

          gs.renderFrame(mirrorsRef.current ? rectsRef.current : null, true);

          sound.update(Math.abs(kmh), drive.throttle, drive.gear, engineRef.current);

          hudTimer += dt;
          if (hudTimer > 0.1) {
            hudTimer = 0;
            const sp = Math.round(Math.abs(kmh));
            if (speedRef.current) speedRef.current.textContent = String(sp);
            if (arcRef.current) arcRef.current.setAttribute('stroke-dasharray', `${Math.min(sp / 60, 1) * 207} 400`);
            const secs = Math.floor(elapsed);
            if (timeRef.current) timeRef.current.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
            if (penRef.current) {
              penRef.current.textContent = String(penalty);
              penRef.current.style.color = penalty > 0 ? '#dc2626' : '';
            }
            if (lastStatus) {
              const ls = lastStatus;
              setExamView((v) =>
                v.where?.uz === ls.where?.uz && v.next?.uz === ls.next?.uz && v.alarm === ls.alarm && JSON.stringify(v.finishTodo) === JSON.stringify(ls.finishTodo)
                  ? v
                  : { where: ls.where, alarm: ls.alarm, finishTodo: ls.finishTodo, next: ls.next },
              );
            }
            const mini = miniRef.current;
            const mctx = mini?.getContext('2d') ?? null;
            if (mctx && mini) {
              const mw = mini.width;
              const mh = mini.height;
              if (miniImg.complete && miniImg.naturalWidth) mctx.drawImage(miniImg, 0, 0, mw, mh);
              else {
                mctx.fillStyle = '#4a4d55';
                mctx.fillRect(0, 0, mw, mh);
              }
              if (exam) {
                const box = (r: Rect, c: string) => {
                  mctx.strokeStyle = c;
                  mctx.lineWidth = 1.5;
                  mctx.strokeRect((r.x0 / W) * mw, (r.z0 / D) * mh, ((r.x1 - r.x0) / W) * mw, ((r.z1 - r.z0) / D) * mh);
                };
                const other = setup.category === 'B' ? 'C' : 'B';
                box(course.box[setup.category].rect, '#22c55e');
                box(course.parallel[setup.category].rect, '#22c55e');
                box(course.box[other].rect, '#f87171');
                box(course.parallel[other].rect, '#f87171');
                const nx = lastStatus?.next;
                if (nx) {
                  const pulse = 3 + 2 * Math.abs(Math.sin(clock * 3));
                  mctx.fillStyle = '#facc15';
                  mctx.strokeStyle = '#000';
                  mctx.lineWidth = 1;
                  mctx.beginPath();
                  mctx.arc((nx.x / W) * mw, (nx.z / D) * mh, pulse, 0, Math.PI * 2);
                  mctx.fill();
                  mctx.stroke();
                }
              }
              mctx.save();
              mctx.translate((tr.x / W) * mw, (tr.z / D) * mh);
              mctx.rotate(-yaw);
              mctx.fillStyle = BLUE;
              mctx.strokeStyle = '#fff';
              mctx.lineWidth = 1.5;
              mctx.beginPath();
              mctx.moveTo(0, -7);
              mctx.lineTo(5, 5);
              mctx.lineTo(0, 2.5);
              mctx.lineTo(-5, 5);
              mctx.closePath();
              mctx.fill();
              mctx.stroke();
              mctx.restore();
            }
          }
        };
        gs.car.root.position.copy(curP);
        gs.car.root.quaternion.copy(curQ);
        gs.camera.position.set(curP.x, curP.y + 3, curP.z + 7);
        gs.camera.lookAt(curP);
        try {
          await gs.renderer.compileAsync(gs.scene, gs.camera);
        } catch {
          gs.renderer.compile(gs.scene, gs.camera);
        }
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        setReady(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          el.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          skids.dispose();
          sound.dispose();
          phys.dispose();
          gs.dispose();
        };
      } catch (e) {
        console.error('avtodrom: failed to start', e);
        if (!disposed) setError(String(e));
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setWheelAngle = (a: number) => {
    if (wheelSvgRef.current) wheelSvgRef.current.style.transform = `rotate(${a}rad)`;
  };

  // ---- Steering wheel: rotate by dragging around its centre (540° lock to lock). ----
  const MAX_WHEEL = Math.PI * 1.5;
  const angleAt = (e: React.PointerEvent) => {
    const r = wheelRef.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  const onWheelDown = (e: React.PointerEvent) => {
    wheelRef.current!.setPointerCapture(e.pointerId);
    wheelDrag.current = { id: e.pointerId, last: angleAt(e), angle: input.current.steer * MAX_WHEEL };
    soundRef.current?.unlock();
  };
  const onWheelMove = (e: React.PointerEvent) => {
    const d = wheelDrag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleAt(e);
    let delta = a - d.last;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    d.last = a;
    d.angle = Math.max(-MAX_WHEEL, Math.min(MAX_WHEEL, d.angle + delta));
    setWheelAngle(d.angle);
    input.current.steer = d.angle / MAX_WHEEL;
  };
  const onWheelUp = () => {
    wheelDrag.current = null;
    const from = input.current.steer * MAX_WHEEL;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (wheelDrag.current) return;
      const p = Math.min(1, (now - t0) / 450);
      const a = from * (1 - p) * (1 - p);
      setWheelAngle(a);
      input.current.steer = a / MAX_WHEEL;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const pedal = (key: 'throttle' | 'brake') => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      input.current[key] = 1;
      soundRef.current?.unlock();
    },
    onPointerUp: () => {
      input.current[key] = 0;
    },
    onPointerCancel: () => {
      input.current[key] = 0;
    },
  });

  const top = 'calc(max(0.6rem, env(safe-area-inset-top)) + 86px)';
  const onOff = (on: boolean, kind: 'blue' | 'red' | 'amber' = 'blue') =>
    on ? (kind === 'red' ? 'bg-red-500 text-white' : kind === 'amber' ? 'bg-amber-400 text-slate-900' : 'text-white') : panel;
  const onStyle = (on: boolean, kind: 'blue' | 'red' | 'amber' = 'blue') => (on && kind === 'blue' ? { background: BLUE } : undefined);

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#dfe7f1]" style={{ touchAction: 'none' }}>
      <div ref={hostRef} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-[#f2f4f7] text-slate-900">
          <div className="w-72 text-center">
            <div className="mb-1 text-lg font-semibold">{t('Автодром тайёрланмоқда', 'Готовим автодром')}</div>
            <div className="mb-4 text-sm text-slate-500">{baseProfile.name} · {setup.category}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: BLUE }} />
            </div>
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          </div>
        </div>
      )}

      {ready && (
        <>
          {/* Side mirrors (drawn into the canvas; these are just the frames) */}
          {mirrors && (['left', 'right'] as const).map((k) => {
            const r = mirrorRects(vp.w)[k];
            return (
              <div
                key={k}
                className="pointer-events-none absolute rounded-2xl border-[3px] border-white shadow-[0_4px_14px_rgba(15,23,42,0.35)]"
                style={{ left: r.x - 3, top: r.y - 3, width: r.w + 6, height: r.h + 6 }}
              />
            );
          })}

          {/* Top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between pt-[max(0.6rem,env(safe-area-inset-top))]" style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}>
            <div className="pointer-events-auto flex items-start gap-2">
              <button onClick={onExit} className={`${roundBtn} ${panel}`} aria-label="Orqaga">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <canvas ref={miniRef} width={92} height={106} className="h-[80px] w-[70px] rounded-2xl border-2 border-white shadow-[0_2px_12px_rgba(15,23,42,0.22)]" />
            </div>

            <div className={`absolute left-1/2 flex h-[70px] w-[70px] -translate-x-1/2 flex-col items-center justify-center rounded-full ${panel}`}>
              <svg viewBox="0 0 100 100" className="absolute h-[70px] w-[70px] -rotate-[225deg]">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeDasharray="207 400" strokeLinecap="round" />
                <circle ref={arcRef} cx="50" cy="50" r="44" fill="none" stroke={BLUE} strokeWidth="6" strokeDasharray="0 400" strokeLinecap="round" />
              </svg>
              <div ref={speedRef} className="text-[22px] font-semibold tabular-nums leading-none">0</div>
              <div className="mt-0.5 text-[9px] text-slate-500">km/soat</div>
            </div>

            <div className="pointer-events-auto flex items-start gap-2">
              <div className={`flex h-11 items-center rounded-full px-3.5 text-sm font-semibold tabular-nums ${panel}`}>
                <span ref={timeRef}>0:00</span>
              </div>
              {exam && (
                <div className={`flex h-11 items-center gap-1 rounded-full px-3.5 text-sm font-semibold ${panel}`}>
                  {t('Жарима', 'Штраф')} <span ref={penRef} className="tabular-nums">0</span>
                </div>
              )}
              <button onClick={() => setCam((c) => (c === 'chase' ? 'cockpit' : c === 'cockpit' ? 'top' : 'chase'))} className={`${roundBtn} ${panel}`} aria-label="Kamera">
                <Camera className="h-5 w-5" />
              </button>
              <button onClick={() => setMenu(true)} className={`${roundBtn} ${panel}`} aria-label="Menu">
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {exam && (examView.where || examView.next) && (
            <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${panel}`} style={{ top }}>
              {examView.where ? (
                <span style={{ color: BLUE }}>{t(examView.where.uz, examView.where.ru)}</span>
              ) : (
                examView.next && (
                  <>
                    <span className="text-slate-500">{t('Кейинги', 'Далее')}: </span>
                    <span style={{ color: BLUE }}>{t(examView.next.uz, examView.next.ru)}</span>
                  </>
                )
              )}
            </div>
          )}

          {toast && (
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(220,38,38,0.35)]" style={{ top: `calc(${top} + 36px)` }}>
              {toast}
            </div>
          )}

          {startFlash && (
            <div className="pointer-events-none absolute inset-x-0 top-[30%] text-center">
              <div className="inline-block rounded-2xl px-6 py-2.5 text-2xl font-bold tracking-wider text-white shadow-xl" style={{ background: BLUE }}>START</div>
              <div className={`mx-auto mt-3 w-[min(90vw,26rem)] rounded-2xl px-4 py-2.5 text-sm ${panel}`}>
                {t('Камар, двигатель, қўл тормози, чап чироқ — 30 сония ичида қўзғалинг', 'Ремень, двигатель, ручник, левый поворотник — тронуться за 30 секунд')}
              </div>
            </div>
          )}

          {examView.alarm && (
            <div className="pointer-events-none absolute inset-x-0 top-[36%] text-center">
              <div className="inline-flex animate-pulse items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-xl">
                <TriangleAlert className="h-5 w-5" />
                {t('АВАРИЯ! Тўхтанг ва авария чироғини ёқинг', 'АВАРИЯ! Остановитесь и включите аварийку')}
              </div>
            </div>
          )}

          {examView.finishTodo && (
            <div className="pointer-events-none absolute inset-x-0 top-[32%] text-center">
              <div className={`mx-auto inline-block rounded-2xl px-5 py-3 text-left text-sm ${panel}`}>
                <div className="mb-1 font-semibold">{t('Финиш: тўхтагач', 'Финиш: после остановки')}</div>
                {[
                  [examView.finishTodo.handbrake, t('Қўл тормозини тортинг', 'Затяните ручник')],
                  [examView.finishTodo.engine, t('Двигателни ўчиринг', 'Заглушите двигатель')],
                  [examView.finishTodo.belt, t('Камарни ечинг', 'Отстегните ремень')],
                ].map(([ok, label], i) => (
                  <div key={i} className={ok ? 'font-medium text-emerald-600' : 'text-slate-600'}>
                    {ok ? '✓' : '○'} {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steering wheel */}
          <div
            ref={wheelRef}
            onPointerDown={onWheelDown}
            onPointerMove={onWheelMove}
            onPointerUp={onWheelUp}
            onPointerCancel={onWheelUp}
            className="absolute bottom-3 h-[146px] w-[146px]"
            style={{ left: 'max(1rem, env(safe-area-inset-left))', marginBottom: 'env(safe-area-inset-bottom)', touchAction: 'none' }}
          >
            <svg ref={wheelSvgRef} viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_4px_10px_rgba(15,23,42,0.35)]">
              <circle cx="50" cy="50" r="43" fill="none" stroke="#1e293b" strokeWidth="9" />
              <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              <path d="M10 55 Q50 45 90 55 L87 64 Q50 57 13 64 Z" fill="#334155" />
              <path d="M43 61 L57 61 L55 89 L45 89 Z" fill="#334155" />
              <circle cx="50" cy="57" r="12.5" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
              <circle cx="50" cy="57" r="5" fill={BLUE} />
              <rect x="47" y="3.5" width="6" height="9" rx="2" fill={BLUE} />
            </svg>
          </div>

          {/* Car controls (belt, engine, parking brake) above the light switches */}
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5" style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
            <div className="flex gap-1.5">
              {([
                { key: 'belt', on: belt, icon: <BeltIcon className="h-5 w-5" />, act: () => setBelt((v) => !v), label: 'Kamar', kind: 'blue' as const },
                { key: 'engine', on: engineOn, icon: <KeyRound className="h-5 w-5" />, act: () => setEngineOn((v) => !v), label: 'Dvigatel', kind: 'blue' as const },
                { key: 'hand', on: handbrake, icon: <CircleParking className="h-5 w-5" />, act: () => setHandbrake((v) => !v), label: "Qo'l tormozi", kind: 'red' as const },
              ]).map((b) => (
                <button key={b.key} onClick={() => { soundRef.current?.unlock(); b.act(); }} aria-label={b.label} className={`${roundBtn} ${onOff(b.on, b.kind)}`} style={onStyle(b.on, b.kind)}>
                  {b.icon}
                </button>
              ))}
            </div>
            <div className="mx-0.5 h-7 w-px bg-white/70" />
            <div className="flex gap-1.5">
              {([
                { key: 'mirrors', on: mirrors, icon: <FlipHorizontal2 className="h-5 w-5" />, act: () => setMirrors((v) => !v), label: "Ko'zgu", kind: 'blue' as const },
                { key: 'left', on: signal === -1 && !hazard, icon: <ArrowBigLeft className="h-5 w-5" />, act: () => { setHazard(false); setSignalState((v) => (v === -1 ? 0 : -1)); }, label: 'Chap', kind: 'amber' as const },
                { key: 'hazard', on: hazard, icon: <TriangleAlert className="h-5 w-5" />, act: () => { setHazard((v) => !v); setSignalState(0); }, label: 'Avariya', kind: 'red' as const },
                { key: 'right', on: signal === 1 && !hazard, icon: <ArrowBigRight className="h-5 w-5" />, act: () => { setHazard(false); setSignalState((v) => (v === 1 ? 0 : 1)); }, label: "O'ng", kind: 'amber' as const },
              ]).map((b) => (
                <button key={b.key} onClick={() => { soundRef.current?.unlock(); b.act(); }} aria-label={b.label} className={`${roundBtn} ${onOff(b.on, b.kind)}`} style={onStyle(b.on, b.kind)}>
                  {b.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Gear selector */}
          <div className={`absolute bottom-4 flex flex-col gap-1 rounded-2xl p-1.5 ${panel}`} style={{ right: 'calc(max(1rem, env(safe-area-inset-right)) + 176px)', marginBottom: 'env(safe-area-inset-bottom)' }}>
            {(['R', 'N', '1', '2'] as Gear[]).map((g) => (
              <button
                key={g}
                onClick={() => setGear(g)}
                className={`h-9 w-10 rounded-xl text-sm font-semibold transition-colors ${gear === g ? 'text-white' : 'text-slate-600 active:bg-slate-100'}`}
                style={gear === g ? { background: g === 'R' ? '#ef4444' : BLUE } : undefined}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Pedals */}
          <div className="absolute bottom-3 flex items-end gap-3" style={{ right: 'max(1rem, env(safe-area-inset-right))', marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div {...pedal('brake')} className="group flex flex-col items-center" style={{ touchAction: 'none' }}>
              <div className={`flex h-[78px] w-[84px] flex-col justify-evenly rounded-2xl px-3 transition-transform group-active:scale-95 ${panel}`}>
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-1.5 rounded-full bg-slate-300 group-active:bg-red-400" />)}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-white drop-shadow">{t('Тормоз', 'Тормоз')}</div>
            </div>
            <div {...pedal('throttle')} className="group flex flex-col items-center" style={{ touchAction: 'none' }}>
              <div className={`flex h-[112px] w-[60px] flex-col justify-evenly rounded-2xl px-3 transition-transform group-active:scale-95 ${panel}`}>
                {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-1.5 rounded-full bg-slate-300 group-active:bg-blue-500" />)}
              </div>
              <div className="mt-1 text-[10px] font-semibold text-white drop-shadow">Gaz</div>
            </div>
          </div>
        </>
      )}

      {/* Phones: landscape only */}
      {rotateBlock && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#f2f4f7] p-8 text-center text-slate-900">
          <div>
            <Smartphone className="mx-auto mb-4 h-14 w-14 rotate-90" style={{ color: BLUE }} />
            <div className="mb-1 text-lg font-semibold">{t('Телефонни ётқизиб ушланг', 'Поверните телефон горизонтально')}</div>
            <div className="text-sm text-slate-500">{t('Автодром фақат горизонтал ҳолатда ўйналади', 'Автодром работает только в горизонтальном положении')}</div>
          </div>
        </div>
      )}

      {/* Pause menu */}
      {menu && (
        <div className="absolute inset-0 grid place-items-center bg-slate-900/40 p-4">
          <div className="max-h-[92vh] w-[min(92vw,28rem)] overflow-y-auto rounded-[24px] bg-white p-5 text-slate-900 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold">{baseProfile.name} · {t('тоифа', 'категория')} {setup.category}</h2>
            {colorHex !== null && (
              <>
                <p className="mb-2 text-sm text-slate-500">{t('Машина ранги', 'Цвет машины')}</p>
                <div className="mb-5 flex flex-wrap gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setColorHex(c.hex)}
                      className="h-10 w-10 rounded-full border border-slate-200"
                      style={{ background: `#${c.hex.toString(16).padStart(6, '0')}`, boxShadow: colorHex === c.hex ? `0 0 0 3px #fff, 0 0 0 5px ${BLUE}` : undefined }}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button onClick={() => setMuted((m) => !m)} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-semibold">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {muted ? t('Овоз ўчиқ', 'Звук выкл') : t('Овоз ёқиқ', 'Звук вкл')}
              </button>
              <button
                onClick={() => {
                  resetRef.current();
                  setMenu(false);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                {t('Қайта бошлаш', 'Заново')}
              </button>
            </div>
            <button onClick={onSetup} className="mb-4 w-full rounded-2xl bg-slate-100 py-3 text-sm font-semibold">
              {t('Машина ва режимни алмаштириш', 'Сменить машину и режим')}
            </button>
            {!touch && (
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                {t('Клавиатура', 'Клавиатура')}: ↑↓←→ · 1 2 N R · B {t('камар', 'ремень')} · E {t('двигатель', 'двигатель')} · H {t('қўл тормози', 'ручник')} · Q / F {t('бурилиш', 'поворотники')} · Z {t('авария', 'аварийка')} · C {t('камера', 'камера')}
              </p>
            )}
            <p className="mb-4 text-[10px] leading-snug text-slate-400">3D: {baseProfile.credit}. Trees, textures — Poly Haven (CC0).</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMenu(false)} className="rounded-2xl py-3 font-semibold text-white" style={{ background: BLUE }}>
                {t('Давом этиш', 'Продолжить')}
              </button>
              <button onClick={onExit} className="rounded-2xl bg-slate-100 py-3 font-semibold">
                {t('Чиқиш', 'Выйти')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {finished && result && (
        <ResultScreen
          total={result.total}
          list={result.list}
          reason={result.reason}
          onAgain={() => {
            resetRef.current();
            onRestart();
          }}
          onSetup={onSetup}
          onExit={onExit}
        />
      )}
    </div>
  );
}
