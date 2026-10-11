import type { GridSize } from '../engine/grid';
import { cubeFaces, type Roll } from '../engine/roll';
import { glyphIndex, letterFontReady, loadLetterFont } from './atlas';
import {
  type Camera,
  cellAt,
  cellCentre,
  frameCamera,
  halfGrid,
  type Point,
  project,
  type Rect,
  TOP_FACE,
  TRAY_MARGIN,
} from './camera';
import { quatFromAxisAngle, quatMultiply, type Vec3 } from './math3d';
import { drawBadges, drawRibbon, drawWeb, type WebEdge } from './overlay';
import { paintFlatBoard } from './painter2d';
import { type Palette, rgb } from './palette';
import { type CubeInstance, CubeScene, type GlowInstance } from './scene';
import {
  cellJitter,
  contactTimes,
  planTumble,
  restingPose,
  restingRotation,
  TUMBLE_SECONDS,
  tumblePose,
  type TumblePlan,
} from './tumble';

/**
 * The board on screen: the WebGL tabletop with a 2D layer on top for the ribbon, badges and the
 * reveal's web. It keeps the moving parts (the tumble, flashes, shakes, the long-word pop) as
 * start times and computes every frame from the clock, so freezing the clock holds any moment.
 */

export interface RevealWord {
  path: readonly number[];
  found: boolean;
  /** A word the Duel's hunter found: drawn as a ghost strand of its own. */
  ghost?: boolean;
}

interface Pulse {
  cells: readonly number[];
  start: number;
}

const FLASH_SECONDS = 0.6;
const SHAKE_SECONDS = 0.42;
const POP_SECONDS = 1.1;
const AGAIN_SECONDS = 0.9;
const WEB_SECONDS = 2.2;

export class BoardView {
  /** The workbench sets this to try the 2D fallback on a machine that has WebGL 2. */
  static flatOnly = false;
  readonly element: HTMLElement;
  private readonly glCanvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly scene: CubeScene | null;
  private camera: Camera | null = null;
  private rect: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private roll: Roll | null = null;
  private seed = 0;
  private plans: TumblePlan[] = [];
  private tumbleStart: number | null = null;
  private trace: number[] = [];
  private hints: ReadonlySet<number> = new Set();
  private tail: Point | null = null;
  private flashes: Pulse[] = [];
  private shakes: Pulse[] = [];
  private pops: Pulse[] = [];
  private agains: Pulse[] = [];
  private web: { words: readonly RevealWord[]; start: number; heat: number[] } | null = null;
  private hover: readonly number[] | null = null;
  private guide: readonly number[] | null = null;
  private dimOthers = 0;
  private frozenAt: number | null = null;
  private frame = 0;
  private visible = true;
  private readonly observer: ResizeObserver;
  /** Called once per cube landing during a tumble, for the clatter. */
  onContact: ((strength: number) => void) | null = null;
  private pendingContacts: number[] = [];

  constructor(
    private palette: Palette,
    private reducedMotion: boolean,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'chl-board';
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.className = 'chl-board__gl';
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'chl-board__overlay';
    for (const canvas of [this.glCanvas, this.overlay]) canvas.setAttribute('aria-hidden', 'true');
    this.element.append(this.glCanvas, this.overlay);
    this.scene = BoardView.flatOnly ? null : CubeScene.create(this.glCanvas);
    if (this.scene && !letterFontReady()) {
      void loadLetterFont().then(() => this.scene?.refreshAtlas());
    }
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.element);
    this.loop = this.loop.bind(this);
    this.frame = requestAnimationFrame(this.loop);
  }

  get hasWebGl(): boolean {
    return this.scene !== null;
  }

  get size(): GridSize | null {
    return this.roll?.board.size ?? null;
  }

  /** Where the tray goes, in CSS pixels within the view. */
  setBoardRect(rect: Rect) {
    this.rect = rect;
    this.camera = null;
  }

  setPalette(palette: Palette, reducedMotion: boolean) {
    this.palette = palette;
    this.reducedMotion = reducedMotion;
  }

  /** Shows a new roll; with `tumble`, the cubes are shaken in from above. */
  setRoll(roll: Roll, seed: number, tumble: boolean) {
    this.roll = roll;
    this.seed = seed;
    this.camera = null;
    this.plans = planTumble(roll.board.size, seed);
    this.trace = [];
    this.hints = new Set();
    this.web = null;
    this.hover = null;
    this.dimOthers = 0;
    this.tumbleStart = tumble && !this.reducedMotion ? this.now() : null;
    this.pendingContacts = this.tumbleStart === null ? [] : contactTimes(this.plans);
  }

  /** Ends a tumble at once: the cubes are simply in their places. */
  settle() {
    this.tumbleStart = null;
    this.pendingContacts = [];
  }

  /** A word the tutorial points at: a faint, pulsing ribbon while nothing is being traced. */
  setGuide(path: readonly number[] | null) {
    this.guide = path && path.length > 0 ? path : null;
  }

  /** Seconds until the tumble has settled (0 when there is none). */
  tumbleRemaining(): number {
    if (this.tumbleStart === null) return 0;
    return Math.max(0, TUMBLE_SECONDS - (this.now() - this.tumbleStart));
  }

  setTrace(cells: readonly number[], tail: Point | null = null) {
    this.trace = [...cells];
    this.tail = tail;
  }

  /** Cubes that could also spell what is being typed: lit softly, without a ribbon. */
  setHints(cells: Iterable<number>) {
    this.hints = new Set(cells);
  }

  flash(cells: readonly number[]) {
    this.flashes.push({ cells, start: this.now() });
  }

  shake(cells: readonly number[]) {
    this.shakes.push({ cells, start: this.now() });
  }

  /** The long-word moment: the chain's cubes hop and spin once. */
  pop(cells: readonly number[]) {
    if (this.reducedMotion) this.flash(cells);
    else this.pops.push({ cells, start: this.now() });
  }

  /** A word found earlier: its cubes pulse where it lies. */
  again(cells: readonly number[]) {
    this.agains.push({ cells, start: this.now() });
  }

  showWeb(words: readonly RevealWord[]) {
    this.web = { words, start: this.reducedMotion ? -Infinity : this.now(), heat: cellHeat(words) };
    this.trace = [];
  }

  /** In the reveal: a word under the pointer or focus, traced on the grid. */
  setHover(path: readonly number[] | null) {
    this.hover = path;
  }

  setDimmed(amount: number) {
    this.dimOthers = amount;
  }

  /** Holds the clock at `seconds` (for stills), or lets it run again with null. */
  freeze(seconds: number | null) {
    this.frozenAt = seconds;
  }

  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (visible) this.frame = requestAnimationFrame(this.loop);
    else cancelAnimationFrame(this.frame);
  }

  /** The cube under a point in the view's own CSS pixels. */
  cellAt(point: Point, reach = 0.5): number | null {
    const camera = this.ensureCamera();
    return camera ? cellAt(camera, point, reach) : null;
  }

  /** A cell's top-face centre on screen, for anchoring things to cubes. */
  cellPoint(cell: number): Point | null {
    const camera = this.ensureCamera();
    if (!camera || !this.roll) return null;
    const [x, , z] = cellCentre(this.roll.board.size, cell);
    return project(camera, [x, TOP_FACE, z]);
  }

  /** The on-screen box of a cell's top face, for the accessible layer over the canvas. */
  cellBox(cell: number): Rect | null {
    const camera = this.ensureCamera();
    if (!camera || !this.roll) return null;
    const [x, , z] = cellCentre(this.roll.board.size, cell);
    const corners = [
      [x - 0.5, TOP_FACE, z - 0.5],
      [x + 0.5, TOP_FACE, z - 0.5],
      [x - 0.5, TOP_FACE, z + 0.5],
      [x + 0.5, TOP_FACE, z + 0.5],
    ].map((corner) => project(camera, corner as Vec3));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.scene?.dispose();
    this.element.remove();
  }

  /** Draws one frame now (used by stills and tests that freeze the clock). */
  draw() {
    this.render(this.now());
  }

  /** Copies the last drawn frame, tabletop and overlay, into a 2D canvas. */
  copyTo(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.drawImage(this.glCanvas, 0, 0, width, height);
    ctx.drawImage(this.overlay, 0, 0, width, height);
  }

  private loop() {
    this.render(this.now());
    if (this.visible) this.frame = requestAnimationFrame(this.loop);
  }

  private now(): number {
    return this.frozenAt ?? performance.now() / 1000;
  }

  /** Sizes the view at once, without waiting for layout: for posters and stills. */
  resizeTo(width: number, height: number) {
    this.applySize(width, height);
  }

  private measure() {
    const box = this.element.getBoundingClientRect();
    this.applySize(box.width, box.height);
  }

  private applySize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    // The shaders run per pixel; past 1.5 the sharper image is not worth the fill cost.
    this.pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    this.scene?.resize(this.width, this.height, this.pixelRatio);
    const overlayRatio = Math.min(2, window.devicePixelRatio || 1);
    this.overlay.width = Math.round(this.width * overlayRatio);
    this.overlay.height = Math.round(this.height * overlayRatio);
    this.camera = null;
  }

  private ensureCamera(): Camera | null {
    if (!this.roll) return null;
    if (!this.camera || this.camera.width !== this.width || this.camera.height !== this.height) {
      this.camera = frameCamera(this.roll.board.size, this.width, this.height, this.rect);
    }
    return this.camera;
  }

  private render(now: number) {
    const camera = this.ensureCamera();
    const roll = this.roll;
    if (!camera || !roll) {
      this.clearOverlay();
      return;
    }
    this.playContacts(now);
    const { cubes, lifts } = this.cubeInstances(roll, now);
    if (this.scene) {
      this.scene.render({
        camera,
        palette: this.palette,
        time: now,
        cubes,
        glows: this.glows(cubes, lifts),
        floor: this.floorGlow(roll.board.size),
        focus: {
          x: this.rect.x + this.rect.width / 2,
          y: this.rect.y + this.rect.height / 2,
          radius: Math.max(this.rect.width, this.rect.height) * 0.75,
        },
        reveal: this.web ? Math.min(1, (now - this.web.start) / WEB_SECONDS) : 0,
      });
    }
    this.drawOverlay(camera, roll, now, lifts, cubes);
  }

  private playContacts(now: number) {
    if (this.tumbleStart === null || !this.onContact || this.frozenAt !== null) return;
    const elapsed = now - this.tumbleStart;
    let landed = 0;
    while (this.pendingContacts.length > 0 && this.pendingContacts[0]! <= elapsed) {
      this.pendingContacts.shift();
      landed++;
    }
    if (landed > 0) this.onContact(Math.min(1, landed / 3));
  }

  private cubeInstances(roll: Roll, now: number) {
    const size = roll.board.size;
    const cubes: CubeInstance[] = [];
    const lifts: number[] = [];
    const traced = new Set(this.hover ?? this.trace);
    const colours = this.palette.cubes;
    const tumbling = this.tumbleStart !== null && now - this.tumbleStart < TUMBLE_SECONDS;
    for (let cell = 0; cell < size * size; cell++) {
      const jitter = cellJitter(this.seed, cell);
      const rest = restingRotation(roll.faceUp[cell]!, jitter.yaw);
      const offset: Vec3 = [jitter.dx, 0, jitter.dz];
      const pose = tumbling
        ? tumblePose(size, cell, this.plans[cell]!, rest, now - this.tumbleStart!, offset)
        : restingPose(size, cell, rest, offset);
      const position: Vec3 = [...pose.position];
      let rotation = pose.rotation;
      const pop = this.pulseAt(this.pops, cell, now, POP_SECONDS);
      if (pop !== null) {
        const order = this.pops.at(-1)!.cells.indexOf(cell);
        const k = Math.max(
          0,
          Math.min(1, (pop * POP_SECONDS - order * 0.05) / (POP_SECONDS * 0.8)),
        );
        position[1] += Math.sin(Math.PI * k) * 0.75;
        rotation = quatMultiply(quatFromAxisAngle([0, 1, 0], easeInOut(k) * Math.PI * 2), rotation);
      }
      // A cube in the chain rises a little off the tray, as if picked up.
      if (traced.has(cell)) position[1] += 0.09;
      const shake = this.pulseAt(this.shakes, cell, now, SHAKE_SECONDS);
      if (shake !== null) position[0] += Math.sin(shake * Math.PI * 7) * 0.07 * (1 - shake);
      const again = this.pulseAt(this.agains, cell, now, AGAIN_SECONDS);
      const flash = this.pulseAt(this.flashes, cell, now, FLASH_SECONDS);
      const glyphs = cubeFaces(roll, cell).map(glyphIndex);
      const colourIndex =
        (Math.floor(cell / size) * 2 + (cell % size) + this.seed) % colours.length;
      cubes.push({
        position,
        rotation,
        scale: 1,
        colour: rgb(colours[colourIndex]!),
        glyphs,
        trace: traced.has(cell) ? 1 : this.hints.has(cell) ? 0.45 : this.webGlow(cell, now),
        flash: Math.max(
          flash === null ? 0 : 1 - flash,
          again === null ? 0 : Math.abs(Math.sin(again * Math.PI * 2)),
        ),
        dim: traced.size > 0 && !traced.has(cell) ? this.dimOthers : 0,
      });
      lifts.push(position[1] - 0.5);
    }
    return { cubes, lifts };
  }

  /** In the reveal, a cube glows by how many words pass through it, once the web reaches it. */
  private webGlow(cell: number, now: number): number {
    if (!this.web || this.hover) return 0;
    const lit = Math.min(1, (now - this.web.start) / WEB_SECONDS);
    return (this.web.heat[cell] ?? 0) * 0.55 * lit;
  }

  /** Progress 0–1 of the newest pulse covering `cell`, or null. */
  private pulseAt(pulses: Pulse[], cell: number, now: number, seconds: number): number | null {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i]!;
      const progress = (now - pulse.start) / seconds;
      if (progress >= 1) {
        if (this.frozenAt === null) pulses.splice(i, 1);
        continue;
      }
      if (progress >= 0 && pulse.cells.includes(cell)) return progress;
    }
    return null;
  }

  private glows(cubes: readonly CubeInstance[], lifts: readonly number[]): GlowInstance[] {
    const glows: GlowInstance[] = [];
    const studio = this.palette.look === 'studio';
    const shadow = rgb(this.palette.shadow);
    cubes.forEach((cube, i) => {
      const lift = Math.max(0, lifts[i]!);
      const [x, , z] = cube.position;
      if (studio) {
        glows.push({
          x: x + 0.05,
          z: z - 0.03,
          half: 0.46,
          softness: 0.07 + lift * 0.12,
          colour: shadow,
          alpha: 0.42 / (1 + lift * 0.8),
        });
        glows.push({
          x: x + 0.2 + lift * 0.3,
          z: z - 0.22 - lift * 0.3,
          half: 0.5 + lift * 0.05,
          softness: 0.32 + lift * 0.18,
          colour: shadow,
          alpha: 0.2 / (1 + lift * 0.8),
        });
      } else {
        glows.push({
          x,
          z,
          half: 0.55,
          softness: 0.42 + lift * 0.2,
          colour: cube.trace > 0 ? rgb(this.palette.traceGlow) : cube.colour,
          alpha: (0.22 + cube.trace * 0.35) / (1 + lift * 0.7),
        });
      }
    });
    return glows;
  }

  /** The tray's own shadow on the floor by day, its neon spill by night. */
  private floorGlow(size: GridSize): GlowInstance[] {
    const half = halfGrid(size) + TRAY_MARGIN;
    if (this.palette.look === 'studio') {
      return [
        { x: 0.12, z: 0.1, half, softness: 0.25, colour: rgb(this.palette.shadow), alpha: 0.32 },
        {
          x: 0.5,
          z: 0.35,
          half: half + 0.2,
          softness: 1.3,
          colour: rgb(this.palette.shadow),
          alpha: 0.22,
        },
      ];
    }
    return [
      {
        x: 0,
        z: 0.2,
        half: half + 0.1,
        softness: 1.4,
        colour: rgb(this.palette.trayEdge),
        alpha: 0.2,
      },
    ];
  }

  private clearOverlay() {
    const ctx = this.overlay.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  private drawOverlay(
    camera: Camera,
    roll: Roll,
    now: number,
    lifts: readonly number[],
    cubes: readonly CubeInstance[],
  ) {
    const ctx = this.overlay.getContext('2d')!;
    const ratio = this.overlay.width / this.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!this.scene) {
      const flat = cubes.map((cube, cell) => ({
        position: cube.position,
        colour: cube.colour,
        face: roll.board.faces[cell]!,
        trace: cube.trace,
      }));
      paintFlatBoard(ctx, camera, this.palette, flat, this.width, this.height);
    }
    const size = roll.board.size;
    const top = (cell: number, dx = 0, dz = 0): Point => {
      const [x, , z] = cellCentre(size, cell);
      const jitter = cellJitter(this.seed, cell);
      return project(camera, [
        x + jitter.dx + dx,
        TOP_FACE + Math.max(0, lifts[cell] ?? 0),
        z + jitter.dz + dz,
      ]);
    };
    const pitch = Math.hypot(top(1).x - top(0).x, top(1).y - top(0).y);
    if (this.web) this.drawRevealWeb(ctx, now, top, pitch);
    const chain = this.hover ?? this.trace;
    if (chain.length === 0 && this.guide) {
      drawRibbon(
        ctx,
        this.guide.map((cell) => top(cell)),
        this.palette,
        {
          width: pitch * 0.13,
          time: now,
          flare: 0,
          strength: 0.3 + 0.18 * Math.sin(now * 3),
        },
      );
    }
    if (chain.length > 0) {
      const points = chain.map((cell) => top(cell));
      if (this.tail && !this.hover) points.push(this.tail);
      const pop = this.pops.at(-1);
      const flare = pop ? Math.max(0, 1 - (now - pop.start) / POP_SECONDS) : 0;
      drawRibbon(ctx, points, this.palette, {
        width: pitch * 0.16,
        time: now,
        flare,
        strength: this.hover ? 0.92 : 1,
      });
      // A cube used again in the same word (Echo, Mirror) gets its next badge on the next corner.
      const corners: [number, number][] = [
        [-0.36, -0.36],
        [0.36, -0.36],
        [0.36, 0.36],
        [-0.36, 0.36],
      ];
      const seen = new Map<number, number>();
      const badges = chain.map((cell) => {
        const visit = seen.get(cell) ?? 0;
        seen.set(cell, visit + 1);
        const [dx, dz] = corners[visit % corners.length]!;
        return top(cell, dx, dz);
      });
      drawBadges(ctx, badges, this.palette, Math.max(9, pitch * 0.1));
    }
  }

  private drawRevealWeb(
    ctx: CanvasRenderingContext2D,
    now: number,
    top: (cell: number) => Point,
    pitch: number,
  ) {
    const web = this.web!;
    const elapsed = now - web.start;
    const steps = webSteps(web.words);
    const edges: WebEdge[] = steps.map((step, index) => {
      const delay = (index / Math.max(1, steps.length)) * WEB_SECONDS * 0.55;
      return {
        from: top(step.a),
        to: top(step.b),
        found: step.found,
        hidden: step.hidden,
        ghost: step.ghost,
        progress: Math.max(0, Math.min(1, (elapsed - delay) / (WEB_SECONDS * 0.35))),
      };
    });
    drawWeb(ctx, edges, this.palette, pitch, this.hover ? 0.35 : 1);
  }
}

interface WebStep {
  a: number;
  b: number;
  found: number;
  hidden: number;
  ghost: number;
}

/** How many of the board's words pass through each cube, as a share of the busiest cube. */
export function cellHeat(words: readonly RevealWord[]): number[] {
  const counts: number[] = [];
  for (const word of words) {
    for (const cell of new Set(word.path)) counts[cell] = (counts[cell] ?? 0) + 1;
  }
  const busiest = Math.max(1, ...counts.filter((count) => count !== undefined));
  return Array.from(counts, (count) => Math.sqrt((count ?? 0) / busiest));
}

/** Every distinct step between two cubes that the board's words take, with how many take it. */
export function webSteps(words: readonly RevealWord[]): WebStep[] {
  const steps = new Map<number, WebStep>();
  for (const word of words) {
    const seen = new Set<number>();
    for (let i = 1; i < word.path.length; i++) {
      const a = Math.min(word.path[i - 1]!, word.path[i]!);
      const b = Math.max(word.path[i - 1]!, word.path[i]!);
      const key = a * 64 + b;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      const step = steps.get(key) ?? { a, b, found: 0, hidden: 0, ghost: 0 };
      if (word.ghost) step.ghost++;
      if (word.found) step.found++;
      else step.hidden++;
      steps.set(key, step);
    }
  }
  // The busiest steps draw in first, so the web's shape appears before its fine threads.
  return [...steps.values()].sort((x, y) => y.found + y.hidden - (x.found + x.hidden));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
