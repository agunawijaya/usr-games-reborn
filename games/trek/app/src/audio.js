// trek/procedural-web — every sound synthesised with Web Audio.
//
// Muted by default: nothing is created until the player turns sound on
// (browsers only allow audio after a user gesture anyway). Tonal effects
// are kept short and sparse so the bridge never sounds like a keyboard
// playing notes; most of the character comes from filtered noise.
//
//   ambience   low drone + air-handling hum + rare, soft console blips
//   phaser     detuned saw through a sweeping band-pass + hiss
//   torpedo    launch thump + receding whoosh
//   explosion  noise burst with a falling low-pass, sub thump, crackle
//   disruptor  harsh descending zaps
//   shieldHit  resonant ping (the bubble ringing)
//   hullHit    metallic clang (tuned band-passes) + thud
//   klaxon     original two-tone alert whoop, three times
//   warp       rising whoosh into a boom

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.volume = 0.8;
    this.lastPlay = {};
  }

  /** Create the graph on first unmute (needs a user gesture). */
  _init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    // Generated stereo reverb: exponentially decaying noise.
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.reverb.connect(this.wet).connect(this.master);
    this.noise = this._noiseBuffer(2, 'white');
    this.brown = this._noiseBuffer(4, 'brown');
    this._ambience();
  }

  _noiseBuffer(seconds, kind) {
    const ctx = this.ctx;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  setMuted(m) {
    this.muted = m;
    if (!m) this._init();
    if (!this.ctx) return;
    if (!m && this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(m ? 0 : this.volume, now, 0.15);
  }

  // --- building blocks -----------------------------------------------------

  _env(gainNode, t, a, peak, d, sustain = 0, r = 0.1, hold = 0) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (hold > 0) g.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    g.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + hold + d);
    if (sustain) g.exponentialRampToValueAtTime(0.0001, t + a + hold + d + r);
  }

  _noiseSrc(buffer = this.noise, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    s.playbackRate.value = 0.9 + Math.random() * 0.2;
    return s;
  }

  _out(node, wet = 0.2) {
    node.connect(this.sfx);
    if (wet > 0) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(this.reverb);
    }
  }

  // --- ambience ------------------------------------------------------------

  _ambience() {
    const ctx = this.ctx;
    const bed = ctx.createGain();
    bed.gain.value = 0.5;
    bed.connect(this.master);
    // Deep drone: two sines a fifth apart through a slowly breathing low-pass.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const dg = ctx.createGain();
    dg.gain.value = 0.06;
    for (const [f, det] of [[55, 0], [82.4, 4], [110, -3]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 60;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    lp.connect(dg).connect(bed);
    // Hull hum: brown noise around 120 Hz.
    const hum = this._noiseSrc(this.brown, true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 120;
    bp.Q.value = 0.8;
    const hg = ctx.createGain();
    hg.gain.value = 0.05;
    hum.connect(bp).connect(hg).connect(bed);
    hum.start();
    // Air handling: faint high hiss.
    const air = this._noiseSrc(this.noise, true);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const ag = ctx.createGain();
    ag.gain.value = 0.006;
    air.connect(hp).connect(ag).connect(bed);
    air.start();
    // Rare console blips: two or three very short, very quiet chirps.
    const blip = () => {
      if (!this.muted) {
        const t = ctx.currentTime + 0.05;
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 1100 + Math.random() * 900;
          const g = ctx.createGain();
          this._env(g, t + i * 0.07, 0.005, 0.012, 0.045);
          o.connect(g);
          this._out(g, 0.5);
          o.start(t + i * 0.07);
          o.stop(t + i * 0.07 + 0.08);
        }
      }
      setTimeout(blip, 7000 + Math.random() * 9000);
    };
    setTimeout(blip, 5000);
  }

  // --- effects -------------------------------------------------------------

  play(name, opts = {}) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Avoid stacking identical sounds fired in the same instant.
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.03) return;
    this.lastPlay[name] = now;
    const fn = this[`_${name}`];
    if (fn) fn.call(this, now + 0.01, opts);
  }

  _phaser(t) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 5;
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(1300, t + 0.8);
    for (const [f, det] of [[330, 0], [336, 12], [660, -8]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const vib = ctx.createOscillator();
      vib.frequency.value = 28;
      const vg = ctx.createGain();
      vg.gain.value = 9;
      vib.connect(vg).connect(o.frequency);
      o.connect(bp);
      o.start(t); o.stop(t + 0.95);
      vib.start(t); vib.stop(t + 0.95);
    }
    const hiss = this._noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    const hg = ctx.createGain();
    this._env(hg, t, 0.02, 0.05, 0.8);
    hiss.connect(hp).connect(hg);
    this._out(hg, 0.15);
    hiss.start(t); hiss.stop(t + 0.95);
    this._env(g, t, 0.025, 0.09, 0.2, 0.07, 0.25, 0.4);
    bp.connect(g);
    this._out(g, 0.25);
  }

  _torpedo(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    const g = ctx.createGain();
    this._env(g, t, 0.005, 0.5, 0.35);
    o.connect(g);
    this._out(g, 0.2);
    o.start(t); o.stop(t + 0.45);
    const n = this._noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(260, t + 0.8);
    const ng = ctx.createGain();
    this._env(ng, t, 0.02, 0.14, 0.8);
    n.connect(bp).connect(ng);
    this._out(ng, 0.3);
    n.start(t); n.stop(t + 1);
  }

  _explosion(t, { size = 1 } = {}) {
    const ctx = this.ctx;
    const s = Math.min(3, size);
    const dur = 1.2 + s * 0.6;
    const n = this._noiseSrc();
    n.playbackRate.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = ctx.createGain();
    this._env(g, t, 0.008, 0.55 * clamp01(0.5 + s * 0.3), dur);
    n.connect(lp).connect(g);
    this._out(g, 0.45);
    n.start(t); n.stop(t + dur + 0.1);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(75, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.9);
    const sg = ctx.createGain();
    this._env(sg, t, 0.01, 0.7, 0.9 + s * 0.2);
    sub.connect(sg);
    this._out(sg, 0.1);
    sub.start(t); sub.stop(t + 1.3 + s * 0.2);
    // Crackle.
    for (let i = 0; i < 10 + s * 6; i++) {
      const tt = t + 0.1 + Math.random() * dur * 0.7;
      const c = this._noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 2500;
      bp.Q.value = 3;
      const cg = ctx.createGain();
      this._env(cg, tt, 0.002, 0.08 * Math.random() + 0.02, 0.04);
      c.connect(bp).connect(cg);
      this._out(cg, 0.3);
      c.start(tt); c.stop(tt + 0.06);
    }
  }

  _disruptor(t) {
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.08;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(1100, tt);
      o.frequency.exponentialRampToValueAtTime(180, tt + 0.16);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      this._env(g, tt, 0.004, 0.07, 0.17);
      o.connect(bp).connect(g);
      this._out(g, 0.2);
      o.start(tt); o.stop(tt + 0.2);
    }
  }

  _shieldHit(t) {
    const ctx = this.ctx;
    const n = this._noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2300;
    bp.Q.value = 14;
    const g = ctx.createGain();
    this._env(g, t, 0.003, 0.35, 0.35);
    n.connect(bp).connect(g);
    this._out(g, 0.35);
    n.start(t); n.stop(t + 0.4);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(1150, t + 0.25);
    const og = ctx.createGain();
    this._env(og, t, 0.003, 0.03, 0.22);
    o.connect(og);
    this._out(og, 0.4);
    o.start(t); o.stop(t + 0.3);
  }

  _hullHit(t) {
    const ctx = this.ctx;
    const n = this._noiseSrc();
    const g = ctx.createGain();
    this._env(g, t, 0.002, 0.5, 0.6);
    for (const f of [430, 1130, 2270]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * (0.95 + Math.random() * 0.1);
      bp.Q.value = 22;
      n.connect(bp).connect(g);
    }
    this._out(g, 0.3);
    n.start(t); n.stop(t + 0.7);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    const og = ctx.createGain();
    this._env(og, t, 0.004, 0.45, 0.3);
    o.connect(og);
    this._out(og, 0.1);
    o.start(t); o.stop(t + 0.35);
  }

  _klaxon(t) {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.62;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(480, tt);
      o.frequency.exponentialRampToValueAtTime(920, tt + 0.42);
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.setValueAtTime(482, tt);
      o2.frequency.exponentialRampToValueAtTime(924, tt + 0.42);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const g = ctx.createGain();
      this._env(g, tt, 0.03, 0.09, 0.14, 0.06, 0.12, 0.28);
      o.connect(lp); g2.connect(lp);
      lp.connect(g);
      this._out(g, 0.3);
      o.start(tt); o.stop(tt + 0.6);
      o2.start(tt); o2.stop(tt + 0.6);
    }
  }

  _warp(t) {
    const ctx = this.ctx;
    const n = this._noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(180, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.8);
    bp.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = ctx.createGain();
    this._env(g, t, 0.3, 0.3, 1.3);
    n.connect(bp).connect(g);
    this._out(g, 0.4);
    n.start(t); n.stop(t + 1.8);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.85);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const og = ctx.createGain();
    this._env(og, t, 0.2, 0.08, 0.7);
    o.connect(lp).connect(og);
    this._out(og, 0.3);
    o.start(t); o.stop(t + 1.1);
    // arrival boom
    this._explosion(t + 0.9, { size: 0.3 });
  }

  _impulse(t) {
    const ctx = this.ctx;
    const n = this._noiseSrc(this.brown);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(600, t + 0.4);
    lp.frequency.linearRampToValueAtTime(200, t + 1.0);
    const g = ctx.createGain();
    this._env(g, t, 0.2, 0.35, 0.8);
    n.connect(lp).connect(g);
    this._out(g, 0.2);
    n.start(t); n.stop(t + 1.2);
  }

  _scan(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1320;
    const g = ctx.createGain();
    this._env(g, t, 0.004, 0.05, 0.5);
    o.connect(g);
    this._out(g, 0.7);
    o.start(t); o.stop(t + 0.6);
  }

  _shield(t, { up = true } = {}) {
    const ctx = this.ctx;
    const n = this._noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(up ? 400 : 1800, t);
    bp.frequency.exponentialRampToValueAtTime(up ? 1800 : 400, t + 0.5);
    const g = ctx.createGain();
    this._env(g, t, 0.05, 0.12, 0.5);
    n.connect(bp).connect(g);
    this._out(g, 0.35);
    n.start(t); n.stop(t + 0.6);
  }

  _dock(t) {
    this._hullHit(t + 0.2);
    this._hullHit(t + 0.55);
    this._shield(t + 0.7, { up: true });
  }

  _resupply(t) {
    this._shield(t, { up: true });
    this._scan(t + 0.15);
  }

  _impact(t) { this._hullHit(t); }
}
