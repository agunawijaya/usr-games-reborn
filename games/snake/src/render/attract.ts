import type { Rng } from '@usr-games/kit';
import { chooseStep, GREEDY } from '../bots/bots';
import { RUN_LENGTH } from '../engine/chambers';
import { reach } from '../engine/geometry';
import { type Round, step, warp } from '../engine/round';
import { goDeeper, playRng, startRun } from '../engine/run';
import { type Flash, GardenView, type Motion } from './garden-view';
import type { Region } from './frame';
import type { Look } from './look';
import { sceneFor } from './scene';

/**
 * The garden playing itself: the greedy bot works a chamber, glint after glint, the snake
 * gliding after it, until it leaves by the door or is caught; then another chamber. Behind the
 * game menu, in the Hall's attract mode and on the poster. Silent always.
 */
export interface AttractOptions {
  readonly look: Look;
  readonly reducedMotion: boolean;
  readonly seed: number;
  /** Where the chamber sits on the canvas; the whole canvas by default. */
  readonly region?: (width: number, height: number) => Region;
}

const STEP_SECONDS = 0.42;
const GLIDE_SECONDS = 0.18;

export class AttractLoop {
  private readonly view: GardenView;
  private look: Look;
  private reducedMotion: boolean;
  private visible = true;
  private frame = 0;
  private round!: Round;
  private rng!: Rng;
  private chamberSeed = 0;
  private motion: Motion | null = null;
  private flashes: Array<{ flash: Flash; born: number }> = [];
  private lastStep = 0;
  private clock = 0;
  private lastFrame = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly options: AttractOptions,
  ) {
    this.view = new GardenView(canvas);
    this.look = options.look;
    this.reducedMotion = options.reducedMotion;
    this.newChamber(options.seed);
    this.resize();
    this.loop(performance.now());
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.reducedMotion = reducedMotion;
    this.draw();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible && !this.frame) this.loop(performance.now());
  }

  /** Fits the canvas; the Hall's poster passes its size, the screens measure the element. */
  resize(givenWidth?: number, givenHeight?: number) {
    const width = givenWidth ?? (this.canvas.clientWidth || this.canvas.width || 1);
    const height = givenHeight ?? (this.canvas.clientHeight || this.canvas.height || 1);
    const region = this.options.region?.(width, height) ?? { x: 0, y: 0, width, height };
    this.view.layout(width, height, region);
    this.draw();
  }

  /** A single still: the poster and reduced motion use it. */
  draw() {
    const time = this.clock;
    const flashes = this.flashes.map(({ flash, born }) => ({ ...flash, age: (time - born) / 0.6 }));
    this.view.render(
      sceneFor(this.round, this.look, this.chamberSeed, {
        motion: this.motion,
        flashes,
        pose: this.motion && this.motion.t < 1 ? 'walk' : 'idle',
      }),
      time,
    );
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.visible = false;
  }

  private newChamber(seed: number) {
    this.chamberSeed = seed;
    const depth = 1 + (seed % 6);
    let run = startRun(`attract:${seed}`, RUN_LENGTH);
    for (let d = 1; d < depth; d++) run = goDeeper(run);
    // Arrive with something in the satchel, so the snake shows a little nerve.
    this.round = { ...run.round, loot: run.round.loot + 75 + (seed % 5) * 25 };
    this.rng = playRng(`attract:${seed}`, depth);
    this.motion = null;
    this.flashes = [];
  }

  private loop = (now: number) => {
    this.frame = 0;
    if (!this.visible) return;
    const delta = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (!this.reducedMotion) {
      this.clock += delta;
      if (this.clock - this.lastStep >= STEP_SECONDS) this.advance();
      if (this.motion)
        this.motion = {
          ...this.motion,
          t: Math.min(1, (this.clock - this.lastStep) / GLIDE_SECONDS),
        };
      this.flashes = this.flashes.filter(({ born }) => this.clock - born < 0.6);
    }
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  private advance() {
    this.lastStep = this.clock;
    const round = this.round;
    const target = round.pickups < 6 ? nearest(round) : round.garden.door;
    const direction = chooseStep(round, target, GREEDY);
    if (direction === null) {
      this.flashes.push({ flash: { kind: 'warp-out', cell: round.you, age: 0 }, born: this.clock });
      this.round = warp(round, this.rng);
      this.motion = null;
      return;
    }
    const turn = step(round, direction, this.rng);
    this.motion = { you: round.you, snake: round.snake, t: 0 };
    this.round = turn.round;
    for (const event of turn.events) {
      if (event.kind === 'pickup')
        this.flashes.push({ flash: { kind: 'pickup', cell: event.at, age: 0 }, born: this.clock });
      if (event.kind === 'door' || event.kind === 'caught') this.newChamber(this.chamberSeed + 1);
    }
    // Never let the attract loop wander forever.
    if (round.moves > 600) this.newChamber(this.chamberSeed + 1);
  }
}

function nearest(round: Round) {
  return [...round.glints].sort((a, b) => reach(a, round.you) - reach(b, round.you))[0]!;
}
