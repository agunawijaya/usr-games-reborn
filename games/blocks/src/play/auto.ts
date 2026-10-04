import { createRng } from '@usr-games/kit';
import { choosePlacement, playStep, type Step } from '../engine/bot';
import { createGame, type Game } from '../engine/game';
import { TANK_HEIGHT, TANK_WIDTH } from '../dives/dives';
import { fallingOf, landingOf, settledCells } from '../render/from-game';
import type { Look } from '../render/look';
import type { TankView } from '../render/view';
import { Moments } from './moments';

/**
 * The house diver at play on its own: behind the game menu, in the Hall's attract tiles and in
 * the demo. It lines each sinker up a key at a time, plunges it, and lets bursts play out; when the
 * tank fills (or has been played long enough) the water clouds over and a fresh tank begins.
 */

const KEY_MS = 120;
/** The pause with a new sinker at the top before the diver touches it. */
const LOOK_MS = 320;
const LANDINGS_PER_TANK = 80;
const MURK_SECONDS = 1.4;

export class AutoTank {
  private game: Game;
  private round = 0;
  private steps: Step[] = [];
  private nextAt = 0;
  private frame = 0;
  private running = false;
  private murkFrom: number | null = null;
  private readonly moments = new Moments();
  private readonly started = performance.now();

  constructor(
    private readonly view: TankView,
    private look: Look,
    private readonly seed: string,
    private readonly options: { reducedMotion?: boolean; level?: number } = {},
  ) {
    this.game = this.fresh();
    // A tank already part-way through, so the very first frame has something to show.
    for (let i = 0; i < 14 && !this.game.over; i++)
      for (const step of choosePlacement(this.game)!.steps) playStep(this.game, step);
  }

  private fresh(): Game {
    return createGame({
      rules: 'standard',
      width: TANK_WIDTH,
      height: TANK_HEIGHT,
      level: this.options.level ?? 3,
      random: createRng(`${this.seed}:${this.round++}`),
    });
  }

  private time(): number {
    return (performance.now() - this.started) / 1000;
  }

  private step(now: number): void {
    const time = this.time();
    if (this.murkFrom !== null) {
      if (time - this.murkFrom > MURK_SECONDS) {
        this.game = this.fresh();
        this.moments.clear();
        this.murkFrom = null;
        this.nextAt = now + LOOK_MS;
      }
      return;
    }
    if (now < this.nextAt || this.moments.holding(time)) return;
    if (this.steps.length === 0) {
      const placement = choosePlacement(this.game);
      if (!placement) return;
      this.steps = [...placement.steps];
    }
    const step = this.steps.shift()!;
    this.moments.act(this.game, time, () => playStep(this.game, step));
    this.nextAt = now + (step === 'plunge' ? LOOK_MS : KEY_MS);
    if (this.game.over || this.game.landings >= LANDINGS_PER_TANK) this.murkFrom = time;
  }

  setLook(look: Look): void {
    this.look = look;
    this.draw();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.step(performance.now());
      this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  draw(): void {
    const time = this.time();
    this.moments.trim(time);
    const game = this.game;
    const holding = this.moments.holding(time);
    this.view.draw({
      cols: game.width,
      rows: game.height,
      settled: settledCells(game),
      falling: holding ? null : fallingOf(game),
      landing: holding ? null : landingOf(game),
      next: game.next,
      look: this.look,
      seed: this.seed,
      bursts: this.moments.bursts,
      trails: this.moments.trails,
      murk: this.murkFrom === null ? 0 : Math.min(1, (time - this.murkFrom) / (MURK_SECONDS * 0.7)),
      time,
      reducedMotion: this.options.reducedMotion ?? false,
    });
  }
}
