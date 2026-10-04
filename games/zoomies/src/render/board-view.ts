import { chebyshev } from '../engine/layout';
import { applyAction, isDangerous, isFree, nextStep, whiskers } from '../engine/rules';
import type { Point, RoomState, Tangle, TurnEvent, Vacuum, VacuumKind } from '../engine/types';
import { follow, frameRoom, type View, viewFor } from './camera';
import { DustLayer } from './dust';
import { DISPLAY_FONT, Effects, star } from './effects';
import { paintStatic } from './floor';
import { cellAt, cellCenter, type Geometry } from './geometry';
import {
  type Coat,
  LOOKS,
  type Look,
  type SceneLook,
  type SceneTheme,
  vacuumColors,
} from './palette';
import { bounce, closeness, dimming, PAYOFF, starsAlpha, stretch, trailProgress } from './payoff';
import { clamp01, easeInOut, hash2, lerp, withAlpha } from './shapes';
import { type CatPose, drawCat } from './sprites/cat';
import { drawDock, drawTangle } from './sprites/things';
import { drawSnooze, drawVacuum, type Mood } from './sprites/vacuum';
import { drawTrails, TrailLog } from './trails';

/**
 * Draws a room and plays each turn as a short animation read from the turn's events: the cat
 * moves, the vacuums roll, bonks pop, tangles appear. The rules never wait for the drawing;
 * the view simply catches up, and a new turn can cut the current animation short.
 */

export interface BoardOptions {
  look: Look;
  theme: SceneTheme;
  coat: Coat;
  reducedMotion: boolean;
  /** Multiplies every animation's length: larger is calmer. */
  pace: number;
  whiskers: boolean;
}

interface Track {
  from: Point;
  to: Point;
  t0: number;
  t1: number;
}

interface Cue {
  at: number;
  run: () => void;
}

interface Animation {
  start: number;
  end: number;
  prev: RoomState;
  next: RoomState;
  cat: { from: Point; to: Point; end: number; kind: 'step' | 'zoom' | 'wait' };
  vacuums: Map<number, Track[]>;
  deaths: Map<number, number>;
  appear: Map<string, number>;
  vanish: Map<string, number>;
  cues: Cue[];
  done: () => void;
}

type TrailMark =
  | { kind: 'sweep'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'paw'; x: number; y: number; facing: number };

/** The room-cleared payoff in progress (see `payoff.ts` for its timeline). */
interface Payoff {
  start: number;
  /** Where the last vacuum bonked, if it did: the pile that bounces. */
  pile: Point | null;
  cues: Cue[];
  done: () => void;
}

/** The keyboard focus cue's colours: the Hall's focus blue by day and by night. */
const FOCUS = { day: '#2459a8', night: '#8ec5ff' } as const;

const BASE = { step: 130, zoom: 300, wait: 90, roll: 180, turbo: 150 };

const key = (p: Point) => `${p.x},${p.y}`;

export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private staticCanvas = document.createElement('canvas');
  private dust: DustLayer | null = null;
  private geo: Geometry | null = null;
  private scene: SceneLook;
  private effects: Effects;
  private state: RoomState | null = null;
  private anim: Animation | null = null;
  private trail: TrailMark[] = [];
  private lastSwept = new Map<number, Point>();
  private facing: -1 | 1 = 1;
  private hover: Point | null = null;
  private loafing = false;
  private ghost: Coat | null = null;
  private trails = new TrailLog();
  /** How much of the trails shows between moments: none during play, all once revealed. */
  private trailsShown = 0;
  private trailReveal: { start: number; duration: number } | null = null;
  private payoff: Payoff | null = null;
  private lastBonk: Point | null = null;
  private follows = false;
  private wholeRoom = false;
  private view: View = { x: 0, y: 0 };
  private focused = false;
  private shake: { start: number } | null = null;
  private frame = 0;
  private running = false;
  private seed = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private danger: Set<string> = new Set();
  private nearby: { dx: number; dy: number; verdict: string }[] = [];
  private moods = new Map<number, Mood>();
  private hatch: { key: string; tile: HTMLCanvasElement } | null = null;
  private lastDraw = 0;
  private vignette: HTMLCanvasElement | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private options: BoardOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.scene = LOOKS[options.theme][options.look];
    this.effects = new Effects(options.look);
  }

  // -------------------------------------------------------------------------------------------
  // Setup

  setRoom(state: RoomState, theme: SceneTheme, seed: number) {
    this.finish();
    this.state = state;
    this.options.theme = theme;
    this.scene = LOOKS[theme][this.options.look];
    this.seed = seed;
    this.trail = [];
    this.trails.clear();
    this.lastBonk = null;
    this.lastSwept.clear();
    this.endMoments();
    this.shake = null;
    this.loafing = false;
    this.facing = 1;
    this.effects.clear();
    this.repaint();
    this.refreshHints();
  }

  /** Jumps to a state without animating (undo, replays, resuming). Keeps the floor's trails. */
  showState(state: RoomState) {
    this.finish();
    this.state = state;
    this.endMoments();
    this.refreshHints();
  }

  /** Back to plain play: no payoff or reveal running, the trails hidden again. */
  private endMoments() {
    const payoff = this.payoff;
    this.payoff = null;
    payoff?.done();
    this.trailReveal = null;
    this.trailsShown = 0;
  }

  resize(width: number, height: number) {
    if (width === this.cssWidth && height === this.cssHeight) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.repaint();
  }

  setOptions(patch: Partial<BoardOptions>) {
    const lookChanged = patch.look !== undefined && patch.look !== this.options.look;
    this.options = { ...this.options, ...patch };
    if (lookChanged) {
      this.scene = LOOKS[this.options.theme][this.options.look];
      this.effects.setLook(this.options.look);
      this.repaint();
    }
    this.refreshHints();
  }

  setHover(cell: Point | null) {
    this.hover = cell;
  }

  /** Whether the board has the keyboard's focus: the cat and the chosen square show it. */
  setFocused(focused: boolean) {
    this.focused = focused;
  }

  /** For a room too big to show at full size: follow the cat, or show the whole room smaller. */
  setWholeRoom(wholeRoom: boolean) {
    if (wholeRoom === this.wholeRoom) return;
    this.wholeRoom = wholeRoom;
    this.repaint();
  }

  /** True when the room is bigger than the view at the cat's smallest size. */
  get roomOutgrowsView(): boolean {
    if (!this.state || this.cssWidth === 0) return false;
    const { width, height } = this.state.layout;
    return frameRoom(width, height, this.cssWidth, this.cssHeight, {
      maxCell: width > 30 ? 40 : 84,
      margin: width > 30 ? 0.5 : 0.9,
      wholeRoom: false,
    }).follows;
  }

  setLoafing(loafing: boolean) {
    this.loafing = loafing;
  }

  /** Draw the cat in a rival's coat, as a faded replay. */
  setGhost(coat: Coat | null) {
    this.ghost = coat;
  }

  cellFromClient(clientX: number, clientY: number): Point | null {
    if (!this.geo) return null;
    const rect = this.canvas.getBoundingClientRect();
    return cellAt(this.geo, clientX - rect.left + this.view.x, clientY - rect.top + this.view.y);
  }

  /** Where a cell's centre is on the page, for placing labels over the board. */
  cellToClient(x: number, y: number): Point | null {
    if (!this.geo) return null;
    const rect = this.canvas.getBoundingClientRect();
    const c = cellCenter(this.geo, x, y);
    return { x: rect.left + c.x - this.view.x, y: rect.top + c.y - this.view.y };
  }

  get cellSize(): number {
    return this.geo?.cell ?? 0;
  }

  private ratio(): number {
    return Math.min(2, window.devicePixelRatio || 1);
  }

  private repaint() {
    if (!this.state || this.cssWidth === 0) return;
    const ratio = this.ratio();
    this.canvas.width = Math.round(this.cssWidth * ratio);
    this.canvas.height = Math.round(this.cssHeight * ratio);
    const { width, height } = this.state.layout;
    const framing = frameRoom(width, height, this.cssWidth, this.cssHeight, {
      maxCell: width > 30 ? 40 : 84,
      margin: width > 30 ? 0.5 : 0.9,
      wholeRoom: this.wholeRoom,
    });
    this.geo = framing.geo;
    this.follows = framing.follows;
    const floorRatio = this.floorRatio(this.geo);
    paintStatic(
      this.staticCanvas,
      this.geo,
      this.scene,
      this.state.layout.furniture,
      this.options.look,
      floorRatio,
    );
    const still = this.staticCanvas.getContext('2d')!;
    still.setTransform(floorRatio, 0, 0, floorRatio, 0, 0);
    this.drawLight(still, this.geo);
    this.vignette = this.options.look === 'night' ? this.paintVignette(ratio) : null;
    this.dust = new DustLayer(this.geo, this.scene, this.options.look, floorRatio, this.seed);
    for (const mark of this.trail) this.replayMark(mark);
    const cat = this.state.cat;
    this.view = viewFor(
      cellCenter(this.geo, cat.x, cat.y),
      this.geo,
      this.cssWidth,
      this.cssHeight,
    );
  }

  /** A floor bigger than the view is painted a little softer past nine megapixels, to spare memory. */
  private floorRatio(geo: Geometry): number {
    return Math.min(this.ratio(), Math.sqrt(9_000_000 / (geo.width * geo.height)));
  }

  private replayMark(mark: TrailMark) {
    if (!this.geo || !this.dust) return;
    if (mark.kind === 'sweep') {
      const a = cellCenter(this.geo, mark.x1, mark.y1);
      const b = cellCenter(this.geo, mark.x2, mark.y2);
      this.dust.sweep(a.x, a.y, b.x, b.y);
    } else {
      const c = cellCenter(this.geo, mark.x, mark.y);
      this.dust.paw(c.x, c.y, mark.facing);
    }
  }

  private mark(mark: TrailMark) {
    this.trail.push(mark);
    this.replayMark(mark);
  }

  // -------------------------------------------------------------------------------------------
  // Hints read from the current state: danger, moods, the nine options

  private refreshHints() {
    const state = this.state;
    this.danger.clear();
    this.moods.clear();
    this.nearby = [];
    if (!state || state.status !== 'playing') return;
    const catchers = new Set<number>();
    for (const event of applyAction(state, { type: 'step', dx: 0, dy: 0 }).events) {
      if (event.type === 'caught') event.by.forEach((id) => catchers.add(id));
    }
    for (const v of state.vacuums) {
      if (!v.alive) continue;
      const reach = v.kind === 'turbo' ? 3 : 2;
      this.moods.set(
        v.id,
        catchers.has(v.id) ? 'danger' : chebyshev(v, state.cat) <= reach ? 'alert' : 'calm',
      );
    }
    if (!this.options.whiskers) return;
    this.nearby = whiskers(state);
    const alive = state.vacuums.filter((v) => v.alive);
    for (let y = 0; y < state.layout.height; y++) {
      for (let x = 0; x < state.layout.width; x++) {
        const near = alive.some(
          (v) => Math.max(Math.abs(v.x - x), Math.abs(v.y - y)) <= (v.kind === 'turbo' ? 2 : 1),
        );
        if (near && isFree(state, x, y) && isDangerous(state, x, y)) this.danger.add(`${x},${y}`);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Turn animation

  private duration(base: number): number {
    if (this.options.reducedMotion) return 1;
    return base * this.options.pace;
  }

  animateTurn(prev: RoomState, next: RoomState, events: readonly TurnEvent[]): Promise<void> {
    this.finish();
    const now = performance.now();
    const catEvent = events.find(
      (e) => e.type === 'cat-step' || e.type === 'cat-zoom' || e.type === 'cat-wait',
    );
    const catKind =
      catEvent?.type === 'cat-zoom' ? 'zoom' : catEvent?.type === 'cat-step' ? 'step' : 'wait';
    const catEnd = this.duration(BASE[catKind]);
    const phase1End = catEnd + this.duration(BASE.roll);
    const phase2End = phase1End + this.duration(BASE.turbo);
    const anim: Animation = {
      start: now,
      end: catEnd,
      prev,
      next,
      cat: { from: prev.cat, to: next.cat, end: catEnd, kind: catKind },
      vacuums: new Map(),
      deaths: new Map(),
      appear: new Map(),
      vanish: new Map(),
      cues: [],
      done: () => undefined,
    };
    let phaseEnd = catEnd;
    this.recordTrails(events);
    const tangledThisTurn = events
      .filter((e) => e.type === 'bonk')
      .reduce((sum, e) => sum + (e.type === 'bonk' ? e.ids.length : 0), 0);
    for (const event of events) {
      switch (event.type) {
        case 'cat-step':
          if (event.to.x !== event.from.x) this.facing = event.to.x > event.from.x ? 1 : -1;
          anim.cues.push({
            at: catEnd,
            run: () => this.mark({ kind: 'paw', ...event.to, facing: this.facing }),
          });
          break;
        case 'cat-zoom':
          anim.cues.push({ at: 0, run: () => this.zoomEffect(event.from, event.to) });
          break;
        case 'vacuum-move': {
          const t0 = event.phase === 1 ? catEnd : phase1End;
          const t1 = event.phase === 1 ? phase1End : phase2End;
          phaseEnd = Math.max(phaseEnd, t1);
          const tracks = anim.vacuums.get(event.id) ?? [];
          tracks.push({ from: event.from, to: event.to, t0, t1 });
          anim.vacuums.set(event.id, tracks);
          break;
        }
        case 'bonk': {
          const at = event.phase === 1 ? phase1End : phase2End;
          phaseEnd = Math.max(phaseEnd, at);
          this.lastBonk = event.at;
          for (const id of event.ids) anim.deaths.set(id, at);
          anim.appear.set(key(event.at), at);
          const heavy = tangledThisTurn >= 3;
          anim.cues.push({
            at,
            run: () => this.bonkEffect(event.at, event.onTangle !== null, heavy),
          });
          break;
        }
        case 'gulp':
          anim.vanish.set(key(event.at), phase1End);
          anim.cues.push({ at: phase1End, run: () => this.wordAt(event.at, 'Gulp!', '#ffe7a8') });
          break;
        case 'dock-spawn':
          anim.cues.push({ at: phaseEnd, run: () => this.puffAt(event.at) });
          break;
        case 'caught':
          anim.cues.push({ at: phaseEnd, run: () => this.caughtEffect(event.at) });
          break;
        case 'safe-zoom-earned':
          anim.cues.push({ at: phaseEnd, run: () => this.sparkleAt(next.cat, '#ffd75e') });
          break;
        default:
          break;
      }
    }
    anim.end = Math.max(phaseEnd, catEnd);
    this.lastSwept.clear();
    for (const v of prev.vacuums) if (v.alive) this.lastSwept.set(v.id, { x: v.x, y: v.y });
    this.state = next;
    this.anim = anim;
    this.refreshHints();
    return new Promise((resolve) => {
      anim.done = resolve;
      if (!this.running) this.finish();
    });
  }

  /** Notes every roll of a turn for the reveal, in the order the vacuums rolled. */
  private recordTrails(events: readonly TurnEvent[]) {
    const rolls: { phase: 1 | 2; from: Point; to: Point }[] = [];
    for (const event of events)
      if (event.type === 'vacuum-move')
        rolls.push({ phase: event.phase === 1 ? 1 : 2, from: event.from, to: event.to });
    this.trails.addTurn(rolls);
  }

  /** Leaves a turn's marks on the floor without playing it (rebuilding trails after a replay). */
  traceTurn(events: readonly TurnEvent[]) {
    this.recordTrails(events);
    for (const event of events) {
      if (event.type === 'vacuum-move')
        this.mark({
          kind: 'sweep',
          x1: event.from.x,
          y1: event.from.y,
          x2: event.to.x,
          y2: event.to.y,
        });
      if (event.type === 'cat-step') {
        if (event.to.x !== event.from.x) this.facing = event.to.x > event.from.x ? 1 : -1;
        this.mark({ kind: 'paw', ...event.to, facing: this.facing });
      }
    }
  }

  /** Ends the current animation at once, firing anything it still owed. */
  finish() {
    const anim = this.anim;
    if (!anim) return;
    for (const cue of anim.cues) cue.run();
    anim.cues = [];
    this.sweepTo(anim, Infinity);
    this.anim = null;
    anim.done();
  }

  private sweepTo(anim: Animation, elapsed: number) {
    for (const [id, tracks] of anim.vacuums) {
      const at = this.trackPosition(tracks, elapsed);
      const last = this.lastSwept.get(id);
      if (last && (Math.abs(last.x - at.x) > 0.01 || Math.abs(last.y - at.y) > 0.01)) {
        this.mark({ kind: 'sweep', x1: last.x, y1: last.y, x2: at.x, y2: at.y });
      }
      this.lastSwept.set(id, at);
    }
  }

  private trackPosition(tracks: readonly Track[], elapsed: number): Point {
    let position = tracks[0]!.from;
    for (const track of tracks) {
      if (elapsed <= track.t0) return position;
      const t = easeInOut(clamp01((elapsed - track.t0) / Math.max(1, track.t1 - track.t0)));
      position = { x: lerp(track.from.x, track.to.x, t), y: lerp(track.from.y, track.to.y, t) };
      if (elapsed < track.t1) return position;
      position = track.to;
    }
    return position;
  }

  // -------------------------------------------------------------------------------------------
  // Moments

  /**
   * The rug remembers: the sprites dim and the trails draw themselves on, turn by turn. Used
   * after a rival's replay; the player's own clear gets the whole payoff (`celebrate`).
   */
  revealTrails(): Promise<void> {
    this.finish();
    this.payoff = null;
    const duration = this.options.reducedMotion ? 1 : 900;
    this.trailReveal = { start: performance.now(), duration };
    return new Promise((resolve) =>
      setTimeout(() => {
        this.trailsShown = 1;
        resolve();
      }, duration),
    );
  }

  /**
   * The room is tidy and the last vacuum has arrived: the camera eases in on the cat and the
   * pile, the cat stretches with a "mrrp", the pile bounces under dizzy stars, then the trails
   * draw onto the rug. Resolves when it is over or skipped. Under reduced motion it is a still
   * of the tangle with the trails already drawn.
   */
  celebrate(cues: { mrrp(): void }): Promise<void> {
    this.finish();
    this.trailReveal = null;
    const still = this.options.reducedMotion;
    return new Promise((resolve) => {
      const payoff: Payoff = {
        start: performance.now() - (still ? PAYOFF.end : 0),
        pile: this.lastBonk,
        cues: still
          ? []
          : [
              { at: PAYOFF.mrrp, run: cues.mrrp },
              { at: PAYOFF.mrrp, run: () => this.mrrpWord() },
            ],
        done: () => undefined,
      };
      let settled = false;
      payoff.done = () => {
        if (settled) return;
        settled = true;
        this.trailsShown = 1;
        resolve();
      };
      this.payoff = payoff;
      // The still version holds for a moment too, so the tangle and its trails can be seen.
      setTimeout(() => payoff.done(), still ? 700 : PAYOFF.end);
    });
  }

  /** Jumps a running payoff to its last frame. */
  skipCelebration() {
    const payoff = this.payoff;
    if (!payoff) return;
    payoff.start = performance.now() - PAYOFF.end;
    payoff.cues = [];
    payoff.done();
  }

  get celebrating(): boolean {
    const payoff = this.payoff;
    return payoff !== null && performance.now() - payoff.start < PAYOFF.end;
  }

  private mrrpWord() {
    if (!this.geo || !this.state) return;
    const c = this.center(this.state.cat);
    const s = this.geo.cell;
    const isDay = this.options.look === 'day';
    this.effects.word(
      performance.now(),
      c.x + this.facing * s * 0.45,
      c.y - s * 0.55,
      s * 0.95,
      'mrrp',
      isDay ? '#fff6d6' : '#2a2448',
      isDay ? '#3a2a1a' : '#ffe6a0',
    );
  }

  private center(p: Point) {
    return cellCenter(this.geo!, p.x, p.y);
  }

  private zoomEffect(from: Point, to: Point) {
    if (!this.geo) return;
    const a = this.center(from);
    const b = this.center(to);
    const s = this.geo.cell;
    this.effects.puff(performance.now(), a.x, a.y + s * 0.2, s);
    if (!this.options.reducedMotion)
      this.effects.streak(performance.now(), a, b, s, this.options.coat.fur);
    this.effects.puff(performance.now() + 200, b.x, b.y + s * 0.2, s);
  }

  private bonkEffect(at: Point, onTangle: boolean, heavy: boolean) {
    if (!this.geo) return;
    const c = this.center(at);
    const s = this.geo.cell;
    const now = performance.now();
    this.effects.puff(now, c.x, c.y, s * 1.2);
    if (!this.options.reducedMotion) this.effects.sparkle(now, c.x, c.y - s * 0.3, s, '#ffd75e');
    const text = heavy ? 'Pile-up!' : onTangle ? 'Stuck!' : 'Bonk!';
    this.effects.word(
      now,
      c.x,
      c.y,
      s * 1.5,
      text,
      this.options.look === 'day' ? '#fff6d6' : '#2a2448',
      this.options.look === 'day' ? '#3a2a1a' : '#ffe6a0',
    );
  }

  private wordAt(at: Point, text: string, fill: string) {
    if (!this.geo) return;
    const c = this.center(at);
    this.effects.word(performance.now(), c.x, c.y, this.geo.cell * 1.4, text, fill, '#3a2a1a');
  }

  private puffAt(at: Point) {
    if (!this.geo) return;
    const c = this.center(at);
    this.effects.puff(performance.now(), c.x, c.y + this.geo.cell * 0.2, this.geo.cell);
  }

  private sparkleAt(at: Point, color: string) {
    if (!this.geo) return;
    const c = this.center(at);
    this.effects.sparkle(
      performance.now(),
      c.x,
      c.y - this.geo.cell * 0.3,
      this.geo.cell * 1.2,
      color,
    );
  }

  private caughtEffect(at: Point) {
    if (!this.geo) return;
    const c = this.center(at);
    this.effects.fur(performance.now(), c.x, c.y, this.geo.cell * 1.4, this.options.coat.fur);
    if (!this.options.reducedMotion) this.shake = { start: performance.now() };
  }

  // -------------------------------------------------------------------------------------------
  // The frame loop

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.draw(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.finish();
  }

  /** Draws one frame now (for posters and screenshots). */
  drawOnce(now = performance.now()) {
    this.draw(now);
  }

  destroy() {
    this.stop();
  }

  private draw(now: number) {
    const geo = this.geo;
    const state = this.state;
    const ctx = this.ctx;
    if (!geo || !state || !this.dust) return;
    const anim = this.anim;
    const payoff = this.payoff;
    const payoffT = payoff ? now - payoff.start : null;
    const reveal = this.trailReveal;
    const elapsed = anim ? now - anim.start : Infinity;
    const target = this.follows
      ? viewFor(this.catCentre(state, anim, elapsed), geo, this.cssWidth, this.cssHeight)
      : { x: 0, y: 0 };
    const panning =
      Math.abs(target.x - this.view.x) > 0.5 || Math.abs(target.y - this.view.y) > 0.5;
    // Between turns only blinks and tails move: a calmer frame rate is plenty, and big fields
    // (the Long Night's) get calmer still.
    const settling =
      anim ||
      this.effects.busy ||
      this.shake ||
      panning ||
      (payoffT !== null && payoffT < PAYOFF.end) ||
      (reveal && now - reveal.start < reveal.duration);
    const idleGap = geo.cols * geo.rows > 400 ? 90 : 33;
    if (!settling && now - this.lastDraw < idleGap) return;
    const dt = now - this.lastDraw;
    this.lastDraw = now;
    this.view = follow(this.view, target, dt, this.options.reducedMotion);
    if (anim) {
      for (const cue of anim.cues) if (cue.at <= elapsed) cue.run();
      anim.cues = anim.cues.filter((cue) => cue.at > elapsed);
      this.sweepTo(anim, elapsed);
    }
    if (payoff && payoffT !== null) {
      for (const cue of payoff.cues) if (cue.at <= payoffT) cue.run();
      payoff.cues = payoff.cues.filter((cue) => cue.at > payoffT);
    }
    const ratio = this.ratio();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.save();
    if (this.shake) {
      const t = (now - this.shake.start) / 380;
      if (t >= 1) this.shake = null;
      else ctx.translate(Math.sin(t * 40) * (1 - t) * geo.cell * 0.08, 0);
    }
    const close = payoffT !== null && !this.options.reducedMotion ? closeness(payoffT) : 0;
    const lens = payoff && close > 0 ? this.closeUp(state, payoff.pile, close) : null;
    if (lens) {
      ctx.translate(lens.tx, lens.ty);
      ctx.scale(lens.zoom, lens.zoom);
    }
    ctx.translate(-Math.round(this.view.x), -Math.round(this.view.y));
    ctx.drawImage(this.staticCanvas, 0, 0, geo.width, geo.height);
    const shown = this.trailAmount(now, payoffT);
    // The vacuums' own faint glow gives way to the drawn trails as they come.
    this.dust.draw(ctx, 0.45 * (1 - shown));
    drawTrails(ctx, geo, this.trails, shown, this.options.look, this.scene);
    const dim = payoffT !== null ? dimming(payoffT) : shown;
    const time = now / 1000;
    if (!anim && state.status === 'playing') this.drawHints(ctx, geo, state);
    const cat = this.drawObjects(ctx, geo, state, anim, elapsed, time, payoffT, dim);
    if (this.focused && state.status === 'playing' && !this.ghost)
      this.drawFocusCue(ctx, cat, geo.cell, time);
    if (payoff?.pile && payoffT !== null) this.drawDizzyStars(ctx, payoff.pile, payoffT, time);
    this.effects.draw(ctx, now);
    ctx.restore();
    if (lens) this.drawSpotlight(ctx, lens, close);
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, this.cssWidth, this.cssHeight);
    if (this.follows && state.status === 'playing') this.drawMarkers(ctx, geo, state);
    if (anim && elapsed >= anim.end) {
      this.anim = null;
      anim.done();
    }
  }

  /** How much of the trails to draw: they come on during a payoff or a reveal, then stay. */
  private trailAmount(now: number, payoffT: number | null): number {
    if (payoffT !== null) return this.options.reducedMotion ? 1 : trailProgress(payoffT);
    const reveal = this.trailReveal;
    if (reveal) return easeInOut(clamp01((now - reveal.start) / reveal.duration));
    return this.trailsShown;
  }

  private catCentre(state: RoomState, anim: Animation | null, elapsed: number): Point {
    const cat = this.catPlacement(state, anim, elapsed);
    return cellCenter(this.geo!, cat.x, cat.y);
  }

  /**
   * The payoff's close-up: a zoom about the cat and the pile, with the pair drawn part of the
   * way to the middle, never so far that the view's edge shows.
   */
  private closeUp(state: RoomState, pile: Point | null, close: number) {
    const geo = this.geo!;
    const s = geo.cell;
    const cat = cellCenter(geo, state.cat.x, state.cat.y);
    const end = pile ? cellCenter(geo, pile.x, pile.y) : cat;
    const focus = { x: (cat.x + end.x) / 2 - this.view.x, y: (cat.y + end.y) / 2 - this.view.y };
    const spanX = Math.abs(cat.x - end.x) + s * 2.6;
    const spanY = Math.abs(cat.y - end.y) + s * 2.6;
    const width = this.cssWidth;
    const height = this.cssHeight;
    const most = Math.max(1, Math.min(1.45, (width * 0.7) / spanX, (height * 0.7) / spanY));
    const zoom = 1 + (most - 1) * close;
    const place = (at: number, size: number) => {
      const land = at + (size / 2 - at) * 0.5 * close;
      return Math.min(0, Math.max(size * (1 - zoom), land - zoom * at));
    };
    const tx = place(focus.x, width);
    const ty = place(focus.y, height);
    return {
      tx,
      ty,
      zoom,
      x: tx + zoom * focus.x,
      y: ty + zoom * focus.y,
      radius: (Math.max(spanX, spanY) / 2) * zoom,
    };
  }

  /** A soft spotlight on the close-up: the rest of the room darkens a little. */
  private drawSpotlight(
    ctx: CanvasRenderingContext2D,
    lens: { x: number; y: number; radius: number },
    close: number,
  ) {
    const shade = this.options.look === 'day' ? '40, 24, 10' : '4, 2, 16';
    const gradient = ctx.createRadialGradient(
      lens.x,
      lens.y,
      lens.radius,
      lens.x,
      lens.y,
      lens.radius * 2.4,
    );
    gradient.addColorStop(0, `rgba(${shade}, 0)`);
    gradient.addColorStop(1, `rgba(${shade}, ${0.34 * close})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.restore();
  }

  /** Three little stars circling over the pile while it bounces. */
  private drawDizzyStars(ctx: CanvasRenderingContext2D, pile: Point, t: number, time: number) {
    const alpha = this.options.reducedMotion ? 0 : starsAlpha(t);
    if (alpha <= 0 || !this.geo) return;
    const s = this.geo.cell;
    const c = cellCenter(this.geo, pile.x, pile.y);
    const lift = bounce(t).lift;
    const ink = this.options.look === 'day' ? '#5a3a14' : '#1a1430';
    withAlpha(ctx, alpha, () => {
      for (let i = 0; i < 3; i++) {
        const a = time * 4.2 + (i * Math.PI * 2) / 3;
        const x = c.x + Math.cos(a) * s * 0.38;
        const y = c.y - s * (0.6 + lift) + Math.sin(a) * s * 0.11;
        star(ctx, x, y, s * 0.13, ink);
        star(ctx, x, y, s * 0.1, '#ffd75e');
      }
    });
  }

  /** The keyboard's focus is on the cat: a ring that walks slowly around it. */
  private drawFocusCue(ctx: CanvasRenderingContext2D, at: Point, s: number, time: number) {
    ctx.save();
    ctx.strokeStyle = FOCUS[this.options.look];
    ctx.lineWidth = Math.max(2.5, s * 0.055);
    ctx.setLineDash([s * 0.16, s * 0.1]);
    ctx.lineDashOffset = this.options.reducedMotion ? 0 : -time * s * 0.3;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y + s * 0.04, s * 0.6, s * 0.56, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** On a followed room, a small marker at the view's edge points at every vacuum beyond it. */
  private drawMarkers(ctx: CanvasRenderingContext2D, geo: Geometry, state: RoomState) {
    const inset = 20;
    const width = this.cssWidth;
    const height = this.cssHeight;
    const ink = this.options.look === 'day' ? '#3a2a1a' : '#f2ecff';
    for (const v of state.vacuums) {
      if (!v.alive) continue;
      const c = cellCenter(geo, v.x, v.y);
      const x = c.x - this.view.x;
      const y = c.y - this.view.y;
      if (x >= 0 && x <= width && y >= 0 && y <= height) continue;
      const mx = Math.min(width - inset, Math.max(inset, x));
      const my = Math.min(height - inset, Math.max(inset, y));
      const colors = vacuumColors(v.kind, this.options.look);
      ctx.save();
      ctx.translate(mx, my);
      // A soft backing disc, so the marker reads on a busy floor in either look.
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle =
        this.options.look === 'day' ? 'rgba(255, 250, 240, 0.85)' : 'rgba(20, 16, 40, 0.8)';
      ctx.fill();
      ctx.rotate(Math.atan2(y - my, x - mx));
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(8, -6);
      ctx.lineTo(8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = colors.body;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Light through a window on the left wall, painted once into the still layer. */
  private drawLight(ctx: CanvasRenderingContext2D, geo: Geometry) {
    const x = geo.boardX + geo.cols * geo.cell * 0.12;
    const y = geo.boardY - geo.cell * 0.5;
    const w = geo.cols * geo.cell * 0.26;
    const h = geo.rows * geo.cell + geo.cell;
    ctx.save();
    ctx.globalCompositeOperation = this.options.look === 'day' ? 'soft-light' : 'screen';
    ctx.fillStyle = this.scene.light;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + h * 0.45, y + h);
    ctx.lineTo(x + h * 0.45, y + h);
    ctx.closePath();
    ctx.fill();
    // Window bars, as shadow lines inside the beam.
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle =
      this.options.look === 'day' ? 'rgba(120, 90, 50, 0.08)' : 'rgba(10, 8, 30, 0.18)';
    ctx.lineWidth = geo.cell * 0.12;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2 + h * 0.45, y + h);
    ctx.stroke();
    ctx.restore();
  }

  /** Night darkens towards the edges of the view; painted once per size. */
  private paintVignette(ratio: number): HTMLCanvasElement {
    const width = this.cssWidth;
    const height = this.cssHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    gradient.addColorStop(0, 'rgba(6, 4, 20, 0)');
    gradient.addColorStop(1, 'rgba(6, 4, 20, 0.55)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }

  private drawHints(ctx: CanvasRenderingContext2D, geo: Geometry, state: RoomState) {
    const s = geo.cell;
    const isDay = this.options.look === 'day';
    if (this.options.whiskers) {
      // Squares a vacuum could reach next turn: fine hatching, so danger never relies on colour.
      // Full strength only where the cat could step next; elsewhere just a whisper of it.
      const tile = this.hatchTile(s, isDay);
      const cat = state.cat;
      for (const near of [false, true]) {
        ctx.globalAlpha = near ? 1 : 0.32;
        for (const cell of this.danger) {
          const [x, y] = cell.split(',').map(Number) as [number, number];
          if (Math.max(Math.abs(x - cat.x), Math.abs(y - cat.y)) <= 1 !== near) continue;
          ctx.drawImage(tile, geo.boardX + x * s, geo.boardY + y * s, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }
    // The cat's own options: a paw print on every square it can safely step to, a cross on
    // the ones a vacuum would reach.
    for (const option of this.nearby) {
      if (option.dx === 0 && option.dy === 0) continue;
      const c = cellCenter(geo, state.cat.x + option.dx, state.cat.y + option.dy);
      if (option.verdict === 'ok')
        drawPaw(
          ctx,
          c.x,
          c.y,
          s * 0.36,
          isDay ? 'rgba(90, 64, 40, 0.38)' : 'rgba(255, 244, 220, 0.34)',
        );
      else if (option.verdict === 'unsafe' && this.options.whiskers) {
        const r = s * 0.12;
        ctx.save();
        ctx.strokeStyle = isDay ? 'rgba(176, 40, 30, 0.75)' : 'rgba(255, 130, 130, 0.8)';
        ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(c.x - r, c.y - r);
        ctx.lineTo(c.x + r, c.y + r);
        ctx.moveTo(c.x + r, c.y - r);
        ctx.lineTo(c.x - r, c.y + r);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (this.hover) {
      // The chosen square: dashed under the pointer, a solid focus-blue frame while the board
      // has the keyboard's focus.
      const px = geo.boardX + this.hover.x * s;
      const py = geo.boardY + this.hover.y * s;
      ctx.save();
      if (this.focused) {
        ctx.strokeStyle = FOCUS[this.options.look];
        ctx.lineWidth = Math.max(3, s * 0.06);
      } else {
        ctx.strokeStyle = isDay ? 'rgba(60, 40, 20, 0.7)' : 'rgba(255, 240, 200, 0.75)';
        ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.setLineDash([s * 0.12, s * 0.08]);
      }
      ctx.beginPath();
      ctx.roundRect(px + s * 0.06, py + s * 0.06, s * 0.88, s * 0.88, s * 0.12);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** One hatched square, drawn once per size and look and stamped on every danger square. */
  private hatchTile(s: number, isDay: boolean): HTMLCanvasElement {
    const ratio = this.ratio();
    const key = `${Math.round(s * ratio)}:${isDay}`;
    if (this.hatch?.key === key) return this.hatch.tile;
    const tile = document.createElement('canvas');
    const size = Math.max(4, Math.round(s * ratio));
    tile.width = size;
    tile.height = size;
    const c = tile.getContext('2d')!;
    c.fillStyle = isDay ? 'rgba(214, 64, 52, 0.07)' : 'rgba(255, 90, 90, 0.07)';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = isDay ? 'rgba(196, 52, 40, 0.34)' : 'rgba(255, 110, 110, 0.32)';
    c.lineWidth = Math.max(1, size * 0.03);
    c.beginPath();
    for (let t = -size; t < size; t += size * 0.2) {
      c.moveTo(t, size);
      c.lineTo(t + size, 0);
    }
    c.stroke();
    this.hatch = { key, tile };
    return tile;
  }

  private tangleKinds(state: RoomState, tangle: Tangle): VacuumKind[] {
    return state.vacuums
      .filter((v) => !v.alive && v.x === tangle.x && v.y === tangle.y)
      .map((v) => v.kind);
  }

  /**
   * Every thing on the floor, back to front. During the payoff the pile bounces and the cat
   * stretches; as the trails come forward everything but those two dims. Returns where the
   * cat is drawn.
   */
  private drawObjects(
    ctx: CanvasRenderingContext2D,
    geo: Geometry,
    state: RoomState,
    anim: Animation | null,
    elapsed: number,
    time: number,
    payoffT: number | null,
    dim: number,
  ): Point {
    const s = geo.cell;
    const look = this.options.look;
    const moving = payoffT !== null && !this.options.reducedMotion;
    const pile = this.payoff?.pile ?? null;
    const pileKey = pile ? key(pile) : null;
    const hop = moving ? bounce(payoffT) : { lift: 0, sx: 1, sy: 1 };
    const faded = 1 - 0.55 * dim;
    const kept = 1 - 0.1 * dim;
    const drawers: { y: number; draw: () => void }[] = [];
    const dock = state.dock;
    if (dock) {
      const c = this.center(dock);
      drawers.push({
        y: c.y - s,
        draw: () =>
          withAlpha(ctx, faded, () =>
            drawDock(ctx, c.x, c.y, s, look, dock.remaining, dock.jammed, time),
          ),
      });
    }
    // Tangles: those already there, those appearing at their bonk, minus any swallowed.
    const tangles = new Map<string, Tangle>();
    const sizeBefore = new Map<string, number>();
    if (anim) for (const t of anim.prev.tangles) sizeBefore.set(key(t), t.size);
    for (const t of anim ? [...anim.prev.tangles, ...state.tangles] : state.tangles)
      tangles.set(key(t), t);
    for (const [k, tangle] of tangles) {
      if (anim) {
        const appearAt = anim.appear.get(k);
        const vanishAt = anim.vanish.get(k);
        if (vanishAt !== undefined && elapsed >= vanishAt) continue;
        const existed = sizeBefore.has(k);
        if (!existed && appearAt !== undefined && elapsed < appearAt) continue;
        if (existed && appearAt !== undefined && elapsed < appearAt)
          tangles.set(k, { ...tangle, size: sizeBefore.get(k)! });
      }
      const shown = tangles.get(k)!;
      const c = this.center(shown);
      const kinds = this.tangleKinds(state, shown);
      const isPile = k === pileKey;
      drawers.push({
        y: c.y,
        draw: () =>
          withAlpha(ctx, isPile ? kept : faded, () => {
            ctx.save();
            if (isPile) {
              // Squash and stretch about the pile's base, lifted by the hop.
              const base = c.y + s * 0.3;
              ctx.translate(c.x, base - hop.lift * s);
              ctx.scale(hop.sx, hop.sy);
              ctx.translate(-c.x, -base);
            }
            drawTangle(
              ctx,
              c.x,
              c.y,
              s * 1.15,
              look,
              shown.kind,
              shown.size,
              kinds,
              time,
              hash2(shown.x, shown.y, this.seed) * 1000,
            );
            ctx.restore();
          }),
      });
    }
    for (const v of state.vacuums) {
      const visible = this.vacuumPlacement(v, anim, elapsed);
      if (!visible) continue;
      const c = cellCenter(geo, visible.x, visible.y);
      const heading = this.headingOf(state, v);
      const mood = anim ? 'calm' : (this.moods.get(v.id) ?? 'calm');
      drawers.push({
        y: c.y,
        draw: () =>
          withAlpha(ctx, faded, () => {
            drawVacuum(ctx, c.x, c.y, s, {
              kind: v.kind,
              look,
              heading,
              mood,
              resting: v.alive && v.kind === 'slow' && v.resting,
              full: v.full,
              time,
              hop: visible.hop,
            });
            if (v.alive && v.kind === 'slow' && v.resting && !this.options.reducedMotion)
              drawSnooze(ctx, c.x, c.y, s, time, look);
          }),
      });
    }
    const cat = this.catPlacement(state, anim, elapsed);
    const catCenter = cellCenter(geo, cat.x, cat.y);
    const proud = moving ? stretch(payoffT) : { sx: 1, sy: 1 };
    drawers.push({
      y: catCenter.y + 0.01,
      draw: () =>
        withAlpha(ctx, cat.alpha * kept, () => {
          const y = catCenter.y - (0.06 + cat.lift) * s;
          // The proud stretch grows up from the paws.
          const feet = y + 0.355 * s * 1.32;
          ctx.save();
          ctx.translate(catCenter.x, feet);
          ctx.scale(proud.sx, proud.sy);
          ctx.translate(-catCenter.x, -feet);
          drawCat(ctx, catCenter.x, y, s * 1.32, {
            coat: this.ghost ?? this.options.coat,
            pose: cat.pose,
            facing: this.facing,
            gaze: this.gaze(state),
            time,
            look,
            ghost: this.ghost !== null,
          });
          ctx.restore();
        }),
    });
    drawers.sort((a, b) => a.y - b.y);
    for (const d of drawers) d.draw();
    if (this.ghost) this.drawGhostLabel(ctx, catCenter, s);
    return catCenter;
  }

  private drawGhostLabel(ctx: CanvasRenderingContext2D, at: Point, s: number) {
    const name = this.ghost!.name;
    ctx.save();
    ctx.font = `600 ${Math.max(12, Math.round(s * 0.26))}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    const width = ctx.measureText(name).width + s * 0.3;
    ctx.fillStyle =
      this.options.look === 'day' ? 'rgba(255, 250, 240, 0.92)' : 'rgba(30, 26, 50, 0.92)';
    ctx.beginPath();
    ctx.roundRect(at.x - width / 2, at.y - s * 0.95, width, s * 0.36, s * 0.18);
    ctx.fill();
    ctx.fillStyle = this.options.look === 'day' ? '#3a2a1a' : '#f2ecff';
    ctx.fillText(name, at.x, at.y - s * 0.69);
    ctx.restore();
  }

  private headingOf(state: RoomState, v: Vacuum): Point {
    if (!v.alive) return { x: 0, y: 0 };
    const to = nextStep(state.layout, v, state.cat);
    return { x: to.x - v.x, y: to.y - v.y };
  }

  private gaze(state: RoomState): Point {
    let nearest: Vacuum | null = null;
    for (const v of state.vacuums)
      if (v.alive && (!nearest || chebyshev(v, state.cat) < chebyshev(nearest, state.cat)))
        nearest = v;
    if (!nearest) return { x: 0, y: 0.3 };
    const dx = nearest.x - state.cat.x;
    const dy = nearest.y - state.cat.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  private vacuumPlacement(
    v: Vacuum,
    anim: Animation | null,
    elapsed: number,
  ): { x: number; y: number; hop: number } | null {
    if (!anim) return v.alive ? { x: v.x, y: v.y, hop: 0 } : null;
    const before = anim.prev.vacuums[v.id];
    if (!before) return elapsed >= anim.end ? { x: v.x, y: v.y, hop: 0 } : null;
    if (!before.alive) return null;
    const death = anim.deaths.get(v.id);
    if (death !== undefined && elapsed >= death) return null;
    const tracks = anim.vacuums.get(v.id);
    if (!tracks) return { x: before.x, y: before.y, hop: 0 };
    const p = this.trackPosition(tracks, elapsed);
    const active = tracks.find((t) => elapsed > t.t0 && elapsed < t.t1);
    const hop = active ? clamp01((elapsed - active.t0) / (active.t1 - active.t0)) : 0;
    return { ...p, hop };
  }

  private catPlacement(
    state: RoomState,
    anim: Animation | null,
    elapsed: number,
  ): { x: number; y: number; pose: CatPose; lift: number; alpha: number } {
    const settled: CatPose =
      state.status === 'caught'
        ? 'fluffed'
        : state.status === 'cleared'
          ? 'happy'
          : this.loafing
            ? 'loaf'
            : 'sit';
    if (!anim || elapsed >= anim.cat.end) {
      const pose = anim && state.status === 'caught' && elapsed < anim.end ? 'sit' : settled;
      return { ...state.cat, pose, lift: 0, alpha: 1 };
    }
    const t = clamp01(elapsed / Math.max(1, anim.cat.end));
    if (anim.cat.kind === 'zoom') {
      // Gone in a blink, back in a blink.
      const alpha = t < 0.4 ? 1 - t / 0.4 : t > 0.6 ? (t - 0.6) / 0.4 : 0;
      const at = t < 0.5 ? anim.cat.from : anim.cat.to;
      return { ...at, pose: 'zoom', lift: 0, alpha };
    }
    if (anim.cat.kind === 'wait')
      return { ...anim.cat.to, pose: this.loafing ? 'loaf' : 'sit', lift: 0, alpha: 1 };
    const e = easeInOut(t);
    return {
      x: lerp(anim.cat.from.x, anim.cat.to.x, e),
      y: lerp(anim.cat.from.y, anim.cat.to.y, e),
      pose: 'step',
      lift: Math.sin(t * Math.PI) * 0.12,
      alpha: 1,
    };
  }
}

/** A small paw print: four toe beans and a pad. */
function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.12, size * 0.26, size * 0.21, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [
    [-0.3, -0.12],
    [-0.11, -0.3],
    [0.11, -0.3],
    [0.3, -0.12],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx * size, y + dy * size, size * 0.1, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
