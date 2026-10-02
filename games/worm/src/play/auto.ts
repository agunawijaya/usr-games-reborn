import { createRng } from '@usr-games/kit';
import { cellAt, emptyBoard, indexOf, parseBoard } from '../engine/board';
import { chooseMove } from '../engine/bot';
import { createGame, type Game, move } from '../engine/game';
import type { Cell } from '../engine/geometry';
import { type GardenSpec, straightStart } from '../gardens/gardens';
import type { Look } from '../render/look';
import type { GardenView } from '../render/view';

/**
 * The house noodle at play, on its own: behind the game menu, in the Hall's attract tiles and
 * in the demo. It takes a step every so often, slides between cells like the real thing, and
 * when it bonks (or grows long enough) the garden quietly starts again on the next seed.
 */

const STEP_MS = 170;
/** Past this length the bed gets crowded; start afresh rather than watch it tie itself up. */
const RESTART_LENGTH = 60;

export type AutoBed =
  { kind: 'garden'; spec: GardenSpec } | { kind: 'open'; width: number; height: number };

export class AutoGarden {
  private game: Game;
  private round = 0;
  private timer = 0;
  private frame = 0;
  private lastStep = performance.now();
  private vacated: Cell | null = null;
  private restartAt: number | null = null;
  private bitAt = -10;
  private readonly started = performance.now();

  constructor(
    private readonly view: GardenView,
    private readonly bed: AutoBed,
    private look: Look,
    private readonly seed: string,
    private readonly options: { grid?: boolean; reducedMotion?: boolean } = {},
  ) {
    this.game = this.fresh();
    // A few moves in, so the very first frame already has a noodle on the go.
    for (let i = 0; i < 8; i++) this.step();
  }

  private fresh(): Game {
    const random = createRng(`${this.seed}:${this.round++}`);
    if (this.bed.kind === 'garden') {
      const spec = this.bed.spec;
      return createGame({
        board: parseBoard(spec.map),
        body: spec.start,
        heading: spec.heading,
        random,
      });
    }
    const { width, height } = this.bed;
    return createGame({
      board: emptyBoard(width, height),
      body: straightStart({ x: 6, y: Math.floor(height / 2) }, 'right', 6),
      heading: 'right',
      random,
    });
  }

  private step(): void {
    const dir = chooseMove(this.game);
    if (!dir) {
      this.restartAt = performance.now() + 1200;
      return;
    }
    const tail = this.game.body.at(-1)!;
    const before = this.game.body.length;
    const events = move(this.game, dir);
    this.vacated =
      this.game.body.length === before && !this.game.occupied.has(indexOf(this.game.board, tail))
        ? tail
        : null;
    if (events.some((e) => e.kind === 'bite')) this.bitAt = this.time();
    if (this.game.status === 'lost' || this.game.body.length >= RESTART_LENGTH)
      this.restartAt = performance.now() + 1200;
  }

  private time(): number {
    return (performance.now() - this.started) / 1000;
  }

  setLook(look: Look): void {
    this.look = look;
    this.draw();
  }

  start(): void {
    if (this.timer) return;
    const tick = () => {
      const now = performance.now();
      if (this.restartAt !== null && now >= this.restartAt) {
        this.restartAt = null;
        this.game = this.fresh();
        this.vacated = null;
      } else if (this.restartAt === null && now - this.lastStep >= STEP_MS) {
        this.lastStep = now;
        this.step();
      }
      this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.timer = 1;
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.timer = 0;
  }

  draw(): void {
    const game = this.game;
    const reduced = this.options.reducedMotion ?? false;
    const lead = reduced ? 1 : Math.min(1, (performance.now() - this.lastStep) / 140);
    const time = this.time();
    const lost = game.status === 'lost';
    this.view.draw({
      board: game.board,
      seed: this.seed,
      look: this.look,
      grid: this.options.grid ?? false,
      body: game.body,
      heading: game.heading,
      digit: game.digit,
      mood: lost ? 'dizzy' : time - this.bitAt < 0.5 ? 'munch' : 'calm',
      sag: lost ? 0.6 : 0,
      chewed: [...game.chewed.keys()].map((i) => cellAt(game.board, i)),
      lead: 1 - (1 - lead) * (1 - lead),
      vacated: this.vacated,
      time,
      reducedMotion: reduced,
    });
  }
}
