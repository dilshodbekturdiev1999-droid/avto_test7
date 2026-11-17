// Synthesised four-cylinder engine: two detuned oscillators at the firing
// frequency through a low-pass whose cutoff opens with throttle. No audio files.
import type { Gear } from './physics';

const GEAR_TOP_KMH: Record<Gear, number> = { R: 15, N: 1, '1': 26, '2': 55 };

export class EngineSound {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private muted = false;
  private rpm = 850;
  private squeal: GainNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;
  private tickClock = 0;

  /** Audio can only start after a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      filter.connect(gain).connect(ctx.destination);
      const a = ctx.createOscillator();
      a.type = 'sawtooth';
      const b = ctx.createOscillator();
      b.type = 'square';
      const bg = ctx.createGain();
      bg.gain.value = 0.35;
      a.connect(filter);
      b.connect(bg).connect(filter);
      a.start();
      b.start();
      // Tyre squeal: band-passed noise whose level follows how hard the tyres slide.
      const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 4;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      src.connect(bp).connect(sg).connect(ctx.destination);
      src.start();
      this.squeal = sg;
      this.squealFilter = bp;
      this.ctx = ctx;
      this.osc = [a, b];
      this.filter = filter;
      this.gain = gain;
    } catch {
      /* no audio on this device */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  /** 0..1 how hard the tyres are sliding; speed in km/h shifts the pitch. */
  setSlide(level: number, kmh: number) {
    if (!this.ctx || !this.squeal || !this.squealFilter) return;
    const t = this.ctx.currentTime;
    this.squeal.gain.setTargetAtTime(this.muted ? 0 : Math.min(1, level) * 0.11, t, 0.06);
    this.squealFilter.frequency.setTargetAtTime(1300 + Math.min(kmh, 60) * 18, t, 0.1);
  }

  /** Indicator relay click (call on each blink edge). */
  tick() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = 1900;
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + 0.04);
  }

  /** Short tone: penalty buzz, start signal, in-cabin alarm. */
  beep(freq = 880, dur = 0.18, vol = 0.12, type: OscillatorType = 'sine') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Penalty: two falling tones. */
  penalty() {
    this.beep(660, 0.14, 0.13, 'triangle');
    setTimeout(() => this.beep(440, 0.22, 0.13, 'triangle'), 150);
  }

  update(kmh: number, throttle: number, gear: Gear, engineOn = true) {
    if (!this.ctx || !this.filter || !this.gain) return;
    if (!engineOn) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      this.rpm = 0;
      return;
    }
    if (this.rpm < 300) this.rpm = 1400; // starter catch
    const top = GEAR_TOP_KMH[gear];
    const target = gear === 'N' ? 850 + throttle * 3500 : 850 + Math.min(kmh / top, 1.15) * 3600 + throttle * 500;
    this.rpm += (target - this.rpm) * 0.08;
    const fire = (this.rpm / 60) * 2; // 4-stroke, 4 cylinders: 2 firings per revolution
    const t = this.ctx.currentTime;
    this.osc[0].frequency.setTargetAtTime(fire, t, 0.03);
    this.osc[1].frequency.setTargetAtTime(fire * 0.5 * 1.006, t, 0.03);
    this.filter.frequency.setTargetAtTime(260 + throttle * 900 + this.rpm * 0.12, t, 0.05);
    this.gain.gain.setTargetAtTime(this.muted ? 0 : 0.05 + throttle * 0.05, t, 0.08);
  }

  dispose() {
    this.osc.forEach((o) => o.stop());
    void this.ctx?.close();
    this.ctx = null;
  }
}
