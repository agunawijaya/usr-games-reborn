// Procedural sound: every sound is synthesised with Web Audio at run time
// (noise buffers, filters, oscillators, envelopes); there are no audio
// files. Muted by default; the first unmute is a user gesture, which is
// when the AudioContext is created.
//
// Two parts:
//   bedFor(spec)  pure: which ambience a room gets (tested in Node)
//   Soundscape    the live mixer: crossfades beds, schedules sparse
//                 incidental sounds, plays one-shots for engine events
//                 and the dogfight.
//
// Realism rule (from the rain port review): incidental sounds are noise
// first; anything tonal is short (under ~80 ms) and sparse, so drips and
// birds do not read as musical notes.

/** Ambience layers per place. Each layer is a recipe name + gain. */
export function bedFor(spec) {
  if (!spec) return { key: 'none', layers: [], sparse: [] };
  const b = spec.biome;
  const night = spec.night;
  const place = spec.place || '';
  const L = [];
  const S = [];
  const add = (recipe, gain, opt) => L.push({ recipe, gain, ...(opt || {}) });
  const every = (recipe, min, max, gain) => S.push({ recipe, min, max, gain });
  if (b === 'ship') {
    add('hum', 0.22);
    add('air', 0.12);
    every('clank', 9, 24, 0.25);
    if (/bay|tube|hangar|launch|gallery|debris|rubble/.test(place)) add('bay', 0.25);
    if (/dining|lounge|parlor|kitchen/.test(place)) every('murmur', 6, 14, 0.18);
    // the Cylon attack: a klaxon while the alert is on (turns 1-30 of the escape)
    if ((spec.light?.alert ?? 0) > 0.3) every('alarm', 4, 7, 0.35);
  } else if (b === 'space') {
    add('cockpit', 0.5);
    every('telemetry', 7, 18, 0.12);
  } else if (b === 'air') {
    add('cockpit', 0.45);
    add('wind', 0.35);
  } else if (b === 'coast') {
    const sea = /beach|shore|dock|lagoon|drown|tidepool|dunes|cliff|coast-road/.test(place) || spec.features?.includes('sea');
    add('surf', sea ? 0.55 : 0.18);
    add('breeze', 0.18);
    if (night) { add('crickets', 0.14); every('frog', 6, 16, 0.14); } else every('gull', 10, 26, sea ? 0.16 : 0.06);
    if (!night) every('bird', 8, 20, 0.08);
    if (place === 'village' && night) { add('drums', 0.16); every('murmur', 5, 12, 0.12); }
    if (place === 'party-lawn') every('murmur', 5, 12, 0.14);
    if (place === 'clubhouse') { add('dance', 0.16); every('murmur', 4, 9, 0.14); }
    if (place === 'stables') every('snort', 9, 20, 0.2);
  } else if (b === 'forest') {
    add('insects', night ? 0.22 : 0.34);
    add('canopy', 0.42);
    every('drip', 2.5, 7, 0.12);
    if (night) { add('crickets', 0.16); every('frog', 4, 11, 0.18); } else every('bird', 5, 13, 0.12);
    if (/pools|falls|stream|canyon|chasm/.test(place) || spec.features?.includes('waterfall')) add('water', /falls|canyon|chasm/.test(place) ? 0.4 : 0.22);
    if (place === 'cave-mouth' || place === 'pools') add('steam', 0.12);
  } else if (b === 'cave') {
    add('roomtone', 0.3);
    every('drip', 1.8, 5.5, 0.2);
    every('moan', 14, 30, 0.12);
    if (/steam|hot|abyss/.test(place)) add('steam', 0.16);
    if (/abyss|pit/.test(place)) add('rumble', 0.3);
    if (/sea-cave|blind-pool|mine-flooded|mine-crystals|mussel/.test(place)) add('lap', place === 'sea-cave' ? 0.35 : 0.2);
  }
  // darkness hides nothing from the ears; injuries add a heartbeat
  if ((spec.status?.fatal ?? 0) >= 2) add('heartbeat', 0.35);
  const key = `${b}|${place}|${night ? 'n' : 'd'}|${L.map((l) => l.recipe).join(',')}|${S.map((x) => x.recipe).join(',')}`;
  return { key, layers: L, sparse: S };
}

/** One-shot recipes for engine events. */
export const EVENT_SOUNDS = {
  move: 'step', teleport: 'shimmer', launch: 'roarUp', land: 'roarDown', crash: 'boom',
  explosions: 'boom', shipExplodes: 'bigBoom', carExplodes: 'boom', bomb: 'boom', grenade: 'boom', gasExplosion: 'bigBoom',
  fightStart: 'ring', strike: 'clang', parried: 'clang', wounded: 'thud', injury: 'thud', slay: 'thud', fightWon: 'ring',
  darkLordFlees: 'whoosh', take: 'click', drop: 'click', wear: 'rustle', give: 'rustle', eat: 'crunch', heal: 'shimmer',
  match: 'strike', fire: 'zap', shot: 'zap', doorOpens: 'grind', seaCaveOpens: 'grind', dug: 'dig', jump: 'whoosh',
  wizard: 'shimmer', su: 'shimmer', kiss: 'breath', loved: 'breath', wedding: 'bells', goddessRises: 'shimmer',
  win: 'bells', die: 'fall', deathAverted: 'shimmer', cylon: 'alarm', cylonDestroyed: 'bigBoom', ropeUp: 'rustle',
  sleep: 'breath', stolen: 'rustle', disarmed: 'clang',
};

export class Soundscape {
  constructor() {
    this.muted = true;
    this.ctx = null;
    this.bed = null;
    this.spec = null;
    this.timers = [];
    this.flightNodes = null;
  }

  /** Creates the graph on first use (must follow a user gesture). */
  _init() {
    if (this.ctx) return true;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 2048;
    comp.connect(this.meter);
    // a short synthetic room echo for caves and the battlestar
    this.echo = ctx.createDelay(1.0);
    this.echo.delayTime.value = 0.23;
    this.echoFb = ctx.createGain();
    this.echoFb.gain.value = 0;
    const echoLp = ctx.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 2200;
    this.echo.connect(echoLp).connect(this.echoFb).connect(this.echo);
    echoLp.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.sfx.connect(this.echo);
    this.noise = {
      white: this._noise((w) => w),
      pink: this._noise(pinkFilter()),
      brown: this._noise(brownFilter()),
    };
    return true;
  }

  _noise(shape) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = shape((seed / 0x7fffffff) * 2 - 1);
    }
    // crossfade the loop seam
    const f = 2048;
    for (let i = 0; i < f; i++) { const k = i / f; d[len - f + i] = d[len - f + i] * (1 - k) + d[i] * k; }
    return buf;
  }

  /** Output level (RMS and peak in dBFS) for tests and the settings panel. */
  level() {
    if (!this.meter) return { rms: -Infinity, peak: -Infinity };
    const a = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(a);
    let sum = 0;
    let peak = 0;
    for (const v of a) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
    return { rms: db(Math.sqrt(sum / a.length)), peak: db(peak) };
  }

  setMuted(m) {
    this.muted = m;
    if (!m && !this._init()) return;
    if (!this.ctx) return;
    if (!m && this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(m ? 0 : 0.8, t, 0.25);
    if (m) this._stopSparse();
    else if (this.spec) { const s = this.spec; this.spec = null; this.setScene(s); }
  }

  setScene(spec) {
    const prev = this.spec;
    this.spec = spec;
    if (this.muted || !this.ctx) return;
    const want = bedFor(spec);
    if (this.bed && this.bed.key === want.key && prev) return;
    const t = this.ctx.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.out.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => old.nodes.forEach((n) => { try { n.stop?.(); n.disconnect(); } catch { /* already gone */ } }), 3000);
    }
    const out = this.ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const nodes = [out];
    for (const l of want.layers) nodes.push(...this._layer(l, out));
    out.gain.setTargetAtTime(1, t, 0.6);
    this.bed = { key: want.key, out, nodes };
    const cave = spec.biome === 'cave' || spec.biome === 'ship';
    this.echoFb.gain.setTargetAtTime(cave ? (spec.biome === 'cave' ? 0.42 : 0.2) : 0, t, 0.3);
    this._stopSparse();
    for (const s of want.sparse) this._sparse(s);
  }

  // ------------------------------------------------------------- layers
  _src(kind, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise[kind];
    s.loop = true;
    s.playbackRate.value = rate;
    s.loopStart = Math.random() * 2;
    s.start(0, Math.random() * 2.5);
    return s;
  }
  _filter(type, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }
  _lfo(target, rate, depth, offset) {
    const o = this.ctx.createOscillator();
    o.frequency.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = depth;
    o.connect(g).connect(target);
    if (offset !== undefined) target.value = offset;
    o.start();
    return [o, g];
  }
  _osc(type, f) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.start();
    return o;
  }

  /** Builds one ambience layer; returns its nodes for later cleanup. */
  _layer({ recipe, gain }, out) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    g.connect(out);
    const n = [g];
    const chain = (...xs) => { for (let i = 0; i < xs.length - 1; i++) xs[i].connect(xs[i + 1]); n.push(...xs); return xs[xs.length - 1]; };
    switch (recipe) {
      case 'hum': { // the battlestar's machinery: mains hum and a slow beat
        const a = this._osc('sine', 55);
        const b = this._osc('sine', 110.6);
        const lp = this._filter('lowpass', 300);
        const m = c.createGain(); m.gain.value = 0.25;
        chain(a, m); chain(b, m); chain(m, lp, g);
        n.push(...this._lfo(m.gain, 0.13, 0.08, 0.25));
        break;
      }
      case 'air': chain(this._src('pink'), this._filter('lowpass', 520), this._filter('highpass', 60), g); break;
      case 'bay': chain(this._src('brown'), this._filter('bandpass', 180, 0.6), g); break;
      case 'cockpit': { // engine rumble felt through the seat
        chain(this._src('brown', 0.7), this._filter('lowpass', 140), g);
        const s = this._osc('sawtooth', 41);
        const lp = this._filter('lowpass', 90);
        const sg = c.createGain(); sg.gain.value = 0.12;
        chain(s, lp, sg, g);
        break;
      }
      case 'wind': {
        const bp = this._filter('bandpass', 800, 0.5);
        chain(this._src('pink'), bp, g);
        n.push(...this._lfo(bp.frequency, 0.07, 350, 800));
        break;
      }
      case 'surf': { // waves: a rolling low wash and a hiss that follows it
        const lp = this._filter('lowpass', 420);
        const amp = c.createGain(); amp.gain.value = 0.5;
        chain(this._src('brown'), lp, amp, g);
        n.push(...this._lfo(amp.gain, 0.095, 0.38, 0.5));
        const hiss = c.createGain(); hiss.gain.value = 0.12;
        chain(this._src('white'), this._filter('highpass', 2500), this._filter('lowpass', 7000), hiss, g);
        n.push(...this._lfo(hiss.gain, 0.095, 0.1, 0.12));
        break;
      }
      case 'breeze': case 'canopy': {
        const bp = this._filter('bandpass', recipe === 'canopy' ? 2400 : 1400, 0.4);
        const amp = c.createGain(); amp.gain.value = 0.5;
        chain(this._src('pink'), bp, amp, g);
        n.push(...this._lfo(amp.gain, 0.05 + Math.random() * 0.05, 0.35, 0.5));
        break;
      }
      case 'insects': { // cicadas: bright noise, fast amplitude flutter, slow swell
        const bp = this._filter('bandpass', 5600, 6);
        const amp = c.createGain(); amp.gain.value = 0.4;
        const swell = c.createGain(); swell.gain.value = 0.6;
        chain(this._src('white'), bp, amp, swell, g);
        n.push(...this._lfo(amp.gain, 48, 0.35, 0.4), ...this._lfo(swell.gain, 0.04, 0.4, 0.6));
        break;
      }
      case 'crickets': {
        const o = this._osc('sine', 4400);
        const amp = c.createGain(); amp.gain.value = 0;
        const gate = c.createGain(); gate.gain.value = 0.5;
        chain(o, amp, gate, g);
        n.push(...this._lfo(amp.gain, 28, 0.5, 0), ...this._lfo(gate.gain, 0.9, 0.5, 0.5));
        break;
      }
      case 'water': chain(this._src('pink', 1.2), this._filter('bandpass', 1100, 0.3), g); break;
      case 'steam': {
        const amp = c.createGain(); amp.gain.value = 0.5;
        chain(this._src('white'), this._filter('highpass', 3000), amp, g);
        n.push(...this._lfo(amp.gain, 0.08, 0.4, 0.5));
        break;
      }
      case 'roomtone': chain(this._src('brown', 0.6), this._filter('lowpass', 160), g); break;
      case 'rumble': chain(this._src('brown', 0.4), this._filter('lowpass', 70), g); break;
      case 'lap': {
        const lp = this._filter('lowpass', 700);
        const amp = c.createGain(); amp.gain.value = 0.4;
        chain(this._src('brown', 1.4), lp, amp, g);
        n.push(...this._lfo(amp.gain, 0.4, 0.3, 0.4));
        break;
      }
      case 'drums': case 'dance': { // distant music: only the low thump survives the distance
        const period = recipe === 'dance' ? 60 / 118 : 60 / 92;
        const lp = this._filter('lowpass', recipe === 'dance' ? 180 : 240);
        chain(lp, g);
        let next = c.currentTime + 0.1;
        let beat = 0;
        const tick = () => {
          while (next < c.currentTime + 0.3) {
            const accent = recipe === 'drums' ? [1, 0, 0.6, 0.4][beat % 4] : 1;
            if (accent) this._thump(lp, next, accent * 0.9, recipe === 'dance' ? 55 : 90);
            next += period;
            beat++;
          }
        };
        const id = setInterval(tick, 100);
        n.push({ stop: () => clearInterval(id), disconnect() {} });
        break;
      }
      case 'heartbeat': {
        const lp = this._filter('lowpass', 120);
        chain(lp, g);
        let next = c.currentTime + 0.1;
        const id = setInterval(() => {
          while (next < c.currentTime + 0.3) { this._thump(lp, next, 1, 48); this._thump(lp, next + 0.22, 0.6, 44); next += 0.95; }
        }, 100);
        n.push({ stop: () => clearInterval(id), disconnect() {} });
        break;
      }
      default: break;
    }
    return n;
  }

  _thump(dest, t, amp, f) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(amp, t + 0.01);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(e).connect(dest);
    o.start(t);
    o.stop(t + 0.4);
  }

  // ------------------------------------------------------------- sparse incidentals
  _sparse(s) {
    const go = () => {
      if (this.muted) return;
      this.play(s.recipe, s.gain);
      this.timers.push(setTimeout(go, (s.min + Math.random() * (s.max - s.min)) * 1000));
    };
    this.timers.push(setTimeout(go, (s.min * 0.3 + Math.random() * s.min) * 1000));
  }
  _stopSparse() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Engine events (the same objects the stage gets). */
  event(e) {
    if (this.muted || !this.ctx) return;
    const r = EVENT_SOUNDS[e.type];
    if (r) this.play(r, 0.7, e);
  }

  // ------------------------------------------------------------- one-shots
  /** A short noise burst through a filter with an envelope. */
  _burst({ kind = 'white', type = 'bandpass', f = 1000, f2, q = 1, a = 0.005, d = 0.2, amp = 0.5, at = 0, rate = 1 }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noise[kind];
    s.playbackRate.value = rate;
    const fl = this._filter(type, f, q);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(amp, t + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    s.connect(fl).connect(e).connect(this.sfx);
    s.start(t, Math.random() * 2);
    s.stop(t + a + d + 0.05);
  }
  /** A short tone (kept under ~80 ms unless it is a deliberate chime). */
  _blip({ f = 1000, f2, type = 'sine', a = 0.003, d = 0.05, amp = 0.2, at = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(amp, t + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(e).connect(this.sfx);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }

  play(recipe, gain = 0.7) {
    if (this.muted || !this.ctx) return;
    const R = Math.random;
    const k = gain;
    const biome = this.spec?.biome;
    switch (recipe) {
      case 'step': {
        const soft = biome === 'coast' || biome === 'forest';
        for (let i = 0; i < 2; i++) this._burst({ kind: soft ? 'pink' : 'white', type: soft ? 'lowpass' : 'bandpass', f: soft ? 900 : 2200, q: 1.2, d: soft ? 0.12 : 0.06, amp: 0.25 * k, at: i * 0.32 });
        break;
      }
      case 'clank': this._burst({ f: 700 + R() * 900, q: 8, d: 0.35, amp: 0.3 * k }); this._burst({ kind: 'brown', type: 'lowpass', f: 200, d: 0.2, amp: 0.3 * k }); break;
      case 'murmur': for (let i = 0; i < 5; i++) this._burst({ kind: 'pink', f: 350 + R() * 300, q: 3, a: 0.05, d: 0.25 + R() * 0.3, amp: 0.15 * k, at: i * (0.2 + R() * 0.3) }); break;
      case 'telemetry': this._blip({ f: 1800 + R() * 600, d: 0.03, amp: 0.06 * k }); this._blip({ f: 2400 + R() * 400, d: 0.03, amp: 0.05 * k, at: 0.09 }); break;
      case 'gull': { // two or three falling "kee-ow" cries: breathy noise with a pitched edge
        const n = 2 + Math.floor(R() * 2);
        for (let i = 0; i < n; i++) {
          const at = i * (0.35 + R() * 0.15);
          this._burst({ f: 2600, f2: 1500, q: 6, a: 0.02, d: 0.28, amp: 0.2 * k, at });
          this._blip({ type: 'triangle', f: 2200 + R() * 300, f2: 1300, a: 0.02, d: 0.07, amp: 0.05 * k, at });
        }
        break;
      }
      case 'bird': { // a quick two-note chirp, very short
        const f = 2800 + R() * 1800;
        this._blip({ f, f2: f * (0.8 + R() * 0.5), d: 0.04, amp: 0.06 * k });
        if (R() < 0.6) this._blip({ f: f * 1.1, f2: f * 0.9, d: 0.035, amp: 0.05 * k, at: 0.09 + R() * 0.05 });
        break;
      }
      case 'frog': for (let i = 0; i < 3 + Math.floor(R() * 3); i++) this._burst({ kind: 'pink', f: 280 + R() * 60, q: 12, a: 0.01, d: 0.06, amp: 0.3 * k, at: i * 0.11 }); break;
      case 'drip': { // splash first; one in four adds a very short bubble plink
        this._burst({ f: 3000 + R() * 2500, q: 1.5, a: 0.002, d: 0.035, amp: 0.25 * k });
        if (R() < 0.25) this._blip({ f: 900 + R() * 900, f2: 1600 + R() * 900, d: 0.03 + R() * 0.04, amp: 0.06 * k, at: 0.01 });
        break;
      }
      case 'moan': this._burst({ kind: 'pink', f: 260, f2: 190, q: 4, a: 1.2, d: 2.5, amp: 0.25 * k }); break;
      case 'shimmer': for (let i = 0; i < 7; i++) this._blip({ f: 1800 + R() * 2600, d: 0.06, amp: 0.05 * k, at: i * 0.05 }); this._burst({ f: 6000, q: 0.8, a: 0.1, d: 0.5, amp: 0.12 * k }); break;
      case 'roarUp': this._burst({ kind: 'brown', type: 'lowpass', f: 120, f2: 900, a: 0.4, d: 1.6, amp: 0.8 * k }); this._burst({ f: 900, f2: 3000, q: 0.6, a: 0.4, d: 1.4, amp: 0.2 * k }); break;
      case 'roarDown': this._burst({ kind: 'brown', type: 'lowpass', f: 700, f2: 90, a: 0.05, d: 1.4, amp: 0.7 * k }); this._burst({ kind: 'brown', type: 'lowpass', f: 90, d: 0.4, amp: 0.8 * k, at: 1.2 }); break;
      case 'boom': this._burst({ kind: 'brown', type: 'lowpass', f: 900, f2: 60, a: 0.005, d: 1.3, amp: 1 * k }); this._burst({ f: 2000, f2: 300, q: 0.5, a: 0.002, d: 0.4, amp: 0.4 * k }); break;
      case 'bigBoom': this.play('boom', k); this._burst({ kind: 'brown', type: 'lowpass', f: 200, f2: 40, a: 0.2, d: 3, amp: 0.9 * k, at: 0.1 }); break;
      case 'ring': [1, 2.76, 5.4].forEach((m, i) => this._blip({ type: 'sine', f: 520 * m, a: 0.002, d: 0.6 - i * 0.15, amp: 0.08 * k })); this._burst({ f: 5000, q: 1, d: 0.15, amp: 0.2 * k }); break;
      case 'clang': [1, 2.4, 4.1].forEach((m, i) => this._blip({ type: 'sine', f: (380 + R() * 60) * m, a: 0.001, d: 0.3 - i * 0.07, amp: 0.1 * k })); this._burst({ f: 3000, q: 2, a: 0.001, d: 0.08, amp: 0.5 * k }); break;
      case 'thud': this._burst({ kind: 'brown', type: 'lowpass', f: 250, f2: 80, a: 0.003, d: 0.25, amp: 0.8 * k }); break;
      case 'whoosh': this._burst({ kind: 'pink', f: 400, f2: 2500, q: 1.2, a: 0.15, d: 0.4, amp: 0.4 * k }); break;
      case 'click': this._burst({ f: 3500, q: 3, a: 0.001, d: 0.025, amp: 0.3 * k }); this._burst({ kind: 'pink', type: 'lowpass', f: 900, a: 0.01, d: 0.08, amp: 0.2 * k, at: 0.03 }); break;
      case 'rustle': for (let i = 0; i < 4; i++) this._burst({ kind: 'pink', type: 'highpass', f: 1800, a: 0.02, d: 0.08 + R() * 0.08, amp: 0.15 * k, at: i * 0.07 }); break;
      case 'crunch': for (let i = 0; i < 3; i++) this._burst({ f: 1400 + R() * 1200, q: 2, a: 0.002, d: 0.06, amp: 0.35 * k, at: i * 0.25 + R() * 0.05 }); break;
      case 'strike': this._burst({ f: 3500, f2: 1500, q: 1, a: 0.005, d: 0.3, amp: 0.4 * k }); this._burst({ kind: 'pink', type: 'lowpass', f: 700, a: 0.1, d: 0.8, amp: 0.2 * k, at: 0.15 }); break;
      case 'zap': this._blip({ type: 'sawtooth', f: 1400, f2: 180, d: 0.18, amp: 0.12 * k }); this._burst({ f: 4000, q: 1, d: 0.12, amp: 0.2 * k }); break;
      case 'grind': this._burst({ kind: 'brown', type: 'bandpass', f: 180, f2: 260, q: 2, a: 0.3, d: 1.8, amp: 0.7 * k }); break;
      case 'dig': for (let i = 0; i < 3; i++) this._burst({ kind: 'pink', f: 700, q: 1.5, a: 0.005, d: 0.15, amp: 0.4 * k, at: i * 0.45 }); break;
      case 'breath': this._burst({ kind: 'pink', f: 700, q: 0.8, a: 0.5, d: 1.2, amp: 0.12 * k }); break;
      case 'bells': [523, 659, 784, 1046].forEach((f, i) => this._blip({ f, a: 0.004, d: 1.4, amp: 0.06 * k, at: i * 0.18 })); break;
      case 'fall': this._blip({ type: 'sawtooth', f: 220, f2: 40, a: 0.05, d: 2.2, amp: 0.1 * k }); this._burst({ kind: 'brown', type: 'lowpass', f: 300, f2: 50, a: 0.3, d: 2.5, amp: 0.5 * k }); break;
      case 'snort': this._burst({ kind: 'pink', f: 500, f2: 250, q: 2, a: 0.03, d: 0.4, amp: 0.3 * k }); this._burst({ kind: 'pink', f: 450, q: 2, a: 0.02, d: 0.25, amp: 0.2 * k, at: 0.5 }); break;
      case 'alarm': for (let i = 0; i < 3; i++) this._blip({ type: 'square', f: 660, f2: 880, a: 0.02, d: 0.35, amp: 0.05 * k, at: i * 0.55 }); break;
      default: break;
    }
  }

  /** Dogfight: engine drone while it lasts, torpedoes, the kill, a lock tone. */
  flight(v, key) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx;
    if (!this.flightNodes && !v.done) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      const s = this._src('brown', 0.8);
      const lp = this._filter('lowpass', 220);
      s.connect(lp).connect(g);
      g.gain.setTargetAtTime(0.5, c.currentTime, 0.3);
      this.flightNodes = { g, s, lastShots: v.shots?.length ?? 0, lock: 0 };
    }
    const F = this.flightNodes;
    if (!F) return;
    if (key === 'f' || key === ' ') this.play('zap', 0.9);
    if (key && 'hjklurdHJKLURD'.includes(key)) this._burst({ kind: 'pink', f: 500, q: 0.8, a: 0.03, d: 0.18, amp: 0.12 });
    // lock tone when the raider sits in the reticle
    const aligned = Math.abs(v.row - 11) <= 1 && Math.abs(v.column - 39) < 4;
    if (aligned && !v.done && c.currentTime - F.lock > 0.35) { this._blip({ type: 'square', f: 1320, d: 0.04, amp: 0.03 }); F.lock = c.currentTime; }
    if (v.done) {
      if (v.outcome === 'destroyed') this.play('bigBoom', 0.9);
      F.g.gain.setTargetAtTime(0, c.currentTime, 0.4);
      const old = F;
      setTimeout(() => { try { old.s.stop(); old.g.disconnect(); } catch { /* gone */ } }, 2000);
      this.flightNodes = null;
    }
  }
}

function pinkFilter() {
  let b0 = 0; let b1 = 0; let b2 = 0;
  return (w) => {
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.2;
  };
}
function brownFilter() {
  let last = 0;
  return (w) => { last = (last + 0.02 * w) / 1.02; return last * 3.5; };
}
