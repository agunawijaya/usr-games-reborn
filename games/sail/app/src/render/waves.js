// Gerstner wave field, driven by the engine's wind (speed 0-7, direction 1-8).
//
// The same parameters feed the ocean vertex shader (as uniform arrays) and
// the CPU sampler below, so ships bob, pitch and roll on exactly the waves
// that are drawn. Model: Finch, "Effective Water Simulation from Physical
// Models", GPU Gems ch. 1 — a sum of trochoidal (Gerstner) waves.
//
// Wavelengths are a FIXED ladder: when the wind rises only amplitudes change
// (the spectrum's peak slides to longer waves), so no wave ever changes its
// phase speed mid-flight and the sea never "swims". Even-numbered waves are
// the swell (direction fixed for the battle); odd ones are the wind sea,
// which fades out and back in when the wind veers.

export const MAX_WAVES = 12;
const G = 9.81;
const LADDER = [150, 112, 84, 63, 47, 35, 26, 19.5, 14.6, 11, 8.2, 6.1];

// Sea state per wind level: amp = dominant amplitude (m), peak = spectral
// peak wavelength (m), steep = total crest sharpness, foam = crest foam,
// spread = directional spread (rad), chop = short-wave energy.
export const SEA = [
  { amp: 0.16, peak: 60, steep: 0.2, foam: 0.0, spread: 0.9, chop: 0.05 }, // 0 becalmed
  { amp: 0.3, peak: 26, steep: 0.3, foam: 0.01, spread: 0.8, chop: 0.25 }, // 1 light breeze
  { amp: 0.5, peak: 30, steep: 0.42, foam: 0.05, spread: 0.75, chop: 0.4 }, // 2 moderate
  { amp: 0.85, peak: 38, steep: 0.52, foam: 0.14, spread: 0.7, chop: 0.55 }, // 3 fresh
  { amp: 1.3, peak: 50, steep: 0.6, foam: 0.28, spread: 0.65, chop: 0.7 }, // 4 strong
  { amp: 2.1, peak: 68, steep: 0.7, foam: 0.48, spread: 0.6, chop: 0.85 }, // 5 gale
  { amp: 3.1, peak: 88, steep: 0.78, foam: 0.68, spread: 0.55, chop: 0.95 }, // 6 full gale
  { amp: 4.6, peak: 115, steep: 0.84, foam: 0.9, spread: 0.5, chop: 1.0 }, // 7 hurricane
];

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Directions are fixed per wave index relative to their group's base angle.
const OFFSET = LADDER.map((_, i) => (hash(i + 13) - 0.5) * 2);

function seaAt(level) {
  const l = Math.max(0, Math.min(7, level));
  const lo = SEA[Math.floor(l)];
  const hi = SEA[Math.ceil(l)];
  const f = l - Math.floor(l);
  const o = {};
  for (const k of Object.keys(lo)) o[k] = lo[k] + (hi[k] - lo[k]) * f;
  return o;
}

function amplitudes(sea) {
  // a young, wind-driven sea has a broad spectrum: broaden it with the chop
  const sigma = 0.5 + 0.35 * sea.chop;
  const out = LADDER.map((L) => {
    const x = Math.log(L / sea.peak);
    const main = Math.exp(-(x * x) / (2 * sigma * sigma));
    const chop = sea.chop * 0.22 * Math.pow(L / sea.peak, 0.9) * (L < sea.peak ? 1 : 0);
    return Math.max(main, chop) * (L > sea.peak * 2.6 ? 0.25 : 1);
  });
  const m = Math.max(...out);
  return out.map((a, i) => (sea.amp * a) / m * (i % 2 ? 0.9 : 1));
}

export class WaveField {
  constructor(level, windAngle) {
    this.level = level;
    this.levelTarget = level;
    this.swellAngle = windAngle;
    this.seaAngle = windAngle;
    this.seaAngleNext = windAngle;
    this.seaFade = 1; // wind-sea amplitude multiplier during a veer
    this.veering = false;
    this.count = MAX_WAVES;
    this.dirs = new Float32Array(MAX_WAVES * 2);
    this.params = new Float32Array(MAX_WAVES * 4); // A, k, omega, Q
    this.phases = new Float32Array(MAX_WAVES);
    for (let i = 0; i < MAX_WAVES; i++) this.phases[i] = hash(i + 29) * Math.PI * 2;
    this.foam = 0;
    this.chop = 0;
    this.amp = 0;
    this.rebuild();
  }

  setWind(level, windAngle) {
    this.levelTarget = level;
    const d = Math.atan2(Math.sin(windAngle - this.seaAngle), Math.cos(windAngle - this.seaAngle));
    if (Math.abs(d) > 0.01) {
      this.seaAngleNext = windAngle;
      this.veering = true;
    }
  }

  // Jump straight to a state (no transition), e.g. on scenario load.
  snap(level, windAngle) {
    this.level = this.levelTarget = level;
    this.swellAngle = this.seaAngle = this.seaAngleNext = windAngle;
    this.seaFade = 1;
    this.veering = false;
    this.rebuild();
  }

  update(dt) {
    let dirty = false;
    if (this.level !== this.levelTarget) {
      const step = dt * 0.25; // a full Beaufort step takes ~4 s
      this.level += Math.sign(this.levelTarget - this.level) * Math.min(step, Math.abs(this.levelTarget - this.level));
      dirty = true;
    }
    if (this.veering) {
      if (this.seaAngle !== this.seaAngleNext) {
        this.seaFade -= dt * 0.6;
        if (this.seaFade <= 0) {
          this.seaFade = 0;
          this.seaAngle = this.seaAngleNext;
        }
      } else {
        this.seaFade += dt * 0.6;
        if (this.seaFade >= 1) {
          this.seaFade = 1;
          this.veering = false;
        }
      }
      dirty = true;
    }
    if (dirty) this.rebuild();
  }

  rebuild() {
    const sea = seaAt(this.level);
    const amps = amplitudes(sea);
    let sumKA = 0;
    for (let i = 0; i < MAX_WAVES; i++) {
      const k = (2 * Math.PI) / LADDER[i];
      const wind = i % 2 === 1;
      const A = amps[i] * (wind ? this.seaFade : 1) * (this.scale ?? 1);
      const base = wind ? this.seaAngle : this.swellAngle;
      // wind sea spreads wider as it gets rougher: short-crested, confused
      const a = base + OFFSET[i] * sea.spread * (wind ? 1 + 0.6 * sea.chop : 0.5);
      this.dirs[i * 2] = Math.cos(a);
      this.dirs[i * 2 + 1] = Math.sin(a);
      this.params[i * 4] = A;
      this.params[i * 4 + 1] = k;
      this.params[i * 4 + 2] = Math.sqrt(G * k);
      sumKA += k * A;
    }
    const Q = sumKA > 0 ? sea.steep / sumKA : 0;
    for (let i = 0; i < MAX_WAVES; i++) this.params[i * 4 + 3] = Q;
    this.foam = sea.foam;
    this.chop = sea.chop;
    this.amp = sea.amp;
  }
}

// Gerstner displacement at an UNdisplaced surface point (x, z).
export function displace(w, x, z, t, out = { x: 0, y: 0, z: 0 }) {
  let dx = 0; let dy = 0; let dz = 0;
  for (let i = 0; i < w.count; i++) {
    const Dx = w.dirs[i * 2];
    const Dz = w.dirs[i * 2 + 1];
    const A = w.params[i * 4];
    if (A === 0) continue;
    const k = w.params[i * 4 + 1];
    const om = w.params[i * 4 + 2];
    const Q = w.params[i * 4 + 3];
    const ph = k * (Dx * x + Dz * z) - om * t + w.phases[i];
    const c = Math.cos(ph);
    dx += Q * A * Dx * c;
    dz += Q * A * Dz * c;
    dy += A * Math.sin(ph);
  }
  out.x = dx; out.y = dy; out.z = dz;
  return out;
}

// Surface height at a WORLD position (x, z): invert the horizontal
// displacement with fixed-point iterations, then read the height.
const tmpD = { x: 0, y: 0, z: 0 };
export function heightAt(w, x, z, t) {
  let px = x;
  let pz = z;
  for (let it = 0; it < 3; it++) {
    displace(w, px, pz, t, tmpD);
    px = x - tmpD.x;
    pz = z - tmpD.z;
  }
  displace(w, px, pz, t, tmpD);
  return tmpD.y;
}
