// Rain: streaks in a box that travels with the camera, slanted by the wind.
// Density follows atmosphere.state.rain (wind 5.5 .. 7).

import * as THREE from 'three';

export function createRain(scene, { quality = 'high' } = {}) {
  const N = quality === 'high' ? 5000 : 1800;
  const R = 90;
  const H = 70;
  const pos = new Float32Array(N * 6);
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seeds[i * 3] = (Math.random() * 2 - 1) * R;
    seeds[i * 3 + 1] = Math.random() * H;
    seeds[i * 3 + 2] = (Math.random() * 2 - 1) * R;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ color: '#c8d2dc', transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 40;
  scene.add(lines);
  let t = 0;
  return {
    update(dt, camera, windVec, windSpeed, level) {
      mat.opacity = level * 0.32;
      lines.visible = level > 0.02;
      if (!lines.visible) return;
      t += dt;
      const fall = 26;
      const slant = 3 + windSpeed * 2.2;
      const len = 2.2;
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      for (let i = 0; i < N; i++) {
        let y = seeds[i * 3 + 1] - (t * fall) % H;
        if (y < 0) y += H;
        const drift = (H - y) / fall;
        let x = seeds[i * 3] + windVec.x * slant * drift;
        let z = seeds[i * 3 + 2] + windVec.y * slant * drift;
        x = ((x + R) % (2 * R) + 2 * R) % (2 * R) - R;
        z = ((z + R) % (2 * R) + 2 * R) % (2 * R) - R;
        const k = i * 6;
        const wx = cx + x;
        const wy = cy - H * 0.5 + y;
        const wz = cz + z;
        pos[k] = wx;
        pos[k + 1] = wy;
        pos[k + 2] = wz;
        pos[k + 3] = wx - windVec.x * slant / fall * len;
        pos[k + 4] = wy + len;
        pos[k + 5] = wz - windVec.y * slant / fall * len;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
