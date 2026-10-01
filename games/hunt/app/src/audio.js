// Procedural sound (port ADR 002: no audio files). Every sound is an
// oscillator or filtered noise shaped by envelopes, panned by where the
// source is on screen, quieter with distance from the player. Muted by
// default; the first unmute creates the AudioContext (browsers require a
// gesture).

import * as K from './engine/constants.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.last = new Map();
  }

  async toggle() {
    if (!this.ctx) this.init();
    this.muted = !this.muted;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, now, 0.05);
    return !this.muted;
  }

  init() {
    const A = window.AudioContext || window.webkitAudioContext;
    const ctx = new A();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // a small room: generated impulse response (decaying stereo noise)
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 0.35;
    this.verbIn.connect(this.verb).connect(this.master);
    // noise source buffer, reused
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.hum();
  }

  // Arena hum: detuned low drones and filtered air, slowly breathing.
  hum() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);
    for (const [f, t] of [[55, 'sine'], [55.4, 'sine'], [110.2, 'triangle']]) {
      const o = ctx.createOscillator();
      o.type = t;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = t === 'triangle' ? 0.12 : 0.5;
      o.connect(og).connect(g);
      o.start();
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    n.connect(lp).connect(ng).connect(g);
    n.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.02;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
  }

  // --- building blocks
  out(pan, gain, verb = 0.3) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(this.master);
    if (verb > 0) {
      const s = ctx.createGain();
      s.gain.value = verb;
      p.connect(s).connect(this.verbIn);
    }
    return g;
  }

  tone(dest, { type = 'sine', f0, f1 = f0, dur, a = 0.004, vol = 0.3, t = 0 }) {
    const ctx = this.ctx;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(dest);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  hiss(dest, { type = 'bandpass', f0, f1 = f0, q = 1, dur, a = 0.003, vol = 0.3, t = 0 }) {
    const ctx = this.ctx;
    const now = ctx.currentTime + t;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, now);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(f).connect(g).connect(dest);
    n.start(now, Math.random());
    n.stop(now + dur + 0.02);
  }

  // Throttle identical sounds (a slime flood fires dozens of events).
  gate(name, ms) {
    const t = performance.now();
    if (t - (this.last.get(name) || 0) < ms) return false;
    this.last.set(name, t);
    return true;
  }

  // name, pan (-1..1), near (0..1), event
  play(name, pan, near, e = {}) {
    if (!this.ctx || this.muted) return;
    const v = 0.25 + 0.75 * near;
    switch (name) {
      case 'fire': {
        const d = this.out(pan, v);
        if (e.type === K.SHOT) {
          this.tone(d, { type: 'square', f0: 1500, f1: 260, dur: 0.09, vol: 0.12 });
          this.hiss(d, { f0: 4000, f1: 1500, q: 0.8, dur: 0.05, vol: 0.18 });
        } else if (e.type === K.SLIME) {
          this.tone(d, { type: 'sine', f0: 260, f1: 90, dur: 0.22, vol: 0.3 });
          this.hiss(d, { type: 'lowpass', f0: 900, f1: 200, dur: 0.18, vol: 0.2 });
        } else {
          this.tone(d, { type: 'sine', f0: 320, f1: 110, dur: 0.16, vol: 0.35 });
          this.hiss(d, { f0: 1800, f1: 500, q: 0.7, dur: 0.1, vol: 0.2 });
        }
        break;
      }
      case 'ricochet': {
        if (!this.gate('ric', 25)) break;
        const d = this.out(pan, v, 0.6);
        const f = 1700 * Math.pow(1.12, Math.min(12, (e.n || 1) - 1));
        this.tone(d, { type: 'sine', f0: f, f1: f * 0.82, dur: 0.28, vol: 0.18 });
        this.tone(d, { type: 'triangle', f0: f * 2.76, f1: f * 2.3, dur: 0.12, vol: 0.05 });
        break;
      }
      case 'scatter': case 'whoosh': {
        const d = this.out(pan, v, 0.5);
        this.hiss(d, { f0: 300, f1: 3000, q: 4, dur: 0.35, a: 0.08, vol: 0.25 });
        break;
      }
      case 'boom': {
        if (!this.gate('boom', 30)) break;
        const s = Math.max(1, e.size || 1);
        const d = this.out(pan, v * Math.min(1.4, 0.6 + s * 0.12), 0.5);
        const dur = 0.25 + s * 0.12;
        this.hiss(d, { type: 'lowpass', f0: 2500 + s * 300, f1: 120, q: 0.5, dur, vol: 0.5 });
        this.tone(d, { type: 'sine', f0: 90, f1: 28, dur: dur * 1.3, vol: 0.55 * Math.min(1, s / 3) + 0.2 });
        break;
      }
      case 'crumble': {
        if (!this.gate('crumble', 40)) break;
        const d = this.out(pan, v * 0.7);
        for (let i = 0; i < 4; i++) this.hiss(d, { f0: 700 + Math.random() * 900, q: 3, dur: 0.05, vol: 0.15, t: i * 0.035 });
        break;
      }
      case 'regrow': {
        if (!this.gate('regrow', 60)) break;
        const d = this.out(pan, v * 0.6, 0.5);
        this.tone(d, { type: 'sine', f0: 180, f1: 720, dur: 0.45, a: 0.08, vol: 0.12 });
        break;
      }
      case 'splat': {
        const d = this.out(pan, v);
        this.hiss(d, { f0: 900, f1: 180, q: 6, dur: 0.25, vol: 0.35 });
        this.tone(d, { type: 'sine', f0: 140, f1: 60, dur: 0.2, vol: 0.3 });
        break;
      }
      case 'ooze': {
        if (!this.gate('ooze', 70)) break;
        const d = this.out(pan, v * 0.35);
        this.tone(d, { type: 'sine', f0: 300 + Math.random() * 300, f1: 120, dur: 0.06, vol: 0.08 });
        break;
      }
      case 'death': {
        const d = this.out(pan, v, 0.6);
        this.tone(d, { type: 'sawtooth', f0: 900, f1: 50, dur: 0.7, vol: 0.14 });
        for (let i = 0; i < 6; i++) this.tone(d, { type: 'sine', f0: 2500 + Math.random() * 2500, dur: 0.12, vol: 0.05, t: 0.05 + i * 0.05 });
        break;
      }
      case 'enter': {
        const d = this.out(pan, v * 0.8, 0.6);
        this.tone(d, { type: 'sine', f0: 220, f1: 880, dur: 0.8, a: 0.2, vol: 0.12 });
        this.hiss(d, { f0: 1500, f1: 6000, q: 2, dur: 0.8, a: 0.3, vol: 0.06 });
        break;
      }
      case 'move': {
        if (!this.gate('step', 60)) break;
        const d = this.out(pan, v * 0.5, 0.1);
        this.hiss(d, { type: 'lowpass', f0: 380 + Math.random() * 120, q: 1, dur: 0.07, vol: 0.12 });
        break;
      }
      case 'turn': {
        const d = this.out(pan, v * 0.4, 0);
        this.tone(d, { type: 'triangle', f0: 600, f1: 900, dur: 0.05, vol: 0.05 });
        break;
      }
      case 'bump': {
        const d = this.out(pan, v * 0.6, 0.1);
        this.tone(d, { type: 'sine', f0: 120, f1: 70, dur: 0.1, vol: 0.2 });
        break;
      }
      case 'bell': case 'hot': {
        const d = this.out(pan, 0.5, 0);
        this.tone(d, { type: name === 'bell' ? 'square' : 'triangle', f0: name === 'bell' ? 880 : 2000, dur: 0.06, vol: 0.05 });
        break;
      }
      case 'scan': {
        const d = this.out(pan, v, 0.7);
        this.tone(d, { type: 'sine', f0: 1200, f1: 1150, dur: 0.6, vol: 0.12 });
        break;
      }
      case 'cloak': {
        const d = this.out(pan, v, 0.5);
        this.tone(d, { type: 'sine', f0: 900, f1: 200, dur: 0.5, vol: 0.1 });
        this.hiss(d, { f0: 4000, f1: 800, q: 3, dur: 0.5, vol: 0.05 });
        break;
      }
      case 'defuse': case 'boots': {
        const d = this.out(pan, v, 0.4);
        this.tone(d, { type: 'sine', f0: 660, dur: 0.12, vol: 0.12 });
        this.tone(d, { type: 'sine', f0: 990, dur: 0.18, vol: 0.12, t: 0.08 });
        break;
      }
      case 'trip': {
        const d = this.out(pan, v, 0);
        this.tone(d, { type: 'square', f0: 2400, dur: 0.03, vol: 0.08 });
        break;
      }
      case 'absorb': {
        const d = this.out(pan, v, 0.5);
        this.tone(d, { type: 'sine', f0: 200, f1: 520, dur: 0.3, vol: 0.18 });
        break;
      }
      case 'zing': {
        const d = this.out(pan, v, 0.2);
        this.hiss(d, { f0: 6000, f1: 2500, q: 8, dur: 0.15, vol: 0.12 });
        break;
      }
      case 'land': {
        const d = this.out(pan, v, 0.3);
        this.tone(d, { type: 'sine', f0: 100, f1: 50, dur: 0.18, vol: 0.3 });
        break;
      }
      case 'volcano': {
        const d = this.out(pan, 1, 0.7);
        this.hiss(d, { type: 'lowpass', f0: 600, f1: 60, q: 0.4, dur: 2.2, a: 0.1, vol: 0.6 });
        this.tone(d, { type: 'sine', f0: 50, f1: 25, dur: 2.2, a: 0.1, vol: 0.5 });
        break;
      }
      case 'hurt': {
        const d = this.out(pan, 0.8, 0);
        this.tone(d, { type: 'sawtooth', f0: 180, f1: 120, dur: 0.12, vol: 0.12 });
        break;
      }
      default: break;
    }
  }
}
