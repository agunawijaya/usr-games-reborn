import type { Arena } from '../engine/arena';
import { applyIntents, planSky } from '../engine/bot';
import { forecast, type Forecast } from '../engine/predict';
import { skyRandomness } from '../engine/randomness';
import { addPlane, createWorld, tick, type World } from '../engine/world';
import type { Focus } from '../render/camera';
import { type LookId, lookFor } from '../render/look';
import { Radar } from '../render/radar';
import { SkyEffects } from './effects';

/**
 * A sky that flies itself: the house controller keeps it, silently. Behind the title screen, in
 * the Hall's attract mode and on the poster.
 */

export interface AutoSkyOptions {
  arena: Arena;
  seed: string;
  look: LookId;
  /** Seconds per tick; demos run faster than play. */
  tickSeconds: number;
  tilt?: number;
  focus?: Focus;
  /** Ticks flown before the first frame, so the sky starts busy. */
  warmUp?: number;
  reducedMotion?: boolean;
}

export class AutoSky {
  readonly radar: Radar;
  private world: World;
  private sky: Forecast;
  private readonly effects = new SkyEffects();
  private look: LookId;
  private elapsed = 0;
  private time = 0;
  private frame = 0;
  private last = 0;
  private running = false;
  private readonly options: AutoSkyOptions;

  constructor(canvas: HTMLCanvasElement, options: AutoSkyOptions) {
    this.options = options;
    this.radar = new Radar(canvas);
    this.look = options.look;
    this.world = this.fresh();
    this.sky = forecast(this.world);
  }

  private fresh(): World {
    const world = createWorld(this.options.arena, skyRandomness(this.options.seed));
    addPlane(world);
    for (let i = 0; i < (this.options.warmUp ?? 0); i++) this.step(world);
    return world;
  }

  private step(world: World): void {
    applyIntents(world, planSky(world, { horizon: 6 }));
    const events = tick(world);
    this.effects.apply(events, world, this.time);
  }

  setLook(look: LookId): void {
    this.look = look;
  }

  resize(width: number, height: number, dpr: number): void {
    this.radar.resize(width, height, dpr);
  }

  /** Draws one frame now. */
  draw(): void {
    this.radar.draw({
      world: this.world,
      forecast: this.sky,
      look: lookFor(this.look === 'scope'),
      tilt: this.options.tilt ?? 0,
      focus: this.options.focus,
      tickProgress: Math.min(1, this.elapsed / this.options.tickSeconds),
      time: this.time,
      selected: null,
      ghost: null,
      ripples: this.effects.ripples,
      pearls: this.effects.pearls,
      bursts: [],
      drain: 0,
      reducedMotion: this.options.reducedMotion ?? false,
      showForecast: false,
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this.elapsed += dt;
      if (this.elapsed >= this.options.tickSeconds) {
        this.elapsed = 0;
        this.step(this.world);
        // A demo never ends: a lost sky quietly starts again.
        if (this.world.loss) this.world = this.fresh();
        this.sky = forecast(this.world);
      }
      this.draw();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }
}
