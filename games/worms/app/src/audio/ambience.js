// Procedural ambience for the abyss (port ADR-002: no audio files).
//
//   drone   three detuned low oscillators through a slowly breathing low-pass
//   rumble  brown noise (generated), low-passed: the weight of deep water
//   bubbles short sine chirps rising in pitch, panned toward a worm
//   chimes  a soft glassy ping when worms cross (ref count >= 2), rate-limited
//
// Everything runs through a procedurally generated reverb. Muted by default;
// the AudioContext is created only on the first user gesture.

export class Ambience {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.nextBubble = 0;
    this.lastChime = 0;
  }

  /** Create the graph (must be called from a user gesture). */
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // procedural reverb: exponentially decaying stereo noise
    const len = Math.floor(ctx.sampleRate * 4.5);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.8;
    this.dry.connect(this.master);
    this.dry.connect(this.reverb);

    // drone
    const droneBus = ctx.createGain();
    droneBus.gain.value = 0.09;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    lp.Q.value = 0.7;
    droneBus.connect(lp).connect(this.dry);
    for (const [f, type, g] of [[41.2, 'sine', 0.55], [55.0, 'sine', 0.35], [61.74, 'triangle', 0.18], [82.4, 'sine', 0.12]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(droneBus);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 90;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();

    // rumble: brown noise
    const nlen = ctx.sampleRate * 6;
    const nb = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nlen; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      nd[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nb;
    noise.loop = true;
    const nlp = ctx.createBiquadFilter();
    nlp.type = 'lowpass';
    nlp.frequency.value = 320;
    const ng = ctx.createGain();
    ng.gain.value = 0.11;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const swellAmt = ctx.createGain();
    swellAmt.gain.value = 0.05;
    swell.connect(swellAmt).connect(ng.gain);
    swell.start();
    noise.connect(nlp).connect(ng).connect(this.dry);
    noise.start();

    this.nextBubble = ctx.currentTime + 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!muted) this.start();
    if (!this.ctx) return;
    if (!muted && this.ctx.state === 'suspended') this.ctx.resume();
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, muted ? 0.15 : 1.2);
  }

  bubble(pan = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f0 = 260 + Math.random() * 520;
    const dur = 0.05 + Math.random() * 0.09;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.8 + Math.random()), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.05, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g).connect(p).connect(this.dry);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  chime(pan = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const base = [523.25, 659.25, 783.99, 987.77][Math.floor(Math.random() * 4)];
    for (const [mul, amp] of [[1, 0.035], [2.01, 0.012], [3.02, 0.006]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      o.connect(g).connect(p).connect(this.dry);
      o.start(t);
      o.stop(t + 3);
    }
  }

  /**
   * Called every frame with the world: schedules bubbles near random heads
   * and chimes where worms cross. panOf(x) maps a grid column to -1..1.
   */
  update(world, panOf) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t >= this.nextBubble) {
      const n = Math.floor(Math.random() * world.worms.length);
      const worm = world.worms[n];
      const x = worm ? worm.xpos[worm.head] : 0;
      const count = Math.random() < 0.3 ? 3 : 1;
      for (let i = 0; i < count; i++) setTimeout(() => this.ctx && this.bubble(panOf(x)), i * 70);
      this.nextBubble = t + 0.6 + Math.random() * 2.6;
    }
  }

  /** A crossing happened at column x (called on engine steps). */
  crossing(x, panOf) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastChime < 1.6) return;
    this.lastChime = t;
    this.chime(panOf(x));
  }
}
