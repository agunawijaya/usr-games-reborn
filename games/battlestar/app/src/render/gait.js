// Human locomotion from the feet up. Instead of swinging leg angles like a
// compass, each foot follows a planned path — planted on the floor through
// stance (heel strike, foot flat, heel-off rolling over the ball of the
// foot), then a swing arc to the next footprint — and a two-bone IK solves
// the hip and knee to reach it. Because the planted foot moves backward in
// the person's frame at exactly the speed the person moves forward, feet
// never slide. The pelvis and torso follow gait biomechanics:
//  - walking: stance ~60 %, pelvis highest at mid-stance (~4 cm bob),
//    pelvis rotation ±4° with thorax counter-rotation, pelvic list toward
//    the swing side, lateral shift over the stance foot, arms swing
//    opposite the legs (more forward than back, lagging slightly);
//  - running: stance ~35-40 % with a flight phase, landing close under the
//    body, knee flexed ~40° at mid-stance (the lowest point), heel kick
//    toward the buttock and knee drive in swing, forward lean, arms bent
//    ~90° pumping toward the chest;
//  - a stiff-legged limp: the injured leg does not bend — it swings out a
//    little and is dragged on its toe while the good leg carries the
//    weight; the body vaults over it when it takes weight.
// Units are the unscaled body (1.76 m person): hip joints ±0.095 m, thigh
// 0.42, shin 0.425, ankle 0.085 above the sole. Angle conventions as in
// humans.js (flexion forward is negative x on hip and shoulder).

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (u) => u * u * (3 - 2 * u);
const easeIn = (u) => u * u;

// toe: the tip of the shoe; tip: where its rounded front rolls on the floor
export const LEG = { hipX: 0.095, hipY: -0.04, thigh: 0.42, shin: 0.425, ankle: 0.085, heel: 0.072, ball: 0.13, toe: 0.175, tip: 0.165 };

/**
 * Gaits. speed m/s and stride m (a full cycle) at 1.76 m body height;
 * stance fraction; contact: where the ankle lands, as a fraction of the
 * stance travel ahead of the hip; h1/h2: ends of heel rocker and foot-flat
 * (fractions of stance); pc/pto: foot pitch at contact / toe-off; width:
 * foot track from the midline; swing: [u, z fraction toe-off → contact,
 * ankle height, pitch] keys; pelvis: base height, bob amplitude, run bob.
 */
export const GAITS = {
  walk: { name: 'walk', speed: 1.35, stride: 1.42, stance: 0.62, contact: 0.42, h1: 0.15, h2: 0.55, pc: -0.28, pto: 0.95, width: 0.075,
    swing: [[0.25, 0.12, 0.2, 0.55], [0.55, 0.55, 0.14, 0.05], [0.85, 1.03, 0.115, -0.22]],
    knee: [[0, 0.06], [0.15, 0.28], [0.42, 0.08], [0.8, 0.1]], hump: 0,
    base: 0.935, bob: 0.02, twist: 0.07, list: 0.045, shift: 0.02, lean: 0.03, chest: 1.3,
    arm: { fwd: 0.32, back: 0.18, elbow: 0.28, elbowFwd: 0.2, lag: 0.05 } },
  hurry: { name: 'hurry', speed: 1.9, stride: 1.72, stance: 0.58, contact: 0.42, h1: 0.13, h2: 0.52, pc: -0.26, pto: 1.0, width: 0.07,
    swing: [[0.25, 0.12, 0.23, 0.6], [0.55, 0.55, 0.15, 0.05], [0.85, 1.03, 0.12, -0.22]],
    knee: [[0, 0.1], [0.15, 0.34], [0.42, 0.12], [0.8, 0.14]], hump: 0,
    base: 0.93, bob: 0.024, twist: 0.08, list: 0.045, shift: 0.018, lean: 0.06, chest: 1.4,
    arm: { fwd: 0.45, back: 0.25, elbow: 0.55, elbowFwd: 0.35, lag: 0.05 } },
  jog: { name: 'jog', speed: 2.8, stride: 2.2, stance: 0.35, contact: 0.35, h1: 0.06, h2: 0.35, pc: -0.06, pto: 0.75, width: 0.05, run: true,
    swing: [[0.06, -0.01, 0.28, 0.95], [0.3, 0.02, 0.44, 1.1], [0.62, 0.62, 0.4, 0.2], [0.93, 1.03, 0.14, -0.06]],
    knee: [[0, 0.32], [0.45, 0.68], [0.85, 0.3]], hump: 0.035,
    base: 0.915, bob: 0.024, twist: 0.09, list: 0.03, shift: 0.01, lean: 0.12, chest: 2.0,
    arm: { fwd: 0.6, back: 0.5, elbow: 1.45, elbowFwd: 0.3, lag: 0.03, pump: true } },
  run: { name: 'run', speed: 4.5, stride: 3.2, stance: 0.3, contact: 0.33, h1: 0.05, h2: 0.3, pc: -0.04, pto: 0.85, width: 0.04, run: true,
    swing: [[0.06, -0.01, 0.32, 1.0], [0.3, 0.02, 0.55, 1.2], [0.62, 0.64, 0.48, 0.25], [0.93, 1.03, 0.15, -0.06]],
    knee: [[0, 0.38], [0.45, 0.74], [0.85, 0.32]], hump: 0.05,
    base: 0.9, bob: 0.035, twist: 0.1, list: 0.025, shift: 0.008, lean: 0.2, chest: 2.2,
    arm: { fwd: 0.8, back: 0.6, elbow: 1.55, elbowFwd: 0.35, lag: 0.02, pump: true } },
  limp: { name: 'limp', speed: 0.55, stride: 0.95, stance: 0.66, contact: 0.4, h1: 0.15, h2: 0.55, pc: -0.2, pto: 0.7, width: 0.08, limp: true,
    swing: [[0.25, 0.15, 0.17, 0.45], [0.55, 0.55, 0.13, 0.05], [0.85, 1.02, 0.11, -0.15]],
    knee: [[0, 0.08], [0.15, 0.16], [0.42, 0.04], [0.8, 0.08]], hump: 0,
    base: 0.915, bob: 0.015, twist: 0.05, list: 0.05, shift: 0.03, lean: 0.12, chest: 1.0,
    arm: { fwd: 0.2, back: 0.1, elbow: 0.4, elbowFwd: 0.2, lag: 0.05 } },
};

// ---------------------------------------------------------------- feet

/** Ankle position [x, y, z] and foot pitch for a normal leg at phase p (0 = this foot's contact). */
function foot(p, g, S, side) {
  const b = g.stance;
  const x = side * g.width;
  const zc = g.contact * b * S;
  const { ankle: A, heel } = LEG;
  if (p < b) {
    const u = p / b;
    const zf = zc - p * S; // where the ankle is when the foot is flat; moves back as fast as the body goes forward
    if (u < g.h1) {
      const ph = lerp(g.pc, 0, ease(u / g.h1)); // heel rocker: the heel stays put
      const hz = zf - heel;
      return [x, A * Math.cos(ph) - heel * Math.sin(ph), hz + A * Math.sin(ph) + heel * Math.cos(ph), ph];
    }
    if (u < g.h2) return [x, A, zf, 0];
    const ph = g.pto * easeIn((u - g.h2) / (1 - g.h2)); // forefoot rocker: the shoe's tip stays put
    const t = LEG.tip;
    const tz = zf + t;
    return [x, A * Math.cos(ph) + t * Math.sin(ph), tz + A * Math.sin(ph) - t * Math.cos(ph), ph];
  }
  // swing: a curve from toe-off to the next contact through the gait's keys
  const u = (p - b) / (1 - b);
  const s0 = foot(b - 1e-6, g, S, side);
  const s1 = foot(0, g, S, side);
  const keys = [[0, s0[2], s0[1], s0[3]], ...g.swing.map(([ku, zf, y, ph]) => [ku, lerp(s0[2], s1[2], zf), y, ph]), [1, s1[2], s1[1], s1[3]]];
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = (u - k1[0]) / (k2[0] - k1[0]);
  const cr = (a, b2, c, d) => 0.5 * ((2 * b2) + (-a + c) * t + (2 * a - 5 * b2 + 4 * c - d) * t * t + (-a + 3 * b2 - 3 * c + d) * t * t * t);
  return [x, cr(k0[2], k1[2], k2[2], k3[2]), cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[3], k1[3], k2[3], k3[3])];
}

/**
 * The injured, stiff leg of a limp: dragged on its toe, then briefly bearing
 * weight. hip: the hip joint's [x, y, z] in the person's frame (null when
 * only the planted position is wanted).
 */
function dragFoot(p, g, S, side, hip) {
  const { ankle: A, toe } = LEG;
  const dragEnd = 0.55;
  const zT1 = 0.14; // the dragged toe comes up only to just ahead of the body
  const zT0 = zT1 - (1 - dragEnd) * S;
  const L = LEG.thigh + LEG.shin - 0.002;
  let tz;
  let out = 0;
  let planted = false;
  if (p < dragEnd) {
    const u = p / dragEnd;
    tz = lerp(zT0, zT1, ease(u));
    out = 0.12 * Math.sin(Math.PI * u); // swings out a little (circumduction)
  } else {
    tz = zT1 - (p - dragEnd) * S; // the toe, now planted, passes back under the body
    planted = true;
  }
  const x = side * (g.width + out);
  let ph = 0;
  let ay = A;
  let az = tz - toe;
  if (!planted && hip) {
    // tip the foot on its toe (fixed on the floor at tz) until the ankle is
    // exactly one straight leg from the hip joint: bisection on the pitch
    const ankleAt = (q) => [tz + A * Math.sin(q) - toe * Math.cos(q), A * Math.cos(q) + toe * Math.sin(q)];
    const dist = (q) => { const [z, y] = ankleAt(q); return Math.hypot(x - hip[0], y - hip[1], z - hip[2]) - L; };
    let lo = 0;
    let hi = 1.35;
    if (dist(lo) <= 0) hi = 0; // even flat, the leg reaches: keep the foot flat
    else if (dist(hi) > 0) lo = hi; // too far even on tiptoe: point it fully
    for (let k = 0; k < 24 && hi - lo > 1e-4; k++) { const m = (lo + hi) / 2; if (dist(m) > 0) lo = m; else hi = m; }
    ph = (lo + hi) / 2;
    [az, ay] = ankleAt(ph);
    if (p < 0.08) {
      // the heel peels off the floor as the drag begins
      const k = ease(p / 0.08);
      ph = lerp(0, ph, k);
      ay = A * Math.cos(ph) + toe * Math.sin(ph);
      az = tz + A * Math.sin(ph) - toe * Math.cos(ph);
    }
  } else if (planted) {
    const settle = ease(clamp((p - dragEnd) / 0.12, 0, 1));
    ph = lerp(0.35, 0, settle);
    ay = lerp(A * Math.cos(0.35) + toe * Math.sin(0.35), A, settle);
    az = tz + A * Math.sin(ph) - toe * Math.cos(ph);
  }
  return [x, ay, az, ph];
}

// ---------------------------------------------------------------- pelvis height

function interp(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], ease((u - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  }
  return keys[keys.length - 1][1];
}

/**
 * How high the pelvis can be at phase p: every leg in stance, with its knee
 * at the gait's knee angle for that moment, limits it; the lowest limit
 * wins. Null in a flight phase (no foot on the floor).
 */
function pelvisLimit(p, g, S, twist, list, shift) {
  const L1 = LEG.thigh;
  const L2 = LEG.shin;
  let best = Infinity;
  const legs = [[-1, p % 1], [1, (p + 0.5) % 1]];
  for (const [side, ph] of legs) {
    let f;
    let kf;
    if (g.limp && side > 0) {
      if (ph < 0.05) continue; // the injured leg only bears weight in its short stance (phase 0.55-1 of the cycle)
      const q = (p % 1);
      if (q < 0.55) continue;
      f = dragFoot(q, g, S, 1, null);
      kf = 0.03; // it does not bend
    } else {
      if (ph >= g.stance) continue;
      const u = ph / g.stance;
      if (u > 0.82) continue; // the trailing leg in pre-swing bends freely
      f = foot(ph, g, S, side);
      kf = interp(g.knee, u);
    }
    const len = Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(kf));
    const hx = shift + side * LEG.hipX * Math.cos(list);
    const hz = -side * LEG.hipX * Math.sin(twist);
    const dx = f[0] - hx;
    const dz = f[2] - hz;
    const h = f[1] + Math.sqrt(Math.max(0.2, len * len - dx * dx - dz * dz)) - LEG.hipY - side * LEG.hipX * Math.sin(list);
    best = Math.min(best, h);
  }
  return best === Infinity ? null : best;
}

/** Pelvis height through the cycle, with a ballistic arc across flight phases. */
function pelvisRaw(p, g, S, twist, list, shift) {
  const h = pelvisLimit(p, g, S, twist, list, shift);
  if (h !== null) return h;
  let a = p;
  let b = p;
  let ha = null;
  let hb = null;
  for (let i = 0; i < 60 && ha === null; i++) { a -= 0.005; ha = pelvisLimit(a, g, S, twist, list, shift); }
  for (let i = 0; i < 60 && hb === null; i++) { b += 0.005; hb = pelvisLimit(b, g, S, twist, list, shift); }
  if (ha === null || hb === null) return g.base;
  const t = (p - a) / (b - a);
  return lerp(ha, hb, t) + g.hump * 4 * t * (1 - t);
}

/**
 * The pelvis curve for a gait and stride: sampled from the leg limits, then
 * smoothed (low harmonics only) so it never jerks at heel strike, and
 * lowered by most of whatever the smoothing overshoots. Cached.
 */
const CURVES = new Map();
const N = 64;
function pelvisCurve(g, S, params) {
  const key = `${g.name}|${S.toFixed(2)}`;
  if (CURVES.has(key)) return CURVES.get(key);
  const raw = [];
  for (let i = 0; i < N; i++) {
    const p = i / N;
    const { twist, list, shift } = params(p);
    raw.push(pelvisRaw(p, g, S, twist, list, shift));
  }
  // smooth (keep low harmonics), then pull back under the limits where the
  // smoothing overshot, and repeat: a smooth curve that stays under the legs' reach
  const lowpass = (src, H) => {
    const out = new Array(N).fill(0);
    for (let h = 0; h <= H; h++) {
      let c = 0;
      let d = 0;
      for (let i = 0; i < N; i++) { c += src[i] * Math.cos(TAU * h * i / N); d += src[i] * Math.sin(TAU * h * i / N); }
      const k = h === 0 ? 1 / N : 2 / N;
      for (let i = 0; i < N; i++) out[i] += k * (c * Math.cos(TAU * h * i / N) + d * Math.sin(TAU * h * i / N));
    }
    return out;
  };
  let sm = lowpass(raw, g.run ? 6 : 4);
  for (let it = 0; it < 6; it++) sm = lowpass(sm.map((v, i) => Math.min(v, raw[i])), g.run ? 8 : 6);
  sm = sm.map((v, i) => Math.min(v, raw[i] + 0.004));
  CURVES.set(key, sm);
  if (CURVES.size > 200) CURVES.delete(CURVES.keys().next().value);
  return sm;
}

// ---------------------------------------------------------------- IK

function rotX(v, a) { const c = Math.cos(a); const s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
function rotY(v, a) { const c = Math.cos(a); const s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
function rotZ(v, a) { const c = Math.cos(a); const s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }

/** Solves one leg so that the ankle reaches `ank` (person frame) with the foot at `pitch`. */
function legIK(out, side, ank, pitch, pel) {
  // into the pelvis frame (Euler XYZ: undo X, then Y, then Z)
  let v = [ank[0] - pel.x, ank[1] - pel.y, ank[2] - pel.z];
  v = rotX(v, -pel.ax);
  v = rotY(v, -pel.ay);
  v = rotZ(v, -pel.az);
  const d = [v[0] - side * LEG.hipX, v[1] - LEG.hipY, v[2]];
  const L1 = LEG.thigh;
  const L2 = LEG.shin;
  let len = Math.hypot(d[0], d[1], d[2]);
  const maxL = L1 + L2 - 1e-3;
  if (len > maxL) { const k = maxL / len; d[0] *= k; d[1] *= k; d[2] *= k; len = maxL; }
  const cosK = (L1 * L1 + L2 * L2 - len * len) / (2 * L1 * L2);
  const kf = Math.PI - Math.acos(clamp(cosK, -1, 1));
  const R = L1 + L2 * Math.cos(kf);
  const tz = Math.asin(clamp(d[0] / Math.max(R, 1e-3), -0.9, 0.9));
  const y1 = -R * Math.cos(tz);
  const z1 = -L2 * Math.sin(kf);
  let tx = Math.atan2(d[2], d[1]) - Math.atan2(z1, y1);
  tx = ((tx + Math.PI * 3) % TAU) - Math.PI;
  const k = side < 0 ? 'L' : 'R';
  out[`th${k}`] = [tx, tz];
  out[`kn${k}`] = kf;
  out[`an${k}`] = pitch - (pel.ax + tx + kf);
}

// ---------------------------------------------------------------- the whole body

/**
 * Fills `out` (a humans.js pose) for gait g at phase p (0..1: the left
 * foot's contact), stride S (body units) and weight w (0..1, how much of
 * the gait shows: it fades toward the standing pose). `ind` gives each
 * person small differences (0..1).
 */
export function locomotion(out, p, g, S, ind = 0.5) {
  p = ((p % 1) + 1) % 1;
  const pl = p;
  const pr = (p + 0.5) % 1;
  const midL = g.stance / 2;
  const run = !!g.run;
  S = Math.round(S * 20) / 20; // quantised so the pelvis curve can be cached
  const params = (q) => {
    if (g.limp) {
      const drag = q < 0.55;
      const u = drag ? q / 0.55 : (q - 0.55) / 0.45;
      return {
        twist: 0.06 * Math.cos(TAU * q),
        list: drag ? 0.09 * Math.sin(Math.PI * u) : -0.03 * Math.sin(Math.PI * u), // hike the injured side to drag it
        shift: drag ? -0.035 : 0.02 * Math.sin(Math.PI * u),
        spineZ: drag ? 0.15 * Math.sin(Math.PI * u) : -0.05, // lean toward the good side while dragging
        lean: g.lean + (drag ? 0.08 * Math.sin(Math.PI * u) : 0), // and forward, hauling the leg
      };
    }
    return {
      twist: g.twist * Math.cos(TAU * q),
      list: -g.list * Math.sin(TAU * (q + 0.1)),
      shift: -g.shift * Math.cos(TAU * (q - midL)),
      spineZ: 0,
      lean: g.lean,
    };
  };
  const { twist, list, shift, spineZ, lean } = params(p);
  // the stance legs (at their natural knee angles) decide how high the pelvis rides
  const curve = pelvisCurve(g, S, params);
  const fi = p * N;
  const i0 = Math.floor(fi) % N;
  const hipY = lerp(curve[i0], curve[(i0 + 1) % N], fi - Math.floor(fi));
  out.hipY = hipY;
  out.hipTwist = twist;
  out.hipZ = list;
  out.hipDx = shift;
  out.hipX = 0;
  const pel = { x: shift, y: hipY, z: 0, ax: 0, ay: twist, az: list };
  // ---- legs
  const fl = foot(pl, g, S, -1);
  legIK(out, -1, fl, fl[3], pel);
  if (g.limp) {
    // the injured side's hip joint (pelvis shifted, hiked and turned)
    const hip = [shift + LEG.hipX * Math.cos(list), hipY + LEG.hipY + LEG.hipX * Math.sin(list), -LEG.hipX * Math.sin(twist)];
    const fr = dragFoot(p, g, S, 1, hip);
    legIK(out, 1, fr, fr[3], pel);
  } else {
    const fr = foot(pr, g, S, 1);
    legIK(out, 1, fr, fr[3], pel);
  }
  // ---- trunk and head
  out.spineX = lean + (run ? 0.03 * Math.cos(TAU * 2 * (p - midL)) : 0.01 * Math.cos(TAU * 2 * p));
  out.spineZ = spineZ - list * 0.6;
  out.chestX = run ? 0.04 : 0.0;
  out.chestY = -twist * g.chest;
  out.chestZ = -list * 0.3;
  out.neckY = -(twist + out.chestY) * 0.9;
  out.neckX = -(out.spineX + out.chestX) * 0.6 + (g.limp ? 0.18 : 0.02);
  out.headZ = -(spineZ + out.chestZ) * 0.5;
  // ---- arms: opposite to the legs, lagging a little; more forward than back
  const a = g.arm;
  const amp = 0.85 + 0.3 * ind;
  const swing = (side) => {
    const f = side < 0 ? -Math.cos(TAU * (p - a.lag)) : Math.cos(TAU * (p - a.lag));
    const flex = (f > 0 ? a.fwd * f : a.back * f) * amp + (a.pump ? 0.15 : 0.05);
    const elbow = a.elbow + a.elbowFwd * Math.max(0, f);
    const inward = a.pump ? 0.18 * Math.max(0, f) : 0;
    return { sh: [-flex, side * (a.pump ? -0.2 : -0.05) * Math.max(0, f), side * (0.09 - inward)], el: -elbow, wr: a.pump ? 0.25 : 0.12 };
  };
  const L = swing(-1);
  const Rt = swing(1);
  out.shL = L.sh; out.elL = L.el; out.wrL = L.wr;
  out.shR = Rt.sh; out.elR = Rt.el; out.wrR = Rt.wr;
  if (g.limp) {
    // the hand on the injured side presses on the thigh; the other arm balances
    out.shR = [-0.25 + 0.05 * Math.sin(TAU * p), 0.25, 0.08];
    out.elR = -0.75;
    out.wrR = 0.5;
    out.shL = [out.shL[0], 0, -0.28 - 0.08 * Math.sin(Math.PI * clamp(p / 0.55, 0, 1))];
  }
  return out;
}
