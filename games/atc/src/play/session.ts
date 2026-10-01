import type { Arena } from '../engine/arena';
import { giveOrder, type Order, readLine } from '../engine/commands';
import { type Heading, HEADING_KEYS } from '../engine/geometry';
import { forecast, type Forecast } from '../engine/predict';
import { skyRandomness } from '../engine/randomness';
import {
  addPlane,
  CEILING,
  createWorld,
  findPlane,
  type Hold,
  type Plane,
  planeName,
  type SkyEvent,
  type SkyRules,
  tick,
  type World,
} from '../engine/world';
import type { Focus } from '../render/camera';
import type { Point } from '../render/features';
import { type LookId, lookFor } from '../render/look';
import type { GhostRoute, RadarScene } from '../render/radar';
import type { WovenFlight } from '../render/tapestry';
import { type GameSettings, SPEED_FACTOR } from '../app/saves';
import type { DailySky } from '../modes/daily';
import type { Puzzle } from '../modes/puzzles';
import { beforeShiftTick, type ShiftDefinition, shiftArena, shiftRules } from '../modes/shifts';
import type { SkyProgress } from '../modes/packages';
import type { SkyKeys } from './keys';
import {
  TUTORIAL_ARENA,
  TUTORIAL_ARRIVALS,
  TUTORIAL_RULES,
  type TutorialStep,
} from '../modes/tutorial';
import { h } from '../ui/dom';
import { createPlayScreen, type PlayScreen } from '../ui/play-screen';
import { stripModels } from '../ui/strips';
import { SkyEffects, stringQueue } from './effects';
import { FlightHistory } from './history';
import {
  draftRoute,
  type Draft,
  extendSketch,
  featureAt,
  type Sketch,
  startSketch,
} from './routing';
import type { SkySound } from './sound';
import { TerminalBar } from './terminal-bar';

/**
 * One sky being played: the world and its clock, everything the player can do to it with the
 * pointer, the keyboard or Terminal mode, the radar and strips that show it, and the summary
 * handed back when it ends. Screens around it (title, cards) belong to the app.
 */

export type SkyMode =
  | { kind: 'tutorial' }
  | { kind: 'shift'; shift: ShiftDefinition }
  | { kind: 'endless'; arena: Arena }
  | { kind: 'daily'; sky: DailySky }
  | { kind: 'puzzle'; puzzle: Puzzle };

export interface SkySummary {
  mode: SkyMode;
  world: World;
  /** lost: a rule was broken; completed: the clock ran out with the sky kept; solved: a puzzle done. */
  outcome: 'lost' | 'completed' | 'solved';
  safe: number;
  landings: number;
  exits: number;
  ticks: number;
  nearMisses: number;
  nearMissTicks: number[];
  longestString: number;
  fuelLeft: number;
  orders: number;
  terminalOrders: number;
  flights: WovenFlight[];
  knots: Point[];
  /** The sky as it was on each of the last ticks, oldest first, for the replay. */
  replay: World[];
  durationSeconds: number;
  medicalLanded: number;
  lowestLandingFuel: number | null;
  lettersFlown: number;
  beaconPasses: number;
  leftHolds: number;
}

export interface SessionHost {
  look(): LookId;
  reducedMotion(): boolean;
  settings(): GameSettings;
  sound: SkySound;
  /** True inside the Hall, whose own pause button sits at the top right. */
  hallChrome: boolean;
  onEnd(summary: SkySummary): void;
  /** The remappable keys, as the Hall's settings bind them. */
  keys(): SkyKeys;
  /** After every tick, for the packages that are earned in the air. */
  onProgress?(progress: SkyProgress): void;
  onExit(): void;
  onShell(): void;
  /**
   * Called with the session itself, as the first step is announced while it is still being built,
   * and with the names of the planes in conflict for the step about the ring.
   */
  onTutorialStep?(step: TutorialStep, session: PlaySession, pair: string): void;
}

const REPLAY_TICKS = 6;
const DRAG_THRESHOLD = 6;
const RADIAL_DELAY = 450;
const TILT_HOLD_DELAY = 220;
const TUTORIAL_TICK_SECONDS = 3;
const PUZZLE_TICK_SECONDS = 1.4;
const HOLD_LOOP = 4;

function modeArena(mode: SkyMode): Arena {
  switch (mode.kind) {
    case 'tutorial':
      return TUTORIAL_ARENA;
    case 'shift':
      return shiftArena(mode.shift);
    case 'endless':
      return mode.arena;
    case 'daily':
      return mode.sky.arena;
    case 'puzzle':
      return mode.puzzle.arena;
  }
}

function modeRules(mode: SkyMode): SkyRules | undefined {
  if (mode.kind === 'tutorial') return TUTORIAL_RULES;
  if (mode.kind === 'shift') return shiftRules(mode.shift);
  if (mode.kind === 'puzzle') return { ...TUTORIAL_RULES, arrivals: mode.puzzle.arrivals };
  return undefined;
}

function modeSeed(mode: SkyMode): string {
  if (mode.kind === 'daily') return mode.sky.seed;
  return `skyloom:${mode.kind}:${Date.now()}:${Math.random()}`;
}

function cloneWorld(world: World): World {
  const clonePlane = (p: Plane): Plane => ({
    ...p,
    route: p.route.map((c) => ({ ...c })),
    track: p.track.slice(-6),
  });
  return {
    ...world,
    air: world.air.map(clonePlane),
    ground: world.ground.map(clonePlane),
    closePairs: new Set(),
  };
}

interface Drag {
  letter: number;
  start: Point;
  pointerId: number;
  sketch: Sketch;
  draft: Draft | null;
  active: boolean;
  fromStrip: boolean;
}

export class PlaySession {
  readonly screen: PlayScreen;
  readonly world: World;
  private readonly mode: SkyMode;
  private readonly host: SessionHost;
  private sky: Forecast;
  private readonly effects = new SkyEffects();
  private readonly history = new FlightHistory();
  private snapshots: World[] = [];
  private selected: number | null = null;
  private drag: Drag | null = null;
  private radial: HTMLElement | null = null;
  private radialTimer = 0;
  private directTarget: number | null = null;
  private tilt = 0;
  private tiltTarget = 0;
  private focus: Focus | undefined;
  private elapsed = 0;
  private time = 0;
  private lastFrame = 0;
  private frame = 0;
  private paused = false;
  private frozen: boolean;
  private ended = false;
  private endedAt = 0;
  private readonly startedAt = performance.now();
  private drain = 0;
  private terminal: TerminalBar | null = null;
  private orders = 0;
  private terminalOrders = 0;
  private landings = 0;
  private exits = 0;
  private fuelOnArrival: number[] = [];
  private nearMissTicks: number[] = [];
  private medicalLanded = 0;
  private lowestLandingFuel: number | null = null;
  private readonly letters = new Set<string>();
  /** Planes seen over each beacon, by letter and arrival tick (letters are reused). */
  private readonly beaconPasses = new Map<number, Set<string>>();
  private leftHolds = 0;
  private readonly holdTurns = new Map<number, number>();
  private tutorialStep: TutorialStep | null = null;
  private readonly tutorialSeen = new Set<TutorialStep>();
  /** Planes that have had an order this sky; the tutorial moves on once its plane has one. */
  private readonly orderedLetters = new Set<number>();
  private banner: HTMLElement | null = null;
  private breakScreen: HTMLElement | null = null;
  private tiltKeyTimer = 0;
  private tiltKeyHeld = false;
  private readonly listeners: (() => void)[] = [];
  private wheelBudget = 0;

  constructor(parent: HTMLElement, mode: SkyMode, host: SessionHost) {
    this.mode = mode;
    this.host = host;
    this.world = createWorld(modeArena(mode), skyRandomness(modeSeed(mode)), modeRules(mode));
    if (mode.kind !== 'tutorial' && mode.kind !== 'puzzle') addPlane(this.world);
    this.noteLetters();
    this.sky = forecast(this.world);
    this.frozen = mode.kind === 'puzzle';
    this.screen = createPlayScreen(parent, host.look(), { hallChrome: host.hallChrome });
    this.screen.root.classList.toggle('is-night', mode.kind === 'shift' && mode.shift.night);
    this.screen.root.classList.toggle('has-shapes', host.settings().shapes);
    this.wireBar();
    this.wirePointer();
    this.wireKeys();
    this.wireStrips();
    this.refreshKeys();
    if (host.settings().terminalByDefault) this.toggleTerminal(true);
    this.renderPanels();
    this.screen.fit();
    const resize = new ResizeObserver(() => this.screen.fit());
    resize.observe(this.screen.radarHost);
    this.listeners.push(() => resize.disconnect());
    host.sound.hum(true);
    if (mode.kind === 'tutorial') {
      // The first plane is scripted for tick 1; begin there so the first step has a plane to route.
      this.advance();
      this.setTutorialStep('route-to-gate');
    }
    if (mode.kind === 'puzzle') {
      // The first planes are scripted for tick 1; the puzzle opens on them, with time standing still.
      this.advance();
      this.frozen = true;
      this.showBanner(
        mode.puzzle.title,
        `${mode.puzzle.brief} Plan, then press Space to run. Par ${mode.puzzle.par}.`,
      );
    }
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame((t) => this.loop(t));
    // The browser tests reach the sky through this handle; it exists only in development.
    if (import.meta.env.DEV) (window as { __skyloom?: PlaySession }).__skyloom = this;
  }

  // —— clock ——

  private tickSeconds(): number {
    if (this.mode.kind === 'tutorial') return TUTORIAL_TICK_SECONDS;
    if (this.mode.kind === 'puzzle') return PUZZLE_TICK_SECONDS;
    return this.world.arena.tickSeconds * SPEED_FACTOR[this.host.settings().speed];
  }

  private loop(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    const running = !this.paused && !this.frozen && !this.ended;
    if (running) {
      this.elapsed += dt;
      if (this.elapsed >= this.tickSeconds()) this.advance();
    }
    const tiltSpeed = this.host.reducedMotion() ? 1 : Math.min(1, dt * 7);
    this.tilt += (this.tiltTarget - this.tilt) * tiltSpeed;
    if (Math.abs(this.tilt - this.tiltTarget) < 0.002) this.tilt = this.tiltTarget;
    if (this.tilt === 0) this.focus = undefined;
    if (this.ended)
      this.drain = this.host.reducedMotion() ? 1 : Math.min(1, (this.time - this.endedAt) / 1);
    this.draw();
    this.frame = requestAnimationFrame((t) => this.loop(t));
  }

  /** Space, or Enter on an empty Terminal line: starts a planned puzzle, or moves on a tick now. */
  private requestTick(): void {
    if (this.mode.kind === 'tutorial' && this.frozen) {
      this.showToast('The sky waits until this step is done.');
      return;
    }
    if (this.frozen) {
      this.frozen = false;
      if (this.mode.kind === 'puzzle') this.hideBanner();
    } else this.advance();
  }

  /** Moves the sky on one tick now. */
  advance(): void {
    if (this.ended || this.paused) return;
    this.elapsed = 0;
    if (this.mode.kind === 'shift') {
      if (beforeShiftTick(this.world, this.mode.shift) === 'wind-change') {
        const change = this.mode.shift.windChange!;
        this.showBanner(
          'The wind has turned',
          `Runway A${change.closes} is closed; everything lands on A${change.opens}.`,
        );
      }
    }
    this.snapshots.push(cloneWorld(this.world));
    if (this.snapshots.length > REPLAY_TICKS) this.snapshots.shift();
    const before = new Map([...this.world.air, ...this.world.ground].map((p) => [p.letter, p]));
    const fuel = new Map(this.world.air.map((p) => [p.letter, p.fuel]));
    this.noteHolds();
    const events = tick(this.world);
    // In a puzzle, time stands still again whenever a new plane comes in, so it can be planned for.
    if (
      this.mode.kind === 'puzzle' &&
      this.world.clock > 1 &&
      events.some((e) => e.kind === 'spawned')
    ) {
      this.frozen = true;
      this.showToast('New arrival: plan, then press Space');
    }
    this.history.record(events, before);
    this.react(events, before, fuel);
    this.noteLetters();
    this.host.onProgress?.(this.progress());
    this.sky = forecast(this.world);
    if (this.selected !== null && !findPlane(this.world, this.selected)) this.selected = null;
    if (this.drag && !findPlane(this.world, this.drag.letter)) this.cancelDrag();
    this.renderPanels();
    if (this.world.loss) this.end('lost');
    else this.checkModeEnd();
    if (this.mode.kind === 'tutorial') this.followTutorial();
    this.placeBanner();
  }

  private react(
    events: readonly SkyEvent[],
    before: ReadonlyMap<number, Plane>,
    fuel: ReadonlyMap<number, number>,
  ): void {
    const sound = this.host.sound;
    const { landed } = this.effects.apply(events, this.world, this.time);
    for (const event of events) {
      switch (event.kind) {
        case 'arrived': {
          const plane = before.get(event.letter);
          const left = fuel.get(event.letter) ?? 0;
          this.fuelOnArrival.push(left / (this.world.arena.width + this.world.arena.height));
          if (event.at.kind === 'runway') {
            this.landings += 1;
            this.lowestLandingFuel = Math.min(this.lowestLandingFuel ?? Infinity, left);
            if (plane?.flight.role === 'medical') this.medicalLanded += 1;
          } else {
            this.exits += 1;
            sound.arrival();
          }
          break;
        }
        case 'took-off':
          sound.departure();
          break;
        case 'near-miss':
          this.nearMissTicks.push(event.tick);
          sound.nearMiss();
          break;
        default:
          break;
      }
    }
    if (landed !== null) sound.landing(landed);
    for (const plane of this.world.air) {
      const beacon = this.world.arena.beacons.findIndex((b) => b.x === plane.x && b.y === plane.y);
      if (beacon < 0) continue;
      const passes = this.beaconPasses.get(beacon) ?? new Set<string>();
      passes.add(`${plane.letter}:${plane.track[0]?.tick ?? 0}`);
      this.beaconPasses.set(beacon, passes);
    }
  }

  /** A left hold counts once a plane has turned all the way round to the left. */
  private noteHolds(): void {
    for (const plane of this.world.air) {
      if (plane.hold !== 'left') {
        this.holdTurns.delete(plane.letter);
        continue;
      }
      const turns = (this.holdTurns.get(plane.letter) ?? 0) + 1;
      this.holdTurns.set(plane.letter, turns);
      if (turns === HOLD_LOOP * 2) this.leftHolds += 1;
    }
  }

  private noteLetters(): void {
    for (const plane of [...this.world.air, ...this.world.ground])
      this.letters.add(planeName(plane).toLowerCase());
  }

  private checkModeEnd(): void {
    const clock = this.world.clock;
    switch (this.mode.kind) {
      case 'shift':
        if (clock >= this.mode.shift.ticks) this.end('completed');
        break;
      case 'daily':
        if (clock >= this.mode.sky.ticks) this.end('completed');
        break;
      case 'puzzle': {
        const all = this.mode.puzzle.arrivals.length;
        const empty = this.world.air.length === 0 && this.world.ground.length === 0;
        if (this.world.safe >= all && empty) this.end('solved');
        else if (clock >= this.mode.puzzle.ticks) this.end('completed');
        break;
      }
      default:
        break;
    }
  }

  private end(outcome: SkySummary['outcome']): void {
    if (this.ended) return;
    this.ended = true;
    this.endedAt = this.time;
    this.cancelDrag();
    this.closeRadial();
    this.hideBanner();
    if (outcome === 'lost') this.host.sound.loss();
    else {
      this.host.sound.hum(false);
      this.host.sound.shiftComplete();
    }
    const summary: SkySummary = {
      mode: this.mode,
      world: this.world,
      outcome,
      safe: this.world.safe,
      landings: this.landings,
      exits: this.exits,
      ticks: this.world.clock,
      nearMisses: this.world.nearMisses,
      nearMissTicks: this.nearMissTicks,
      longestString: this.effects.longestString,
      fuelLeft: this.fuelOnArrival.length
        ? this.fuelOnArrival.reduce((a, b) => a + b, 0) / this.fuelOnArrival.length
        : 0,
      orders: this.orders,
      terminalOrders: this.terminalOrders,
      flights: this.history.woven(this.world),
      knots: this.history.knots,
      replay: [...this.snapshots, cloneWorld(this.world)],
      durationSeconds: Math.max(1, Math.round((performance.now() - this.startedAt) / 1000)),
      medicalLanded: this.medicalLanded,
      lowestLandingFuel: this.lowestLandingFuel,
      lettersFlown: this.letters.size,
      beaconPasses: this.mostBeaconPasses(),
      leftHolds: this.leftHolds,
    };
    const delay = outcome === 'lost' && !this.host.reducedMotion() ? 1400 : 500;
    window.setTimeout(() => this.host.onEnd(summary), delay);
  }

  private mostBeaconPasses(): number {
    return Math.max(0, ...[...this.beaconPasses.values()].map((passes) => passes.size));
  }

  private progress(): SkyProgress {
    return {
      arenaId: this.world.arena.id,
      safe: this.world.safe,
      landings: this.landings,
      longestString: this.effects.longestString,
      lowestLandingFuel: this.lowestLandingFuel,
      lettersFlown: this.letters.size,
      beaconPasses: this.mostBeaconPasses(),
      leftHolds: this.leftHolds,
    };
  }

  // —— drawing ——

  private flaggedLetters(): Set<number> {
    const flagged = new Set<number>();
    const loss = this.world.loss;
    if (loss) {
      flagged.add(loss.letter);
      if (loss.reason.kind === 'separation') flagged.add(loss.reason.other);
    }
    return flagged;
  }

  private draw(): void {
    const ghost: GhostRoute | null =
      this.drag?.active && this.drag.draft ? this.ghostOf(this.drag) : null;
    const scene: RadarScene = {
      world: this.world,
      forecast: this.ended ? { ...this.sky, conflicts: [] } : this.sky,
      look: lookFor(this.host.look() === 'scope'),
      tilt: this.tilt,
      focus: this.focus,
      tickProgress: this.ended || this.frozen ? 0 : Math.min(1, this.elapsed / this.tickSeconds()),
      time: this.time,
      selected: this.selected,
      ghost,
      ripples: this.effects.ripples,
      pearls: this.effects.pearls,
      stringQueue: this.ended ? [] : stringQueue(this.world, this.effects),
      bursts: this.effects.bursts,
      drain: this.drain,
      reducedMotion: this.host.reducedMotion(),
      showForecast: this.host.settings().prediction && !this.ended,
      flagged: this.flaggedLetters(),
      night: this.mode.kind === 'shift' && this.mode.shift.night,
      shapes: this.host.settings().shapes,
    };
    this.screen.radar.draw(scene);
  }

  private ghostOf(drag: Drag): GhostRoute {
    const draft = drag.draft!;
    const end = drag.sketch.end.cell;
    return {
      letter: drag.letter,
      cells: draft.cells,
      cursor: { x: end.x + 0.5, y: end.y + 0.5 },
      valid: draft.valid,
      label: draft.label,
    };
  }

  private renderPanels(): void {
    const context =
      this.mode.kind === 'shift'
        ? {
            context: `Shift ${this.mode.shift.number}`,
            title: this.mode.shift.title,
            target: this.mode.shift.target,
          }
        : this.mode.kind === 'daily'
          ? {
              context: `Daily Sky #${this.mode.sky.number}`,
              title: `Quarter ${Math.min(4, Math.floor(this.world.clock / 40) + 1)} of 4`,
              target: null,
            }
          : this.mode.kind === 'puzzle'
            ? {
                context: 'Puzzle',
                title: this.mode.puzzle.title,
                target: this.mode.puzzle.arrivals.length,
              }
            : this.mode.kind === 'tutorial'
              ? { context: 'Tutorial', title: 'Your first sky', target: TUTORIAL_ARRIVALS.length }
              : { context: 'Endless', title: this.world.arena.name, target: null };
    const speed = this.host.settings().speed;
    this.screen.renderBar({
      ...context,
      arena: this.world.arena.name,
      safe: this.world.safe,
      tick: this.world.clock,
      tickProgress: 0,
      string: this.effects.stringLength,
      speed:
        this.mode.kind === 'puzzle'
          ? `${this.orders} of par ${this.mode.puzzle.par}`
          : `${Math.round(this.tickSeconds() * 10) / 10} s a tick${speed === 'classic' ? '' : ` · ${speed}`}`,
    });
    this.screen.renderStrips(
      stripModels(this.world, this.sky, this.selected),
      this.world.air.length,
      this.world.ground.length,
    );
    if (!this.terminal) this.screen.renderFoot({ kind: 'hints', selected: this.selectedName() });
  }

  private selectedName(): string | null {
    const plane = this.selected === null ? undefined : findPlane(this.world, this.selected);
    return plane ? planeName(plane) : null;
  }

  // —— giving orders ——

  private plane(letter: number | null): Plane | undefined {
    return letter === null ? undefined : findPlane(this.world, letter);
  }

  private counted(letter: number): void {
    this.orders += 1;
    this.orderedLetters.add(letter);
    this.sky = forecast(this.world);
    this.host.sound.order();
    this.renderPanels();
    if (this.mode.kind === 'tutorial') this.followTutorial();
  }

  private refuse(message: string): void {
    this.host.sound.refused();
    this.showToast(message);
  }

  select(letter: number | null): void {
    this.selected = letter;
    this.renderPanels();
    this.placeBanner();
  }

  setAltitude(letter: number, altitude: number): void {
    const plane = this.plane(letter);
    if (!plane) return;
    const to = Math.max(plane.onGround ? 1 : 0, Math.min(CEILING, altitude));
    if (to === plane.targetAltitude) return;
    if (to === 0 && plane.destination.kind !== 'runway') {
      this.refuse(`${planeName(plane)} is not landing: keep it in the air`);
      return;
    }
    plane.targetAltitude = to;
    this.counted(letter);
  }

  setHeading(letter: number, heading: Heading): void {
    const plane = this.plane(letter);
    if (!plane) return;
    if (plane.onGround) {
      this.refuse(`${planeName(plane)} is on the ground: give it an altitude first`);
      return;
    }
    plane.route = [];
    plane.hold = null;
    plane.waitForBeacon = null;
    plane.targetHeading = heading;
    this.counted(letter);
  }

  setHold(letter: number, side: Hold): void {
    const plane = this.plane(letter);
    if (!plane) return;
    if (plane.onGround) {
      this.refuse(`${planeName(plane)} is on the ground and cannot hold`);
      return;
    }
    plane.route = [];
    plane.waitForBeacon = null;
    plane.hold = side;
    this.counted(letter);
  }

  private commitRoute(letter: number, draft: Draft): void {
    const plane = this.plane(letter);
    if (!plane || !draft.valid || draft.cells.length === 0) {
      if (draft.label) this.refuse(draft.label);
      return;
    }
    plane.route = draft.cells.map((c) => ({ ...c }));
    plane.hold = null;
    plane.waitForBeacon = null;
    this.counted(letter);
  }

  private toggleStatus(letter: number): void {
    const plane = this.plane(letter);
    if (!plane || plane.onGround) return;
    plane.status = plane.status === 'ignored' ? 'marked' : 'ignored';
    this.counted(letter);
  }

  giveTerminalOrder(order: Order): void {
    if (giveOrder(this.world, order)) {
      this.terminalOrders += 1;
      this.counted(order.letter);
    }
  }

  // —— pointer ——

  private pointToCell(event: PointerEvent | WheelEvent): Point | null {
    const box = this.screen.radar.canvas.getBoundingClientRect();
    return this.screen.radar.cellAt(
      this.world.arena,
      event.clientX - box.left,
      event.clientY - box.top,
    );
  }

  private planeUnder(event: PointerEvent | WheelEvent): number | null {
    const box = this.screen.radar.canvas.getBoundingClientRect();
    return this.screen.radar.planeAt(event.clientX - box.left, event.clientY - box.top);
  }

  private wirePointer(): void {
    const canvas = this.screen.radar.canvas;
    canvas.tabIndex = 0;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.listeners.push(() =>
        target.removeEventListener(type, handler as EventListener, options),
      );
    };
    on(canvas, 'contextmenu', (event) => event.preventDefault());
    on(canvas, 'pointerdown', (event) => this.pointerDown(event));
    on(window, 'pointermove', (event) => this.pointerMove(event));
    on(window, 'pointerup', (event) => this.pointerUp(event));
    on(canvas, 'wheel', (event) => this.wheel(event), { passive: false });
  }

  private pointerDown(event: PointerEvent): void {
    if (this.ended) return;
    this.closeRadial();
    if (event.button === 2) {
      if (this.drag) this.cancelDrag();
      else this.tiltTarget = 1;
      return;
    }
    if (event.button !== 0) return;
    const cell = this.pointToCell(event);
    if (this.directTarget !== null && cell) {
      const letter = this.directTarget;
      this.directTarget = null;
      const plane = this.plane(letter);
      if (plane)
        this.commitRoute(
          letter,
          draftRoute(
            this.world.arena,
            plane,
            extendSketch(startSketch(), featureAt(this.world.arena, cell, true)),
          ),
        );
      return;
    }
    const letter = this.planeUnder(event);
    if (letter === null) {
      this.select(null);
      return;
    }
    this.select(letter);
    this.drag = {
      letter,
      start: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
      sketch: startSketch(),
      draft: null,
      active: false,
      fromStrip: false,
    };
    window.clearTimeout(this.radialTimer);
    this.radialTimer = window.setTimeout(() => {
      if (this.drag && !this.drag.active) {
        const at = this.drag;
        this.drag = null;
        this.openRadial(at.letter, at.start);
      }
    }, RADIAL_DELAY);
  }

  private pointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (
      !drag.active &&
      Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < DRAG_THRESHOLD
    )
      return;
    drag.active = true;
    window.clearTimeout(this.radialTimer);
    const cell = this.pointToCell(event);
    const plane = this.plane(drag.letter);
    if (!cell || !plane) {
      drag.draft = null;
      return;
    }
    drag.sketch = extendSketch(
      drag.sketch,
      featureAt(this.world.arena, cell, this.host.settings().snapping),
    );
    drag.draft = draftRoute(this.world.arena, plane, drag.sketch);
  }

  private pointerUp(event: PointerEvent): void {
    if (event.button === 2) {
      this.tiltTarget = 0;
      return;
    }
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    window.clearTimeout(this.radialTimer);
    this.drag = null;
    this.screen.root.classList.remove('is-dragging-strip');
    if (drag.active && drag.draft) this.commitRoute(drag.letter, drag.draft);
  }

  private cancelDrag(): void {
    window.clearTimeout(this.radialTimer);
    this.drag = null;
    this.screen.root.classList.remove('is-dragging-strip');
  }

  private wheel(event: WheelEvent): void {
    event.preventDefault();
    if (this.ended) return;
    const now = performance.now();
    if (now < this.wheelBudget) return;
    this.wheelBudget = now + 90;
    const up = event.deltaY < 0;
    if (this.tilt > 0.5) {
      const cell = this.pointToCell(event);
      const zoom = Math.min(2.6, Math.max(1, (this.focus?.zoom ?? 1) + (up ? 0.25 : -0.25)));
      this.focus =
        zoom <= 1
          ? undefined
          : {
              x: cell?.x ?? this.world.arena.width / 2,
              y: cell?.y ?? this.world.arena.height / 2,
              altitude: 2,
              zoom,
            };
      return;
    }
    const letter = this.planeUnder(event) ?? this.selected;
    const plane = this.plane(letter);
    if (!plane || letter === null) return;
    this.selected = letter;
    this.setAltitude(letter, plane.targetAltitude + (up ? 1 : -1));
  }

  // —— the radial menu ——

  private openRadial(letter: number, at: Point): void {
    const plane = this.plane(letter);
    if (!plane) return;
    const name = planeName(plane);
    const box = this.screen.root.getBoundingClientRect();
    const item = (label: string, run: () => void, angle: number) => {
      const button = h(
        'button',
        { type: 'button', class: 'sk-radial__item', style: `--angle:${angle}deg` },
        label,
      );
      button.addEventListener('click', () => {
        this.closeRadial();
        run();
      });
      return button;
    };
    const menu = h(
      'div',
      {
        class: 'sk-radial',
        role: 'menu',
        'aria-label': `Orders for ${name}`,
        style: `left:${at.x - box.left}px;top:${at.y - box.top}px`,
      },
      h('span', { class: 'sk-radial__name' }, name),
      item('Hold left', () => this.setHold(letter, 'left'), 210),
      item('Hold right', () => this.setHold(letter, 'right'), 330),
      item('Climb', () => this.setAltitude(letter, plane.targetAltitude + 1), 270),
      item('Descend', () => this.setAltitude(letter, plane.targetAltitude - 1), 90),
      item(
        'Direct to…',
        () => {
          this.directTarget = letter;
          this.showToast(`Click where ${name} should fly`);
        },
        30,
      ),
      item(plane.status === 'ignored' ? 'Mark' : 'Ignore', () => this.toggleStatus(letter), 150),
    );
    this.screen.root.append(menu);
    this.radial = menu;
    (menu.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private closeRadial(): void {
    this.radial?.remove();
    this.radial = null;
  }

  // —— strips: click to select, drag onto the radar to clear a plane there ——

  private wireStrips(): void {
    const board = this.screen.root.querySelector('.sk-board') as HTMLElement;
    const down = (event: PointerEvent) => {
      const strip = (event.target as HTMLElement).closest<HTMLElement>('[data-letter]');
      if (!strip || event.button !== 0) return;
      const letter = strip.dataset.letter!.toLowerCase().charCodeAt(0) - 97;
      this.select(letter);
      this.drag = {
        letter,
        start: { x: event.clientX, y: event.clientY },
        pointerId: event.pointerId,
        sketch: startSketch(),
        draft: null,
        active: false,
        fromStrip: true,
      };
      this.screen.root.classList.add('is-dragging-strip');
    };
    // With a strip list focused, the arrow keys walk the selection through the board and the bay.
    const arrows = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const strips = [...board.querySelectorAll<HTMLElement>('[role="option"][data-letter]')];
      if (strips.length === 0) return;
      event.preventDefault();
      const letters = strips.map((strip) => strip.dataset.letter!.toLowerCase().charCodeAt(0) - 97);
      const at = this.selected === null ? -1 : letters.indexOf(this.selected);
      const next =
        event.key === 'ArrowDown'
          ? (at + 1) % letters.length
          : (at - 1 + letters.length) % letters.length;
      this.select(letters[next]!);
      const strip = board.querySelector<HTMLElement>(
        `[data-letter="${strips[next]!.dataset.letter}"]`,
      );
      const box = strip?.closest<HTMLElement>('[role="listbox"]');
      if (box && box !== document.activeElement) box.focus();
      strip?.scrollIntoView({ block: 'nearest' });
    };
    board.addEventListener('pointerdown', down);
    board.addEventListener('keydown', arrows);
    this.listeners.push(() => {
      board.removeEventListener('pointerdown', down);
      board.removeEventListener('keydown', arrows);
    });
  }

  // —— keyboard ——

  private wireKeys(): void {
    const keydown = (event: KeyboardEvent) => this.keyDown(event);
    const keyup = (event: KeyboardEvent) => this.keyUp(event);
    // Escape while drawing a route cancels the route, before the Hall reads it as a pause.
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        (this.drag?.active || this.radial || this.directTarget !== null)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.cancelDrag();
        this.closeRadial();
        this.directTarget = null;
      }
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    this.listeners.push(() => {
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    });
  }

  private keyDown(event: KeyboardEvent): void {
    if (
      this.ended ||
      this.paused ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, .sk-card, .sk-radial')) return;
    if (this.remappedKey(event, target)) return;
    const key = event.key;
    if (key === 'Enter') {
      this.select(null);
      return;
    }
    const selected = this.plane(this.selected);
    if (selected && !event.shiftKey) {
      const heading = HEADING_KEYS.indexOf(key as (typeof HEADING_KEYS)[number]);
      if (heading >= 0) {
        event.preventDefault();
        this.setHeading(selected.letter, heading as Heading);
        return;
      }
      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        this.setAltitude(selected.letter, Number(key));
        return;
      }
    }
    if (/^[a-zA-Z]$/.test(key)) {
      const letter = key.toLowerCase().charCodeAt(0) - 97;
      if (findPlane(this.world, letter)) {
        event.preventDefault();
        this.select(letter);
      }
    }
  }

  /** Called when the Hall's bindings change, so the hints show the keys as they are now. */
  refreshKeys(): void {
    const keys = this.host.keys();
    this.screen.setKeyLabels({
      nextTick: keys.label('next-tick'),
      nextPlane: keys.label('next-plane'),
      terminal: keys.label('terminal'),
      holdLeft: keys.label('hold-left'),
      holdRight: keys.label('hold-right'),
    });
    if (!this.terminal) this.screen.renderFoot({ kind: 'hints', selected: this.selectedName() });
  }

  /** The keys the Hall lets a player remap; true when the key was one of them. */
  private remappedKey(event: KeyboardEvent, target: HTMLElement | null): boolean {
    const action = this.host.keys().actionFor(event);
    switch (action) {
      case 'next-tick':
        event.preventDefault();
        this.requestTick();
        return true;
      case 'terminal':
        event.preventDefault();
        this.toggleTerminal(!this.terminal);
        return true;
      case 'next-plane':
        if (target !== this.screen.radar.canvas) return false;
        event.preventDefault();
        this.cycle(event.shiftKey ? -1 : 1);
        return true;
      case 'hold-left':
      case 'hold-right': {
        const selected = this.plane(this.selected);
        if (!selected) return false;
        event.preventDefault();
        this.setHold(selected.letter, action === 'hold-left' ? 'left' : 'right');
        return true;
      }
      case 'tilt':
        // Holding the tilt key tilts the sky; a quick tap of a letter key still selects that plane.
        event.preventDefault();
        if (event.repeat) return true;
        window.clearTimeout(this.tiltKeyTimer);
        this.tiltKeyHeld = false;
        this.tiltKeyTimer = window.setTimeout(() => {
          this.tiltKeyHeld = true;
          this.tiltTarget = 1;
        }, TILT_HOLD_DELAY);
        return true;
      default:
        return false;
    }
  }

  private keyUp(event: KeyboardEvent): void {
    if (this.host.keys().actionFor(event) !== 'tilt') return;
    window.clearTimeout(this.tiltKeyTimer);
    if (this.tiltKeyHeld) {
      this.tiltKeyHeld = false;
      this.tiltTarget = 0;
      return;
    }
    if (!/^Key[A-Z]$/.test(event.code)) return;
    const letter = event.code.charCodeAt(3) - 65;
    if (findPlane(this.world, letter)) this.select(letter);
  }

  /** Tab walks the strips from the most urgent down. */
  private cycle(direction: 1 | -1): void {
    const order = stripModels(this.world, this.sky, this.selected).map((m) => m.letter);
    if (order.length === 0) return;
    const at = this.selected === null ? -1 : order.indexOf(this.selected);
    const next = (at + direction + order.length) % order.length;
    this.select(order[next]!);
  }

  // —— Terminal mode ——

  toggleTerminal(on: boolean): void {
    if (on && !this.terminal) {
      this.terminal = new TerminalBar(this.screen, {
        read: (typed) => readLine(this.world, typed),
        order: (order) => this.giveTerminalOrder(order),
        tick: () => this.requestTick(),
        shell: () => this.openShell(),
      });
      this.terminal.focus();
    } else if (!on && this.terminal) {
      this.terminal.destroy();
      this.terminal = null;
      this.renderPanels();
      this.screen.radar.canvas.focus();
    }
  }

  get terminalOn(): boolean {
    return this.terminal !== null;
  }

  /** The 1986 game's `!` opened a real shell and stopped the clock; here a small one opens. */
  private openShell(): void {
    this.paused = true;
    this.host.onShell();
    const lines = h(
      'pre',
      { class: 'sk-shell__screen' },
      `$ whoami\ncontroller\n$ uptime\nthe sky waited for you\n$ exit`,
    );
    const close = h(
      'button',
      { type: 'button', class: 'sk-button sk-button--primary' },
      'Back to the sky',
    );
    const shell = h(
      'div',
      { class: 'sk-shell', role: 'dialog', 'aria-label': 'A small shell' },
      lines,
      close,
    );
    close.addEventListener('click', () => {
      shell.remove();
      this.paused = false;
      this.terminal?.focus();
    });
    this.screen.root.append(shell);
    close.focus();
  }

  // —— messages ——

  showBanner(title: string, body: string, action?: { label: string; run: () => void }): void {
    this.banner?.remove();
    const banner = h(
      'div',
      { class: 'sk-banner', role: 'status' },
      h('strong', {}, title),
      h('span', {}, body),
    );
    if (action) {
      const button = h(
        'button',
        { type: 'button', class: 'sk-button sk-button--primary' },
        action.label,
      );
      button.addEventListener('click', action.run);
      banner.append(button);
    }
    this.screen.overlay.append(banner);
    this.banner = banner;
    this.placeBanner();
  }

  /** Keeps a banner off the plane it is about: at the top, or at the bottom when that plane is high. */
  private placeBanner(): void {
    if (!this.banner) return;
    const plane = this.plane(this.bannerSubject());
    this.banner.classList.toggle(
      'is-low',
      plane !== undefined && plane.y < this.world.arena.height / 2,
    );
  }

  private bannerSubject(): number | null {
    switch (this.tutorialStep) {
      case 'route-to-gate':
        return 0;
      case 'route-to-runway':
        return 1;
      case 'conflict':
      case 'part-them':
        return 2;
      default:
        return this.selected;
    }
  }

  hideBanner(): void {
    this.banner?.remove();
    this.banner = null;
  }

  showToast(message: string): void {
    const toast = h('div', { class: 'sk-toast', role: 'status' }, message);
    this.screen.overlay.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  // —— the tutorial ——

  private setTutorialStep(step: TutorialStep): void {
    this.tutorialStep = step;
    this.tutorialSeen.add(step);
    this.host.onTutorialStep?.(step, this, this.conflictPair());
    // Steps that ask for an action hold the clock until it is done.
    this.frozen = step === 'route-to-gate' || step === 'route-to-runway' || step === 'conflict';
  }

  private conflictPair(): string {
    const first = this.sky.conflicts[0];
    if (!first) return 'Two planes';
    const name = (letter: number) => {
      const plane = findPlane(this.world, letter);
      return plane ? planeName(plane) : '?';
    };
    return `${name(first.a)} and ${name(first.b)}`;
  }

  /** Each step is shown once, in order; a step that asks for an order ends when its plane has one. */
  private followTutorial(): void {
    const here = (letter: number) => findPlane(this.world, letter) !== undefined;
    const handled = (letter: number) => this.orderedLetters.has(letter) || !here(letter);
    const conflict = this.sky.conflicts.length > 0;
    const step = this.tutorialStep;
    let next = step;
    if (step === 'route-to-gate' && handled(0)) next = 'let-time-run';
    else if (step === 'route-to-runway' && handled(1)) next = 'let-time-run';
    else if (step === 'part-them' && !conflict) next = 'finish';
    else if (step === 'let-time-run' && here(1) && !this.tutorialSeen.has('route-to-runway'))
      next = 'route-to-runway';
    else if (step === 'let-time-run' && here(2) && conflict && !this.tutorialSeen.has('conflict'))
      next = 'conflict';
    if (next !== step && next !== null) this.setTutorialStep(next);
    const everyoneHome = TUTORIAL_ARRIVALS.every((_, letter) => !here(letter));
    if (this.world.clock > 3 && everyoneHome && this.world.safe >= TUTORIAL_ARRIVALS.length)
      this.end('solved');
  }

  /** The tutorial's "Next" after reading about the ring. */
  tutorialNext(): void {
    if (this.tutorialStep === 'conflict') this.setTutorialStep('part-them');
  }

  // —— pause, appearance, teardown ——

  pause(): void {
    this.paused = true;
    this.cancelDrag();
    this.closeRadial();
    this.tiltTarget = 0;
    this.host.sound.hum(false);
    if (this.mode.kind === 'daily' && !this.ended) {
      // The daily sky hides while paused, so a break cannot be used to plan.
      this.breakScreen = h(
        'div',
        { class: 'sk-break', role: 'status' },
        h('strong', {}, 'Tower on break'),
        h('span', {}, 'The Daily Sky waits behind the blinds until you resume.'),
      );
      this.screen.radarHost.append(this.breakScreen);
      this.screen.root.classList.add('is-on-break');
    }
  }

  resume(): void {
    this.paused = false;
    this.lastFrame = performance.now();
    this.breakScreen?.remove();
    this.breakScreen = null;
    this.screen.root.classList.remove('is-on-break');
    if (!this.ended) this.host.sound.hum(true);
  }

  setLook(look: LookId): void {
    this.screen.setLook(look);
  }

  get isEnded(): boolean {
    return this.ended;
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.radialTimer);
    window.clearTimeout(this.tiltKeyTimer);
    this.host.sound.hum(false);
    for (const stop of this.listeners) stop();
    this.terminal?.destroy();
    this.screen.root.remove();
  }

  // —— the top bar's own buttons ——

  private wireBar(): void {
    this.screen.onGameMenu(() => this.host.onExit());
  }
}
