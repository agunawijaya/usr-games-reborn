// Procedural Web Audio: every sound is synthesised from oscillators and
// noise at run time (no samples, in the spirit of ADR-002). Ambience follows
// the engine's wind; one-shots are panned and filtered by distance from the
// camera, and delayed by the speed of sound so distant broadsides flash
// before they boom.

import * as THREE from 'three';

export function createAudio() {
  let ctx = null;
  let master;
  let comp;
  let reverb;
  let reverbGain;
  let noiseBuf;
  let brownBuf;
  let started = false;
  let muted = false;
  let camera = null;
  const amb = {};
  let windLevel = 3;
  let rainLevel = 0;

  function makeNoise(seconds, brown = false) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else d[i] = w;
      }
    }
    return b;
  }

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function loop(buf, filterType, freq, q, gain) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(master);
    src.start(0, Math.random() * 2);
    return { src, f, g };
  }

  function start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.35;
    reverb.connect(reverbGain).connect(master);
    noiseBuf = makeNoise(4);
    brownBuf = makeNoise(6, true);
    // ambience
    amb.waves = loop(brownBuf, 'lowpass', 500, 0.5, 0.35);
    amb.wind = loop(noiseBuf, 'bandpass', 420, 0.8, 0.05);
    amb.whistle = loop(noiseBuf, 'bandpass', 1300, 18, 0.0);
    amb.rain = loop(noiseBuf, 'highpass', 2500, 0.4, 0.0);
    // slow swell on the waves
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 0.12;
    lfo.connect(lg).connect(amb.waves.g.gain);
    lfo.start();
    setWind(windLevel, 0);
  }

  function setWind(w, rain = rainLevel) {
    windLevel = w;
    rainLevel = rain;
    if (!ctx) return;
    const t = ctx.currentTime;
    amb.wind.g.gain.setTargetAtTime(0.02 + w * 0.028, t, 1.5);
    amb.wind.f.frequency.setTargetAtTime(300 + w * 90, t, 1.5);
    amb.whistle.g.gain.setTargetAtTime(w >= 5 ? (w - 4) * 0.012 : 0, t, 2);
    amb.waves.g.gain.setTargetAtTime(0.22 + w * 0.05, t, 2);
    amb.waves.f.frequency.setTargetAtTime(380 + w * 70, t, 2);
    amb.rain.g.gain.setTargetAtTime(rain * 0.12, t, 2);
  }

  // Distance, pan and speed-of-sound delay for a world position.
  function place(pos) {
    if (!camera || !pos) return { gain: 1, pan: 0, delay: 0, cutoff: 12000, dist: 100 };
    const rel = new THREE.Vector3().copy(pos).sub(camera.position);
    const dist = rel.length();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const pan = THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1) * 0.8;
    return {
      gain: 1 / (1 + dist / 180),
      pan,
      delay: Math.min(1.4, dist / 343),
      cutoff: THREE.MathUtils.clamp(14000 / (1 + dist / 120), 500, 14000),
      dist,
    };
  }

  function chain(p, wet = 0.3) {
    const g = ctx.createGain();
    g.gain.value = p.gain;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = p.cutoff;
    const pan = ctx.createStereoPanner();
    pan.pan.value = p.pan;
    g.connect(lp).connect(pan).connect(master);
    const send = ctx.createGain();
    send.gain.value = wet + Math.min(0.5, p.dist / 1200);
    pan.connect(send).connect(reverb);
    return g;
  }

  function noiseHit(out, t, dur, type, freq, q, level, sweepTo = null) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 3);
    s.stop(t + dur + 0.05);
  }

  function tone(out, t, dur, f0, f1, level, type = 'sine') {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const ok = () => ctx && !muted;
  let lastCannon = 0;

  return {
    start,
    setCamera(c) { camera = c; },
    setWind,
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.1);
    },
    get muted() { return muted; },

    cannon(pos, load = 3) {
      if (!ok()) return;
      const now = ctx.currentTime;
      if (now - lastCannon < 0.035) return; // polyphony guard
      lastCannon = now;
      const p = place(pos);
      const t = now + p.delay;
      const out = chain(p, 0.35);
      const big = load === 4 ? 1.25 : 1;
      tone(out, t, 0.9, 70 * big, 28, 0.9);
      noiseHit(out, t, 1.6, 'lowpass', 900, 0.7, 0.8 * big, 120);
      noiseHit(out, t, 0.05, 'highpass', 2500, 0.5, 0.5);
    },
    impact(pos) {
      if (!ok()) return;
      const p = place(pos);
      const t = ctx.currentTime + p.delay;
      const out = chain(p, 0.2);
      noiseHit(out, t, 0.35, 'bandpass', 600, 1.2, 0.7, 180);
      tone(out, t, 0.25, 140, 60, 0.4, 'triangle');
      noiseHit(out, t + 0.03, 0.5, 'bandpass', 2200, 2, 0.12);
    },
    splash(pos) {
      if (!ok()) return;
      const p = place(pos);
      const t = ctx.currentTime + p.delay;
      noiseHit(chain(p, 0.15), t, 0.7, 'bandpass', 1800, 0.8, 0.35, 350);
    },
    explosion(pos) {
      if (!ok()) return;
      const p = place(pos);
      const t = ctx.currentTime + p.delay;
      const out = chain({ ...p, gain: Math.min(1, p.gain * 2.5) }, 0.6);
      tone(out, t, 3.5, 55, 18, 1.0);
      noiseHit(out, t, 4.5, 'lowpass', 1200, 0.5, 1.0, 60);
      for (let i = 0; i < 6; i++) noiseHit(out, t + 0.3 + Math.random() * 2, 0.2, 'bandpass', 800 + Math.random() * 1500, 2, 0.2);
    },
    founder(pos) {
      if (!ok()) return;
      const p = place(pos);
      const t = ctx.currentTime;
      const out = chain(p, 0.4);
      noiseHit(out, t, 6, 'lowpass', 300, 0.5, 0.6, 60);
      for (let i = 0; i < 12; i++) tone(out, t + Math.random() * 5, 0.12, 300 + Math.random() * 500, 700, 0.08);
    },
    bell() {
      if (!ok()) return;
      const t = ctx.currentTime + 0.1;
      const out = chain({ gain: 0.35, pan: 0, delay: 0, cutoff: 9000, dist: 50 }, 0.4);
      for (const [r, a] of [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [8.9, 0.05]]) tone(out, t, 3.2 / r + 0.5, 660 * r, 660 * r * 0.995, a);
    },
    melee(pos) {
      if (!ok()) return;
      const p = place(pos);
      const out = chain(p, 0.3);
      const t = ctx.currentTime + p.delay;
      for (let i = 0; i < 10; i++) {
        const dt = Math.random() * 1.4;
        if (Math.random() < 0.5) tone(out, t + dt, 0.18, 1800 + Math.random() * 1400, 1500, 0.08, 'square');
        else noiseHit(out, t + dt, 0.12, 'highpass', 1500, 0.6, 0.25);
      }
    },
    creak(heavy = false) {
      if (!ok()) return;
      const t = ctx.currentTime + Math.random() * 0.3;
      const out = chain({ gain: heavy ? 0.5 : 0.18, pan: Math.random() - 0.5, delay: 0, cutoff: 4000, dist: 40 }, 0.2);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = 90 + Math.random() * 70;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * (1.15 + Math.random() * 0.3), t + 0.6);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700 + Math.random() * 500;
      bp.Q.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.8);
    },
    thunder() {
      if (!ok()) return;
      const t = ctx.currentTime + 0.4 + Math.random() * 1.8;
      const out = chain({ gain: 0.9, pan: Math.random() - 0.5, delay: 0, cutoff: 900, dist: 900 }, 0.7);
      noiseHit(out, t, 4.5, 'lowpass', 400, 0.4, 0.9, 50);
      tone(out, t, 3, 45, 25, 0.5);
    },
    // called every frame: random timber creaks, more in a seaway
    tick(dt) {
      if (!ok()) return;
      if (Math.random() < dt * (0.12 + windLevel * 0.06)) this.creak(false);
    },
  };
}
