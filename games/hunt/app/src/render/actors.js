// Players as hovering arrowhead drones. The hull IS the facing glyph: an
// arrowhead pointing where the player faces, like hunt's < > ^ v. On top,
// a glowing chevron marker in the player's colour (a hollow chevron for
// team 2, so teams differ by shape as well as by colour). Under-glow on the
// floor, a thruster at the back, damage shown by flicker and sparks, cloak
// by a refraction shimmer (render/post.js), memory ghosts as holograms.

import * as THREE from 'three';
import * as K from '../engine/constants.js';
import { NOISE, LIGHTS, BEAM } from './glsl.js';

const FACE_ANGLE = { [K.RIGHT]: 0, [K.ABOVE]: Math.PI / 2, [K.LEFTS]: Math.PI, [K.BELOW]: -Math.PI / 2 };
export const faceAngle = (f) => FACE_ANGLE[f] ?? 0;

function arrowShape(len = 0.84, wid = 0.72, notch = 0.24) {
  const s = new THREE.Shape();
  s.moveTo(len / 2, 0);
  s.lineTo(-len / 2, wid / 2);
  s.lineTo(-len / 2 + notch, 0);
  s.lineTo(-len / 2, -wid / 2);
  s.closePath();
  return s;
}

let hullGeo = null;
let markGeo = null;
let markHollowGeo = null;
function geos() {
  if (hullGeo) return;
  hullGeo = new THREE.ExtrudeGeometry(arrowShape(), {
    depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1,
  });
  hullGeo.rotateX(-Math.PI / 2); // shape lies in XZ, extruded up
  hullGeo.computeVertexNormals();
  markGeo = new THREE.ShapeGeometry(arrowShape(0.5, 0.46, 0.16));
  markGeo.rotateX(-Math.PI / 2);
  const hollow = arrowShape(0.54, 0.5, 0.17);
  hollow.holes.push(new THREE.Path(arrowShape(0.3, 0.26, 0.1).getPoints()));
  markHollowGeo = new THREE.ShapeGeometry(hollow);
  markHollowGeo.rotateX(-Math.PI / 2);
}

function hullMaterial(lightUniforms, color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uHurt: { value: 0 },
      uCloak: { value: 0 },
      uAlpha: { value: 1 },
      uEye: { value: new THREE.Vector3() },
      uFace: { value: new THREE.Vector2(1, 0) },
      uBeamOn: { value: 1 },
      uLit: { value: 1 },
      uAmb: { value: 0 },
      ...lightUniforms,
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vL = position;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uCol;
      uniform float uTime, uHurt, uCloak, uAlpha, uLit;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      ${NOISE}
      ${LIGHTS}
      ${BEAM}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), 2.5);
        vec3 body = vec3(0.035, 0.04, 0.055);
        vec3 light = beamLight(vW, n, uLit) + pointLights(vW, n) + 0.25;
        vec3 spec = vec3(1.0) * pow(max(dot(reflect(-normalize(vec3(0.3, 1.0, 0.2)), n), v), 0.0), 30.0) * 0.4;
        vec3 col = body * light + spec;
        // trim: emissive lines along the bevel and the spine
        float spine = smoothstep(0.03, 0.0, abs(vL.z)) * step(0.15, vL.y);
        float bevel = smoothstep(0.62, 0.95, abs(n.y)) < 0.5 ? 1.0 : 0.0;
        col += uCol * (fres * 1.4 + spine * 0.9 + (1.0 - abs(n.y)) * 0.35);
        // damage: flicker and hot sparks on the hull
        float flick = step(0.5 + 0.45 * (1.0 - uHurt), hash12(vec2(floor(uTime * 22.0), 1.0)));
        col *= 1.0 - flick * uHurt * 0.7;
        col += vec3(1.0, 0.5, 0.2) * uHurt * step(0.985, hash12(floor(vW.xz * 40.0) + floor(uTime * 16.0)));
        float a = uAlpha;
        // cloak: the refraction happens in post; here only a rim remains
        if (uCloak > 0.0) {
          float scan = 0.5 + 0.5 * sin(vW.y * 60.0 - uTime * 7.0 + vW.x * 5.0);
          vec3 glass = vec3(0.75, 0.9, 1.0) * fres * (0.35 + 0.25 * scan) + uCol * fres * 0.25;
          col = mix(col, glass, uCloak);
          a = mix(a, (fres * 0.55 + 0.02) * uAlpha, uCloak);
        }
        gl_FragColor = vec4(col, a);
      }`,
  });
}

function glowMaterial(color, add = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(color) }, uI: { value: add }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol;
      uniform float uI, uTime;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float g = exp(-r * r * 3.5) * (1.0 - smoothstep(0.85, 1.0, r));
        gl_FragColor = vec4(uCol * g * uI, 1.0);
      }`,
  });
}

function markMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(2.2),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class Actor {
  constructor(lightUniforms, color, hollow) {
    geos();
    this.group = new THREE.Group();
    this.hull = new THREE.Mesh(hullGeo, hullMaterial(lightUniforms, color));
    this.hull.position.y = 0.34;
    this.mark = new THREE.Mesh(hollow ? markHollowGeo : markGeo, markMaterial(color));
    this.mark.position.y = 0.62;
    this.mark.scale.setScalar(1.25);
    const disc = new THREE.PlaneGeometry(2.4, 2.4);
    disc.rotateX(-Math.PI / 2);
    this.glow = new THREE.Mesh(disc, glowMaterial(color, 0.55));
    this.glow.position.y = 0.02;
    this.thrust = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2), glowMaterial(color, 1.6));
    this.thrust.position.set(-0.38, 0.36, 0);
    this.spin = new THREE.Group();
    this.spin.add(this.hull, this.mark, this.thrust);
    this.group.add(this.glow, this.spin);
    this.color = new THREE.Color(color);
    this.angle = 0;
    this.targetAngle = 0;
  }

  setColor(c) {
    this.color.set(c);
    this.hull.material.uniforms.uCol.value.set(c);
    this.mark.material.color.set(c).multiplyScalar(2.2);
    this.glow.material.uniforms.uCol.value.set(c);
    this.thrust.material.uniforms.uCol.value.set(c);
  }

  // x, z world; h hover height; face angle; hurt 0..1; cloak 0..1; alpha
  pose(x, z, h, angle, time, hurt, cloak, alpha, lit, moving) {
    this.group.position.set(x, h, z);
    let d = angle - this.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.angle += d * 0.45;
    this.spin.rotation.y = this.angle;
    const bob = Math.sin(time * 3.1 + x * 0.7) * 0.025;
    this.spin.position.y = bob;
    this.spin.rotation.z = moving ? Math.sin(time * 18) * 0.03 : 0;
    const u = this.hull.material.uniforms;
    u.uTime.value = time;
    u.uHurt.value = hurt;
    u.uCloak.value = cloak;
    u.uAlpha.value = alpha;
    u.uLit.value = lit;
    // cloaked: the marker all but vanishes, flickering like a bad signal
    const flicker = cloak > 0 ? 0.06 + 0.1 * Math.max(0, Math.sin(time * 23 + x * 5) * Math.sin(time * 7.3)) : 1;
    this.mark.material.opacity = alpha * flicker;
    this.glow.material.uniforms.uI.value = (0.9 + (moving ? 0.3 : 0)) * alpha * (cloak > 0 ? 0.08 : 1);
    this.thrust.material.uniforms.uI.value = (moving ? 2.4 : 1.1) * alpha * (1 - cloak * 0.8) * (0.85 + 0.15 * Math.sin(time * 40 + x));
  }

  bindShared(eye, face, beamOn, amb) {
    const u = this.hull.material.uniforms;
    u.uEye = eye;
    u.uFace = face;
    u.uBeamOn = beamOn;
    u.uAmb = amb;
  }
}

// A remembered opponent outside line of sight: a flickering hologram of
// the last place the viewer's screen shows them.
export class Ghost {
  constructor(color) {
    geos();
    this.mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(0.6), transparent: true, opacity: 0.35,
      wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(hullGeo, this.mat);
    this.mesh.position.y = 0.3;
  }

  pose(x, z, angle, time, alpha) {
    this.mesh.position.set(x, 0.3 + Math.sin(time * 2 + x) * 0.02, z);
    this.mesh.rotation.y = angle;
    this.mat.opacity = alpha * (0.22 + 0.12 * Math.sin(time * 11 + z * 3));
  }
}
