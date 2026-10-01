// Atmosphere: time of day per scenario ("mood") blended with the ENGINE's
// wind level. One set of uniform objects is shared by the sky dome, the
// ocean and the smoke, so a rising gale darkens everything at once.

import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

// Art-directed moods for the featured scenarios. Elevation/azimuth in
// degrees; azimuth 0 = north (-z), clockwise.
export const MOODS = {
  golden: { elev: 11, azim: 250, zenith: '#3a68a6', mid: '#9fb9cc', horizon: '#f0c089', ground: '#223a4a', sun: '#ffc27a', sunI: 3.2, cover: 0.45, haze: 0.8, exposure: 1.0, deep: '#061d2c', scatter: '#0f6a66' },
  gale: { elev: 24, azim: 215, zenith: '#566f8c', mid: '#8998a7', horizon: '#b9c3cc', ground: '#26343d', sun: '#fff0dc', sunI: 2.4, cover: 0.62, haze: 1.0, exposure: 1.05, deep: '#133440', scatter: '#24776c' },
  tropic: { elev: 52, azim: 150, zenith: '#2463b8', mid: '#78a8dc', horizon: '#bfe0f2', ground: '#1b4a5c', sun: '#fffaf0', sunI: 3.6, cover: 0.38, haze: 0.7, exposure: 0.95, deep: '#04304a', scatter: '#16a093' },
  dusk: { elev: 3.5, azim: 265, zenith: '#26334f', mid: '#6c7089', horizon: '#c9806a', ground: '#141d27', sun: '#ff9a5c', sunI: 2.2, cover: 0.55, haze: 1.0, exposure: 1.15, deep: '#07141f', scatter: '#1b4f57' },
  haze: { elev: 20, azim: 110, zenith: '#5d86b5', mid: '#a8bdcc', horizon: '#e9d9bf', ground: '#2b4450', sun: '#ffe2b0', sunI: 3.0, cover: 0.3, haze: 1.2, exposure: 1.0, deep: '#092838', scatter: '#197c78' },
  // Moonlight: the "sun" is the moon; stars; clouds lit dimly; lanterns carry the scene.
  night: { elev: 28, azim: 130, zenith: '#060c1a', mid: '#122036', horizon: '#26364f', ground: '#03060a', sun: '#bccdf2', sunI: 0.9, amb: 0.32, cover: 0.3, haze: 0.7, exposure: 1.9, deep: '#020912', scatter: '#0c2733', night: 1, cloudLight: 0.16, sunScale: 0.35, grade: [0.72, 0.84, 1.12], sat: 0.45 },
  // A grey northern day: flat light, low cloud, cold water.
  overcast: { elev: 18, azim: 200, zenith: '#66788a', mid: '#8a97a4', horizon: '#b7bec4', ground: '#283137', sun: '#e9e7e2', sunI: 1.5, amb: 1.35, cover: 0.86, haze: 1.2, exposure: 1.12, deep: '#10252d', scatter: '#285852', cloudLight: 0.8, sunVis: 0.06, sat: 0.8 },
  // Fresh water: greener, short low waves, a far shoreline.
  lake: { elev: 34, azim: 205, zenith: '#4777ad', mid: '#91b3cf', horizon: '#d9e0e1', ground: '#2c3d31', sun: '#fff3dc', sunI: 3.0, cover: 0.42, haze: 1.1, exposure: 1.0, deep: '#0d2c26', scatter: '#3b7d58', sea: 0.45, shore: true },
};

export function createAtmosphere() {
  const u = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uZenith: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uGround: { value: new THREE.Color() },
    uCloudCover: { value: 0.3 },
    uCloudDark: { value: 0 },
    uCloudShift: { value: new THREE.Vector2() },
    uFlash: { value: 0 },
    uHaze: { value: 1 },
    uSunVis: { value: 1 },
    uTime: { value: 0 },
    uStorm: { value: 0 },
    uDeep: { value: new THREE.Color() },
    uScatter: { value: new THREE.Color() },
    uNight: { value: 0 },
    uCloudLight: { value: 1 },
  };
  const state = {
    mood: MOODS.golden,
    wind: 3, // smoothed engine windspeed (0..7)
    windTarget: 3,
    windVec: new THREE.Vector2(0, -1),
    windVecTarget: new THREE.Vector2(0, -1),
    flash: 0,
    nextBolt: 4,
    exposure: 1,
    fogColor: new THREE.Color(),
    fogDensity: 0.00012,
    rain: 0,
  };

  function setMood(name) {
    state.mood = MOODS[name] || MOODS.golden;
  }
  function setWind(speed, vec2, snap = false) {
    state.windTarget = speed;
    state.windVecTarget.copy(vec2).normalize();
    if (snap) {
      state.wind = speed;
      state.windVec.copy(state.windVecTarget);
    }
  }

  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const tmp3 = new THREE.Color();
  const tmp4 = new THREE.Color();
  const slate = C('#4a525c');
  const stormZenith = C('#1b1f26');
  const stormHorizon = C('#3d444c');

  function update(dt, time, rng = Math.random) {
    const m = state.mood;
    // smooth the engine's wind level so the sky changes over seconds
    state.wind += (state.windTarget - state.wind) * Math.min(1, dt * 0.35);
    state.windVec.lerp(state.windVecTarget, Math.min(1, dt * 0.5)).normalize();
    const w = state.wind;
    const storm = THREE.MathUtils.smoothstep(w, 4.2, 7.0); // 0 below gale, 1 in the hurricane
    const gale = THREE.MathUtils.smoothstep(w, 3.5, 6.0);

    const el = THREE.MathUtils.degToRad(m.elev);
    const az = THREE.MathUtils.degToRad(m.azim);
    u.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

    // weather greys the sky toward slate; at night the same weather darkens it
    const k = m.night ? 0.3 : 1;
    const sl = tmp2.copy(slate).multiplyScalar(k);
    const sh = tmp3.copy(stormHorizon).multiplyScalar(k);
    u.uZenith.value.set(m.zenith).lerp(tmp4.copy(stormZenith).multiplyScalar(k), storm * 0.85);
    u.uMid.value.set(m.mid).lerp(sl, gale * 0.5).lerp(sh, storm * 0.75);
    u.uHorizon.value.set(m.horizon).lerp(sl, gale * 0.55).lerp(sh, storm * 0.7);
    u.uNight.value = m.night || 0;
    u.uCloudLight.value = m.cloudLight ?? 1;
    state.seaScale = m.sea ?? 1;
    u.uGround.value.set(m.ground).lerp(C('#10161b'), storm * 0.7);
    u.uCloudCover.value = THREE.MathUtils.clamp(m.cover + gale * 0.45 + storm * 0.35, 0, 1);
    u.uCloudDark.value = THREE.MathUtils.clamp(gale * 0.35 + storm * 0.6, 0, 0.95);
    u.uSunVis.value = (m.sunVis ?? 1) * (1 - THREE.MathUtils.clamp(gale * 0.5 + storm * 0.5, 0, 0.97));
    tmp.set(m.sun);
    u.uSunColor.value.copy(tmp).multiplyScalar((1 - storm * 0.6) * (m.sunScale ?? 1));
    u.uHaze.value = m.haze + gale * 0.6;
    u.uDeep.value.set(m.deep).lerp(C('#15272e'), gale * 0.45);
    u.uScatter.value.set(m.scatter).lerp(C('#2a5a58'), gale * 0.6).multiplyScalar(1 - storm * 0.5);
    u.uStorm.value = storm;
    u.uTime.value = time;
    // clouds drift downwind, faster in a blow
    const drift = 0.004 + w * 0.0035;
    u.uCloudShift.value.x += state.windVec.x * drift * dt;
    u.uCloudShift.value.y += state.windVec.y * drift * dt;

    // lightning: only in a true storm (wind 7), occasionally at wind 6
    const boltRate = storm > 0.85 ? 1 : storm > 0.6 ? 0.25 : 0;
    state.flash = Math.max(0, state.flash - dt * 5);
    state.nextBolt -= dt * boltRate;
    state.bolt = false;
    if (boltRate > 0 && state.nextBolt <= 0) {
      state.flash = 1;
      state.bolt = true;
      state.nextBolt = 2 + rng() * 6;
    }
    const flicker = state.flash > 0 ? state.flash * (0.6 + 0.4 * Math.sin(time * 90)) : 0;
    u.uFlash.value = flicker;

    state.exposure = m.exposure * (1 - storm * 0.25);
    state.fogColor.copy(u.uHorizon.value).lerp(u.uGround.value, 0.25);
    state.fogDensity = 0.00008 + gale * 0.00018 + storm * 0.0005;
    state.rain = THREE.MathUtils.smoothstep(w, 5.5, 7.0);
    state.storm = storm;
    state.gale = gale;
  }

  return { u, state, setMood, setWind, update };
}

// Wind direction (engine dir 1..8, the way the wind BLOWS TOWARD) as a
// world-space xz vector: x east, z south.
export function dirVector(dir) {
  const a = ((dir - 1) * Math.PI) / 4; // 0 = north
  return new THREE.Vector2(Math.sin(a), -Math.cos(a));
}
