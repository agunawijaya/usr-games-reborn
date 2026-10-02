import { type Cave, isMagic, tunnelsFrom } from '../engine/cave';
import type { Senses } from '../engine/expedition';
import {
  circlePoints,
  curvePoints,
  letter,
  type Medium,
  type Point,
  polygonPoints,
  stroke,
} from './hand';
import type { Look } from './look';
import { spoilMap } from './crumple';
import { clamp, hash2 } from './noise';

/**
 * The explorer's map: rooms stood in are inked (or chalked) firmly, rooms only seen down a tunnel
 * are pencilled, tunnels that run one way carry an arrow, and beside each room sit the notes of
 * what was felt there. At the end of an expedition the whole cave is revealed and lit, room by
 * room, from where it ended.
 */

export type NotebookMark = 'safe' | 'pit' | 'bats' | 'wumpus';

export interface MapReveal {
  pits: readonly boolean[];
  bats: readonly boolean[];
  wumpus: number;
  /** The room the light spreads from. */
  origin: number;
  /** 0 → nothing lit, 1 → every room lit. */
  progress: number;
  /** Rooms lit warm on a win, cold on a loss. */
  mood: 'hushed' | 'lost';
}

export interface MapScene {
  cave: Cave;
  /** Layout positions (index = room), in any units; the map fits them to its box. */
  layout: readonly Point[];
  here: number;
  visited: readonly number[];
  sensed: ReadonlyMap<number, Senses>;
  marks: ReadonlyMap<number, ReadonlySet<NotebookMark>>;
  rules: 'standard' | 'classic';
  /** Lines discovered this turn and how far they have written themselves (0–1). */
  writing?: ReadonlyMap<string, number>;
  /** Rooms of a dart path being aimed. */
  aim?: readonly number[];
  reveal?: MapReveal;
  /** 0–1: how far a lost expedition has crumpled (or smudged) the map. */
  spoiled?: number;
  /** The dark cave: the map draws nothing by itself but the room you are in and your own marks. */
  unmapped?: boolean;
  /** The room the keyboard's notebook cursor is on. */
  cursor?: number;
  /** While aiming: the rooms the dart can fly to next, with the key that picks each. */
  aimNext?: ReadonlyMap<number, number>;
  time: number;
}

/** Every room the map shows, for drawing and for finding the room under the pointer. */
export function drawnRooms(scene: MapScene): Set<number> {
  if (scene.reveal) return allRooms(scene.cave);
  const rooms = new Set<number>();
  const stood = scene.unmapped ? [scene.here] : scene.visited;
  for (const room of stood) {
    rooms.add(room);
    for (const to of tunnelsFrom(scene.cave, room)) if (!isMagic(scene.cave, to)) rooms.add(to);
  }
  if (scene.unmapped) for (const room of scene.marks.keys()) rooms.add(room);
  for (const room of scene.aim ?? []) rooms.add(room);
  return rooms;
}

/** The room drawn at a point inside the box, if any. */
export function roomAtPoint(scene: MapScene, box: Box, point: Point): number | null {
  const radius = roomRadius(scene, box);
  let best: { room: number; distance: number } | null = null;
  for (const room of drawnRooms(scene)) {
    const p = roomPoint(scene, box, room);
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (distance <= radius * 1.45 && (!best || distance < best.distance)) best = { room, distance };
  }
  return best?.room ?? null;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

interface Bounds {
  minX: number;
  minY: number;
  spanX: number;
  spanY: number;
}

const boundsOf = new WeakMap<readonly Point[], Bounds>();

function boundsOfPoints(points: readonly Point[]): Bounds {
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  return {
    minX,
    minY,
    spanX: Math.max(1e-6, Math.max(...points.map((p) => p.x)) - minX),
    spanY: Math.max(1e-6, Math.max(...points.map((p) => p.y)) - minY),
  };
}

function layoutBounds(layout: readonly Point[]): Bounds {
  const known = boundsOf.get(layout);
  if (known) return known;
  const bounds = boundsOfPoints(layout.slice(1));
  boundsOf.set(layout, bounds);
  return bounds;
}

function mixBounds(a: Bounds, b: Bounds, t: number): Bounds {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    minX: mix(a.minX, b.minX),
    minY: mix(a.minY, b.minY),
    spanX: mix(a.spanX, b.spanX),
    spanY: mix(a.spanY, b.spanY),
  };
}

/** How the layout sits in the box: the part of it framed, a scale for each axis and an offset. */
interface MapView {
  bounds: Bounds;
  sx: number;
  sy: number;
  x: number;
  y: number;
}

/** The most the known part of a twenty-room cave is enlarged, so a few rooms never fill the page. */
const MAX_ZOOM = 2.2;

/** Bigger caves may zoom further in: their rooms sit closer together when the whole cave is shown. */
function maxZoom(cave: Cave): number {
  return MAX_ZOOM * Math.max(1, Math.sqrt(cave.size / 20));
}

const tunnelLengths = new WeakMap<readonly Point[], number>();

/** The typical length of a tunnel in layout units: the median over every tunnel of the cave. */
function typicalTunnel(cave: Cave, layout: readonly Point[]): number {
  const known = tunnelLengths.get(layout);
  if (known) return known;
  const lengths: number[] = [];
  for (let room = 1; room <= cave.size; room++) {
    for (const to of tunnelsFrom(cave, room)) {
      if (to <= room || isMagic(cave, to)) continue;
      lengths.push(Math.hypot(layout[to]!.x - layout[room]!.x, layout[to]!.y - layout[room]!.y));
    }
  }
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 1;
  tunnelLengths.set(layout, median);
  return median;
}

const viewsOf = new WeakMap<MapScene, { key: string; view: MapView }>();

/**
 * Frames the rooms the map shows, not the whole cave: early on a few rooms are drawn large, and
 * the map pulls back as the cave is explored. When the cave is revealed it eases out to all of it.
 */
function viewOf(scene: MapScene, box: Box): MapView {
  const key = `${box.x},${box.y},${box.w},${box.h}`;
  const cached = viewsOf.get(scene);
  if (cached?.key === key) return cached.view;
  const full = layoutBounds(scene.layout);
  const shown = [...drawnRooms(scene.reveal ? { ...scene, reveal: undefined } : scene)];
  const known = shown.length > 0 ? boundsOfPoints(shown.map((room) => scene.layout[room]!)) : full;
  const t = scene.reveal ? smoothstep(scene.reveal.progress) : 0;
  const bounds = mixBounds(known, full, t);
  // Room enough at the edges for a room's ring and the marks beside it.
  const pad = Math.min(box.w, box.h) * 0.06 + 34;
  const availableW = box.w - pad * 2;
  const availableH = box.h - pad * 2;
  const wholeCave = Math.min(availableW / full.spanX, availableH / full.spanY);
  const limit = wholeCave * maxZoom(scene.cave);
  const uniform = Math.min(availableW / bounds.spanX, availableH / bounds.spanY, limit);
  // Stretched a little along the shorter side to use the page, never enough to look distorted.
  const sx = Math.min(availableW / bounds.spanX, uniform * 1.3, limit);
  const sy = Math.min(availableH / bounds.spanY, uniform * 1.3, limit);
  const view = {
    bounds,
    sx,
    sy,
    x: box.x + (box.w - bounds.spanX * sx) / 2,
    y: box.y + (box.h - bounds.spanY * sy) / 2,
  };
  viewsOf.set(scene, { key, view });
  return view;
}

function smoothstep(t: number): number {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

/** Where a room is drawn inside the box. */
export function roomPoint(scene: MapScene, box: Box, room: number): Point {
  const p = scene.layout[room]!;
  const view = viewOf(scene, box);
  return {
    x: view.x + (p.x - view.bounds.minX) * view.sx,
    y: view.y + (p.y - view.bounds.minY) * view.sy,
  };
}

/** A room's size follows how far apart rooms are drawn, so the numbers are as big as the map allows. */
export function roomRadius(scene: MapScene, box: Box): number {
  const view = viewOf(scene, box);
  const spacing = typicalTunnel(scene.cave, scene.layout) * Math.min(view.sx, view.sy);
  return clamp(spacing * 0.3, 10, 24);
}

interface Edge {
  a: number;
  b: number;
  /** a → b is known to exist. */
  forward: boolean;
  /** b → a is known to exist. */
  backward: boolean;
  /** Both ends stood in, so the absence of a direction is known too. */
  settled: boolean;
}

function knownEdges(scene: MapScene, everything: boolean): Edge[] {
  const { cave } = scene;
  const visited = new Set(scene.visited);
  const edges = new Map<string, Edge>();
  for (let room = 1; room <= cave.size; room++) {
    if (!everything && !visited.has(room)) continue;
    for (const to of tunnelsFrom(cave, room)) {
      if (isMagic(cave, to) || to === room) continue;
      const key = edgeKey(room, to);
      const edge = edges.get(key) ?? {
        a: Math.min(room, to),
        b: Math.max(room, to),
        forward: false,
        backward: false,
        settled: false,
      };
      if (room === edge.a) edge.forward = true;
      else edge.backward = true;
      edge.settled = everything || (visited.has(edge.a) && visited.has(edge.b));
      edges.set(key, edge);
    }
  }
  return [...edges.values()];
}

function mediumOf(look: Look): Medium {
  return look.dark ? 'chalk' : 'ink';
}

export function drawMap(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  box: Box,
): void {
  const everything = Boolean(scene.reveal);
  // In the dark cave only the room you stand in counts as drawn; the rest is your notebook.
  const seen = scene.unmapped && !everything ? { ...scene, visited: [scene.here] } : scene;
  const visited = new Set(seen.visited);
  const radius = roomRadius(scene, box);
  const at = (room: number) => roomPoint(scene, box, room);
  const lit = scene.reveal ? litRooms(scene, scene.reveal) : null;
  const drawn = drawnRooms(scene);

  if (lit) drawLight(ctx, scene, look, box, radius, lit);
  for (const edge of knownEdges(seen, everything))
    drawEdge(ctx, seen, look, edge, at, radius, visited);
  drawMagic(ctx, scene, look, at, radius, everything ? allRooms(scene.cave) : visited);
  if (scene.aim) drawAim(ctx, scene.aim, look, at, radius, scene.here, scene.time);
  for (const room of drawn) {
    const stood = visited.has(room);
    drawRoom(ctx, scene, look, room, at(room), radius, stood || everything, lit?.get(room));
  }
  for (const room of seen.visited) drawSensed(ctx, scene, look, room, at, radius);
  for (const [room, marks] of scene.marks) {
    if (drawn.has(room)) drawMarks(ctx, look, marks, at(room), radius, room);
  }
  if (scene.reveal) drawHazards(ctx, scene, scene.reveal, look, at, radius);
  if (!scene.reveal || scene.reveal.mood === 'lost')
    drawHere(ctx, look, at(scene.here), radius, scene.time);
  if (scene.aimNext) drawAimKeys(ctx, look, scene.aimNext, at, radius);
  if (scene.cursor) drawCursor(ctx, look, at(scene.cursor), radius, scene.time);
  if (scene.spoiled) spoilMap(ctx, box, look, scene.spoiled);
}

/** Keyboard numbers beside the rooms the dart can fly to next. */
function drawAimKeys(
  ctx: CanvasRenderingContext2D,
  look: Look,
  next: ReadonlyMap<number, number>,
  at: (room: number) => Point,
  radius: number,
): void {
  ctx.save();
  ctx.font = `600 ${Math.round(radius * 0.62)}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [room, key] of next) {
    const p = at(room);
    const c = { x: p.x - radius * 1.05, y: p.y - radius * 1.05 };
    const r = radius * 0.48;
    ctx.fillStyle = look.dart;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.dark ? '#141020' : '#fbf7ea';
    ctx.fillText(String(key), c.x, c.y + 1);
  }
  ctx.restore();
}

/** The notebook cursor: a dashed ring that turns slowly, so it reads without colour. */
function drawCursor(
  ctx: CanvasRenderingContext2D,
  look: Look,
  p: Point,
  radius: number,
  time: number,
): void {
  ctx.save();
  ctx.strokeStyle = look.dark ? '#ffd27a' : '#1f5fbf';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -time * 12;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 1.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function allRooms(cave: Cave): Set<number> {
  return new Set(Array.from({ length: cave.size }, (_, i) => i + 1));
}

/** The light spreads one tunnel per step from the origin; returns how lit each room is (0–1). */
function litRooms(scene: MapScene, reveal: MapReveal): Map<number, number> {
  const { cave } = scene;
  const steps = new Map<number, number>([[reveal.origin, 0]]);
  const queue = [reveal.origin];
  while (queue.length > 0) {
    const room = queue.shift()!;
    const around = new Set<number>(tunnelsFrom(cave, room));
    for (let other = 1; other <= cave.size; other++) {
      if (tunnelsFrom(cave, other).includes(room)) around.add(other);
    }
    for (const next of around) {
      if (isMagic(cave, next) || steps.has(next)) continue;
      steps.set(next, steps.get(room)! + 1);
      queue.push(next);
    }
  }
  const deepest = Math.max(1, ...steps.values());
  const front = reveal.progress * (deepest + 1.5);
  const lit = new Map<number, number>();
  for (const [room, step] of steps) lit.set(room, clamp(front - step));
  return lit;
}

function drawLight(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  box: Box,
  radius: number,
  lit: Map<number, number>,
): void {
  const warm = scene.reveal?.mood === 'hushed';
  ctx.save();
  if (look.dark) ctx.globalCompositeOperation = 'lighter';
  for (const [room, amount] of lit) {
    if (amount <= 0) continue;
    const p = roomPoint(scene, box, room);
    const glow = radius * (2.4 + amount * 0.8);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    const color = warm ? look.lanternGlow : look.lineSoft;
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = amount * (look.dark ? 0.9 : 0.75);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function bend(a: Point, b: Point, seed: number): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const sway = (hash2(seed, 3) - 0.5) * 0.22 * length;
  return { x: mx - ((b.y - a.y) / length) * sway, y: my + ((b.x - a.x) / length) * sway };
}

function trimmed(a: Point, b: Point, radius: number): [Point, Point] {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const gap = radius + 3;
  return [
    { x: a.x + ux * gap, y: a.y + uy * gap },
    { x: b.x - ux * gap, y: b.y - uy * gap },
  ];
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  edge: Edge,
  at: (room: number) => Point,
  radius: number,
  visited: Set<number>,
): void {
  const [from, to] = trimmed(at(edge.a), at(edge.b), radius);
  const seed = edge.a * 131 + edge.b * 7;
  const control = bend(from, to, seed);
  const points = curvePoints(from, control, to, 26);
  const firm = visited.has(edge.a) && visited.has(edge.b);
  const progress = scene.writing?.get(edgeKey(edge.a, edge.b)) ?? 1;
  const medium = mediumOf(look);
  stroke(ctx, points, {
    medium: firm || scene.reveal ? medium : look.dark ? 'chalk' : 'pencil',
    color: firm || scene.reveal ? look.line : look.lineSoft,
    width: look.dark ? 2.6 : firm ? 2.1 : 1.5,
    seed,
    wobble: 1.4,
    progress,
    alpha: firm || scene.reveal ? 1 : 0.85,
  });
  const oneWay = edge.forward !== edge.backward && (edge.settled || scene.reveal);
  if (oneWay && progress >= 1) {
    const reversed = edge.backward && !edge.forward;
    drawArrow(ctx, points, reversed, look, seed);
  }
}

/** An arrowhead halfway along a one-way tunnel, pointing the way it runs. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  reversed: boolean,
  look: Look,
  seed: number,
): void {
  const middle = Math.floor(points.length / 2);
  const a = points[middle - 1]!;
  const b = points[middle + 1]!;
  let angle = Math.atan2(b.y - a.y, b.x - a.x);
  if (reversed) angle += Math.PI;
  const tip = points[middle]!;
  const size = 9;
  const wing = (side: number): Point => ({
    x: tip.x - Math.cos(angle + side * 0.5) * size,
    y: tip.y - Math.sin(angle + side * 0.5) * size,
  });
  stroke(ctx, [wing(-1), tip, wing(1)], {
    medium: mediumOf(look),
    color: look.line,
    width: look.dark ? 2.6 : 2.1,
    seed: seed + 9,
    wobble: 0.4,
  });
}

/** Magic tunnels lead nowhere you can draw: a shimmering squiggle trailing off into stars. */
function drawMagic(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  at: (room: number) => Point,
  radius: number,
  rooms: Set<number>,
): void {
  for (const room of rooms) {
    if (!tunnelsFrom(scene.cave, room).some((to) => isMagic(scene.cave, to))) continue;
    const p = at(room);
    const angle = hash2(room, 11) * Math.PI * 2;
    const points: Point[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const r = radius + 4 + t * radius * 1.8;
      const sway = Math.sin(t * 14 + scene.time * 3) * 3.2 * t;
      points.push({
        x: p.x + Math.cos(angle) * r - Math.sin(angle) * sway,
        y: p.y + Math.sin(angle) * r + Math.cos(angle) * sway,
      });
    }
    stroke(ctx, points, {
      medium: mediumOf(look),
      color: look.marks.bats,
      width: 1.8,
      seed: room,
      wobble: 0.3,
    });
    const end = points[points.length - 1]!;
    drawSparkle(ctx, end.x, end.y, 5 + Math.sin(scene.time * 4 + room) * 1.5, look.marks.bats);
  }
}

function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? size : size * 0.32;
    const angle = (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  aim: readonly number[],
  look: Look,
  at: (room: number) => Point,
  radius: number,
  here: number,
  time: number,
): void {
  const rooms = [here, ...aim];
  ctx.save();
  ctx.strokeStyle = look.dart;
  ctx.lineWidth = 3.2;
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -time * 30;
  ctx.globalAlpha = 0.9;
  for (let i = 1; i < rooms.length; i++) {
    const [a, b] = trimmed(at(rooms[i - 1]!), at(rooms[i]!), radius * 0.8);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  room: number,
  p: Point,
  radius: number,
  firm: boolean,
  light: number | undefined,
): void {
  const seed = room * 97 + 13;
  if (firm) {
    ctx.save();
    ctx.globalAlpha = look.dark ? 0.85 : 0.92;
    ctx.fillStyle = look.dark ? 'rgba(20, 17, 14, 0.92)' : look.ground;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.96, 0, Math.PI * 2);
    ctx.fill();
    if (light && light > 0) {
      ctx.globalAlpha = light * (look.dark ? 0.45 : 0.55);
      ctx.fillStyle = scene.reveal?.mood === 'hushed' ? look.lantern : look.lineSoft;
      ctx.fill();
    }
    ctx.restore();
  }
  stroke(ctx, circlePoints(p, radius, seed), {
    medium: firm ? mediumOf(look) : look.dark ? 'chalk' : 'pencil',
    color: firm ? look.line : look.lineSoft,
    width: firm ? (look.dark ? 2.8 : 2.2) : 1.4,
    seed,
    wobble: 1.1,
    alpha: firm ? 1 : 0.8,
  });
  const label = String(room);
  letter(ctx, label, p.x, p.y + 1, {
    medium: firm ? mediumOf(look) : look.dark ? 'chalk' : 'pencil',
    color: firm ? look.label : look.lineSoft,
    size: radius * (label.length > 2 ? 0.66 : label.length > 1 ? 0.78 : 0.88),
    seed: seed + 3,
    weight: look.dark ? 0.15 : 0.12,
  });
}

/** Little notes of what was felt in a room, set on the side of it facing away from its tunnels. */
function drawSensed(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  look: Look,
  room: number,
  at: (room: number) => Point,
  radius: number,
): void {
  const senses = scene.sensed.get(room);
  if (!senses || (!senses.pit && !senses.bats && senses.wumpus === 0)) return;
  const p = at(room);
  const away = freeSide(scene, room, at);
  let slot = 0;
  const place = () => {
    const angle = away + (slot - 0.5) * 0.62;
    slot += 1;
    return { x: p.x + Math.cos(angle) * radius * 1.75, y: p.y + Math.sin(angle) * radius * 1.75 };
  };
  const unit = radius * 0.5;
  if (senses.pit) drawDraft(ctx, place(), unit, look, room);
  if (senses.bats) drawBatNote(ctx, place(), unit, look, room);
  if (senses.wumpus > 0) {
    const strong = scene.rules === 'standard' && senses.wumpus === 1;
    drawWhiff(ctx, place(), unit, look, room, strong);
  }
}

function freeSide(scene: MapScene, room: number, at: (room: number) => Point): number {
  const p = at(room);
  let x = 0;
  let y = 0;
  for (const to of tunnelsFrom(scene.cave, room)) {
    if (isMagic(scene.cave, to) || to === room) continue;
    const q = at(to);
    const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    x += (q.x - p.x) / length;
    y += (q.y - p.y) / length;
  }
  return x === 0 && y === 0 ? -Math.PI / 4 : Math.atan2(-y, -x);
}

/** Three wavy lines: a draft. */
function drawDraft(
  ctx: CanvasRenderingContext2D,
  c: Point,
  unit: number,
  look: Look,
  seed: number,
): void {
  for (let row = -1; row <= 1; row++) {
    const points: Point[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      points.push({
        x: c.x - unit + t * unit * 2,
        y: c.y + row * unit * 0.55 + Math.sin(t * Math.PI * 2) * unit * 0.18,
      });
    }
    stroke(ctx, points, {
      medium: look.dark ? 'chalk' : 'pencil',
      color: look.marks.pit,
      width: 1.5,
      seed: seed + row,
      wobble: 0.3,
    });
  }
}

/** A little bat: two scalloped wings. */
function drawBatNote(
  ctx: CanvasRenderingContext2D,
  c: Point,
  unit: number,
  look: Look,
  seed: number,
): void {
  const w = unit * 1.15;
  const points: Point[] = [
    { x: c.x - w, y: c.y - unit * 0.35 },
    { x: c.x - w * 0.62, y: c.y + unit * 0.25 },
    { x: c.x - w * 0.36, y: c.y - unit * 0.02 },
    { x: c.x, y: c.y + unit * 0.4 },
    { x: c.x + w * 0.36, y: c.y - unit * 0.02 },
    { x: c.x + w * 0.62, y: c.y + unit * 0.25 },
    { x: c.x + w, y: c.y - unit * 0.35 },
  ];
  stroke(ctx, points, {
    medium: look.dark ? 'chalk' : 'pencil',
    color: look.marks.bats,
    width: 1.6,
    seed,
    wobble: 0.2,
  });
}

/** A green curl of smell; a strong one (one room away) curls twice. */
function drawWhiff(
  ctx: CanvasRenderingContext2D,
  c: Point,
  unit: number,
  look: Look,
  seed: number,
  strong: boolean,
): void {
  const curls = strong ? 2 : 1;
  for (let k = 0; k < curls; k++) {
    const points: Point[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      points.push({
        x: c.x - unit + t * unit * 2,
        y: c.y + (k - (curls - 1) / 2) * unit * 0.7 - Math.sin(t * Math.PI * 3) * unit * 0.28,
      });
    }
    stroke(ctx, points, {
      medium: look.dark ? 'chalk' : 'ink',
      color: look.marks.wumpus,
      width: strong ? 2.2 : 1.7,
      seed: seed + k * 5,
      wobble: 0.3,
    });
  }
}

const MARK_LETTER: Record<NotebookMark, string> = { safe: '✓', pit: 'P', bats: 'B', wumpus: 'W' };

/**
 * Notebook marks: each has its own shape as well as its own letter, so they read without colour —
 * a circle for safe, a triangle for a pit, a diamond for bats, a rounded square for the wumpus.
 */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  look: Look,
  mark: NotebookMark,
  c: Point,
  size: number,
  seed: number,
): void {
  const color = look.marks[mark];
  const medium: Medium = look.dark ? 'chalk' : 'pencil';
  const r = size / 2;
  let outline: Point[];
  if (mark === 'safe') outline = circlePoints(c, r * 1.05, seed, 0.2);
  else if (mark === 'pit') {
    outline = polygonPoints([
      { x: c.x, y: c.y - r * 1.15 },
      { x: c.x + r * 1.2, y: c.y + r * 0.85 },
      { x: c.x - r * 1.2, y: c.y + r * 0.85 },
    ]);
  } else if (mark === 'bats') {
    outline = polygonPoints([
      { x: c.x, y: c.y - r * 1.2 },
      { x: c.x + r * 1.2, y: c.y },
      { x: c.x, y: c.y + r * 1.2 },
      { x: c.x - r * 1.2, y: c.y },
    ]);
  } else {
    const k = r;
    const bevel = r * 0.3;
    outline = polygonPoints([
      { x: c.x - k, y: c.y - k + bevel },
      { x: c.x - k + bevel, y: c.y - k },
      { x: c.x + k - bevel, y: c.y - k },
      { x: c.x + k, y: c.y - k + bevel },
      { x: c.x + k, y: c.y + k - bevel },
      { x: c.x + k - bevel, y: c.y + k },
      { x: c.x - k + bevel, y: c.y + k },
      { x: c.x - k, y: c.y + k - bevel },
    ]);
  }
  stroke(ctx, outline, { medium, color, width: look.dark ? 2.4 : 1.9, seed, wobble: 0.35 });
  letter(ctx, MARK_LETTER[mark], c.x, c.y + (mark === 'pit' ? r * 0.28 : 0), {
    medium,
    color,
    size: size * (mark === 'pit' ? 0.62 : 0.72),
    seed: seed + 1,
    weight: 0.17,
  });
}

function drawMarks(
  ctx: CanvasRenderingContext2D,
  look: Look,
  marks: ReadonlySet<NotebookMark>,
  p: Point,
  radius: number,
  room: number,
): void {
  const size = radius * 0.9;
  [...marks].forEach((mark, i) => {
    const c = { x: p.x + radius * 0.95 + i * size * 1.05, y: p.y - radius * 0.95 };
    drawMark(ctx, look, mark, c, size, room * 31 + i);
  });
}

/** On the revealed map: holes for pits, a bat for bats, a sleepy face for the wumpus. */
function drawHazards(
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  reveal: MapReveal,
  look: Look,
  at: (room: number) => Point,
  radius: number,
): void {
  for (let room = 1; room <= scene.cave.size; room++) {
    const p = at(room);
    const below = { x: p.x, y: p.y + radius * 1.55 };
    if (reveal.pits[room]) {
      ctx.save();
      ctx.fillStyle = look.dark ? '#000' : look.outline;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(below.x, below.y, radius * 0.62, radius * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      stroke(
        ctx,
        circlePoints(below, radius * 0.66, room).map((q) => ({
          x: q.x,
          y: below.y + (q.y - below.y) * 0.4,
        })),
        {
          medium: mediumOf(look),
          color: look.marks.pit,
          width: 1.6,
          seed: room,
          wobble: 0.3,
        },
      );
    }
    if (reveal.bats[room]) {
      const c = { x: p.x - radius * 1.25, y: p.y - radius * 1.15 };
      drawBatNote(ctx, c, radius * 0.48, look, room + 5);
    }
    if (room === reveal.wumpus) {
      ctx.save();
      ctx.strokeStyle = look.marks.wumpus;
      ctx.lineWidth = 3;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 1.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** You are here: a looser second ring and a small flame above the room. */
function drawHere(
  ctx: CanvasRenderingContext2D,
  look: Look,
  p: Point,
  radius: number,
  time: number,
): void {
  if (look.dark) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(p.x, p.y, radius * 0.4, p.x, p.y, radius * 3.2);
    glow.addColorStop(0, 'rgba(255, 181, 71, 0.42)');
    glow.addColorStop(1, 'rgba(255, 181, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  stroke(ctx, circlePoints(p, radius * 1.32, 77, 0.6), {
    medium: look.dark ? 'chalk' : 'ink',
    color: look.here,
    width: look.dark ? 3 : 2.4,
    seed: 77,
    wobble: 1.6,
  });
  const flicker = Math.sin(time * 9) * 0.6 + Math.sin(time * 5.3) * 0.4;
  const top = { x: p.x + radius * 0.95, y: p.y - radius * 1.25 };
  ctx.save();
  ctx.fillStyle = look.here;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y - radius * 0.62 - flicker);
  ctx.quadraticCurveTo(top.x + radius * 0.36, top.y - radius * 0.1, top.x, top.y + radius * 0.2);
  ctx.quadraticCurveTo(
    top.x - radius * 0.36,
    top.y - radius * 0.1,
    top.x,
    top.y - radius * 0.62 - flicker,
  );
  ctx.fill();
  ctx.restore();
}
