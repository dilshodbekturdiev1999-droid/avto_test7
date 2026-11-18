// Engine and car sounds. The engine is a physical model running in an AudioWorklet
// (engine-worklet.js): each car has its own cylinders, pipes and muffler, so the
// Cobalt, the 3-cylinder Tracker, the Malibu turbo and the Isuzu diesel all sound
// different. Revs follow the speed in gear, the load follows the throttle; starter,
// shut-down, turbo whistle / blow-off. Old browsers without AudioWorklet get a
// simple synth. No audio files.
import type { Gear } from './physics';
import type { EngineKind, VehicleProfile } from './vehicles';
import workletUrl from './engine-worklet.js?url';

interface EngineSpec {
  idle: number;
  redline: number;
  /** rpm per km/h in each gear */
  perKmh: Record<'1' | '2' | 'R', number>;
  volume: number;
  /** cabin / exhaust tone: low-pass base and how much the throttle opens it */
  tone: number;
  toneOpen: number;
  turbo: number; // 0 = none
  model: Record<string, number | number[]>;
}

const SPECS: Record<EngineKind, EngineSpec> = {
  // Cobalt 1.5 (B15D2): plain four, a bit buzzy at the top
  petrol4: {
    idle: 820, redline: 6200, perKmh: { '1': 170, '2': 78, R: 230 }, volume: 1.0, tone: 1500, toneOpen: 2600, turbo: 0,
    model: { cylinders: 4, intake: 100, exhaust: 100, extractor: 100, intakeOpen: 0.25, intakeClosed: 0.95, exhaustOpen: 0.25, exhaustClosed: 0.95, ignition: 0.016, pipe: 128, pipeReflect: 0.1, muffler: [10, 15, 20, 25], action: 0.25, outlet: 5, intakeNoiseHz: 9000, blockHz: 125, roughness: 1, misfire: 0.08, knock: 0, mixBlock: 0.6, mixIntake: 0.35, mixOutlet: 1.0, trim: 1 },
  },
  // Tracker 1.2 turbo three: uneven three-cylinder beat, turbo
  turbo3: {
    idle: 780, redline: 6000, perKmh: { '1': 150, '2': 70, R: 210 }, volume: 1.05, tone: 1300, toneOpen: 2300, turbo: 1,
    model: { cylinders: 3, intake: 90, exhaust: 85, extractor: 120, intakeOpen: 0.28, intakeClosed: 0.95, exhaustOpen: 0.22, exhaustClosed: 0.96, ignition: 0.018, pipe: 170, pipeReflect: 0.12, muffler: [12, 19, 27, 36], action: 0.28, outlet: 6, intakeNoiseHz: 7500, blockHz: 110, roughness: 1.5, misfire: 0.12, knock: 0, mixBlock: 0.7, mixIntake: 0.3, mixOutlet: 1.0, trim: 1 },
  },
  // Malibu 1.5 turbo four: smooth, deeper and quieter, long muffler
  turbo4: {
    idle: 720, redline: 6000, perKmh: { '1': 125, '2': 62, R: 190 }, volume: 0.8, tone: 1050, toneOpen: 1800, turbo: 0.8,
    model: { cylinders: 4, intake: 110, exhaust: 120, extractor: 130, intakeOpen: 0.22, intakeClosed: 0.96, exhaustOpen: 0.2, exhaustClosed: 0.97, ignition: 0.02, pipe: 190, pipeReflect: 0.08, muffler: [20, 28, 37, 46], action: 0.32, outlet: 8, intakeNoiseHz: 6000, blockHz: 100, roughness: 0.6, misfire: 0.04, knock: 0, mixBlock: 0.5, mixIntake: 0.25, mixOutlet: 1.0, trim: 1 },
  },
  // Isuzu Elf 3.0 turbo diesel: slow, deep, injector clatter
  diesel4: {
    idle: 680, redline: 3600, perKmh: { '1': 135, '2': 56, R: 200 }, volume: 1.15, tone: 900, toneOpen: 1700, turbo: 0.6,
    model: { cylinders: 4, intake: 140, exhaust: 150, extractor: 160, intakeOpen: 0.3, intakeClosed: 0.94, exhaustOpen: 0.3, exhaustClosed: 0.94, ignition: 0.009, pipe: 240, pipeReflect: 0.14, muffler: [30, 41, 55, 70], action: 0.3, outlet: 10, intakeNoiseHz: 5000, blockHz: 140, roughness: 1.3, misfire: 0.1, knock: 0.35, mixBlock: 0.9, mixIntake: 0.3, mixOutlet: 1.0, trim: 1 },
  },
};

export class EngineSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private spec: EngineSpec;
  private gearLimit: Record<Gear, number>;
  // engine model
  private node: AudioWorkletNode | null = null;
  private rpmParam: AudioParam | null = null;
  private loadParam: AudioParam | null = null;
  private tone: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  // fallback synth
  private osc: OscillatorNode[] = [];
  // turbo
  private whistle: OscillatorNode | null = null;
  private whistleGain: GainNode | null = null;
  private boost = 0;
  private lastThrottle = 0;
  // state
  private rpm = 0;
  private load = 0;
  private running = false;
  private starting = 0; // seconds of cranking left
  private squeal: GainNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastT = 0;

  constructor(profile?: Pick<VehicleProfile, 'engine' | 'gearLimit'>) {
    this.spec = SPECS[profile?.engine ?? 'petrol4'];
    this.gearLimit = profile?.gearLimit ?? { R: 15, N: 0, '1': 26, '2': 50 };
  }

  /** Audio can only start after a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      const master = ctx.createGain();
      master.gain.value = 1;
      master.connect(comp).connect(ctx.destination);
      this.master = master;

      // engine chain: source -> tone low-pass -> gain -> master
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 0.7;
      tone.frequency.value = this.spec.tone;
      const body = ctx.createBiquadFilter(); // a little body around the firing range
      body.type = 'peaking';
      body.frequency.value = 160;
      body.gain.value = 4;
      body.Q.value = 0.9;
      const engGain = ctx.createGain();
      engGain.gain.value = 0;
      tone.connect(body).connect(engGain).connect(master);
      this.tone = tone;
      this.engGain = engGain;
      if (ctx.audioWorklet) {
        ctx.audioWorklet
          .addModule(workletUrl)
          .then(() => {
            if (!this.ctx) return;
            const node = new AudioWorkletNode(ctx, 'avtodrom-engine', {
              numberOfInputs: 0,
              numberOfOutputs: 1,
              outputChannelCount: [1],
              processorOptions: this.spec.model,
            });
            this.rpmParam = node.parameters.get('rpm') ?? null;
            this.loadParam = node.parameters.get('load') ?? null;
            const trim = ctx.createGain();
            trim.gain.value = 0.22;
            node.connect(trim).connect(tone);
            this.node = node;
          })
          .catch(() => this.fallback());
      } else this.fallback();

      // turbo whistle
      if (this.spec.turbo > 0) {
        const w = ctx.createOscillator();
        w.type = 'sine';
        w.frequency.value = 3000;
        const wg = ctx.createGain();
        wg.gain.value = 0;
        w.connect(wg).connect(master);
        w.start();
        this.whistle = w;
        this.whistleGain = wg;
      }

      // tyre squeal: band-passed noise whose level follows how hard the tyres slide
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = noise;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 4;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      src.connect(bp).connect(sg).connect(master);
      src.start();
      this.squeal = sg;
      this.squealFilter = bp;
    } catch {
      /* no audio on this device */
    }
  }

  private fallback() {
    const ctx = this.ctx;
    if (!ctx || !this.tone || this.osc.length) return;
    const a = ctx.createOscillator();
    a.type = 'sawtooth';
    const b = ctx.createOscillator();
    b.type = 'square';
    const bg = ctx.createGain();
    bg.gain.value = 0.35;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    a.connect(g).connect(this.tone);
    b.connect(bg).connect(this.tone);
    a.start();
    b.start();
    this.osc = [a, b];
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  /** 0..1 how hard the tyres are sliding; speed in km/h shifts the pitch. */
  setSlide(level: number, kmh: number) {
    if (!this.ctx || !this.squeal || !this.squealFilter) return;
    const t = this.ctx.currentTime;
    this.squeal.gain.setTargetAtTime(Math.min(1, level) * 0.11, t, 0.06);
    this.squealFilter.frequency.setTargetAtTime(1300 + Math.min(kmh, 60) * 18, t, 0.1);
  }

  /** Indicator relay click (call on each blink edge). */
  tick() {
    if (!this.ctx || this.muted || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1900;
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.04);
  }

  /** Short tone: penalty buzz, start signal, in-cabin alarm. */
  beep(freq = 880, dur = 0.18, vol = 0.12, type: OscillatorType = 'sine') {
    if (!this.ctx || this.muted || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Penalty: two falling tones. */
  penalty() {
    this.beep(660, 0.14, 0.13, 'triangle');
    setTimeout(() => this.beep(440, 0.22, 0.13, 'triangle'), 150);
  }

  /** Starter motor whirr (with the compression beats of the cylinders). */
  private starter() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const dur = 0.75;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(150, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    g.gain.setValueAtTime(0.06, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // compression beats
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** Turbo blow-off when the throttle snaps shut on boost. */
  private blowOff(level: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.35);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * level * this.spec.turbo, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.45);
  }

  update(kmh: number, throttle: number, gear: Gear, engineOn = true) {
    const ctx = this.ctx;
    if (!ctx || !this.engGain || !this.tone) return;
    const now = ctx.currentTime;
    const dt = Math.min(0.1, Math.max(0, now - this.lastT || 0.016));
    this.lastT = now;
    const S = this.spec;

    if (engineOn && !this.running) {
      this.running = true;
      this.starting = 0.7;
      this.starter();
    }
    if (!engineOn && this.running) this.running = false;

    let target: number;
    let load: number;
    if (!this.running) {
      target = 0;
      load = 0;
    } else if (this.starting > 0) {
      this.starting -= dt;
      target = this.starting > 0 ? 260 : S.idle * 1.5; // cranking, then the catch flare
      load = this.starting > 0 ? 0.15 : 0.6;
    } else {
      const g = gear === 'N' ? null : gear;
      const free = S.idle + throttle * (S.redline * 0.78 - S.idle);
      if (!g) target = free;
      else {
        const wheel = Math.abs(kmh) * S.perKmh[g];
        // pulling away: the clutch slips, revs are held above idle by the throttle
        const slip = S.idle + throttle * 1100;
        target = Math.min(S.redline, Math.max(wheel, kmh < this.gearLimit[g] * 0.35 ? slip : S.idle));
      }
      load = throttle;
    }
    // revs rise with throttle, fall slower (flywheel)
    const up = this.running ? (this.starting > 0 ? 2500 : 2600 + throttle * 4500) : 0;
    const down = this.running ? 2200 : 1600;
    const d = target - this.rpm;
    this.rpm += d > 0 ? Math.min(d, up * dt) : Math.max(d, -down * dt);
    if (this.rpm < 1) this.rpm = 0;
    this.load += (load - this.load) * Math.min(1, dt * 8);

    const r = this.rpm;
    const level = r <= 0 ? 0 : Math.min(1, r / 400) * (0.5 + 0.35 * (r / S.redline) + 0.35 * this.load) * S.volume;
    this.engGain.gain.setTargetAtTime(level, now, 0.05);
    this.tone.frequency.setTargetAtTime(S.tone + this.load * S.toneOpen + (r / S.redline) * 1200, now, 0.06);
    if (this.rpmParam && this.loadParam) {
      this.rpmParam.setTargetAtTime(r, now, 0.03);
      this.loadParam.setTargetAtTime(this.load, now, 0.05);
    } else if (this.osc.length) {
      const fire = (r / 60) * 2;
      this.osc[0].frequency.setTargetAtTime(Math.max(1, fire), now, 0.03);
      this.osc[1].frequency.setTargetAtTime(Math.max(1, fire * 0.5 * 1.006), now, 0.03);
    }

    // turbo: boost spools with revs under load, whistle rises with it
    if (this.whistle && this.whistleGain) {
      const want = this.running ? Math.max(0, (r - S.idle * 1.6) / (S.redline * 0.6)) * this.load : 0;
      const prev = this.boost;
      this.boost += (Math.min(1, want) - this.boost) * Math.min(1, dt * (want > this.boost ? 1.6 : 4));
      this.whistle.frequency.setTargetAtTime(2400 + this.boost * 5200, now, 0.08);
      this.whistleGain.gain.setTargetAtTime(this.boost * 0.006 * S.turbo, now, 0.08);
      if (this.lastThrottle > 0.6 && throttle < 0.1 && prev > 0.35) this.blowOff(prev);
    }
    this.lastThrottle = throttle;
  }

  dispose() {
    this.osc.forEach((o) => o.stop());
    this.whistle?.stop();
    this.node?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
  }
}
