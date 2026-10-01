// Synthesised sound (Web Audio; no audio files). Muted until you switch it
// on — the first switch also unlocks the AudioContext.
//   ambience  — a low thruster hum under the platform; its pitch and edge
//               rise as robots close in and levels fill up
//   you       — a soft magnetic footstep
//   robots    — a servo whirr per turn, louder when they are near
//   crashes   — a metallic boom with a ring pitched up a step per crash in
//               a chain; into scrap: a duller crunch
//   teleport  — a rising sweep and a shimmer; level clear — a bright chord;
//   level     — robots beaming in; death — a falling sting and static
// The stadium:
//   crowd     — a bed of murmur that swells with the game; a cheer (a
//               roar, claps, whistles) on every crash, bigger along a chain;
//               an "ooh" when a robot gets next to you or you teleport; a
//               long "boo" when you lose; applause through a celebration
//               (voices are detuned sawtooths through vowel formants)
//   fireworks — a whistle up, a boom and a crackle, later when further away
//   rubbish   — cans clink, bottles knock, cups and paper tap as they land
import { fxBus, type FxEvent } from '../fx/bus';

const PENTA = [0, 3, 5, 7, 10];

class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  hum!: GainNode;
  humOsc: OscillatorNode[] = [];
  humFilter!: BiquadFilterNode;
  noise!: AudioBuffer;
  bed!: GainNode;
  bedFilter!: BiquadFilterNode;
  on = false;
  private lastOoh = -10;
  private lastTrash = -10;

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    this.master.connect(comp).connect(ctx.destination);
    const n = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // the hum
    this.hum = ctx.createGain();
    this.hum.gain.value = 0.05;
    this.humFilter = ctx.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.value = 260;
    for (const [f, type] of [[48, 'sawtooth'], [48.4, 'sine'], [96.5, 'triangle']] as Array<[number, OscillatorType]>) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = type === 'sawtooth' ? 0.25 : 0.5;
      o.connect(g).connect(this.humFilter);
      o.start();
      this.humOsc.push(o);
    }
    this.humFilter.connect(this.hum).connect(this.master);
    this.hum.gain.value = 0.02;
    // the crowd bed: murmur (band-passed noise) with a slow flutter
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    this.bedFilter = ctx.createBiquadFilter();
    this.bedFilter.type = 'bandpass'; this.bedFilter.frequency.value = 650; this.bedFilter.Q.value = 0.8;
    this.bed = ctx.createGain(); this.bed.gain.value = 0.05;
    const flutter = ctx.createOscillator(), fg = ctx.createGain();
    flutter.frequency.value = 0.35; fg.gain.value = 0.015;
    flutter.connect(fg).connect(this.bed.gain);
    src.connect(this.bedFilter).connect(this.bed).connect(this.master);
    src.start(); flutter.start();
  }

  /** The murmur swells to `level` and settles back. */
  private swell(t: number, level: number, hold = 0.4, freq = 650) {
    this.bed.gain.cancelScheduledValues(t);
    this.bed.gain.setTargetAtTime(Math.min(0.32, level), t, 0.12);
    this.bed.gain.setTargetAtTime(0.05, t + hold, 1.4);
    this.bedFilter.frequency.setTargetAtTime(freq, t, 0.2);
    this.bedFilter.frequency.setTargetAtTime(650, t + hold, 1.5);
  }

  /** A roar: noise swelling up and away, with claps and a whistle or two. */
  private cheer(t: number, k: number) {
    this.swell(t, 0.08 + k * 0.2, 0.6 + k, 900 + k * 500);
    this.hiss(t, 1.4 + k, 0.05 + k * 0.1, 900, 1800, 0.5);
    const claps = Math.round(6 + k * 30);
    for (let i = 0; i < claps; i++) this.hiss(t + Math.random() * (0.8 + k), 0.03, 0.02 + Math.random() * 0.03, 2400, 1800, 1.2);
    for (let i = 0; i < Math.round(k * 3); i++) {
      const f = 1900 + Math.random() * 900;
      this.tone(t + 0.1 + Math.random() * 0.6, f, 0.35 + Math.random() * 0.3, 0.012, 'sine', 1.25);
    }
  }

  /** Many voices on one vowel: "ooh" (rising, then falling) or "boo". */
  private voices(t: number, boo: boolean, dur: number, gain: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f2.type = 'bandpass';
    f1.frequency.value = boo ? 320 : 360; f1.Q.value = 5;
    f2.frequency.value = boo ? 700 : 880; f2.Q.value = 7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    out.connect(f1).connect(lp); out.connect(f2).connect(lp); lp.connect(this.master);
    for (let i = 0; i < 10; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const f0 = boo ? 105 + Math.random() * 70 : 170 + Math.random() * 120;
      const st = t + Math.random() * 0.15;
      o.frequency.setValueAtTime(f0, st);
      if (boo) o.frequency.linearRampToValueAtTime(f0 * 0.9, st + dur);
      else { o.frequency.linearRampToValueAtTime(f0 * 1.18, st + dur * 0.4); o.frequency.linearRampToValueAtTime(f0 * 0.92, st + dur); }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(gain, st + 0.18);
      g.gain.setValueAtTime(gain, st + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(g).connect(out);
      o.start(st); o.stop(st + dur + 0.1);
    }
  }

  setOn(on: boolean) {
    this.on = on;
    if (on) this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.08);
  }

  private get t() { return this.ctx ? this.ctx.currentTime : 0; }

  private tone(t: number, f: number, dur: number, gain: number, type: OscillatorType = 'sine', glide = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(t: number, dur: number, gain: number, f0: number, f1: number, q = 1.5) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  handle = (e: FxEvent) => {
    if (!this.on || !this.ctx) return;
    const t = this.t;
    switch (e.type) {
      case 'playerStep':
        this.tone(t, 190, 0.07, 0.12, 'sine', 0.7);
        this.hiss(t, 0.05, 0.05, 3000, 1800, 3);
        break;
      case 'robotSteps': {
        const near = e.nearest <= 1 ? 1 : e.nearest <= 3 ? 0.6 : e.nearest <= 6 ? 0.3 : 0.1;
        if (e.nearest <= 1 && t - this.lastOoh > 2) { this.lastOoh = t; this.voices(t + 0.05, false, 1.1, 0.02); }
        this.hiss(t + 0.02, 0.16, 0.03 + near * 0.06, 900 + near * 1400, 2400 + near * 2000, 4);
        this.tone(t + 0.02, 140 + near * 90, 0.14, 0.02 + near * 0.03, 'square', 1.25);
        this.humFilter.frequency.setTargetAtTime(220 + near * 700, t, 0.3);
        this.hum.gain.setTargetAtTime(0.04 + near * 0.05, t, 0.3);
        break;
      }
      case 'impact': {
        const step = Math.max(0, e.chain - 1);
        const semis = 12 * Math.floor(step / 5) + PENTA[step % 5];
        const f = 220 * 2 ** (Math.min(semis, 30) / 12);
        if (e.onPile) {
          this.tone(t, 70, 0.3, 0.35, 'sine', 0.6);
          this.hiss(t, 0.25, 0.25, 800, 300, 0.8);
        } else {
          this.tone(t, 60, 0.45, 0.5, 'sine', 0.5);
          this.hiss(t, 0.35, 0.35, 2500, 400, 0.7);
          for (const k of [1, 2.76, 5.4]) this.tone(t + 0.01, f * k, 0.6 / Math.sqrt(k), 0.07 / k, 'sine');
        }
        this.cheer(t + 0.08, Math.min(1, 0.25 + e.chain * 0.12));
        break;
      }
      case 'teleport':
        if (t - this.lastOoh > 1) { this.lastOoh = t; this.voices(t + 0.1, false, 1.2, 0.022); }
        this.tone(t, 300, 0.5, 0.12, 'sawtooth', 5);
        this.hiss(t, 0.5, 0.12, 1200, 7000, 2);
        this.tone(t + 0.45, 1400, 0.4, 0.05, 'sine', 1.5);
        break;
      case 'spawn':
        this.tone(t + e.delay, 900 + Math.random() * 200, 0.12, 0.03, 'triangle', 0.5);
        break;
      case 'levelClear':
        for (const [k, f] of [[0, 523], [0.08, 659], [0.16, 784], [0.24, 1046]]) this.tone(t + k, f, 0.9, 0.08, 'triangle');
        this.cheer(t + 0.1, 1);
        this.cheer(t + 1.6, 0.8);
        break;
      case 'death':
        this.tone(t, 440, 1.2, 0.2, 'sawtooth', 0.25);
        this.tone(t, 55, 1.4, 0.4, 'sine', 0.5);
        this.hiss(t + 0.05, 1.6, 0.2, 6000, 600, 0.5);
        this.hum.gain.setTargetAtTime(0.0, t + 0.5, 0.5);
        this.voices(t + 0.7, true, 2.6, 0.024);
        this.voices(t + 2.9, true, 2.2, 0.018);
        this.swell(t + 0.7, 0.2, 4, 420);
        break;
      case 'firework':
        if (e.phase === 'launch') {
          this.hiss(t, 1.1, 0.02, 1200, 4200, 3);
          this.tone(t, 700 + Math.random() * 300, 1.1, 0.008, 'sine', 2.4);
        } else {
          const d = Math.min(0.35, e.distance / 200); // further away, heard a little later
          this.tone(t + d, 55 + Math.random() * 20, 0.9, 0.3 * e.size, 'sine', 0.5);
          this.hiss(t + d, 0.8, 0.14 * e.size, 1600, 200, 0.6);
          for (let i = 0; i < 24; i++) this.hiss(t + d + 0.35 + Math.random() * 1.1, 0.02, 0.02 + Math.random() * 0.03, 5000, 3000, 2);
          if (Math.random() < 0.4) this.cheer(t + d + 0.2, 0.35);
        }
        break;
      case 'trash':
        if (t - this.lastTrash < 0.035) break;
        this.lastTrash = t;
        if (e.kind === 'can') this.tone(t, 2600 + Math.random() * 1500, 0.12, 0.02 + Math.min(0.03, e.speed * 0.002), 'triangle', 0.9);
        else if (e.kind === 'bottle') this.tone(t, 900 + Math.random() * 400, 0.1, 0.03, 'sine', 0.8);
        else this.hiss(t, 0.04, 0.03, 2500, 1500, 1.5);
        break;
      case 'levelStart':
        this.cheer(t + 0.3, 0.4);
        this.hum.gain.setTargetAtTime(0.015 + Math.min(e.level, 4) * 0.006, t, 0.6);
        this.humOsc.forEach((o, i) => o.frequency.setTargetAtTime([48, 48.4, 96.5][i] * (1 + Math.min(e.level, 4) * 0.05), t, 0.8));
        break;
      default:
        break;
    }
  };
}

export const sfx = new Sfx();
fxBus.on(sfx.handle);
