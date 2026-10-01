// The arena floor: wet obsidian terrazzo tiles, lit only where the viewer
// can see (the light cone), ghost grout lines where they remember, black
// where they have never been. Slime, lava, scorch and blast heat live in
// the same shader, driven by the per-cell fields.

import * as THREE from 'three';
import { NOISE, MAZE, LIGHTS, BEAM } from './glsl.js';
import { COL } from './palette.js';

export function makeFloor(fields, lightUniforms) {
  const geo = new THREE.PlaneGeometry(51 + 16, 23 + 16, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const c = (h) => new THREE.Color(h);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uVis: { value: fields.vis },
      uFx: { value: fields.fx },
      uTerr: { value: fields.terr },
      uTime: { value: 0 },
      uEye: { value: new THREE.Vector3() },
      uFace: { value: new THREE.Vector2(1, 0) },
      uBeamOn: { value: 1 },
      uAmb: { value: 0 },
      uSeeAll: { value: 0 },
      uHigh: { value: 1 },
      uLite: { value: 0 },
      uFloor: { value: c(COL.floor) },
      uGrout: { value: c(COL.grout) },
      uGhost: { value: c(COL.ghost) },
      uSlime: { value: c(COL.slime) },
      uSlimeDeep: { value: c(COL.slimeDeep) },
      uLava: { value: c(COL.lava) },
      uLavaHot: { value: c(COL.lavaHot) },
      ...lightUniforms,
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uVis;
      uniform sampler2D uFx;
      uniform sampler2D uTerr;
      uniform float uTime, uSeeAll, uHigh, uLite;
      uniform vec3 uFloor, uGrout, uGhost, uSlime, uSlimeDeep, uLava, uLavaHot;
      varying vec3 vW;
      ${NOISE}
      ${MAZE}
      ${LIGHTS}
      ${BEAM}

      // smoother-than-bilinear sample of a 51x23 field, so goo reads as blobs
      vec4 smoothField(sampler2D t, vec2 uv) {
        vec2 px = uv * MAZE - 0.5;
        vec2 i = floor(px);
        vec2 f = fract(px);
        f = f * f * (3.0 - 2.0 * f);
        return texture(t, (i + 0.5 + f) / MAZE);
      }

      void main() {
        vec2 cell = vW.xz + vec2(25.0, 11.0);
        vec2 uv = (cell + 0.5) / MAZE;
        bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
        vec4 V = inside ? texture(uVis, uv) : vec4(0.0);
        vec4 F = inside ? texture(uFx, uv) : vec4(0.0);
        float lit = max(V.r, uSeeAll * 0.85);
        float known = max(V.g, uSeeAll);

        // terrazzo tile: grout at cell edges, fine aggregate, soft wear
        vec2 f = fract(cell + 0.5);
        float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        float grout = 1.0 - smoothstep(0.012, 0.03, edge);
        float speck = step(0.9, hash12(floor(cell * 11.0))) * hash12(floor(cell * 11.0) + 3.1);
        float wear = uLite > 0.5 ? 0.5 : fbm(cell * 1.7);
        vec3 base = uFloor * (0.8 + 0.5 * wear) + vec3(0.05, 0.06, 0.08) * speck;
        base = mix(base, uGrout, grout * 0.85);

        // micro-normal for wet glints
        vec2 gn = uLite > 0.5 ? vec2(0.0) : vec2(vnoise(cell * 6.0) - 0.5, vnoise(cell * 6.0 + 7.7) - 0.5) * 0.25;
        vec3 n = normalize(vec3(gn.x, 1.0, gn.y));
        vec3 p = vW;
        vec3 light = beamLight(p, n, lit) + pointLights(p + vec3(0.0, 0.02, 0.0), n);
        // contact shadow where the floor meets masonry
        float occ = 0.0;
        if (inside) {
          vec2 t = 0.55 / MAZE;
          occ = (texture(uTerr, uv + vec2(t.x, 0.0)).r + texture(uTerr, uv - vec2(t.x, 0.0)).r
               + texture(uTerr, uv + vec2(0.0, t.y)).r + texture(uTerr, uv - vec2(0.0, t.y)).r) * 0.25;
        }
        vec3 col = base * light * (1.0 - 0.7 * smoothstep(0.05, 0.6, occ));

        // wet sheen: the beam glints toward the camera
        vec3 V3 = normalize(cameraPosition - p);
        vec3 Lb = normalize(vec3(uEye.x - p.x, 1.6, uEye.z - p.z));
        float spec = pow(max(dot(reflect(-Lb, n), V3), 0.0), 40.0) * (0.35 + 0.65 * wear);
        col += vec3(1.0, 0.95, 0.85) * spec * lit * 0.35 * uBeamOn;

        // remembered but unlit: tiny blueprint ticks at cell corners (a
        // surveyed floor), never a glowing grid
        float ghost = known * (1.0 - lit);
        vec2 cc = abs(f - 0.5);
        float tick = (1.0 - smoothstep(0.018, 0.032, min(0.5 - cc.x, 0.5 - cc.y))) * step(0.42, max(cc.x, cc.y)) * step(0.41, min(cc.x, cc.y));
        col += uGhost * tick * 0.06 * ghost;
        col += uGhost * 0.004 * ghost;

        // scorch (dark) and fresh blast heat (glowing square)
        if (F.r > 0.004 || F.g > 0.004) {
          float nz = uLite > 0.5 ? 0.5 : fbm(cell * 3.0 + uTime * 0.03);
          col *= 1.0 - F.r * 0.65 * (0.7 + 0.3 * nz);
          float ember = F.r * F.r * smoothstep(0.55, 0.9, nz);
          col += vec3(1.0, 0.35, 0.08) * ember * 0.25 * max(lit, 0.35);
          col += vec3(1.0, 0.45, 0.14) * F.g * F.g * (0.8 + 0.4 * nz) * 0.85;
        }

        // slime: blobby threshold of the smoothed field + warped noise
        if (max(V.b, V.a) > 0.004) {
          vec2 warp = uLite > 0.5 ? vec2(0.5) : vec2(vnoise(cell * 2.0 + uTime * 0.2), vnoise(cell * 2.0 - uTime * 0.17));
          vec4 S = smoothField(uVis, uv + (warp - 0.5) * 0.012);
          float gn2 = uLite > 0.5 ? vnoise(cell * 3.5) : fbm(cell * 3.5 + uTime * 0.25);
          float d = S.b + (gn2 - 0.5) * 0.35;
          float goo = smoothstep(0.32, 0.42, d);
          // the meniscus throws a thin dark shadow just outside the goo
          float outside = smoothstep(0.2, 0.33, d) * (1.0 - goo);
          col *= 1.0 - 0.55 * outside * max(lit, 0.2);
          if (goo > 0.001) {
            // sparse bubbles of different sizes that swell and pop
            float bub = 0.0;
            if (uLite < 0.5) {
              vec2 bc = cell * 3.2 + vec2(0.0, uTime * 0.12);
              vec2 bi = floor(bc);
              vec2 bf = fract(bc) - 0.5;
              float h = hash12(bi);
              float life = fract(uTime * (0.25 + h * 0.4) + h * 7.0);
              float rad = (0.1 + 0.22 * hash12(bi + 3.3)) * smoothstep(0.0, 0.8, life) * step(0.72, h);
              float ring = smoothstep(rad, rad - 0.05, length(bf - (hash22(bi) - 0.5) * 0.4)) - smoothstep(rad - 0.05, rad - 0.1, length(bf - (hash22(bi) - 0.5) * 0.4));
              bub = ring * (1.0 - smoothstep(0.85, 1.0, life));
            }
            float rim = smoothstep(0.32, 0.38, d) - smoothstep(0.38, 0.5, d);
            float depth = smoothstep(0.38, 0.95, d);
            float gl = max(lit, 0.06 * known);
            // body: thin goo shows the floor through it, thick goo is deep green
            vec3 through = base * light * 0.6;
            vec3 body = mix(uSlime * 0.2, uSlimeDeep * 0.55, depth);
            vec3 gooCol = mix(through * vec3(0.55, 1.0, 0.45) + uSlime * 0.05, body * (0.35 + 0.8 * gl), 0.35 + 0.65 * depth);
            // a faint inner glow (it is not ordinary slime) and a bright meniscus
            gooCol += uSlime * (0.035 + 0.025 * sin(uTime * 1.7 + cell.x + cell.y * 1.3)) * depth;
            gooCol += uSlime * rim * 0.28 * (0.4 + gl);
            gooCol += vec3(0.75, 1.0, 0.65) * bub * 0.35 * gl;
            // glossy, wet: sharp highlights from the beam and from above
            vec3 gnn = normalize(vec3((vec2(vnoise(cell * 7.0 + uTime * 0.4), vnoise(cell * 7.0 - uTime * 0.37)) - 0.5) * 0.6, 1.0));
            float gspec = pow(max(dot(reflect(-Lb, gnn), V3), 0.0), 90.0) * 1.4
                        + pow(max(dot(reflect(-normalize(vec3(-0.3, 1.0, 0.4)), gnn), V3), 0.0), 120.0) * 0.5;
            gooCol += vec3(0.92, 1.0, 0.85) * gspec * gl;
            col = mix(col, gooCol, goo * max(gl, 0.12));
          }
          // lava: same field, molten
          float dl = S.a + (gn2 - 0.5) * 0.3;
          float lv = smoothstep(0.3, 0.42, dl);
          if (lv > 0.001) {
            float crack = uLite > 0.5 ? 0.3 : smoothstep(0.1, 0.0, worley(cell * 3.0 + uTime * 0.15));
            vec3 lcol = mix(uLava * 0.6, uLavaHot, crack + 0.3 * gn2);
            col = mix(col, lcol * 2.2, lv);
          }
        }
        // oozing is drawn on every screen in hunt (showexpl '*'): a green flash
        col += uSlime * F.b * 0.9 * (0.6 + 0.4 * (uLite > 0.5 ? 0.5 : vnoise(cell * 5.0 + uTime * 2.0)));

        // regrow glow at the foot of rising walls
        col += vec3(0.3, 0.9, 1.0) * F.a * F.a * 0.8;

        // beyond the border: void with faint haze
        if (!inside) col = vec3(0.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 0);
  mesh.renderOrder = -1;
  return mesh;
}
