// The 3D world: renderer, lights, atmosphere, sky, ocean, post-processing.
// Knows nothing about the rules; the game layer feeds it wind and ships.

import * as THREE from 'three';
import { createAtmosphere, dirVector } from './atmosphere.js';
import { createSky } from './sky.js';
import { createOcean } from './ocean.js';
import { createPost } from './post.js';
import { WaveField, heightAt } from './waves.js';

export const CELL = 40; // metres per original grid square

// Engine grid -> world. Row grows south (+z), col grows east (+x).
export const gridToWorld = (row, col) => new THREE.Vector3(col * CELL, 0, row * CELL);
// Heading (engine dir 1..8, 1 = north, clockwise) -> yaw about +y for a
// model whose bow points down -z.
export const dirYaw = (dir) => -((dir - 1) * Math.PI) / 4;

export function createWorld(canvas, { quality = 'high' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1));
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping; // done in post
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const atmo = createAtmosphere();
  const sky = createSky(atmo, { quality });
  scene.add(sky.mesh);
  const ocean = createOcean(atmo, { quality });
  scene.add(ocean.mesh);
  scene.fog = new THREE.FogExp2(0x9ab0c0, 0.00012);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = quality === 'high';
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  const sc = sun.shadow.camera;
  sc.left = -220; sc.right = 220; sc.top = 220; sc.bottom = -220; sc.near = 10; sc.far = 1400;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x203040, 0.9);
  scene.add(hemi);
  const flashLight = new THREE.DirectionalLight(0xc8d4ff, 0);
  flashLight.position.set(300, 800, -200);
  scene.add(flashLight);

  const field = new WaveField(3, 0);

  // A far shoreline for lake scenarios: a ring of low wooded hills, 5-9 km
  // out, heights from layered sines; it takes the haze colour each frame.
  const shore = (() => {
    const seg = 360;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const r = 6200 + 1800 * Math.sin(a * 2 + 1.3) + 600 * Math.sin(a * 7 + 0.4);
      const h = Math.max(0, 55 + 70 * Math.sin(a * 5 + 2.1) + 40 * Math.sin(a * 13) + 18 * Math.sin(a * 37 + 1.7))
        * (0.35 + 0.65 * Math.max(0, Math.sin(a * 1.0 + 0.6)));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      pos.push(x, -2, z, x, h, z);
      if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#445', side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false;
    m.renderOrder = -1;
    m.visible = false;
    return m;
  })();
  scene.add(shore);
  const post = createPost(renderer, { quality });

  let time = 0;
  const focus = new THREE.Vector3();

  function setWind(speed, dir, snap = false) {
    const v = dirVector(dir);
    atmo.setWind(speed, v, snap);
    const ang = Math.atan2(v.y, v.x);
    if (snap) field.snap(speed, ang);
    else field.setWind(speed, ang);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    return { w, h };
  }

  const tint = new THREE.Color();
  function update(dt, camera, focusPoint) {
    time += dt;
    field.update(dt);
    atmo.update(dt, time);
    focus.copy(focusPoint);
    ocean.update(field, camera, camera.position, atmo.state);
    ocean.uniforms.uTime.value = time;
    sky.update(camera);
    const s = atmo.state;
    const u = atmo.u;
    // sun light follows the atmosphere
    sun.color.copy(u.uSunColor.value);
    const mood = s.mood;
    sun.intensity = (mood.sunI ?? 3.2) * u.uSunVis.value * THREE.MathUtils.clamp(u.uSunDir.value.y * 4 + 0.2, 0.15, 1);
    // fresh water carries shorter, lower waves (lake mood)
    if ((field.scale ?? 1) !== (s.seaScale ?? 1)) {
      field.scale = s.seaScale ?? 1;
      field.rebuild();
    }
    shore.visible = !!mood.shore;
    if (shore.visible) {
      shore.position.set(camera.position.x, 0, camera.position.z);
      shore.material.color.copy(s.fogColor).lerp(u.uGround.value, 0.35);
    }
    sun.position.copy(focus).addScaledVector(u.uSunDir.value, 700);
    sun.target.position.copy(focus);
    hemi.color.copy(u.uZenith.value).lerp(new THREE.Color(1, 1, 1), 0.35);
    hemi.groundColor.copy(u.uGround.value);
    hemi.intensity = (1.1 - s.storm * 0.5) * (mood.amb ?? 1);
    flashLight.intensity = u.uFlash.value * 6;
    scene.fog.color.copy(s.fogColor);
    scene.fog.density = s.fogDensity * 1.3;
    // per-mood colour grade (moonlight is blue and nearly colourless), then storm
    const g = s.mood.grade || [1, 1, 1];
    tint.setRGB(g[0], g[1], g[2]).lerp(new THREE.Color(0.85, 0.92, 1.05), s.storm);
  }

  function render(camera, extra = {}) {
    const s = atmo.state;
    post.render(scene, camera, {
      exposure: s.exposure * (extra.exposure ?? 1),
      time,
      bloom: 0.45 + s.storm * 0.2,
      saturation: (s.mood.sat ?? 1) * (1 - s.gale * 0.2 - s.storm * 0.25),
      tint,
      flash: atmo.u.uFlash.value,
      vignette: extra.vignette ?? 0.55,
    });
  }

  const waterHeight = (x, z) => heightAt(field, x, z, time);

  return {
    renderer, scene, atmo, sky, ocean, field, sun, hemi, post,
    setWind, resize, update, render, waterHeight,
    get time() { return time; },
  };
}
