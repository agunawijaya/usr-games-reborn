// trek/procedural-web — shield bubble with hex-grid ripple at the impact point.
//
// An ellipsoid fitted to the ship. Normally only a faint Fresnel rim is
// visible. A hit sends a ring of lit hexagons racing outward from the
// impact direction across the surface (angular distance on the unit
// sphere), with a hot spot where the bolt landed. Up to four ripples at
// once. Raising shields sweeps the hex grid on from bow to stern; the
// Captain's Override invulnerability tints the whole bubble gold.

import * as THREE from 'three';
import { HASH } from './glsl.js';

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  vObj = normalize(position);
  vNormalV = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = HASH + /* glsl */ `
uniform vec3 uColor, uGold;
uniform float uTime, uBase, uPower, uGoldMix, uHexScale;
uniform vec4 uHits[4];      // xyz impact direction (object space, unit), w start time
uniform float uHitStr[4];
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;

// Distance to the nearest hexagon edge (0 on edges), plus the cell id.
vec3 hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec4 cell = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 9.73);
  vec2 q = abs(cell.xy);
  float edge = 0.5 - max(dot(q, s * 0.5), q.x);
  return vec3(edge, cell.zw);
}

void main() {
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(-vViewPos);
  float fres = pow(1.0 - abs(dot(n, v)), 2.5);
  // Hex grid projected from the dorsal side (the camera looks down).
  vec3 hg = hexGrid(vObj.xz * uHexScale + vObj.y * 0.35);
  float lines = 1.0 - smoothstep(0.0, 0.06, hg.x);
  float cellRnd = hash12(hg.yz);

  float ripple = 0.0, spot = 0.0, fill = 0.0;
  for (int i = 0; i < 4; i++) {
    float age = uTime - uHits[i].w;
    if (age < 0.0 || age > 1.6 || uHitStr[i] <= 0.0) continue;
    float ang = acos(clamp(dot(vObj, uHits[i].xyz), -1.0, 1.0));
    float front = age * 2.6;
    float band = exp(-pow((ang - front) / 0.22, 2.0)) * (1.0 - age / 1.6);
    ripple += band * uHitStr[i];
    fill += exp(-ang * ang * 7.0) * exp(-age * 5.0) * uHitStr[i] * (0.6 + 0.4 * cellRnd);
    spot += exp(-ang * ang * 60.0) * exp(-age * 7.0) * uHitStr[i];
  }
  // Power sweep: bow (+x) to stern while shields come up.
  float sweep = uPower < 1.0 ? exp(-pow((vObj.x - (1.0 - uPower * 2.6)) / 0.25, 2.0)) : 0.0;

  vec3 col = mix(uColor, uGold, uGoldMix);
  float a = fres * uBase * (1.0 + uGoldMix * 0.6)
          + lines * (ripple * 1.5 + sweep * 0.9 + uGoldMix * 0.06 + fill * 0.7)
          + ripple * 0.06 + fill * 0.12 + spot * 2.5 + sweep * 0.1;
  gl_FragColor = vec4(col * a, 1.0);
}
`;

const sphere = new THREE.SphereGeometry(1, 48, 32);

export class ShieldBubble {
  /** @param radii THREE.Vector3 half-extents (x = length, y = height, z = span) */
  constructor(radii, color = 0x7cc4ff, { hexScale = 6 } = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uGold: { value: new THREE.Color(1.0, 0.78, 0.3) },
        uTime: { value: 0 }, uBase: { value: 0.0 }, uPower: { value: 1 }, uGoldMix: { value: 0 },
        uHexScale: { value: hexScale },
        uHits: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(1, 0, 0, -99)) },
        uHitStr: { value: [0, 0, 0, 0] },
      },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(sphere, this.material);
    this.mesh.scale.copy(radii);
    this.mesh.renderOrder = 14;
    this.next = 0;
    this.up = false;
    this.base = 0;
    this.targetBase = 0;
    this.powerStart = -99;
    this.time = 0;
  }

  /** Visible idle strength: 0 (down) … ~0.35 (up). */
  setUp(up, idle = 0.22) {
    if (up && !this.up) this.powerStart = this.time;
    this.up = up;
    this.targetBase = up ? idle : 0;
  }

  setGold(k) { this.material.uniforms.uGoldMix.value = k; }

  /**
   * Register an impact coming from world point `from`.
   * @param strength 0.4 (glancing) … 1.5 (heavy)
   */
  hit(fromWorld, strength = 1) {
    this.mesh.updateWorldMatrix(true, false);
    // worldToLocal already undoes the ellipsoid scale → unit-sphere direction.
    const local = this.mesh.worldToLocal(fromWorld.clone()).normalize();
    const i = this.next;
    this.next = (this.next + 1) % 4;
    this.material.uniforms.uHits.value[i].set(local.x, local.y, local.z, this.time);
    this.material.uniforms.uHitStr.value[i] = strength;
  }

  update(t, dt) {
    this.time = t;
    this.base += (this.targetBase - this.base) * Math.min(1, dt * 4);
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uBase.value = this.base;
    u.uPower.value = Math.min(1, (t - this.powerStart) / 0.9);
  }

  dispose() { this.material.dispose(); }
}
