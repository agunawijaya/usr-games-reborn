import { type Arena, placeLabel } from '../engine/arena';
import type { Cell } from '../engine/geometry';
import type { Forecast } from '../engine/predict';
import {
  CEILING,
  LOW_FUEL,
  movesOnTick,
  type Plane,
  planeName,
  type TrackPoint,
  type World,
} from '../engine/world';
import {
  type Camera,
  drawGround,
  type Focus,
  easeTilt,
  framed,
  groundSquash,
  isTilted,
  project,
  type Projected,
} from './camera';
import { arenaCentre, centre, type Point } from './features';
import { drawPlaneGlyph } from './glyphs';
import { groundTexture } from './ground';
import {
  drawApproachLights,
  drawLandingLights,
  drawPearlThread,
  type QueuedLight,
} from './landings';
import type { Look } from './look';

/**
 * Draws one frame of the sky: the printed ground, then everything that moves, flat or tilted.
 * The radar never decides anything; it reads the world, the forecast and a few presentation
 * flags, so the same code draws play, replays, the Hall's demo and the poster.
 */

export interface GhostRoute {
  letter: number;
  /** The planned cells, as the route search returned them. */
  cells: readonly Cell[];
  /** Where the pointer is, in cells. */
  cursor: Point;
  valid: boolean;
  label: string;
}

export interface Ripple {
  runway: number;
  /** Seconds, on the same clock as `RadarScene.time`. */
  start: number;
  /** Position in the string: later landings ripple brighter. */
  order: number;
}

/** A landing in the current string: a pearl on its runway. */
export interface Pearl {
  runway: number;
  start: number;
}

export interface Burst {
  x: number;
  y: number;
  altitude: number;
  start: number;
}

export interface RadarScene {
  world: World;
  forecast: Forecast;
  look: Look;
  /** 0 flat … 1 tilted. */
  tilt: number;
  /** Where the tilted camera leans in, if anywhere. */
  focus?: Focus;
  /** 0–1: how far the sky is between the last tick and the next. */
  tickProgress: number;
  /** Seconds, for the sweep, pulses and ripples. */
  time: number;
  selected: number | null;
  ghost: GhostRoute | null;
  ripples: readonly Ripple[];
  /** The landings of the string in progress, oldest first. */
  pearls?: readonly Pearl[];
  /** Letters of the planes lined up to continue the string, in the order they will land. */
  stringQueue?: readonly number[];
  bursts: readonly Burst[];
  /** 0–1: colour drained after a loss. */
  drain: number;
  reducedMotion: boolean;
  showForecast: boolean;
  /** Letters whose strips or tags should read as in conflict even without a forecast. */
  flagged?: ReadonlySet<number>;
  /** A night shift: the chart darkens to dusk and the approach lights burn. */
  night?: boolean;
  /**
   * Shape cues for players who tell colours apart less easily: the conflict ring is dashed with
   * a diamond countdown, and a plane in conflict wears a square where a selected one wears a circle.
   */
  shapes?: boolean;
}

interface Shown {
  plane: Plane;
  x: number;
  y: number;
  altitude: number;
  angle: number;
  at: Projected;
}

const SWEEP_SECONDS = 4.5;
/** Below this many CSS pixels a cell, the radar draws no labels or data tags. */
const COMPACT_CELL = 12;

export class Radar {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  /** Where each plane was drawn last frame, in device pixels, for picking with the pointer. */
  private drawn: { letter: number; x: number; y: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = dpr;
    this.width = Math.round(cssWidth * dpr);
    this.height = Math.round(cssHeight * dpr);
    if (this.canvas.width !== this.width) this.canvas.width = this.width;
    if (this.canvas.height !== this.height) this.canvas.height = this.height;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  /** The largest whole-pixel cell that fits the arena in the panel with a small margin. */
  camera(arena: Arena, tilt: number, focus?: Focus): Camera {
    const margin = 14 * this.dpr;
    const cell = Math.floor(
      Math.min((this.width - margin * 2) / arena.width, (this.height - margin * 2) / arena.height),
    );
    const flat: Camera = {
      tilt,
      cell,
      originX: this.width / 2,
      originY: this.height / 2,
      columns: arena.width,
      rows: arena.height,
      zoom: 1,
      shiftX: 0,
      shiftY: 0,
    };
    return framed(flat, this.width, this.height, CEILING, focus);
  }

  /** The cell under a point in CSS pixels, when flat; null outside the arena. */
  cellAt(arena: Arena, cssX: number, cssY: number): Point | null {
    const camera = this.camera(arena, 0);
    const x = (cssX * this.dpr - camera.originX) / camera.cell + arena.width / 2;
    const y = (cssY * this.dpr - camera.originY) / camera.cell + arena.height / 2;
    if (x < 0 || y < 0 || x >= arena.width || y >= arena.height) return null;
    return { x, y };
  }

  /** Where a plane was drawn last frame, in CSS pixels; for tests and pointer hints. */
  planeOnScreen(letter: number): { x: number; y: number } | null {
    const p = this.drawn.find((d) => d.letter === letter);
    return p ? { x: p.x / this.dpr, y: p.y / this.dpr } : null;
  }

  /** The centre of a cell on the flat radar, in CSS pixels. */
  cellOnScreen(arena: Arena, x: number, y: number): { x: number; y: number } {
    const camera = this.camera(arena, 0);
    return {
      x: (camera.originX + (x + 0.5 - arena.width / 2) * camera.cell) / this.dpr,
      y: (camera.originY + (y + 0.5 - arena.height / 2) * camera.cell) / this.dpr,
    };
  }

  /** The plane drawn nearest a point in CSS pixels, if one is within reach of it. */
  planeAt(cssX: number, cssY: number): number | null {
    const x = cssX * this.dpr;
    const y = cssY * this.dpr;
    const reach = Math.max(18 * this.dpr, this.lastCell * 0.75);
    let best: { letter: number; distance: number } | null = null;
    for (const p of this.drawn) {
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance <= reach && (!best || distance < best.distance))
        best = { letter: p.letter, distance };
    }
    return best?.letter ?? null;
  }

  private lastCell = 40;

  draw(scene: RadarScene): void {
    const { ctx } = this;
    const { arena } = scene.world;
    // Nothing to draw into until the canvas has been given a size.
    if (this.width < arena.width || this.height < arena.height) return;
    const camera = this.camera(arena, scene.tilt, scene.focus);
    this.lastCell = camera.cell * camera.zoom;
    const look = scene.look;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = look.backdrop;
    ctx.fillRect(0, 0, this.width, this.height);

    const margin = {
      x: Math.ceil(arena.width * 0.3),
      y: Math.ceil(arena.height * 0.55),
    };
    // A leaning camera needs a sharper print of the ground.
    const detail = Math.min(3, Math.max(1, Math.ceil(camera.zoom - 0.25)));
    const texture = groundTexture(arena, look, camera.cell * detail, margin);
    drawGround(ctx, camera, texture);
    if (isTilted(camera)) drawHaze(ctx, camera, look, this.height);
    if (look.sweep && scene.drain < 1) drawSweep(ctx, camera, scene);

    if (scene.night && !look.dark) drawDusk(ctx, this.width, this.height);
    const shown = showPlanes(scene, camera);
    this.drawn = shown.map((s) => ({ letter: s.plane.letter, x: s.at.x, y: s.at.y }));
    const conflicted = conflictedLetters(scene);
    if (isTilted(camera)) {
      drawShadows(ctx, camera, scene, shown);
      drawLayers(ctx, camera, scene, shown);
    }
    drawApproachLights(ctx, camera, scene);
    drawRoutes(ctx, camera, scene, shown);
    if (scene.ghost) drawGhost(ctx, camera, scene, shown, scene.ghost);
    // On a small screen, such as a preview tile in the Hall, words would cover the sky.
    const compact = camera.cell * camera.zoom < COMPACT_CELL * this.dpr;
    if (!compact) drawFixedLabels(ctx, camera, scene);
    if (scene.showForecast) drawForecasts(ctx, camera, scene, shown, conflicted);
    drawTrails(ctx, camera, scene, shown);
    const queue = queuedLights(scene, camera, shown);
    drawPearlThread(ctx, camera, scene, queue);
    drawConflicts(ctx, camera, scene, shown);
    drawPlanes(ctx, camera, scene, shown, conflicted);
    drawLandingLights(ctx, camera, scene, queue);
    if (!compact) drawTags(ctx, camera, scene, shown, conflicted);
    if (scene.drain > 0) drainColour(ctx, this.width, this.height, scene.drain, look);
    // The mark of the loss stays in colour on the drained sky, so the eye finds it.
    drawBursts(ctx, camera, scene);
  }
}

/** A haze towards the far side of the tilted ground, for depth. */
function drawHaze(ctx: CanvasRenderingContext2D, camera: Camera, look: Look, height: number) {
  const far = project(camera, 0, 0);
  const t = easeTilt(camera.tilt);
  const gradient = ctx.createLinearGradient(
    0,
    0,
    0,
    Math.max(far.y, height * 0.25) + camera.cell * 2,
  );
  gradient.addColorStop(0, look.dark ? 'rgba(2, 11, 11, 0.85)' : 'rgba(236, 228, 210, 0.8)');
  gradient.addColorStop(1, look.dark ? 'rgba(2, 11, 11, 0)' : 'rgba(236, 228, 210, 0)');
  ctx.save();
  ctx.globalAlpha = t;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, height);
  ctx.restore();
}

/** A length in cells, on screen: grows as the camera leans in, like everything in the sky. */
/** Dusk over the printed chart, for night shifts in the day look. */
function drawDusk(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(96, 108, 160, 0.42)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function sizeOf(camera: Camera, cells: number): number {
  return camera.cell * camera.zoom * cells;
}

/** A text-related length: stays readable at any zoom, never below `minimum` pixels. */
function textSize(camera: Camera, cells: number, minimum = 0): number {
  return Math.max(minimum, camera.cell * cells);
}

function cellCentre(camera: Camera, cell: Cell, altitude = 0): Projected {
  const c = centre(cell);
  return project(camera, c.x, c.y, altitude);
}

/**
 * Where each plane is drawn between ticks. Jets glide one cell per tick; props glide one cell
 * over two ticks, so they visibly move at half speed instead of jumping every other tick.
 */
function showPlanes(scene: RadarScene, camera: Camera): Shown[] {
  const { world, forecast, tickProgress } = scene;
  const shown: Shown[] = [];
  for (const plane of world.air) {
    const path = forecast.paths.get(plane.letter) ?? [];
    let next: TrackPoint | undefined;
    let phase: number;
    if (plane.kind === 'jet') {
      next = path[0];
      phase = tickProgress;
    } else if (movesOnTick(plane, world.clock + 1)) {
      next = path[0];
      phase = 0.5 + tickProgress / 2;
      if (plane.track.length < 2) phase = tickProgress;
    } else {
      next = path[1];
      phase = tickProgress / 2;
    }
    const target = next ?? { x: plane.x, y: plane.y, altitude: plane.altitude, tick: 0 };
    const x = plane.x + (target.x - plane.x) * phase + 0.5;
    const y = plane.y + (target.y - plane.y) * phase + 0.5;
    const altitude = plane.altitude + (target.altitude - plane.altitude) * phase;
    const nextAngle =
      target.x === plane.x && target.y === plane.y
        ? (plane.heading * Math.PI) / 4
        : Math.atan2(target.x - plane.x, -(target.y - plane.y));
    const before = plane.track[plane.track.length - 2];
    const lastAngle = before
      ? Math.atan2(plane.x - before.x, -(plane.y - before.y))
      : (plane.heading * Math.PI) / 4;
    const turnPhase = Math.min(1, phase / 0.35);
    const angle = lerpAngle(lastAngle, nextAngle, turnPhase);
    shown.push({ plane, x, y, altitude, angle, at: project(camera, x, y, altitude) });
  }
  for (const plane of world.ground) {
    const x = plane.x + 0.5;
    const y = plane.y + 0.5;
    const angle = (plane.heading * Math.PI) / 4;
    shown.push({ plane, x, y, altitude: 0, angle, at: project(camera, x, y, 0) });
  }
  return shown.sort((a, b) => a.at.depth - b.at.depth);
}

/** The noses of the planes lined up to continue the string, where their landing lights shine. */
function queuedLights(scene: RadarScene, camera: Camera, shown: Shown[]): QueuedLight[] {
  const squash = isTilted(camera) ? groundSquash(camera) : 1;
  return (scene.stringQueue ?? []).flatMap((letter, index) => {
    const s = shown.find((p) => p.plane.letter === letter);
    if (!s || s.plane.destination.kind !== 'runway') return [];
    const reach = camera.cell * 0.44 * s.at.scale;
    return [
      {
        x: s.at.x + Math.sin(s.angle) * reach,
        y: s.at.y - Math.cos(s.angle) * reach * squash,
        scale: s.at.scale,
        runway: s.plane.destination.index,
        order: index + 1,
      },
    ];
  });
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function conflictedLetters(scene: RadarScene): Set<number> {
  const letters = new Set<number>(scene.flagged ?? []);
  for (const c of scene.forecast.conflicts) {
    letters.add(c.a);
    letters.add(c.b);
  }
  return letters;
}

function font(size: number, weight = 600): string {
  return `${weight} ${size.toFixed(1)}px "IBM Plex Mono", ui-monospace, monospace`;
}

/** A label with a halo the colour of the ground, so it reads over lines and hills. */
function haloText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
  halo: string,
  haloWidth: number,
): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = halo;
  ctx.lineWidth = haloWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** The scope's sweep: a bright line trailing a fading wedge of light. */
function drawSweep(ctx: CanvasRenderingContext2D, camera: Camera, scene: RadarScene): void {
  const look = scene.look;
  const c = arenaCentre(scene.world.arena);
  const angle = scene.reducedMotion
    ? -Math.PI / 4
    : ((scene.time / SWEEP_SECONDS) % 1) * Math.PI * 2;
  const wedge = Math.PI * 0.3;
  const reach = Math.hypot(camera.columns, camera.rows);
  const alpha = 0.095 * (1 - scene.drain);
  ctx.save();
  clipToArena(ctx, camera);
  const steps = 36;
  for (let i = 0; i < steps; i++) {
    const a0 = angle - wedge * (1 - i / steps);
    const a1 = angle - wedge * (1 - (i + 1) / steps);
    const p0 = project(camera, c.x, c.y);
    const p1 = project(camera, c.x + Math.sin(a0) * reach, c.y - Math.cos(a0) * reach);
    const p2 = project(camera, c.x + Math.sin(a1) * reach, c.y - Math.cos(a1) * reach);
    ctx.globalAlpha = alpha * ((i + 1) / steps) ** 2.2;
    ctx.fillStyle = look.sweep!;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
  }
  const from = project(camera, c.x, c.y);
  const to = project(camera, c.x + Math.sin(angle) * reach, c.y - Math.cos(angle) * reach);
  ctx.globalAlpha = 0.5 * (1 - scene.drain);
  ctx.strokeStyle = look.sweep!;
  ctx.lineWidth = Math.max(1, sizeOf(camera, 0.04));
  ctx.shadowColor = look.sweep!;
  ctx.shadowBlur = sizeOf(camera, 0.3);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function clipToArena(ctx: CanvasRenderingContext2D, camera: Camera): void {
  const corners = [
    project(camera, 0, 0),
    project(camera, camera.columns, 0),
    project(camera, camera.columns, camera.rows),
    project(camera, 0, camera.rows),
  ];
  ctx.beginPath();
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
}

/** How bright a blip is: it flares as the sweep passes and settles behind it. */
function sweepGlow(scene: RadarScene, x: number, y: number): number {
  if (!scene.look.sweep || scene.reducedMotion) return 1;
  const c = arenaCentre(scene.world.arena);
  const bearing = Math.atan2(x - c.x, -(y - c.y));
  const sweep = ((scene.time / SWEEP_SECONDS) % 1) * Math.PI * 2;
  let behind = sweep - bearing;
  while (behind < 0) behind += Math.PI * 2;
  while (behind > Math.PI * 2) behind -= Math.PI * 2;
  return 0.72 + 0.6 * Math.exp(-behind / 0.9);
}

/**
 * Each plane's shadow on the ground, in its own shape, softer the higher it flies, and a fine
 * drop line between them, so height reads at a glance.
 */
function drawShadows(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
) {
  const squash = groundSquash(camera);
  const t = easeTilt(camera.tilt);
  const look = scene.look;
  ctx.save();
  for (const s of shown) {
    if (s.altitude <= 0.01) continue;
    const ground = project(camera, s.x, s.y, 0);
    const size = sizeOf(camera, 0.8) * ground.scale;
    const closeness = 1 - s.altitude / (CEILING + 3);
    ctx.globalAlpha = t * (0.45 + 0.5 * closeness);
    ctx.filter = `blur(${(size * 0.02 * (1 + s.altitude * 0.4)).toFixed(1)}px)`;
    drawPlaneGlyph(ctx, s.plane.kind, ground.x, ground.y, size, s.angle, squash, {
      fill: look.shadow,
      outline: 'rgba(0, 0, 0, 0)',
      glow: null,
      glowStrength: 0,
    });
    ctx.filter = 'none';
    ctx.globalAlpha = t * 0.75;
    ctx.strokeStyle = look.dark ? look.trail : look.forecast;
    ctx.lineWidth = Math.max(1.2, sizeOf(camera, 0.03));
    ctx.setLineDash([sizeOf(camera, 0.08), sizeOf(camera, 0.07)]);
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y);
    ctx.lineTo(s.at.x, s.at.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/**
 * Altitude as glass shelves: each thousand feet is outlined along the back and the sides (open
 * towards the viewer, so the near edges never cross the traffic), a level in use more strongly.
 * The shelves are not filled: stacked washes would grey the whole chart. A ruler at the back
 * corner names the levels.
 */
function drawLayers(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
) {
  const t = easeTilt(camera.tilt);
  const look = scene.look;
  const used = new Set(shown.filter((s) => !s.plane.onGround).map((s) => Math.round(s.altitude)));
  ctx.save();
  ctx.lineJoin = 'round';
  for (let level = 1; level <= CEILING; level++) {
    const nearLeft = project(camera, 0, camera.rows, level);
    const farLeft = project(camera, 0, 0, level);
    const farRight = project(camera, camera.columns, 0, level);
    const nearRight = project(camera, camera.columns, camera.rows, level);
    const strong = used.has(level);
    ctx.globalAlpha = t * (strong ? 0.85 : 0.3);
    ctx.strokeStyle = look.layerEdge;
    ctx.lineWidth = Math.max(1, sizeOf(camera, strong ? 0.035 : 0.02));
    ctx.beginPath();
    ctx.moveTo(nearLeft.x, nearLeft.y);
    ctx.lineTo(farLeft.x, farLeft.y);
    ctx.lineTo(farRight.x, farRight.y);
    ctx.lineTo(nearRight.x, nearRight.y);
    ctx.stroke();
  }

  // The ruler: a post at the far left corner with a tick and a number for every level.
  const base = project(camera, 0, 0, 0);
  const top = project(camera, 0, 0, CEILING);
  ctx.globalAlpha = t * 0.9;
  ctx.strokeStyle = look.layerEdge;
  ctx.lineWidth = Math.max(1, sizeOf(camera, 0.04));
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.font = font(textSize(camera, 0.3, 13), 600);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let level = 1; level <= CEILING; level++) {
    const at = project(camera, 0, 0, level);
    ctx.globalAlpha = t * (used.has(level) ? 1 : 0.6);
    haloText(
      ctx,
      level === CEILING ? '9 000 ft' : `${level}`,
      at.x - sizeOf(camera, 0.2),
      at.y,
      look.label,
      look.labelHalo,
      sizeOf(camera, 0.1),
    );
  }
  ctx.restore();
}

/** Beacon, runway and gate names, always upright. */
function drawFixedLabels(ctx: CanvasRenderingContext2D, camera: Camera, scene: RadarScene) {
  const { arena } = scene.world;
  const look = scene.look;
  const size = textSize(camera, 0.3, 13);
  ctx.save();
  ctx.font = font(size, 600);
  ctx.textBaseline = 'middle';
  const halo = textSize(camera, 0.12);
  arena.beacons.forEach((beacon, i) => {
    const at = cellCentre(camera, beacon);
    ctx.textAlign = 'left';
    const offset = look.dark ? 0.62 : 0.5;
    haloText(
      ctx,
      `B${i}`,
      at.x + sizeOf(camera, offset),
      at.y + sizeOf(camera, look.dark ? -0.5 : 0.62),
      look.beacon,
      look.labelHalo,
      halo,
    );
  });
  arena.runways.forEach((runway, i) => {
    const at = cellCentre(camera, runway);
    ctx.textAlign = 'left';
    haloText(
      ctx,
      `A${i}`,
      at.x + sizeOf(camera, 0.45),
      at.y - sizeOf(camera, 0.55),
      look.label,
      look.labelHalo,
      halo,
    );
  });
  arena.gates.forEach((gate, i) => {
    const at = cellCentre(camera, gate);
    const inward = {
      x: gate.x < 1 ? 1 : gate.x >= arena.width - 1 ? -1 : 0,
      y: gate.y < 1 ? 1 : gate.y >= arena.height - 1 ? -1 : 0,
    };
    ctx.textAlign = inward.x > 0 ? 'left' : inward.x < 0 ? 'right' : 'center';
    const dx = inward.x * 0.62 + (inward.x === 0 ? 0.0 : 0);
    const dy = inward.y * 0.68 + (inward.y === 0 ? -0.55 : 0);
    haloText(
      ctx,
      `E${i}`,
      at.x + sizeOf(camera, dx),
      at.y + sizeOf(camera, dy),
      look.gate,
      look.labelHalo,
      halo,
    );
  });
  ctx.restore();
}

/** The altitude a plane will have at each cell of its route: one thousand feet per move. */
function routeAltitudes(plane: Plane, count: number): number[] {
  const altitudes: number[] = [];
  let altitude = plane.altitude;
  for (let i = 0; i < count; i++) {
    altitude += Math.sign(plane.targetAltitude - altitude);
    altitudes.push(altitude);
  }
  return altitudes;
}

/** Committed routes: the chart's magenta line, or a ribbon in the air when tilted. */
function drawRoutes(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
) {
  const look = scene.look;
  const tilted = isTilted(camera);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of shown) {
    const { route } = s.plane;
    if (route.length === 0) continue;
    const altitudes = routeAltitudes(s.plane, route.length);
    const points3d = [
      { x: s.x, y: s.y, altitude: s.altitude },
      ...route.map((cell, i) => ({ x: cell.x + 0.5, y: cell.y + 0.5, altitude: altitudes[i]! })),
    ];
    const selected = scene.selected === s.plane.letter;
    if (tilted) {
      drawRibbon(ctx, camera, scene, points3d, selected);
      continue;
    }
    const points = points3d.map((p) => project(camera, p.x, p.y, p.altitude));
    const width = sizeOf(camera, selected ? 0.1 : 0.075);
    tracePath(ctx, points);
    ctx.strokeStyle = look.routeCasing;
    ctx.lineWidth = width + sizeOf(camera, 0.08);
    ctx.globalAlpha = look.dark ? 0.8 : 1;
    ctx.stroke();
    ctx.globalAlpha = selected ? 1 : 0.86;
    if (look.dark) {
      ctx.shadowColor = look.route;
      ctx.shadowBlur = sizeOf(camera, 0.3);
    }
    ctx.strokeStyle = look.route;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawRouteEnd(ctx, camera, scene, points, width);
  }
  ctx.restore();
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]) {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
}

/** An arrowhead where the route ends, pointing the way the plane will be flying. */
function drawRouteEnd(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  points: readonly Projected[],
  width: number,
) {
  const end = points[points.length - 1]!;
  const before = points[points.length - 2] ?? end;
  const angle = Math.atan2(end.y - before.y, end.x - before.x);
  const size = sizeOf(camera, 0.26);
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(angle);
  ctx.fillStyle = scene.look.route;
  ctx.strokeStyle = scene.look.routeCasing;
  ctx.lineWidth = width * 0.6;
  ctx.beginPath();
  ctx.moveTo(size * 0.55, 0);
  ctx.lineTo(-size * 0.45, -size * 0.5);
  ctx.lineTo(-size * 0.2, 0);
  ctx.lineTo(-size * 0.45, size * 0.5);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/** A route in the tilt view: a translucent band hanging at the plane's height, and its shadow. */
function drawRibbon(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  points: readonly { x: number; y: number; altitude: number }[],
  selected: boolean,
) {
  const look = scene.look;
  const t = easeTilt(camera.tilt);
  const thickness = 0.85;
  const top = points.map((p) => project(camera, p.x, p.y, p.altitude));
  const bottom = points.map((p) => project(camera, p.x, p.y, Math.max(0, p.altitude - thickness)));
  const ground = points.map((p) => project(camera, p.x, p.y, 0));

  ctx.save();
  ctx.globalAlpha = 0.5 * t;
  ctx.strokeStyle = look.route;
  ctx.lineWidth = Math.max(1, sizeOf(camera, 0.035));
  ctx.setLineDash([sizeOf(camera, 0.14), sizeOf(camera, 0.12)]);
  tracePath(ctx, ground);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < points.length - 1; i++) {
    const gradient = ctx.createLinearGradient(top[i]!.x, top[i]!.y, bottom[i]!.x, bottom[i]!.y);
    gradient.addColorStop(0, look.route);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (selected ? 0.5 : 0.36) * t;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(top[i]!.x, top[i]!.y);
    ctx.lineTo(top[i + 1]!.x, top[i + 1]!.y);
    ctx.lineTo(bottom[i + 1]!.x, bottom[i + 1]!.y);
    ctx.lineTo(bottom[i]!.x, bottom[i]!.y);
    ctx.closePath();
    ctx.fill();
  }
  // Fine curtains from the ribbon down to its shadow every other cell, so the height reads.
  ctx.globalAlpha = 0.3 * t;
  ctx.lineWidth = Math.max(1, sizeOf(camera, 0.02));
  ctx.beginPath();
  for (let i = 2; i < points.length; i += 2) {
    ctx.moveTo(bottom[i]!.x, bottom[i]!.y);
    ctx.lineTo(ground[i]!.x, ground[i]!.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (look.dark) {
    ctx.shadowColor = look.route;
    ctx.shadowBlur = sizeOf(camera, 0.35);
  }
  ctx.strokeStyle = look.route;
  ctx.lineWidth = sizeOf(camera, selected ? 0.085 : 0.065);
  tracePath(ctx, top);
  ctx.stroke();
  ctx.restore();
  drawRouteEnd(ctx, camera, scene, top, sizeOf(camera, 0.06));
}

/** The next three ticks, dashed, with a tick mark where the plane will be at each. */
function drawForecasts(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
  conflicted: ReadonlySet<number>,
) {
  const look = scene.look;
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of shown) {
    if (s.plane.onGround) continue;
    const path = scene.forecast.paths.get(s.plane.letter);
    if (!path || path.length === 0) continue;
    const hot = conflicted.has(s.plane.letter);
    const colour = hot ? look.conflict : look.forecast;
    const points = [s.at, ...path.map((p) => project(camera, p.x + 0.5, p.y + 0.5, p.altitude))];
    if (s.plane.route.length === 0 || hot) {
      ctx.strokeStyle = colour;
      ctx.globalAlpha = hot ? 0.95 : 0.85;
      ctx.lineWidth = Math.max(1.2, sizeOf(camera, hot ? 0.05 : 0.035));
      ctx.setLineDash([sizeOf(camera, 0.12), sizeOf(camera, 0.1)]);
      tracePath(ctx, points);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = colour;
    for (const p of points.slice(1)) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, sizeOf(camera, 0.055) * p.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A short wake of the last few positions. */
function drawTrails(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
) {
  const look = scene.look;
  ctx.save();
  ctx.fillStyle = look.trail;
  if (look.planeGlow) {
    ctx.shadowColor = look.planeGlow;
    ctx.shadowBlur = sizeOf(camera, 0.15);
  }
  for (const s of shown) {
    const recent = s.plane.track.slice(-5, -1).reverse();
    recent.forEach((p, i) => {
      const at = project(camera, p.x + 0.5, p.y + 0.5, p.altitude);
      ctx.globalAlpha = (1 - i / 4.5) * 0.85;
      ctx.beginPath();
      ctx.arc(at.x, at.y, sizeOf(camera, 0.07 - i * 0.01) * at.scale, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

/** A calm ring around each pair that will lose separation, with the ticks left. */
function drawConflicts(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
) {
  const look = scene.look;
  const byLetter = new Map(shown.map((s) => [s.plane.letter, s]));
  ctx.save();
  for (const conflict of scene.forecast.conflicts) {
    const a = byLetter.get(conflict.a);
    const b = byLetter.get(conflict.b);
    if (!a || !b) continue;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const midAlt = (a.altitude + b.altitude) / 2;
    const at = project(camera, midX, midY, midAlt);
    const span = Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) / 2;
    const radius = span + sizeOf(camera, 0.85) * at.scale;
    const squash = isTilted(camera) ? groundSquash(camera) : 1;
    const pulse = scene.reducedMotion ? 0 : (scene.time % 1) / 1;

    ctx.strokeStyle = look.conflict;
    ctx.fillStyle = look.conflict;
    ctx.globalAlpha = look.dark ? 0.08 : 0.05;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, radius, radius * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = sizeOf(camera, scene.shapes ? 0.09 : 0.06);
    if (scene.shapes) ctx.setLineDash([sizeOf(camera, 0.42), sizeOf(camera, 0.22)]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!scene.reducedMotion) {
      ctx.globalAlpha = 0.55 * (1 - pulse);
      ctx.lineWidth = sizeOf(camera, 0.04);
      ctx.beginPath();
      const grow = radius + sizeOf(camera, 0.55) * pulse;
      ctx.ellipse(at.x, at.y, grow, grow * squash, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The countdown badge sits on the ring at two o'clock.
    const badgeAngle = -Math.PI / 4;
    const bx = at.x + Math.cos(badgeAngle) * radius;
    const by = at.y + Math.sin(badgeAngle) * radius * squash;
    const badge = sizeOf(camera, 0.38);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    if (scene.shapes) {
      const corner = badge * 1.25;
      ctx.moveTo(bx, by - corner);
      ctx.lineTo(bx + corner, by);
      ctx.lineTo(bx, by + corner);
      ctx.lineTo(bx - corner, by);
      ctx.closePath();
    } else ctx.arc(bx, by, badge, 0, Math.PI * 2);
    ctx.fillStyle = look.conflict;
    ctx.fill();
    ctx.lineWidth = sizeOf(camera, 0.06);
    ctx.strokeStyle = look.labelHalo;
    ctx.stroke();
    ctx.fillStyle = look.dark ? '#1a0a06' : '#fffaf2';
    ctx.font = font(Math.max(15, sizeOf(camera, 0.46)), 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${conflict.inTicks}`, bx, by + sizeOf(camera, 0.03));
  }
  ctx.restore();
}

function drawPlanes(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
  conflicted: ReadonlySet<number>,
) {
  const look = scene.look;
  const squash = isTilted(camera) ? groundSquash(camera) : 1;
  for (const s of shown) {
    const selected = scene.selected === s.plane.letter;
    const hot = conflicted.has(s.plane.letter);
    const fill = hot ? look.conflict : selected ? look.selected : look.plane;
    const glowStrength = sweepGlow(scene, s.x, s.y) * (selected || hot ? 1.3 : 1);
    if (hot && scene.shapes) {
      ctx.save();
      ctx.strokeStyle = look.conflict;
      ctx.lineWidth = sizeOf(camera, 0.06);
      const half = sizeOf(camera, 0.6) * s.at.scale;
      ctx.strokeRect(s.at.x - half, s.at.y - half * squash, half * 2, half * 2 * squash);
      ctx.restore();
    }
    if (selected) {
      ctx.save();
      ctx.strokeStyle = look.selected;
      ctx.lineWidth = sizeOf(camera, 0.05);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const r = sizeOf(camera, 0.62) * s.at.scale;
      ctx.ellipse(s.at.x, s.at.y, r, r * squash, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = s.plane.onGround ? 0.6 : 1;
    drawPlaneGlyph(
      ctx,
      s.plane.kind,
      s.at.x,
      s.at.y,
      sizeOf(camera, 0.8) * s.at.scale,
      s.angle,
      squash,
      {
        fill,
        outline: look.dark ? 'rgba(2, 18, 18, 0.7)' : look.paper,
        glow: look.planeGlow
          ? hot
            ? look.conflict
            : selected
              ? look.selected
              : look.planeGlow
          : null,
        glowStrength,
      },
    );
    ctx.restore();
  }
}

interface TagBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlap(a: TagBox, b: TagBox): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Data tags: the plane's letter and altitude as the original printed them (k7), where it is
 * climbing or descending to, and where it is bound. Tags pick the free corner around their plane.
 */
function drawTags(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
  conflicted: ReadonlySet<number>,
) {
  const look = scene.look;
  const main = textSize(camera, 0.4, 15);
  const small = textSize(camera, 0.32, 14);
  const lineGap = main * 0.18;
  const placed: TagBox[] = shown.map((s) => ({
    x: s.at.x - sizeOf(camera, 0.4),
    y: s.at.y - sizeOf(camera, 0.4),
    width: sizeOf(camera, 0.8),
    height: sizeOf(camera, 0.8),
  }));
  const { arena } = scene.world;
  for (const fixed of [...arena.beacons, ...arena.runways]) {
    const at = cellCentre(camera, fixed);
    placed.push({
      x: at.x - textSize(camera, 0.7),
      y: at.y - sizeOf(camera, 0.8),
      width: textSize(camera, 1.9),
      height: textSize(camera, 1.6),
    });
  }
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const ordered = [...shown].sort(
    (a, b) => Number(scene.selected === b.plane.letter) - Number(scene.selected === a.plane.letter),
  );
  for (const s of ordered) {
    const plane = s.plane;
    const selected = scene.selected === plane.letter;
    const hot = conflicted.has(plane.letter);
    const name = plane.onGround ? planeName(plane) : `${planeName(plane)}${plane.altitude}`;
    const climb =
      plane.onGround || plane.targetAltitude === plane.altitude
        ? ''
        : `${plane.targetAltitude > plane.altitude ? '▴' : '▾'}${plane.targetAltitude}`;
    const bound = plane.onGround ? 'ready' : `→${placeLabel(plane.destination)}`;
    const role = plane.onGround
      ? ''
      : plane.flight.role === 'medical'
        ? ' MED'
        : plane.flight.role === 'mail'
          ? ' POST'
          : '';
    const fuelLow = plane.fuel < LOW_FUEL;

    ctx.font = font(main, 700);
    const nameWidth = ctx.measureText(name).width;
    ctx.font = font(small, 600);
    const climbWidth = climb ? ctx.measureText(` ${climb}`).width : 0;
    const secondLine = `${bound}${role}${fuelLow ? ` ·${plane.fuel}` : ''}`;
    const secondWidth = ctx.measureText(secondLine).width;
    const width = Math.max(nameWidth + climbWidth, secondWidth) + textSize(camera, 0.16);
    const height = main + small + lineGap + textSize(camera, 0.1);

    const gap = sizeOf(camera, 0.42);
    const candidates: TagBox[] = [
      { x: s.at.x + gap, y: s.at.y - gap - height, width, height },
      { x: s.at.x + gap, y: s.at.y + gap * 0.6, width, height },
      { x: s.at.x - gap - width, y: s.at.y - gap - height, width, height },
      { x: s.at.x - gap - width, y: s.at.y + gap * 0.6, width, height },
    ];
    let best = candidates[0]!;
    let bestScore = Infinity;
    for (const [i, box] of candidates.entries()) {
      // A tag that would leave the radar is the last resort.
      const outside =
        box.x < 0 ||
        box.y < 0 ||
        box.x + box.width > ctx.canvas.width ||
        box.y + box.height > ctx.canvas.height;
      const score =
        placed.reduce((sum, other) => sum + overlap(box, other), 0) + i * 4 + (outside ? 1e7 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = box;
      }
    }
    placed.push(best);

    const textColour = hot ? look.conflict : look.tag;
    // An ignored or unmarked plane steps back, as the 1986 game kept it out of the way.
    const quiet = plane.status !== 'marked' && !selected && !hot ? 0.45 : 1;
    const leaderX = best.x < s.at.x ? best.x + best.width : best.x;
    const leaderY = best.y < s.at.y ? best.y + best.height * 0.8 : best.y + best.height * 0.2;
    ctx.strokeStyle = hot ? look.conflict : look.tagMuted;
    ctx.globalAlpha = 0.7 * quiet;
    ctx.lineWidth = Math.max(1, textSize(camera, 0.025));
    ctx.beginPath();
    const toward = Math.atan2(leaderY - s.at.y, leaderX - s.at.x);
    ctx.moveTo(
      s.at.x + Math.cos(toward) * sizeOf(camera, 0.36),
      s.at.y + Math.sin(toward) * sizeOf(camera, 0.36),
    );
    ctx.lineTo(leaderX, leaderY);
    ctx.stroke();
    ctx.globalAlpha = (plane.onGround ? 0.75 : 1) * quiet;

    const padX = textSize(camera, 0.08);
    if (selected) {
      ctx.fillStyle = look.selected;
      roundRect(
        ctx,
        best.x - padX * 0.5,
        best.y - padX * 0.3,
        best.width + padX,
        best.height + padX * 0.6,
        textSize(camera, 0.12),
      );
      ctx.fill();
    }
    const ink = selected ? (look.dark ? '#03161c' : '#fffaf4') : textColour;
    const halo = selected ? 'rgba(0,0,0,0)' : look.tagHalo;
    const x = best.x + padX;
    const y1 = best.y + main * 0.92;
    ctx.font = font(main, 700);
    haloText(ctx, name, x, y1, ink, halo, textSize(camera, 0.13));
    if (climb) {
      ctx.font = font(small, 600);
      haloText(
        ctx,
        ` ${climb}`,
        x + nameWidth,
        y1,
        selected ? ink : look.tagMuted,
        halo,
        textSize(camera, 0.12),
      );
    }
    ctx.font = font(small, 600);
    const y2 = y1 + small + lineGap;
    haloText(
      ctx,
      `${bound}${role}`,
      x,
      y2,
      selected ? ink : look.tagMuted,
      halo,
      textSize(camera, 0.12),
    );
    if (fuelLow) {
      const before = ctx.measureText(`${bound}${role}`).width;
      haloText(
        ctx,
        ` ·${plane.fuel}`,
        x + before,
        y2,
        selected ? ink : look.warn,
        halo,
        textSize(camera, 0.12),
      );
    }
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The route the player is drawing: dashed, snapped to cells, with the pointer's knob. */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  shown: Shown[],
  ghost: GhostRoute,
) {
  const look = scene.look;
  const from = shown.find((s) => s.plane.letter === ghost.letter);
  if (!from) return;
  const altitudes = routeAltitudes(from.plane, ghost.cells.length);
  const points = [
    from.at,
    ...ghost.cells.map((c, i) =>
      project(camera, c.x + 0.5, c.y + 0.5, isTilted(camera) ? altitudes[i]! : 0),
    ),
  ];
  const colour = ghost.valid ? look.route : look.conflict;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  tracePath(ctx, points);
  ctx.strokeStyle = look.routeCasing;
  ctx.lineWidth = sizeOf(camera, 0.16);
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colour;
  ctx.lineWidth = sizeOf(camera, 0.08);
  ctx.setLineDash([sizeOf(camera, 0.2), sizeOf(camera, 0.13)]);
  ctx.lineDashOffset = scene.reducedMotion ? 0 : -scene.time * sizeOf(camera, 1.2);
  if (look.dark) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = sizeOf(camera, 0.3);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  ctx.fillStyle = colour;
  for (const p of points.slice(1)) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, sizeOf(camera, 0.05), 0, Math.PI * 2);
    ctx.fill();
  }

  const knob = project(camera, ghost.cursor.x, ghost.cursor.y, 0);
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, sizeOf(camera, 0.2), 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.lineWidth = sizeOf(camera, 0.06);
  ctx.strokeStyle = look.routeCasing;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, sizeOf(camera, 0.42), 0, Math.PI * 2);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = sizeOf(camera, 0.035);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const size = textSize(camera, 0.32, 14);
  ctx.font = `600 ${size.toFixed(1)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const width = ctx.measureText(ghost.label).width + textSize(camera, 0.4);
  const height = size + textSize(camera, 0.26);
  const lx = knob.x + sizeOf(camera, 0.55);
  const ly = knob.y + sizeOf(camera, 0.35);
  roundRect(ctx, lx, ly, width, height, height / 2);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.fillStyle = look.dark ? '#03161c' : '#fffaf4';
  ctx.textBaseline = 'middle';
  ctx.fillText(ghost.label, lx + textSize(camera, 0.2), ly + height / 2 + 1);
  ctx.restore();
}

/** A loss of separation: a white flare and one ring of sparks that fades within 0.6 s. */
function drawBursts(ctx: CanvasRenderingContext2D, camera: Camera, scene: RadarScene) {
  ctx.save();
  for (const burst of scene.bursts) {
    const at = project(camera, burst.x, burst.y, burst.altitude);
    const age = scene.time - burst.start;
    if (age < 0) continue;
    if (scene.reducedMotion) {
      drawBurstIcon(ctx, camera, scene, at);
      continue;
    }
    if (age < 0.18) {
      ctx.globalAlpha = 1 - age / 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(at.x, at.y, sizeOf(camera, 0.9) * (0.6 + age * 3), 0, Math.PI * 2);
      ctx.fill();
    }
    if (age < 0.6) {
      const t = age / 0.6;
      const radius = sizeOf(camera, 0.3 + t * 1.3);
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = scene.look.dark ? '#fff1d6' : scene.look.conflict;
      ctx.lineWidth = sizeOf(camera, 0.05) * (1 - t * 0.6);
      ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + 0.2;
        const inner = radius * 0.78;
        ctx.beginPath();
        ctx.moveTo(at.x + Math.cos(angle) * inner, at.y + Math.sin(angle) * inner);
        ctx.lineTo(at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius);
        ctx.stroke();
      }
    } else {
      drawBurstIcon(ctx, camera, scene, at);
    }
  }
  ctx.restore();
}

/** What stays after the flare, and all that is shown with reduced motion: a still mark. */
function drawBurstIcon(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  at: Projected,
) {
  const r = sizeOf(camera, 0.8);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = scene.look.dark ? '#ffe3c2' : scene.look.conflict;
  ctx.lineWidth = sizeOf(camera, 0.05);
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const inner = i % 2 === 0 ? r * 0.35 : r * 0.5;
    const outer = i % 2 === 0 ? r : r * 0.75;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(angle) * inner, at.y + Math.sin(angle) * inner);
    ctx.lineTo(at.x + Math.cos(angle) * outer, at.y + Math.sin(angle) * outer);
    ctx.stroke();
  }
}

/** After a loss the colour drains towards one quiet tone. */
function drainColour(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  look: Look,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = Math.min(1, amount) * 0.92;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(1, amount) * (look.dark ? 0.22 : 0.12);
  ctx.fillStyle = look.dark ? '#000000' : '#efe9dc';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
