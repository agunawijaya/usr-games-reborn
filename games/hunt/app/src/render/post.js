// Post: the scene renders into an HDR target; cloaked players and hot
// things write screen-space offsets into a distortion target (refraction
// shimmer); a bloom mip chain makes the neon glow; the final pass adds
// chromatic aberration on big hits, a vignette, ACES tone-mapping, grain
// and the sRGB curve. Low quality: no MSAA, a short bloom chain, no
// distortion, no grain.

import * as THREE from 'three';

const FS_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(frag, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
}

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.quad);
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.levels = 5;
    this.high = true;
    this.scene = null;
    this.dist = null;
    this.mips = [];
    this.bright = pass(/* glsl */ `
      uniform sampler2D tSrc; uniform float uThresh; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = clamp(c, 0.0, 64.0); float l = max(max(c.r, c.g), c.b);
        float k = smoothstep(uThresh, uThresh + 0.8, l); gl_FragColor = vec4(c * k, 1.0); }`,
    { tSrc: { value: null }, uThresh: { value: 1.25 } });
    this.down = pass(/* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec2 o = uTexel;
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb
        + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0); }`,
    { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = pass(/* glsl */ `
      uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec2 o = uTexel;
        vec3 c = texture2D(tSrc, vUv + vec2(-o.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.0
        + texture2D(tSrc, vUv + vec2(0.0, o.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.0
        + texture2D(tSrc, vUv + vec2(o.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.0
        + texture2D(tSrc, vUv + vec2(0.0, -o.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
        gl_FragColor = vec4(c / 12.0 + texture2D(tBase, vUv).rgb, 1.0); }`,
    { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.final = pass(/* glsl */ `
      uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tDist;
      uniform float uBloom, uCA, uVig, uGrain, uTime, uExposure, uUseDist, uFlash;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
      void main(){
        vec2 uv = vUv;
        if (uUseDist > 0.5) { vec4 d = texture2D(tDist, uv); uv += (d.rg - 0.5) * 0.012 * d.a; }
        vec2 c = uv - 0.5;
        float ca = uCA * dot(c, c) * 4.0;
        vec3 col;
        col.r = texture2D(tScene, uv + c * ca * 0.02).r;
        col.g = texture2D(tScene, uv).g;
        col.b = texture2D(tScene, uv - c * ca * 0.02).b;
        vec3 b = texture2D(tBloom, uv).rgb;
        if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
        if (any(isnan(b)) || any(isinf(b))) b = vec3(0.0);
        col += b * uBloom;
        col *= uExposure;
        col += vec3(1.0, 0.95, 0.9) * uFlash;
        col = aces(col);
        float v = smoothstep(0.95, 0.25, length(c * vec2(1.1, 1.3)));
        col *= mix(1.0, v, uVig);
        col = pow(col, vec3(1.0 / 2.2));
        col += (h(vUv * 999.0 + uTime) - 0.5) * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }`,
    {
      tScene: { value: null }, tBloom: { value: null }, tDist: { value: null },
      uBloom: { value: 0.9 }, uCA: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.025 },
      uTime: { value: 0 }, uExposure: { value: 1.0 }, uUseDist: { value: 1 }, uFlash: { value: 0 },
    });
    this.distScene = new THREE.Scene();
  }

  // 'high' | 'low' | 'lite'
  setQuality(profile) {
    this.profile = profile;
    this.high = profile === 'high';
    this.lite = profile === 'lite';
    this.levels = this.high ? 6 : this.lite ? 1 : 4;
    this.final.uniforms.uGrain.value = this.high ? 0.022 : 0;
    this.final.uniforms.uUseDist.value = this.high ? 1 : 0;
    if (this.w) this.resize(this.w, this.h, this.pr);
  }

  resize(w, h, pr) {
    this.w = w; this.h = h; this.pr = pr;
    const W = Math.max(1, Math.floor(w * pr));
    const H = Math.max(1, Math.floor(h * pr));
    for (const t of [this.scene, this.dist, ...this.mips]) t?.dispose();
    this.scene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: this.high ? 4 : 0 });
    this.dist = new THREE.WebGLRenderTarget(Math.floor(W / 2), Math.floor(H / 2), { type: THREE.UnsignedByteType });
    this.mips = [];
    let mw = Math.floor(W / 2);
    let mh = Math.floor(H / 2);
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(Math.max(1, mw), Math.max(1, mh), { type: THREE.HalfFloatType }));
      this.mips.push(new THREE.WebGLRenderTarget(Math.max(1, mw), Math.max(1, mh), { type: THREE.HalfFloatType }));
      mw = Math.floor(mw / 2);
      mh = Math.floor(mh / 2);
    }
  }

  blit(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.fsScene, this.fsCam);
  }

  render(scene, camera, time, fx) {
    const r = this.r;
    r.setRenderTarget(this.scene);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);
    // distortion (cloak shimmer): offsets in rg, strength in a
    if (this.high && this.distScene.children.length) {
      r.setRenderTarget(this.dist);
      r.setClearColor(0x808000, 0);
      r.clear();
      r.render(this.distScene, camera);
    }
    const f = this.final.uniforms;
    if (this.lite) {
      // no bloom: the scene straight into the grade
      f.tScene.value = this.scene.texture;
      f.tBloom.value = this.scene.texture;
      f.tDist.value = this.dist.texture;
      f.uTime.value = time;
      f.uCA.value = fx.ca;
      f.uFlash.value = fx.flash;
      f.uBloom.value = 0;
      this.blit(this.final, null);
      return;
    }
    // bloom
    const L = this.levels;
    this.bright.uniforms.tSrc.value = this.scene.texture;
    this.blit(this.bright, this.mips[0]);
    let src = this.mips[0];
    for (let i = 1; i < L; i++) {
      const dst = this.mips[i * 2];
      this.down.uniforms.tSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.blit(this.down, dst);
      src = dst;
    }
    for (let i = L - 2; i >= 0; i--) {
      const base = i === 0 ? this.mips[0] : this.mips[i * 2];
      const dst = this.mips[i * 2 + 1];
      this.up.uniforms.tSrc.value = src.texture;
      this.up.uniforms.tBase.value = base.texture;
      this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.blit(this.up, dst);
      src = dst;
    }
    f.tScene.value = this.scene.texture;
    f.tBloom.value = src.texture;
    f.tDist.value = this.dist.texture;
    f.uTime.value = time;
    f.uCA.value = fx.ca;
    f.uFlash.value = fx.flash;
    f.uBloom.value = fx.bloom;
    this.blit(this.final, null);
  }
}
