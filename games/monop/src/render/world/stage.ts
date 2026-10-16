import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { blurShader, type GradeSettings, gradeShader, type TiltShiftSettings } from './tiltshift';

/**
 * The canvas, renderer and picture pipeline every board shares: the scene drawn once into a
 * buffer, blurred towards the top and bottom (tilt-shift), bloomed when the lights are on,
 * graded, then tone-mapped to the screen. One frame loop drives the world and stops while the
 * game is paused or off-screen.
 */

export interface LookSettings {
  tiltShift: TiltShiftSettings;
  grade: GradeSettings;
  /** Bloom strength; 0 turns the pass off (daylight needs none). */
  bloom: number;
  exposure: number;
}

export interface StageOptions {
  /** Device pixels per CSS pixel are capped here: a 4K laptop screen need not draw 4K. */
  maxPixelRatio?: number;
  preserveDrawingBuffer?: boolean;
}

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(26, 16 / 9, 0.5, 900);
  private readonly composer: EffectComposer;
  private readonly blurAcross: ShaderPass;
  private readonly blurDown: ShaderPass;
  private readonly grade: ShaderPass;
  private readonly bloom: UnrealBloomPass;
  private frame = 0;
  private running = false;
  private last = 0;
  private readonly maxPixelRatio: number;
  private readonly tickers = new Set<(seconds: number, elapsed: number) => void>();
  private elapsed = 0;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly host: HTMLElement,
    look: LookSettings,
    options: StageOptions = {},
  ) {
    this.maxPixelRatio = options.maxPixelRatio ?? 1.5;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dd-world';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.append(this.canvas);
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.blurAcross = new ShaderPass(blurShader([1, 0], look.tiltShift));
    this.blurDown = new ShaderPass(blurShader([0, 1], look.tiltShift));
    this.bloom = new UnrealBloomPass(new Vector2(960, 540), look.bloom, 0.55, 0.82);
    this.grade = new ShaderPass(gradeShader(look.grade));
    this.composer.addPass(this.blurAcross);
    this.composer.addPass(this.blurDown);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.setLook(look);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  setLook(look: LookSettings): void {
    this.look = look;
    for (const pass of [this.blurAcross, this.blurDown]) {
      const u = pass.uniforms as Record<string, { value: unknown }>;
      u.focus!.value = look.tiltShift.focus;
      u.band!.value = look.tiltShift.band;
      u.ramp!.value = look.tiltShift.ramp;
      u.maxBlur!.value = look.tiltShift.maxBlur;
    }
    const g = this.grade.uniforms as Record<string, { value: unknown }>;
    g.saturation!.value = look.grade.saturation;
    g.contrast!.value = look.grade.contrast;
    g.vignette!.value = look.grade.vignette;
    g.tint!.value = look.grade.tint;
    this.bloom.enabled = look.bloom > 0 && this.quality === 'full';
    this.bloom.strength = look.bloom;
    this.renderer.toneMappingExposure = look.exposure;
  }

  /** Moves the sharp band of the tilt-shift: 0 is the bottom of the frame, 1 the top. */
  setFocus(focus: number): void {
    for (const pass of [this.blurAcross, this.blurDown]) {
      (pass.uniforms as Record<string, { value: unknown }>).focus!.value = focus;
    }
  }

  /**
   * Full: shadows, the tilt-shift blur, bloom, and up to 1.5 device pixels a pixel. Light: none
   * of those, for machines that cannot keep up; the miniature reads a little flatter, the game
   * the same.
   */
  quality: 'full' | 'light' = 'full';
  private look: LookSettings | null = null;

  setQuality(quality: 'full' | 'light'): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.applyQuality();
    this.resize();
  }

  /** Brings the passes and the scene's shadows in line with the quality; call after building a scene. */
  applyQuality(): void {
    const full = this.quality === 'full';
    this.blurAcross.enabled = full;
    this.blurDown.enabled = full;
    this.bloom.enabled = full && (this.look?.bloom ?? 0) > 0;
    this.scene.traverse((child) => {
      const light = child as {
        isLight?: boolean;
        castShadow?: boolean;
        userData: { shadows?: boolean };
      };
      if (!light.isLight) return;
      light.userData.shadows ??= light.castShadow ?? false;
      light.castShadow = full && light.userData.shadows === true;
    });
  }

  /**
   * Whether frames are drawn. The flat map turns it off: the world keeps time (the game's
   * moments are timed by it) without spending the GPU on a picture nobody sees.
   */
  drawing = true;

  /** Something to move every frame; returns a function that stops it. */
  onTick(tick: (seconds: number, elapsed: number) => void): () => void {
    this.tickers.add(tick);
    return () => this.tickers.delete(tick);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const seconds = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.advance(seconds);
      if (this.drawing) this.render();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  /** Moves the world on without drawing: staged scenes use it to reach a moment exactly. */
  advance(seconds: number): void {
    this.elapsed += seconds;
    for (const tick of this.tickers) tick(seconds, this.elapsed);
  }

  render(): void {
    this.composer.render();
  }

  resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const ratio = Math.min(
      this.quality === 'full' ? this.maxPixelRatio : 1,
      window.devicePixelRatio || 1,
    );
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // The blur is measured against 1080 lines so it looks the same at every window size.
    const scale = (height * ratio) / 1080;
    for (const pass of [this.blurAcross, this.blurDown]) {
      const u = pass.uniforms as Record<string, { value: unknown }>;
      (u.resolution!.value as Vector2).set(width * ratio, height * ratio).divideScalar(scale);
    }
    if (!this.running) this.render();
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.composer.dispose();
    this.renderer.dispose();
    // Browsers keep only a handful of live WebGL contexts: give this one back at once.
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
