import { createRng } from '@usr-games/kit';
import type { GameSettings } from '../app/saves';
import { cellAt, emptyBoard, indexOf } from '../engine/board';
import {
  type Bite,
  cloneGame,
  continueDash,
  createGame,
  type Game,
  move,
  type MoveEvent,
  startDash,
} from '../engine/game';
import type { Cell, Dir } from '../engine/geometry';
import {
  CLASSIC_INTERVAL,
  IDLE_INTERVAL,
  Pace,
  TEMPO_MULTIPLIER,
  TEMPOS,
  type Tempo,
  tempoFor,
} from '../engine/tempo';
import { ENDLESS_SIZE, type GardenSpec, straightStart } from '../gardens/gardens';
import type { FillPuzzle } from '../gardens/puzzles';
import { START_HINT } from '../modes/copy';
import { gardenGame, puzzleGame } from '../modes/gardens-play';
import { packagesForBite } from '../modes/packages';
import { Tutorial } from '../modes/tutorial';
import { type Burst, driftFor, type Popup, POPUP_SECONDS } from '../render/effects';
import type { Look } from '../render/look';
import type { Mood } from '../render/noodle';
import { askToConfirm, coachCard, type ResultsModel, resultsCard, startHint } from '../ui/cards';
import { createPlayScreen, type PlayScreen } from '../ui/play-screen';
import type { NoodleSound } from './sound';

/**
 * One run in one garden: the noodle, the keys that steer it, the clock that creeps it along,
 * and everything drawn and heard along the way.
 *
 * Timing follows 1980 where it matters: left alone the noodle takes a step every so often
 * (once a second in Classic tempo), and every key press moves it at once and starts that wait
 * again. Holding a key repeats it, and the pace of the last moments sets the tempo and with it
 * the points of a bite. Fill puzzles and the tutorial wait for the keys: nothing rushes them.
 */

export type PlayMode =
  | { kind: 'garden'; garden: GardenSpec }
  | { kind: 'puzzle'; puzzle: FillPuzzle }
  | { kind: 'endless' }
  | { kind: 'daily'; seed: string; number: number; dateKey: string; garden: GardenSpec }
  | { kind: 'tutorial' };

export interface Summary {
  mode: PlayMode;
  game: Game;
  durationSeconds: number;
  /** The fastest tempo any bite was taken at, and the tempo of the run's last bite. */
  fastestTempo: Tempo | null;
  lastBiteTempo: Tempo | null;
  /** Every bite of the run was at Classic tempo. */
  classicThroughout: boolean;
  baseTempo: Tempo;
}

export interface SessionHooks {
  look(): Look;
  reducedMotion(): boolean;
  settings(): GameSettings;
  sound: NoodleSound;
  /** On the workbench the game shows its own Pause button; in the Hall the Hall does. */
  ownPause: boolean;
  onEnd(summary: Summary): void;
  onPackages(ids: string[]): void;
  onGameMenu(): void;
  onPause(): void;
  /** Space in Endless switches Classic tempo; the app keeps the choice. */
  onClassicChange(classic: boolean): void;
}

/**
 * A key held this long starts repeating, every HOLD_REPEAT after that. A quick tap must never
 * count twice, so the wait is longer than any tap; longer still when every step is deliberate.
 */
const HOLD_DELAY = 260;
const HOLD_DELAY_TURNS = 420;
const HOLD_REPEAT = 105;
const DASH_STEP = 42;
/** In mud the noodle cannot be pushed past this gap between moves, and creeps half as fast. */
const MUD_GAP = 340;
/** How far through its life an older popup jumps when a newer one appears: into its fade. */
const POPUP_FADE_FROM = POPUP_SECONDS * 0.8;
/** Seconds the end of a run is watched before the results card. */
const LOSS_PAUSE = 1.5;
const GROWN_PAUSE = 1.7;
const FILLED_PAUSE = 2.6;

const KEY_DIRS: Readonly<Record<string, Dir>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyK: 'up',
  KeyJ: 'down',
  KeyH: 'left',
  KeyL: 'right',
};

function realTime(mode: PlayMode): boolean {
  return mode.kind === 'garden' || mode.kind === 'endless' || mode.kind === 'daily';
}

function gameFor(mode: PlayMode, tutorial: Tutorial | null): Game {
  switch (mode.kind) {
    case 'garden':
      return gardenGame(mode.garden, createRng(`garden:${mode.garden.id}:${Date.now()}`));
    case 'daily':
      return gardenGame(mode.garden, createRng(mode.seed));
    case 'puzzle':
      return puzzleGame(mode.puzzle);
    case 'tutorial':
      return tutorial!.game;
    case 'endless':
      return createGame({
        board: emptyBoard(ENDLESS_SIZE.width, ENDLESS_SIZE.height),
        // Seven behind the head, as the 1980 default; the noodle waits for the first key.
        body: straightStart({ x: 9, y: Math.floor(ENDLESS_SIZE.height / 2) }, 'right', 8),
        random: createRng(`endless:${Date.now()}`),
      });
  }
}

export class PlaySession {
  readonly screen: PlayScreen;
  game: Game;
  private readonly tutorial: Tutorial | null;
  private readonly seed: string;
  private readonly pace = new Pace();
  private readonly history: Game[] = [];
  private frame = 0;
  private running = true;
  private paused = false;
  /** Unpaused seconds since the run began: every animation runs on this clock. */
  private clockBase = 0;
  private clockStartedAt = performance.now();
  private nextIdleAt = Infinity;
  private nextDashAt = Infinity;
  private held: { dir: Dir; code: string; nextAt: number } | null = null;
  private queued: Dir | null = null;
  private lastMoveAt = -Infinity;
  private glideMs = 120;
  private vacated: Cell | null = null;
  private tempo: Tempo;
  private classic: boolean;
  private classicThroughout = true;
  private fastestTempo: Tempo | null = null;
  private lastBiteTempo: Tempo | null = null;
  private digitBornAt = 0;
  private readonly popups: Popup[] = [];
  private readonly bursts: Burst[] = [];
  private readonly meals: { move: number; size: number }[] = [];
  private pulseAt: number | null = null;
  private ending: { kind: 'lost' | 'grown' | 'filled'; at: number } | null = null;
  private ended = false;
  private resultsShown = false;
  private hint: HTMLElement | null = null;
  private coach: HTMLElement | null = null;
  private readonly onKeyDown = (event: KeyboardEvent) => this.keyDown(event);
  private readonly onKeyUp = (event: KeyboardEvent) => this.keyUp(event);
  private readonly onResize = () => this.screen.fit();

  constructor(
    host: HTMLElement,
    readonly mode: PlayMode,
    private readonly hooks: SessionHooks,
  ) {
    this.tutorial = mode.kind === 'tutorial' ? new Tutorial() : null;
    this.game = gameFor(mode, this.tutorial);
    this.seed =
      mode.kind === 'garden'
        ? mode.garden.id
        : mode.kind === 'daily'
          ? mode.garden.id
          : mode.kind === 'puzzle'
            ? mode.puzzle.id
            : mode.kind;
    const settings = hooks.settings();
    this.classic = mode.kind === 'endless' && settings.classicTempo;
    this.tempo = settings.tempo;
    this.screen = createPlayScreen(host, hooks.look().id, { hallChrome: !hooks.ownPause });
    this.screen.onGameMenu(() => hooks.onGameMenu());
    this.screen.onPause(() => hooks.onPause());
    this.screen.stage.addEventListener('pointerdown', (event) => this.pointerDash(event));
    this.renderBar();
    this.screen.fit();
    this.showHelpers();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.frame = requestAnimationFrame(() => this.tick());
  }

  get isOver(): boolean {
    return this.ended || this.ending !== null;
  }

  // —— the clock ——

  private clock(): number {
    return this.paused
      ? this.clockBase
      : this.clockBase + (performance.now() - this.clockStartedAt) / 1000;
  }

  pause(): void {
    if (this.paused) return;
    this.clockBase = this.clock();
    this.paused = true;
    this.held = null;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.clockStartedAt = performance.now();
    if (this.nextIdleAt !== Infinity) this.nextIdleAt = performance.now() + this.idleInterval();
  }

  private idleInterval(): number {
    const base = this.classic ? CLASSIC_INTERVAL : IDLE_INTERVAL[this.hooks.settings().tempo];
    return this.inMud() ? base * 2 : base;
  }

  private inMud(): boolean {
    const head = this.game.body[0]!;
    return this.game.board.terrain[indexOf(this.game.board, head)] === 'mud';
  }

  // —— input ——

  private keyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
    if (this.paused || this.isOver) return;
    if (event.code === 'Space' && this.mode.kind === 'endless') {
      event.preventDefault();
      if (!event.repeat) this.toggleClassic();
      return;
    }
    if ((event.code === 'KeyZ' || event.code === 'Backspace') && this.mode.kind === 'puzzle') {
      event.preventDefault();
      if (!event.repeat) this.undo();
      return;
    }
    const dir = KEY_DIRS[event.code];
    if (!dir) return;
    event.preventDefault();
    if (event.repeat) return;
    const now = performance.now();
    if (event.shiftKey) {
      this.held = null;
      this.dash(dir, now);
      return;
    }
    const delay = realTime(this.mode) ? HOLD_DELAY : HOLD_DELAY_TURNS;
    this.held = { dir, code: event.code, nextAt: now + delay };
    this.press(dir, now);
  }

  private keyUp(event: KeyboardEvent): void {
    if (this.held && event.code === this.held.code) this.held = null;
  }

  /** A click in line with the head dashes towards it, stopping on the cell clicked. */
  private pointerDash(event: PointerEvent): void {
    if (this.paused || this.isOver || event.button !== 0) return;
    const canvas = this.screen.view.canvas;
    const box = canvas.getBoundingClientRect();
    const layout = this.screen.view.layoutFor(this.game.board);
    const scale = canvas.width / box.width;
    const x = Math.floor(((event.clientX - box.left) * scale - layout.left) / layout.cell);
    const y = Math.floor(((event.clientY - box.top) * scale - layout.top) / layout.cell);
    const head = this.game.body[0]!;
    if ((x !== head.x) === (y !== head.y)) return;
    const dir: Dir = x > head.x ? 'right' : x < head.x ? 'left' : y > head.y ? 'down' : 'up';
    const distance = Math.abs(x - head.x) + Math.abs(y - head.y);
    this.dash(dir, performance.now(), distance);
  }

  private press(dir: Dir, now: number): void {
    if (this.nextDashAt !== Infinity) {
      this.queued = dir;
      return;
    }
    // In mud the noodle will not be pushed: the turn waits for the mud to let go.
    if (this.inMud() && now - this.lastMoveAt < MUD_GAP) {
      this.queued = dir;
      return;
    }
    this.step(dir, now, false);
  }

  private dash(dir: Dir, now: number, limit?: number): void {
    if (this.nextDashAt !== Infinity) return;
    this.saveForUndo();
    const events = this.apply(now, () =>
      startDash(this.game, dir, { multiplier: this.multiplierAt(now) }),
    );
    if (limit !== undefined) this.game.dashLeft = Math.min(this.game.dashLeft, limit - 1);
    if (events.some((e) => e.kind === 'moved')) this.hooks.sound.play('dash');
    if (this.game.dashLeft > 0) this.nextDashAt = now + DASH_STEP;
  }

  // —— moves ——

  /** The multiplier for the move about to happen, which itself counts towards the pace. */
  private multiplierAt(now: number): number {
    this.pace.record(now);
    return this.classic ? 1 : TEMPO_MULTIPLIER[this.currentTempo(now)];
  }

  private currentTempo(now: number): Tempo {
    const base = this.hooks.settings().tempo;
    const paced = tempoFor(this.pace.movesPerSecond(now));
    return TEMPOS.indexOf(paced) > TEMPOS.indexOf(base) ? paced : base;
  }

  private step(dir: Dir, now: number, idle: boolean): void {
    if (!idle) this.saveForUndo();
    this.apply(now, () => move(this.game, dir, { multiplier: this.multiplierAt(now) }));
  }

  /** Plays a move, noting which cell the tail left so the noodle can slide out of it. */
  private apply(now: number, play: () => MoveEvent[]): MoveEvent[] {
    const tail = this.game.body.at(-1) ?? null;
    const before = this.game.body.length;
    const events = play();
    const moved = events.some((e) => e.kind === 'moved');
    const left =
      moved &&
      tail !== null &&
      this.game.body.length === before &&
      !this.game.occupied.has(indexOf(this.game.board, tail));
    if (moved) this.vacated = left ? tail : null;
    this.afterMove(events, now);
    return events;
  }

  private saveForUndo(): void {
    if (this.mode.kind !== 'puzzle') return;
    this.history.push(cloneGame(this.game));
    if (this.history.length > 400) this.history.shift();
  }

  private undo(): void {
    const previous = this.history.pop();
    if (!previous) return;
    this.game = previous;
    this.vacated = null;
    this.lastMoveAt = -Infinity;
    this.meals.length = 0;
    this.hooks.sound.play('undo');
    this.renderBar();
    this.showHelpers();
  }

  private toggleClassic(): void {
    this.classic = !this.classic;
    this.hooks.onClassicChange(this.classic);
    this.renderBar();
  }

  private afterMove(events: readonly MoveEvent[], now: number): void {
    const time = this.clock();
    let moved = false;
    for (const event of events) {
      switch (event.kind) {
        case 'moved':
          moved = true;
          break;
        case 'bite':
          this.onBite(event.bite, time, now);
          break;
        case 'bump':
          this.hooks.sound.play('bump');
          break;
        case 'chewed':
          this.hooks.sound.play('chew');
          break;
        case 'regrew':
          this.hooks.sound.play('regrow');
          break;
        case 'lost':
          if (this.tutorial) break;
          this.ending = { kind: 'lost', at: time };
          if (event.loss !== 'out-of-numbers') this.hooks.sound.play('bonk');
          break;
        case 'filled':
          this.ending = { kind: 'filled', at: time };
          this.hooks.sound.play('filled');
          break;
        case 'grown':
          this.ending = { kind: 'grown', at: time };
          this.pulseAt = time;
          this.hooks.sound.play('grown');
          break;
      }
    }
    if (moved) {
      if (this.lastMoveAt > -Infinity)
        this.glideMs = Math.min(160, Math.max(60, (now - this.lastMoveAt) * 0.75));
      this.lastMoveAt = now;
      if (realTime(this.mode)) this.nextIdleAt = now + this.idleInterval();
      const tempo = this.classic ? 'creep' : this.currentTempo(now);
      if (TEMPOS.indexOf(tempo) > TEMPOS.indexOf(this.tempo)) this.hooks.sound.tempo(tempo);
      this.tempo = tempo;
    }
    if (this.tutorial) {
      const { advanced } = this.tutorial.after(events);
      if (this.tutorial.game !== this.game) {
        this.game = this.tutorial.game;
        this.vacated = null;
        this.meals.length = 0;
      }
      if (advanced || this.tutorial.hint) this.showHelpers();
      if (this.tutorial.lesson === 'done' && !this.ending)
        this.ending = { kind: 'grown', at: time };
      this.digitBornAt = time;
    }
    if (events.length > 0) this.renderBar();
    if (this.hint && this.game.status !== 'waiting') {
      this.hint.remove();
      this.hint = null;
    }
  }

  private onBite(bite: Bite, time: number, now: number): void {
    const tempo = this.classic ? null : this.currentTempo(now);
    if (!this.classic) this.classicThroughout = false;
    if (tempo) {
      if (!this.fastestTempo || TEMPOS.indexOf(tempo) > TEMPOS.indexOf(this.fastestTempo))
        this.fastestTempo = tempo;
      this.lastBiteTempo = tempo;
    }
    this.meals.push({ move: bite.move, size: bite.value });
    // The newest points take the stage: any still showing step back and fade out.
    for (const popup of this.popups) popup.born = Math.min(popup.born, time - POPUP_FADE_FROM);
    this.popups.push({
      at: bite.at,
      points: bite.points,
      chain: bite.chain,
      value: bite.value,
      born: time,
      badge: bite.bonus > 0 ? 'COUNT-UP!' : undefined,
      drift: driftFor(bite.at, this.game.board.width, this.game.board.height, [
        ...this.game.body,
        ...this.landmarks(),
      ]),
    });
    this.bursts.push({ at: bite.at, value: bite.value, born: time + 0.05 });
    this.hooks.sound.bite(bite.value);
    if (bite.chain >= 2) this.hooks.sound.chain(bite.chain);
    if (bite.chain >= 3) this.pulseAt = time;
    this.digitBornAt = time;
    this.hooks.onPackages(packagesForBite(bite, this.game));
  }

  /** Everything on the board a popup should not cover: rocks, roots, mud, tunnels, the digit. */
  private landmarks(): Cell[] {
    const cells: Cell[] = [];
    this.game.board.terrain.forEach((terrain, i) => {
      if (terrain !== 'soil') cells.push(cellAt(this.game.board, i));
    });
    if (this.game.digit) cells.push(this.game.digit.at);
    return cells;
  }

  // —— the frame ——

  private tick(): void {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.tick());
    const now = performance.now();
    if (!this.paused && !this.isOver) this.advance(now);
    this.draw();
    if (this.ending && !this.ended) this.maybeEnd();
  }

  private advance(now: number): void {
    if (this.nextDashAt !== Infinity && now >= this.nextDashAt) {
      this.apply(now, () =>
        continueDash(this.game, { multiplier: this.multiplierAt(now), dashing: true }),
      );
      this.nextDashAt = this.game.dashLeft > 0 && !this.isOver ? now + DASH_STEP : Infinity;
      if (this.nextDashAt === Infinity && this.queued) {
        const dir = this.queued;
        this.queued = null;
        this.press(dir, now);
      }
      return;
    }
    if (this.queued && !(this.inMud() && now - this.lastMoveAt < MUD_GAP)) {
      const dir = this.queued;
      this.queued = null;
      this.step(dir, now, false);
      return;
    }
    if (this.held && now >= this.held.nextAt) {
      this.held.nextAt = now + HOLD_REPEAT;
      this.press(this.held.dir, now);
      return;
    }
    const waiting = this.game.status === 'waiting';
    if (realTime(this.mode) && !waiting && now >= this.nextIdleAt && this.game.heading) {
      this.step(this.game.heading, now, true);
    }
  }

  private draw(): void {
    const time = this.clock();
    const look = this.hooks.look();
    const settings = this.hooks.settings();
    const reduced = this.hooks.reducedMotion();
    const game = this.game;
    const sinceMove = performance.now() - this.lastMoveAt;
    const lead = reduced || this.paused ? 1 : Math.min(1, sinceMove / this.glideMs);
    const eased = 1 - (1 - lead) * (1 - lead);
    const length = game.body.length + game.growing;
    while (this.meals.length > 0 && game.moves - this.meals[0]!.move > length + 2)
      this.meals.shift();
    trimOld(this.popups, time, 1.5);
    trimOld(this.bursts, time, 0.8);
    const ending = this.ending;
    const sinceEnd = ending ? time - ending.at : 0;
    const lost = ending?.kind === 'lost';
    const mood: Mood = lost
      ? game.loss?.kind === 'out-of-numbers'
        ? 'calm'
        : 'dizzy'
      : ending || (this.pulseAt !== null && time - this.pulseAt < 1.2)
        ? 'delight'
        : time - this.digitBornAt < 0.35 && this.meals.length > 0
          ? 'munch'
          : 'calm';
    this.screen.view.draw({
      board: game.board,
      seed: this.seed,
      look,
      grid: settings.grid,
      shapes: settings.shapes,
      body: game.body,
      heading: game.heading,
      digit: game.digit,
      digitAge: time - this.digitBornAt,
      bulges: this.meals.map((m) => ({ at: game.moves - m.move - (1 - eased), size: m.size })),
      pulse: this.pulseAt === null ? null : Math.min(1, (time - this.pulseAt) / 1.6),
      mood,
      sag: lost && game.loss?.kind !== 'out-of-numbers' ? Math.min(1, sinceEnd / 1.2) : 0,
      popups: this.popups,
      bursts: this.bursts,
      mosaic: ending?.kind === 'filled' ? sinceEnd : null,
      bonk:
        lost && game.loss && game.loss.kind !== 'out-of-numbers'
          ? { at: game.loss.at, age: sinceEnd }
          : null,
      chewed: [...game.chewed.keys()].map((i) => cellAt(game.board, i)),
      night: this.mode.kind === 'garden' && this.mode.garden.night === true,
      lead: eased,
      vacated: this.vacated,
      time,
      reducedMotion: reduced,
    });
  }

  private maybeEnd(): void {
    const ending = this.ending!;
    const wait =
      ending.kind === 'lost' ? LOSS_PAUSE : ending.kind === 'filled' ? FILLED_PAUSE : GROWN_PAUSE;
    if (this.clock() - ending.at < wait) return;
    this.ended = true;
    this.held = null;
    this.hooks.onEnd({
      mode: this.mode,
      game: this.game,
      durationSeconds: Math.round(this.clock()),
      fastestTempo: this.fastestTempo,
      lastBiteTempo: this.lastBiteTempo,
      classicThroughout: this.classic && this.classicThroughout,
      baseTempo: this.hooks.settings().tempo,
    });
  }

  // —— the bar and the cards ——

  private renderBar(): void {
    const game = this.game;
    const context =
      this.mode.kind === 'garden'
        ? `Garden ${this.mode.garden.number}`
        : this.mode.kind === 'puzzle'
          ? `Fill puzzle ${this.mode.puzzle.number}`
          : this.mode.kind === 'daily'
            ? `Daily Garden #${this.mode.number}`
            : this.mode.kind === 'tutorial'
              ? 'Tutorial'
              : 'Endless';
    const title =
      this.mode.kind === 'garden'
        ? this.mode.garden.title
        : this.mode.kind === 'puzzle'
          ? this.mode.puzzle.title
          : this.mode.kind === 'daily'
            ? this.mode.garden.title
            : this.mode.kind === 'tutorial'
              ? 'Three quick lessons'
              : 'The open bed';
    this.screen.renderBar({
      context,
      title,
      length: game.body.length + game.growing,
      score: game.score,
      chain: game.chain,
      tempo: this.tempo,
      classic: this.classic,
      par: this.mode.kind === 'puzzle' ? { moves: game.moves, par: this.mode.puzzle.par } : null,
    });
  }

  private showHelpers(): void {
    this.coach?.remove();
    this.coach = null;
    if (this.tutorial) {
      const lesson = this.tutorial.current;
      const index = ['steer', 'dash', 'chain', 'done'].indexOf(lesson.id);
      this.coach = coachCard(
        index < 3 ? `Lesson ${index + 1} of 3` : 'All done',
        lesson.title,
        lesson.body,
        this.tutorial.hint,
      );
      this.screen.overlay.append(this.coach);
    }
    if (this.game.status === 'waiting' && !this.hint && realTime(this.mode)) {
      this.hint = startHint(START_HINT);
      this.screen.overlay.append(this.hint);
    }
  }

  /** Fill puzzles forgive a slip: the run before the losing move comes back. */
  get canTakeBack(): boolean {
    return this.mode.kind === 'puzzle' && this.history.length > 0 && this.game.status === 'lost';
  }

  takeBack(): void {
    if (!this.canTakeBack) return;
    this.screen.overlay.querySelector('.nn-results')?.remove();
    this.ending = null;
    this.ended = false;
    this.resultsShown = false;
    this.undo();
  }

  /** The results card, over the garden, with the first action focused. */
  showResults(model: ResultsModel): void {
    this.resultsShown = true;
    this.coach?.remove();
    const card = resultsCard(model);
    this.screen.overlay.append(card);
    (card.querySelector('.nn-results__title') as HTMLElement | null)?.focus();
  }

  get showingResults(): boolean {
    return this.resultsShown;
  }

  confirm(text: Parameters<typeof askToConfirm>[1]): Promise<boolean> {
    return askToConfirm(this.screen.root, text);
  }

  setLook(look: Look): void {
    this.screen.setLook(look.id);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.screen.root.remove();
  }
}

function trimOld<T extends { born: number }>(list: T[], time: number, life: number): void {
  while (list.length > 0 && time - list[0]!.born > life) list.shift();
}
