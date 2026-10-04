import { createRng } from '@usr-games/kit';
import type { GameSettings } from '../app/saves';
import {
  canSink,
  classicTickMicros,
  CORAL,
  countKind,
  createGame,
  fall,
  type Game,
  type GameEvent,
  plunge,
  SEAWEED,
  shift,
  sink,
  sinkSeconds,
  turn,
} from '../engine/game';
import {
  diveGame,
  diveProgress,
  type DiveSpec,
  diveState,
  TANK_HEIGHT,
  TANK_WIDTH,
} from '../dives/dives';
import { CLASSIC_HINT, START_HINT } from '../modes/copy';
import { DAILY_SINKERS, dailyGame, dailyOver } from '../modes/daily';
import { packagesForBurst, packagesForPlay } from '../modes/packages';
import { Tutorial } from '../modes/tutorial';
import { scoreFactors, scorePopTimes } from '../render/effects';
import { fallingOf, landingOf, settledCells } from '../render/from-game';
import type { Look } from '../render/look';
import {
  askToConfirm,
  type ConfirmText,
  coachCard,
  keysHint,
  type ResultsModel,
  resultsCard,
} from '../ui/cards';
import { createPlayScreen, type PlayScreen } from '../ui/play-screen';
import { Moments } from './moments';
import type { SinkerSound } from './sound';

/**
 * One run in one tank: the sinker, the keys that move it, the clock that sinks it, and everything
 * seen and heard along the way.
 *
 * Standard rules: the sinker sinks a row at a time at the level's pace; resting on something it
 * waits half a second (moving or turning it starts that wait again, a few times) and then settles.
 * Classic 1992 keeps the original's clock: a tick at a million microseconds over the level, a
 * three-thousandth quicker every tick, the shape landing at the first tick it cannot move down,
 * and two ticks of stillness for every row that clears, keys pressed meanwhile thrown away.
 */

export type PlayMode =
  | { kind: 'dive'; dive: DiveSpec }
  | { kind: 'marathon'; level: number }
  | { kind: 'classic'; level: number }
  | { kind: 'daily'; seed: string; number: number; dateKey: string; name: string; par: number }
  | { kind: 'tutorial' };

export type Ending = 'won' | 'lost' | 'done';

export interface Summary {
  mode: PlayMode;
  game: Game;
  ending: Ending;
  durationSeconds: number;
  coralAtStart: number;
}

export interface SessionHooks {
  look(): Look;
  reducedMotion(): boolean;
  settings(): GameSettings;
  sound: SinkerSound;
  /** On the workbench the game shows its own Pause button; in the Hall the Hall does. */
  ownPause: boolean;
  onEnd(summary: Summary): void;
  onPackages(ids: string[]): void;
  onGameMenu(): void;
  onPause(): void;
}

/** Marathon climbs a level every this many rows. */
export const MARATHON_ROWS_PER_LEVEL = 10;
const CLASSIC_WIDTH = 10;
const CLASSIC_HEIGHT = 20;

/** Seconds a resting sinker waits before it settles, and how often a move may start that again. */
const REST_SECONDS = 0.5;
const REST_RESETS = 15;
/** Held slide: the wait before it repeats, then the repeat. */
const SLIDE_DELAY = 0.17;
const SLIDE_REPEAT = 0.05;
/** Held sink: a row this often. */
const SINK_REPEAT = 0.045;
/** Seconds the end of a run is watched before the results card. */
const END_PAUSE: Record<Ending, number> = { won: 1.8, lost: 1.9, done: 1.5 };
const HINT_SECONDS = 7;

type Action = 'left' | 'right' | 'turnLeft' | 'turnRight' | 'sink' | 'plunge' | 'pause' | 'quit';

const STANDARD_KEYS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'turnRight',
  KeyW: 'turnRight',
  KeyX: 'turnRight',
  KeyZ: 'turnLeft',
  ArrowDown: 'sink',
  KeyS: 'sink',
  Space: 'plunge',
  KeyP: 'pause',
};

/** The original's keys too, `jkl pq`: left, turn, right, drop, pause, quit. */
const CLASSIC_KEYS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left',
  KeyJ: 'left',
  ArrowRight: 'right',
  KeyL: 'right',
  ArrowUp: 'turnLeft',
  KeyK: 'turnLeft',
  KeyZ: 'turnLeft',
  Space: 'plunge',
  KeyP: 'pause',
  KeyQ: 'quit',
};

function gameFor(mode: PlayMode, tutorial: Tutorial | null): Game {
  switch (mode.kind) {
    case 'dive':
      return diveGame(mode.dive, createRng(`dive:${mode.dive.id}:${Date.now()}`));
    case 'daily':
      return dailyGame(mode.seed);
    case 'tutorial':
      return tutorial!.game;
    case 'marathon':
      return createGame({
        rules: 'standard',
        width: TANK_WIDTH,
        height: TANK_HEIGHT,
        level: mode.level,
        levelEvery: MARATHON_ROWS_PER_LEVEL,
        random: createRng(`marathon:${Date.now()}`),
      });
    case 'classic':
      return createGame({
        rules: 'classic',
        width: CLASSIC_WIDTH,
        height: CLASSIC_HEIGHT,
        level: mode.level,
        random: createRng(`classic:${Date.now()}`),
      });
  }
}

export class PlaySession {
  readonly screen: PlayScreen;
  game: Game;
  private readonly tutorial: Tutorial | null;
  private readonly classic: boolean;
  private readonly moments = new Moments();
  private readonly coralAtStart: number;
  private frame = 0;
  private running = true;
  private paused = false;
  /** Unpaused seconds since the run began: every animation and every wait runs on this clock. */
  private clockBase = 0;
  private clockStartedAt = performance.now();
  private nextFallAt = 0;
  private restSince: number | null = null;
  private restResets = 0;
  /** Classic: no moves until this time, after rows clear. */
  private stillUntil = 0;
  private wasHolding = false;
  private held: { action: 'left' | 'right' | 'sink'; code: string; nextAt: number } | null = null;
  private lastDownAt = -Infinity;
  private ending: { kind: Ending; at: number } | null = null;
  private ended = false;
  private resultsShown = false;
  private hint: HTMLElement | null = null;
  private hintUntil = HINT_SECONDS;
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
    this.classic = this.game.rules === 'classic';
    this.coralAtStart = countKind(this.game, CORAL);
    this.screen = createPlayScreen(host, hooks.look().id, { hallChrome: !hooks.ownPause });
    this.screen.onGameMenu(() => hooks.onGameMenu());
    this.screen.onPause(() => hooks.onPause());
    this.renderBar();
    this.screen.fit();
    this.showHelpers();
    this.nextFallAt = this.interval();
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
  }

  /** Seconds between the sinker's own steps down. */
  private interval(): number {
    return this.classic ? this.game.fallMicros / 1_000_000 : sinkSeconds(this.game.level);
  }

  /** The tutorial waits for the keys: nothing sinks on its own there, though it still settles. */
  private get sinksByItself(): boolean {
    return this.mode.kind !== 'tutorial';
  }

  // —— input ——

  private keyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    // Paused or over, the keys belong to the cards and the Hall.
    if (this.paused || this.isOver) return;
    if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
    const action = (this.classic ? CLASSIC_KEYS : STANDARD_KEYS)[event.code];
    if (!action) return;
    // During play the keys are the game's, even with a button of the bar focused.
    event.preventDefault();
    if (action === 'pause') {
      if (!event.repeat) this.hooks.onPause();
      return;
    }
    if (action === 'quit') {
      if (!event.repeat) this.hooks.onGameMenu();
      return;
    }
    if (event.repeat) return;
    const time = this.clock();
    this.dropHint();
    if (action === 'left' || action === 'right' || action === 'sink') {
      this.held = {
        action,
        code: event.code,
        nextAt: time + (action === 'sink' ? SINK_REPEAT : SLIDE_DELAY),
      };
    }
    this.perform(action, time);
  }

  private keyUp(event: KeyboardEvent): void {
    if (this.held && event.code === this.held.code) this.held = null;
  }

  /** True while the tank is busy with a burst (or Classic's stillness) and takes no keys. */
  private busy(time: number): boolean {
    return this.moments.holding(time) || time < this.stillUntil;
  }

  private perform(action: Action, time: number): void {
    if (this.busy(time) || this.game.over) return;
    switch (action) {
      case 'left':
      case 'right': {
        const events = shift(this.game, action === 'left' ? -1 : 1);
        this.afterMove(events, time);
        if (events[0]?.kind === 'moved') this.hooks.sound.play('slide');
        break;
      }
      case 'turnLeft':
      case 'turnRight': {
        const events = turn(this.game, action === 'turnLeft' ? 'left' : 'right');
        this.afterMove(events, time);
        this.hooks.sound.play(events[0]?.kind === 'turned' ? 'turn' : 'blocked');
        break;
      }
      case 'sink': {
        if (this.classic) return;
        const events = sink(this.game);
        if (events.length > 0) {
          this.lastDownAt = time;
          this.nextFallAt = time + this.interval();
          this.after(events, time);
        }
        break;
      }
      case 'plunge':
        this.after(this.moments.act(this.game, time, () => plunge(this.game)).events, time);
        break;
    }
  }

  /** A slide or a turn: a sinker resting on something waits again, a few times over. */
  private afterMove(events: readonly GameEvent[], time: number): void {
    const moved = events.some((e) => e.kind === 'moved' || e.kind === 'turned');
    if (moved && this.restSince !== null && this.restResets < REST_RESETS) {
      this.restResets++;
      this.restSince = canSink(this.game) ? null : time;
    }
    this.after(events, time);
  }

  // —— what happened ——

  private after(events: readonly GameEvent[], time: number): void {
    if (events.length === 0) return;
    const sound = this.hooks.sound;
    for (const event of events) {
      switch (event.kind) {
        case 'drifted':
          sound.play('drift');
          break;
        case 'plunged':
          if (event.rows > 0) sound.plunge(event.rows);
          break;
        case 'landed':
          sound.land(event.how === 'plunge');
          this.restSince = null;
          this.restResets = 0;
          this.nextFallAt = time + this.interval();
          if (!this.classic && this.game.combo >= 2) sound.combo(this.game.combo);
          this.hooks.onPackages(packagesForPlay(this.game));
          break;
        case 'burst': {
          const burst = event.burst;
          if (this.classic) {
            // Two ticks of stillness for every row, as in 1992.
            this.stillUntil = time + 2 * burst.rows.length * this.interval();
            sound.burst(burst.rows.length, 0, []);
          } else {
            const moment = { rows: burst.rows, combo: burst.combo, level: this.game.level };
            sound.burst(burst.rows.length, scoreFactors(moment).length, scorePopTimes(moment));
            this.hooks.onPackages(packagesForBurst(burst, this.game));
          }
          break;
        }
        case 'levelled':
          sound.play('level');
          break;
        case 'over':
          if (!this.tutorial) this.end('lost', time);
          break;
      }
    }
    if (this.tutorial) this.afterLesson(events, time);
    else this.checkGoal(time);
    this.renderBar();
  }

  private afterLesson(events: readonly GameEvent[], time: number): void {
    const tutorial = this.tutorial!;
    const { advanced } = tutorial.after(events);
    if (tutorial.game !== this.game) {
      this.game = tutorial.game;
      this.restSince = null;
    }
    if (advanced || tutorial.hint) this.showHelpers();
    if (tutorial.lesson === 'done' && !this.ending) this.end('done', time);
  }

  private checkGoal(time: number): void {
    if (this.ending) return;
    const mode = this.mode;
    if (mode.kind === 'dive') {
      const state = diveState(mode.dive, this.game);
      if (state === 'won') {
        this.hooks.sound.play('won');
        this.end('won', time);
      } else if (state === 'lost') this.end('lost', time);
    } else if (mode.kind === 'daily' && dailyOver(this.game)) {
      this.end(this.game.over ? 'lost' : 'done', time);
    }
  }

  private end(kind: Ending, time: number): void {
    if (this.ending) return;
    this.ending = { kind, at: time };
    this.held = null;
    if (kind === 'lost') this.hooks.sound.play('full');
  }

  // —— the frame ——

  private tick(): void {
    if (!this.running) return;
    this.frame = requestAnimationFrame(() => this.tick());
    const time = this.clock();
    if (!this.paused && !this.isOver) this.advance(time);
    this.draw(time);
    if (this.ending && !this.ended) this.maybeEnd(time);
  }

  private advance(time: number): void {
    const holding = this.busy(time);
    if (holding) {
      this.wasHolding = true;
      return;
    }
    if (this.wasHolding) {
      // The tank is still again: the new sinker gets a full step before it moves.
      this.wasHolding = false;
      this.nextFallAt = time + this.interval();
    }
    if (time > this.hintUntil) this.dropHint();
    if (this.held && time >= this.held.nextAt) {
      this.held.nextAt = time + (this.held.action === 'sink' ? SINK_REPEAT : SLIDE_REPEAT);
      this.perform(this.held.action, time);
    }
    if (canSink(this.game)) {
      this.restSince = null;
      if (this.sinksByItself && time >= this.nextFallAt) this.tickDown(time);
      return;
    }
    if (this.classic) {
      // The original lands a shape at the first tick it cannot move down.
      if (time >= this.nextFallAt) this.tickDown(time);
      return;
    }
    this.restSince ??= time;
    if (time - this.restSince >= REST_SECONDS) this.tickDown(time);
  }

  /** The clock's own step: down a row, or settle. */
  private tickDown(time: number): void {
    if (this.classic) classicTickMicros(this.game);
    const sinking = canSink(this.game);
    this.nextFallAt = time + this.interval();
    if (sinking) this.lastDownAt = time;
    const acted = this.moments.act(this.game, time, () => fall(this.game));
    this.after(acted.events, time);
  }

  private draw(time: number): void {
    this.moments.trim(time);
    const game = this.game;
    const reduced = this.hooks.reducedMotion();
    const settings = this.hooks.settings();
    const holding = this.busy(time);
    const glide = Math.min(0.09, this.interval() * 0.6);
    const lead = reduced ? 0 : -(1 - Math.min(1, (time - this.lastDownAt) / glide));
    const ending = this.ending;
    const showFalling = !holding && !ending;
    const dive = this.mode.kind === 'dive' ? this.mode.dive : null;
    this.screen.view.draw({
      cols: game.width,
      rows: game.height,
      settled: settledCells(game),
      falling: showFalling ? fallingOf(game) : null,
      fallLead: lead,
      landing: showFalling && settings.sonar ? landingOf(game) : null,
      next: ending?.kind === 'lost' ? null : game.next,
      look: this.hooks.look(),
      seed: dive?.id ?? this.mode.kind,
      bursts: this.moments.bursts,
      trails: this.moments.trails,
      murk: ending?.kind === 'lost' ? Math.min(1, (time - ending.at) / 1.3) : 0,
      currents: game.currents,
      night: dive?.dark === true,
      time,
      reducedMotion: reduced,
    });
  }

  private maybeEnd(time: number): void {
    const ending = this.ending!;
    // Let a last burst play out before the card covers it.
    if (time - ending.at < END_PAUSE[ending.kind] || this.moments.holding(time)) return;
    this.ended = true;
    this.held = null;
    this.hooks.onEnd({
      mode: this.mode,
      game: this.game,
      ending: ending.kind,
      durationSeconds: Math.round(this.clock()),
      coralAtStart: this.coralAtStart,
    });
  }

  // —— the bar and the cards ——

  private renderBar(): void {
    const game = this.game;
    const mode = this.mode;
    let goal: { label: string; done: number; of: number } | null = null;
    if (mode.kind === 'dive') {
      const [done, of] = diveProgress(mode.dive, game, this.coralAtStart);
      goal = { label: mode.dive.goal.kind === 'rows' ? 'Rows' : 'Coral', done, of };
    } else if (mode.kind === 'daily') {
      goal = { label: 'Sinkers', done: Math.min(game.landings, DAILY_SINKERS), of: DAILY_SINKERS };
    }
    this.screen.renderBar({
      ...barTitle(mode, game),
      score: game.points,
      level: game.level,
      rows: game.rowsCleared,
      combo: game.combo,
      classic: this.classic,
      goal,
    });
  }

  private showHelpers(): void {
    this.coach?.remove();
    this.coach = null;
    if (this.tutorial) {
      const lesson = this.tutorial.current;
      const step = this.tutorial.step;
      this.coach = coachCard(
        step < 3 ? `Lesson ${step + 1} of 3` : 'All done',
        lesson.title,
        lesson.body,
        this.tutorial.hint,
      );
      this.screen.overlay.append(this.coach);
      return;
    }
    if (!this.hint) {
      this.hint = keysHint(this.classic ? CLASSIC_HINT : START_HINT);
      this.screen.overlay.append(this.hint);
    }
  }

  private dropHint(): void {
    this.hint?.remove();
    this.hint = null;
    this.hintUntil = Infinity;
  }

  /** The results card, over the tank, with its title focused. */
  showResults(model: ResultsModel): void {
    this.resultsShown = true;
    this.coach?.remove();
    this.dropHint();
    const card = resultsCard(model);
    this.screen.overlay.append(card);
    (card.querySelector('.snk-results__title') as HTMLElement | null)?.focus();
  }

  get showingResults(): boolean {
    return this.resultsShown;
  }

  /** Seaweed still in the tank (for the gardener's package). */
  get seaweedLeft(): number {
    return countKind(this.game, SEAWEED);
  }

  confirm(text: ConfirmText): Promise<boolean> {
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

/** The bar's two lines of context: which mode, and which tank. */
function barTitle(mode: PlayMode, game: Game): { context: string; title: string } {
  switch (mode.kind) {
    case 'dive':
      return { context: `Dive ${mode.dive.number}`, title: mode.dive.title };
    case 'marathon':
      return { context: 'Marathon', title: `from level ${game.startLevel}` };
    case 'classic':
      return { context: 'Classic 1992', title: `level ${game.level}` };
    case 'daily':
      return { context: `Daily Dive #${mode.number}`, title: mode.name };
    case 'tutorial':
      return { context: 'Tutorial', title: 'Three short lessons' };
  }
}
