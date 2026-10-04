import { worldName } from '../data/worlds';
import type { Beat } from '../engine/beats';
import { systemsDown } from '../engine/preview';
import type { Point, WatchState } from '../engine/types';
import { type FlareGuide, flareGuide } from './flare-guide';
import { decorRandom, hashOf, type Look, PALETTES, type Palette } from './palette';
import { type Scene, sceneAtArrival, sceneOf, samePoint } from './scene';
import {
  drawGleaner,
  drawHarbour,
  drawHole,
  drawShip,
  drawStar,
  drawWorld,
  type ShipLook,
} from './sprites';

/**
 * The tactical view of the ship's zone: ten by ten cells on a starfield or a paper chart, the
 * things in it, the preview of the order being aimed, and the animation of the last order's
 * beats. Rules never live here; it only draws what the engine said happened.
 */

export type ZoneOverlay =
  | { kind: 'none' }
  | {
      kind: 'path';
      cells: Point[];
      stop: Point;
      blocked: Point | null;
      leaves: boolean;
      warn: boolean;
    }
  | {
      kind: 'flare';
      path: Point[];
      hit: Point | null;
      bearing: number;
      scatter: number;
      burst: number;
    }
  | { kind: 'beams'; targets: { at: Point; expected: number; stopped: boolean }[] }
  | { kind: 'hail'; target: Point; chance: number };

interface Effect {
  start: number;
  end: number;
  draw(ctx: CanvasRenderingContext2D, k: number, view: ZoneView): void;
}

interface Tween {
  key: number;
  from: Point;
  to: Point;
  start: number;
  end: number;
  fadeOut?: boolean;
}

interface Pending {
  at: number;
  apply(): void;
}

export interface Geometry {
  x0: number;
  y0: number;
  cell: number;
  board: number;
}

const now = () => performance.now() / 1000;

/** The Lantern drawn a third larger than her cell: the hero of the zone. */
const SHIP_SCALE = 1.32;
/** How long a saved world's moment lasts, in seconds; the order's animation waits for it. */
const MOMENT_SECONDS = 1.5;
const STILL_MOMENT_SECONDS = 1.2;

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const smooth = (k: number) => k * k * (3 - 2 * k);

export class ZoneView {
  readonly ctx: CanvasRenderingContext2D;
  look: Look;
  p: Palette;
  reducedMotion: boolean;
  pace = 1;
  scene: Scene | null = null;
  heading = 0;
  ship: Omit<ShipLook, 'heading'> = {
    shieldUp: false,
    shieldFraction: 1,
    shrouded: false,
    moored: false,
    ember: false,
    beamsReady: false,
  };
  overlay: ZoneOverlay = { kind: 'none' };
  /**
   * When the last order's saved-world moment begins, in seconds after the order started, or
   * null when it saved none here. The screen times the chime and the chart by it.
   */
  lastMomentAt: number | null = null;
  cursor: Point | null = null;
  selected: Point | null = null;
  showCursor = false;
  geometry: Geometry = { x0: 0, y0: 0, cell: 40, board: 400 };
  private width = 0;
  private height = 0;
  private ratio = 1;
  private background: HTMLCanvasElement | null = null;
  private backgroundKey = '';
  private effects: Effect[] = [];
  private tweens = new Map<number, Tween>();
  private shipTween: { from: Point; to: Point; start: number; end: number } | null = null;
  private pending: Pending[] = [];
  private frame = 0;
  private visible = true;
  private busyUntil = 0;
  private stillTime = 1.3;
  /** A world being saved: the camera eases towards it while its moment plays. */
  private moment: { at: Point; name: string; start: number; end: number } | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    look: Look,
    reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.look = look;
    this.p = PALETTES[look];
    this.reducedMotion = reducedMotion;
  }

  start() {
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (this.visible) this.draw();
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.frame);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.p = PALETTES[look];
    this.reducedMotion = reducedMotion;
    this.backgroundKey = '';
  }

  resize(width: number, height: number) {
    this.ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    const pad = Math.max(16, Math.min(this.width, this.height) * 0.04);
    const board = Math.max(10, Math.min(this.width, this.height) - pad * 2);
    this.geometry = {
      board,
      cell: board / 10,
      x0: (this.width - board) / 2,
      y0: (this.height - board) / 2,
    };
    this.backgroundKey = '';
  }

  /** Shows a state at once, without animation. */
  show(s: WatchState) {
    this.scene = sceneOf(s);
    this.syncShip(s);
    this.effects = [];
    this.tweens.clear();
    this.shipTween = null;
    this.pending = [];
    this.busyUntil = 0;
    this.moment = null;
  }

  get busy(): boolean {
    return now() < this.busyUntil;
  }

  /** Ends the playing animation at once and shows the final state. */
  skip(next: WatchState) {
    for (const item of this.pending) item.apply();
    this.show(next);
  }

  /** The flare being aimed, as it is drawn; null when no flare is being aimed. */
  flareGuide(): FlareGuide | null {
    const overlay = this.overlay;
    if (overlay.kind !== 'flare' || !this.scene) return null;
    return flareGuide(this.geometry, this.scene.ship, overlay);
  }

  /** The world whose saving is blooming right now, if any. */
  get blooming(): string | null {
    const m = this.moment;
    return m && now() >= m.start && now() <= m.end ? m.name : null;
  }

  center(at: Point): { x: number; y: number } {
    const { x0, y0, cell } = this.geometry;
    return { x: x0 + (at.col + 0.5) * cell, y: y0 + (at.row + 0.5) * cell };
  }

  cellAtPixel(x: number, y: number): Point | null {
    const { x0, y0, cell } = this.geometry;
    const col = Math.floor((x - x0) / cell);
    const row = Math.floor((y - y0) / cell);
    if (row < 0 || row > 9 || col < 0 || col > 9) return null;
    return { row, col };
  }

  private syncShip(s: WatchState) {
    const moored = s.ship.condition === 'moored';
    this.ship = {
      shieldUp: s.ship.shieldUp,
      shieldFraction: s.ship.shield / s.params.shield,
      shrouded: s.ship.shrouded,
      moored,
      ember: s.ship.vessel === 'ember',
      // The emitters glow while a volley could be fired: power aboard, the banks working.
      beamsReady:
        !moored &&
        !s.ship.shrouded &&
        s.ship.energy > 0 &&
        !systemsDown(s).some((down) => down.system === 'beams'),
    };
  }

  /**
   * Plays one order's beats over the scene and returns how long that takes, in seconds. The
   * scene ends exactly on `next`.
   */
  play(prev: WatchState, next: WatchState, beats: readonly Beat[]): number {
    if (!this.scene) this.show(prev);
    const speed = (this.reducedMotion ? 0.45 : 1) * this.pace;
    const d = (seconds: number) => seconds * speed;
    const start = now();
    let t = start;
    const at = (time: number, apply: () => void) => this.pending.push({ at: time, apply });
    const shipPos = () => this.scene?.ship ?? next.ship.cell;
    let volleyAt = -1;
    let beamAt = -1;
    this.lastMomentAt = null;

    beats.forEach((beat, index) => {
      if (beat.type !== 'shot' && volleyAt >= 0) {
        t = Math.max(t, volleyAt + d(0.32));
        volleyAt = -1;
      }
      if (beat.type !== 'beam' && beamAt >= 0) {
        t = Math.max(t, beamAt + d(0.4));
        beamAt = -1;
      }
      switch (beat.type) {
        case 'travel': {
          const changed = !samePoint(beat.from.zone, beat.to.zone);
          const heading = Math.atan2(
            beat.to.cell.col - beat.from.cell.col + (beat.to.zone.col - beat.from.zone.col) * 10,
            beat.from.cell.row - beat.to.cell.row + (beat.from.zone.row - beat.to.zone.row) * 10,
          );
          at(t, () => {
            this.heading = heading;
          });
          if (!changed) {
            const tStart = t;
            const duration = d(0.42);
            at(t, () => {
              const from = { ...(this.scene?.ship ?? beat.from.cell) };
              if (this.reducedMotion) {
                if (this.scene) this.scene.ship = { ...beat.to.cell };
                return;
              }
              this.shipTween = {
                from,
                to: { ...beat.to.cell },
                start: tStart,
                end: tStart + duration,
              };
              if (this.scene) this.scene.ship = { ...beat.to.cell };
            });
            t += duration;
          } else {
            t = this.jump(t, d, next, beats.slice(index + 1));
          }
          break;
        }
        case 'snared':
        case 'black-hole':
        case 'rim':
          t = this.jump(t, d, next, beats.slice(index + 1));
          break;
        case 'gleaner-moved': {
          const time = t;
          at(time, () => {
            const g = this.scene?.gleaners.find((x) => samePoint(x, beat.from));
            if (!g) return;
            g.row = beat.to.row;
            g.col = beat.to.col;
            if (!this.reducedMotion)
              this.tweens.set(g.key, {
                key: g.key,
                from: beat.from,
                to: beat.to,
                start: time,
                end: time + d(0.32),
              });
          });
          if (beats[index + 1]?.type !== 'gleaner-moved') t += d(0.34);
          break;
        }
        case 'gleaner-left': {
          const time = t;
          at(time, () => {
            const g = this.scene?.gleaners.find((x) => samePoint(x, beat.from));
            if (!g || !this.scene) return;
            this.scene.gleaners = this.scene.gleaners.filter((x) => x !== g);
            const edge = edgeToward(beat.from, beat.toZone, next.ship.zone);
            this.addEffect(time, d(0.45), (ctx, k) => {
              const a = this.center(beat.from);
              const b = this.center(edge);
              const { cell } = this.geometry;
              ctx.globalAlpha = 1 - k;
              drawGleaner(
                ctx,
                a.x + (b.x - a.x) * k,
                a.y + (b.y - a.y) * k,
                cell,
                this.p,
                this.look,
                time,
                g.charge,
                g.key,
              );
              ctx.globalAlpha = 1;
            });
          });
          t += d(0.2);
          break;
        }
        case 'gleaner-arrived': {
          const time = t;
          at(time, () => {
            this.scene?.gleaners.push({ key: Math.random(), ...beat.at, charge: 1 });
            this.addEffect(time, d(0.6), (ctx, k) =>
              this.ring(ctx, beat.at, k, this.p.gleaner, 0.2, 0.9),
            );
          });
          t += d(0.4);
          break;
        }
        case 'shot': {
          if (volleyAt < 0) volleyAt = t;
          const time = volleyAt;
          volleyAt += d(0.12);
          this.addEffect(time, d(0.3), (ctx, k) => this.bolt(ctx, beat.from, shipPos(), k));
          this.addEffect(time + d(0.24), d(0.7), (ctx, k) => {
            if (beat.absorbed > 0) this.ring(ctx, shipPos(), k, this.p.shield, 0.45, 0.75);
            this.floater(ctx, shipPos(), `−${beat.hit - beat.absorbed}`, this.p.danger, k);
          });
          break;
        }
        case 'beam': {
          if (beamAt < 0) beamAt = t;
          const time = beamAt;
          beamAt += d(0.1);
          this.addEffect(time, d(0.42), (ctx, k) =>
            this.ray(ctx, shipPos(), beat.target, k, beat.bank),
          );
          this.addEffect(time + d(0.2), d(0.8), (ctx, k) =>
            this.floater(ctx, beat.target, `${beat.hit}`, this.p.beam, k),
          );
          break;
        }
        case 'gleaner-stopped': {
          const time = Math.max(t, beamAt >= 0 ? beamAt + d(0.25) : t);
          at(time, () => {
            const g = this.scene?.gleaners.find((x) => samePoint(x, beat.at));
            if (this.scene)
              this.scene.gleaners = this.scene.gleaners.filter((x) => !samePoint(x, beat.at));
            const seed = g?.key ?? 1;
            this.addEffect(time, d(0.8), (ctx, k) => this.husk(ctx, beat.at, k, seed));
          });
          if (beamAt < 0) t += d(0.35);
          break;
        }
        case 'gleaner-hit':
          this.addEffect(t, d(0.8), (ctx, k) =>
            this.floater(ctx, beat.at, `−${beat.damage}`, this.p.flare, k),
          );
          break;
        case 'flare': {
          const time = t;
          const duration = d(0.06 * Math.max(1, beat.path.length) + 0.1);
          this.addEffect(time, duration, (ctx, k) => this.flareFlight(ctx, beat.path, k));
          this.addEffect(time + duration, d(0.4), (ctx, k) => {
            const end = beat.path[beat.path.length - 1];
            if (end) this.ring(ctx, end, k, this.p.flare, 0.1, 0.55);
          });
          t += duration + d(0.12);
          break;
        }
        case 'nova': {
          const time = t;
          at(time, () => {
            if (!this.scene) return;
            this.scene.stars = this.scene.stars.filter((s) => !samePoint(s, beat.at));
            if (beat.leftHole) this.scene.holes.push({ ...beat.at });
          });
          this.addEffect(time, d(0.9), (ctx, k) => this.nova(ctx, beat.at, k));
          t += d(0.45);
          break;
        }
        case 'nova-fizzled':
          this.addEffect(t, d(0.5), (ctx, k) => this.ring(ctx, beat.at, k, this.p.star, 0.2, 0.5));
          t += d(0.2);
          break;
        case 'world-destroyed':
          if (samePoint(beat.zone, next.ship.zone)) {
            at(t, () => {
              if (this.scene) this.scene.world = null;
            });
          }
          break;
        case 'harbour-lost':
          if (samePoint(beat.zone, next.ship.zone)) {
            at(t, () => {
              if (this.scene) this.scene.harbour = null;
            });
          }
          break;
        case 'collapse':
          if (beat.here) {
            this.addEffect(t, d(1.2), (ctx, k) => this.whiteout(ctx, k));
            t += d(0.8);
          }
          break;
        case 'shield': {
          const time = t;
          at(time, () => {
            this.ship.shieldUp = beat.up;
          });
          this.addEffect(time, d(0.5), (ctx, k) =>
            this.ring(ctx, shipPos(), k, this.p.shield, 0.3, 0.7),
          );
          t += d(0.25);
          break;
        }
        case 'hail':
          this.addEffect(t, d(0.7), (ctx, k) => this.hailWaves(ctx, shipPos(), beat.at, k));
          t += d(0.6);
          break;
        case 'moored':
          this.addEffect(t, d(0.8), (ctx, k) =>
            this.ring(ctx, shipPos(), k, this.p.lamp, 0.3, 1.2),
          );
          t += d(0.3);
          break;
        case 'swept':
          at(t, () => {
            if (this.scene) this.scene.swept.push(...beat.cells);
          });
          break;
        case 'world-relit': {
          // The signature moment: once the beams have landed, the saved world blooms.
          if (!beat.byUs || !samePoint(beat.zone, next.ship.zone) || !next.worldCell) break;
          const time = t + d(0.3);
          const duration = this.reducedMotion ? STILL_MOMENT_SECONDS : MOMENT_SECONDS;
          const where = { ...next.worldCell };
          const name = worldName(beat.world);
          this.lastMomentAt = time - start;
          at(time, () => {
            this.moment = { at: where, name, start: time, end: time + duration };
          });
          this.addEffect(time, duration, (ctx, k) => this.bloom(ctx, where, name, beat.world, k));
          t = time + duration;
          break;
        }
        default:
      }
    });
    if (volleyAt >= 0) t = Math.max(t, volleyAt + d(0.32));
    if (beamAt >= 0) t = Math.max(t, beamAt + d(0.4));
    const end = t + d(0.15);
    at(end, () => {
      this.scene = sceneOf(next);
      this.syncShip(next);
      this.tweens.clear();
      this.shipTween = null;
    });
    this.busyUntil = end;
    return end - start;
  }

  /** Leaving one zone and appearing in the next: the board streaks away and fades back in. */
  private jump(
    t: number,
    d: (s: number) => number,
    next: WatchState,
    after: readonly Beat[],
  ): number {
    const out = d(0.45);
    const inn = d(0.45);
    this.addEffect(t, out, (ctx, k) => this.streaks(ctx, k, false));
    this.pending.push({
      at: t + out,
      apply: () => {
        this.scene = sceneAtArrival(next, after);
        this.syncShip(next);
        this.tweens.clear();
        this.shipTween = null;
      },
    });
    this.addEffect(t + out, inn, (ctx, k) => this.streaks(ctx, k, true));
    return t + out + inn * 0.6;
  }

  private addEffect(start: number, duration: number, draw: Effect['draw']) {
    this.effects.push({ start, end: start + Math.max(0.01, duration), draw });
  }

  draw() {
    if (this.width < 4 || this.height < 4) return;
    const { ctx } = this;
    const time = now();
    for (const item of this.pending.filter((p) => p.at <= time)) item.apply();
    this.pending = this.pending.filter((p) => p.at > time);
    const t = this.reducedMotion ? this.stillTime : time;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const camera = this.camera(time);
    if (camera) {
      ctx.translate(camera.x + camera.focusX, camera.y + camera.focusY);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.focusX, -camera.focusY);
    }
    this.drawBackground();
    const scene = this.scene;
    if (scene) {
      this.drawOverlayUnder(t);
      this.drawThings(scene, t, time);
      this.drawOverlayOver(t);
    }
    this.effects = this.effects.filter((effect) => effect.end > time);
    for (const effect of this.effects) {
      if (effect.start > time) continue;
      const k = Math.min(1, (time - effect.start) / (effect.end - effect.start));
      ctx.save();
      effect.draw(ctx, k, this);
      ctx.restore();
    }
  }

  /**
   * While a saved world's moment plays, the view leans in towards it: a little closer, and a
   * world in a corner drawn towards the middle, so the moment is seen. Still under reduced
   * motion.
   */
  private camera(
    time: number,
  ): { zoom: number; x: number; y: number; focusX: number; focusY: number } | null {
    const m = this.moment;
    if (!m || this.reducedMotion || time < m.start || time > m.end) return null;
    const k = (time - m.start) / (m.end - m.start);
    const lean = k < 0.25 ? smooth(k / 0.25) : k > 0.8 ? smooth((1 - k) / 0.2) : 1;
    const focus = this.center(m.at);
    const middleX = this.width / 2;
    const middleY = this.height / 2;
    const offCentre = Math.min(
      1,
      Math.hypot(focus.x - middleX, focus.y - middleY) / (this.geometry.board * 0.45),
    );
    const pull = 0.38 * lean * offCentre;
    const zoom = 1 + 0.16 * lean;
    // Never pull so far that the view slides off the painted canvas and bares its edge.
    const keepCovered = (shift: number, at: number, size: number) =>
      Math.min(at * (zoom - 1), Math.max(-(size - at) * (zoom - 1), shift));
    return {
      zoom,
      x: keepCovered((middleX - focus.x) * pull, focus.x, this.width),
      y: keepCovered((middleY - focus.y) * pull, focus.y, this.height),
      focusX: focus.x,
      focusY: focus.y,
    };
  }

  private drawBackground() {
    const key = `${this.look}:${this.width}x${this.height}:${this.scene?.zone.row},${this.scene?.zone.col}:${this.scene?.collapsed}`;
    if (key !== this.backgroundKey || !this.background) {
      this.background = paintBackground(
        this.width,
        this.height,
        this.ratio,
        this.geometry,
        this.look,
        this.scene,
      );
      this.backgroundKey = key;
    }
    this.ctx.drawImage(this.background, 0, 0, this.width, this.height);
  }

  private visibleCell(scene: Scene, at: Point): boolean {
    if (!scene.dark) return true;
    if (Math.abs(at.row - scene.ship.row) <= 0 && Math.abs(at.col - scene.ship.col) <= 0)
      return true;
    return scene.swept.some((s) => samePoint(s, at));
  }

  private drawThings(scene: Scene, t: number, time: number) {
    const { ctx, p, look } = this;
    const { cell } = this.geometry;
    if (scene.dark) this.drawDarkness(scene);
    for (const star of scene.stars) {
      if (!this.visibleCell(scene, star)) continue;
      const c = this.center(star);
      drawStar(
        ctx,
        c.x,
        c.y,
        cell,
        p,
        look,
        t,
        hashOf(`${scene.zone.row}${scene.zone.col}${star.row}${star.col}`),
      );
    }
    for (const hole of scene.holes) {
      if (!this.visibleCell(scene, hole)) continue;
      const c = this.center(hole);
      drawHole(ctx, c.x, c.y, cell, p, look, t);
    }
    if (scene.world && this.visibleCell(scene, scene.world.at)) {
      const c = this.center(scene.world.at);
      drawWorld(ctx, c.x, c.y, cell * 0.3, p, look, t, scene.world.state, scene.world.index * 31);
    }
    if (scene.harbour && this.visibleCell(scene, scene.harbour)) {
      const c = this.center(scene.harbour);
      drawHarbour(ctx, c.x, c.y, cell, p, look, t);
    }
    for (const g of scene.gleaners) {
      if (!this.visibleCell(scene, g)) continue;
      const pos = this.tweened(g.key, g, time);
      drawGleaner(ctx, pos.x, pos.y, cell, p, look, t, g.charge, g.key % 7);
    }
    const shipPos = this.shipTween ? this.lerp(this.shipTween, time) : this.center(scene.ship);
    drawShip(ctx, shipPos.x, shipPos.y, cell * SHIP_SCALE, p, look, t, {
      ...this.ship,
      heading: this.heading,
      beamReach: 1.7,
    });
  }

  private drawDarkness(scene: Scene) {
    const { ctx } = this;
    const { cell } = this.geometry;
    ctx.save();
    ctx.fillStyle = this.look === 'night' ? 'rgba(2, 4, 10, 0.72)' : 'rgba(29, 39, 65, 0.22)';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (this.visibleCell(scene, { row, col })) continue;
        const c = this.center({ row, col });
        ctx.fillRect(c.x - cell / 2, c.y - cell / 2, cell, cell);
      }
    }
    ctx.restore();
  }

  private tweened(key: number, at: Point, time: number): { x: number; y: number } {
    const tween = this.tweens.get(key);
    if (!tween || time >= tween.end) return this.center(at);
    return this.lerp(tween, time);
  }

  private lerp(tween: { from: Point; to: Point; start: number; end: number }, time: number) {
    const k = Math.max(0, Math.min(1, (time - tween.start) / (tween.end - tween.start)));
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const a = this.center(tween.from);
    const b = this.center(tween.to);
    return { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease };
  }

  private drawOverlayUnder(t: number) {
    const { ctx, p } = this;
    const { cell } = this.geometry;
    const overlay = this.overlay;
    if (overlay.kind === 'path') {
      ctx.save();
      ctx.strokeStyle = overlay.warn ? p.danger : p.lamp;
      ctx.fillStyle = overlay.warn ? p.danger : p.lamp;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.setLineDash([cell * 0.14, cell * 0.12]);
      ctx.lineDashOffset = -t * cell * 0.3;
      const scene = this.scene!;
      const from = this.center(scene.ship);
      const points = overlay.cells.map((c) => this.center(c));
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      for (const pt of points) ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const stop = this.center(overlay.stop);
      if (!overlay.leaves) {
        ctx.beginPath();
        ctx.arc(stop.x, stop.y, cell * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      if (overlay.blocked) {
        const b = this.center(overlay.blocked);
        ctx.strokeStyle = p.danger;
        ctx.lineWidth = Math.max(2, cell * 0.07);
        ctx.beginPath();
        ctx.moveTo(b.x - cell * 0.3, b.y - cell * 0.3);
        ctx.lineTo(b.x + cell * 0.3, b.y + cell * 0.3);
        ctx.moveTo(b.x + cell * 0.3, b.y - cell * 0.3);
        ctx.lineTo(b.x - cell * 0.3, b.y + cell * 0.3);
        ctx.stroke();
      }
      ctx.restore();
    }
    const guide = this.flareGuide();
    if (guide) {
      const { from, to: end } = guide;
      const reach = cell * 11;
      ctx.save();
      // The stray wedges: where the flare may really go, ±scatter either side of the bearing;
      // a spread of three (Shift) adds two faint ones. Then the bearing itself, flown true.
      for (const wedge of guide.wedges) {
        ctx.save();
        if (wedge.faint) ctx.globalAlpha = 0.35;
        this.wedge(ctx, from, reach, wedge.from, wedge.to);
        ctx.restore();
      }
      ctx.strokeStyle = p.flare;
      ctx.lineWidth = Math.max(2, cell * 0.05);
      ctx.lineCap = 'round';
      ctx.setLineDash([cell * 0.12, cell * 0.08]);
      ctx.lineDashOffset = this.reducedMotion ? 0 : -t * cell * 0.25;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The stray wedge of a flare; in the Chart look hatched in ink with a darker edge. */
  private wedge(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    reach: number,
    a0: number,
    a1: number,
  ) {
    const { cell } = this.geometry;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.arc(from.x, from.y, reach, a0, a1);
      ctx.closePath();
    };
    ctx.save();
    path();
    if (this.look === 'night') {
      ctx.fillStyle = 'rgba(255, 210, 120, 0.11)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 210, 120, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(184, 95, 0, 0.12)';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(122, 64, 0, 0.32)';
      ctx.lineWidth = 1;
      const step = cell * 0.18;
      for (let d = -reach; d < reach; d += step) {
        ctx.beginPath();
        ctx.moveTo(from.x + d - reach, from.y - reach);
        ctx.lineTo(from.x + d + reach, from.y + reach);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      path();
      ctx.strokeStyle = '#8a4a00';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawOverlayOver(t: number) {
    const { ctx, p } = this;
    const { cell } = this.geometry;
    const overlay = this.overlay;
    if (overlay.kind === 'flare' && overlay.hit) {
      this.reticle(ctx, overlay.hit, p.flare, t);
    }
    if (overlay.kind === 'hail') {
      this.reticle(ctx, overlay.target, p.lamp, t);
      this.label(ctx, overlay.target, `${overlay.chance}%`, p.lamp);
    }
    if (overlay.kind === 'beams') {
      for (const target of overlay.targets) {
        const c = this.center(target.at);
        ctx.save();
        ctx.strokeStyle = target.stopped ? p.beam : p.ink2;
        ctx.lineWidth = Math.max(2, cell * 0.05);
        ctx.setLineDash(target.stopped ? [] : [cell * 0.08, cell * 0.06]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, cell * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // A label goes below its gleaner when another gleaner sits right above.
        const crowded = overlay.targets.some(
          (other) => other.at.row === target.at.row - 1 && other.at.col === target.at.col,
        );
        this.label(
          ctx,
          target.at,
          target.stopped ? 'stops' : `−${target.expected}`,
          target.stopped ? p.beam : p.ink2,
          crowded ? 'below' : 'above',
        );
      }
    }
    if (this.selected) this.reticle(ctx, this.selected, p.lamp, t);
    if (this.cursor && this.showCursor) {
      // Corner brackets, so the keyboard cursor never hides what sits in the cell.
      const c = this.center(this.cursor);
      const half = cell / 2 - 2;
      const arm = cell * 0.22;
      ctx.save();
      ctx.strokeStyle = p.cursor;
      ctx.lineWidth = 2;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(c.x + sx * half, c.y + sy * (half - arm));
        ctx.lineTo(c.x + sx * half, c.y + sy * half);
        ctx.lineTo(c.x + sx * (half - arm), c.y + sy * half);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private reticle(ctx: CanvasRenderingContext2D, at: Point, color: string, t: number) {
    const c = this.center(at);
    const { cell } = this.geometry;
    const r = cell * (0.46 + (this.reducedMotion ? 0 : 0.03 * Math.sin(t * 4)));
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, cell * 0.05);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, a - 0.4, a + 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private label(
    ctx: CanvasRenderingContext2D,
    at: Point,
    text: string,
    color: string,
    side: 'above' | 'below' = 'above',
  ) {
    const c = this.center(at);
    const { cell } = this.geometry;
    const y = side === 'above' ? c.y - cell * 0.5 : c.y + cell * 0.5;
    ctx.save();
    ctx.font = `600 ${Math.max(12, cell * 0.24)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = side === 'above' ? 'bottom' : 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.look === 'night' ? 'rgba(6, 10, 23, 0.85)' : 'rgba(244, 235, 215, 0.9)';
    ctx.strokeText(text, c.x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, c.x, y);
    ctx.restore();
  }

  private bolt(ctx: CanvasRenderingContext2D, from: Point, to: Point, k: number) {
    const a = this.center(from);
    const b = this.center(to);
    const head = Math.min(1, k * 1.4);
    const tail = Math.max(0, k * 1.4 - 0.4);
    ctx.strokeStyle = this.p.shot;
    ctx.lineWidth = Math.max(2, this.geometry.cell * 0.06);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - k * 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail);
    ctx.lineTo(a.x + (b.x - a.x) * head, a.y + (b.y - a.y) * head);
    ctx.stroke();
  }

  private ray(ctx: CanvasRenderingContext2D, from: Point, to: Point, k: number, bank: number) {
    const a = this.center(from);
    const b = this.center(to);
    const { cell } = this.geometry;
    const reach = Math.min(1, k * 3);
    const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    const wobble = ((bank % 3) - 1) * cell * 0.08;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = this.p.beam;
    ctx.lineCap = 'round';
    for (const [width, alpha] of [
      [cell * 0.22, 0.18],
      [cell * 0.09, 0.5],
      [cell * 0.035, 1],
    ] as const) {
      ctx.globalAlpha = fade * alpha;
      ctx.lineWidth = Math.max(1, width);
      ctx.beginPath();
      ctx.moveTo(a.x + wobble, a.y - wobble);
      ctx.lineTo(a.x + (b.x - a.x) * reach, a.y + (b.y - a.y) * reach);
      ctx.stroke();
    }
  }

  private flareFlight(ctx: CanvasRenderingContext2D, path: readonly Point[], k: number) {
    if (path.length === 0 || !this.scene) return;
    const points = [this.scene.ship, ...path].map((c) => this.center(c));
    const pos = k * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(pos));
    const f = pos - i;
    const a = points[i]!;
    const b = points[i + 1] ?? a;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    const { cell } = this.geometry;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.35);
    glow.addColorStop(0, this.p.flare);
    glow.addColorStop(0.4, this.p.lampSoft);
    glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.p.lamp;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    const tailStart = points[Math.max(0, i - 1)]!;
    ctx.moveTo(tailStart.x, tailStart.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  private ring(
    ctx: CanvasRenderingContext2D,
    at: Point,
    k: number,
    color: string,
    from: number,
    to: number,
  ) {
    const c = this.center(at);
    const { cell } = this.geometry;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = Math.max(1.5, cell * 0.05 * (1 - k) + 1);
    ctx.beginPath();
    ctx.arc(c.x, c.y, cell * (from + (to - from) * k), 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * A world saved: its light swells outward in two rings, the world shines over everything,
   * and its name lifts above it in the display face. Under reduced motion: a steady ring and
   * the name, at once.
   */
  private bloom(ctx: CanvasRenderingContext2D, at: Point, name: string, world: number, k: number) {
    const c = this.center(at);
    const { cell, x0, board } = this.geometry;
    const { p, look } = this;
    const still = this.reducedMotion;
    const fade = k > 0.82 ? (1 - k) / 0.18 : 1;
    if (!still) {
      const grow = easeOut(Math.min(1, k / 0.65));
      const radius = cell * (0.6 + 2.8 * grow);
      const light = ctx.createRadialGradient(c.x, c.y, cell * 0.2, c.x, c.y, radius);
      light.addColorStop(
        0,
        look === 'night' ? 'rgba(255, 214, 130, 0.7)' : 'rgba(242, 166, 50, 0.5)',
      );
      light.addColorStop(
        0.45,
        look === 'night' ? 'rgba(255, 196, 92, 0.22)' : 'rgba(242, 166, 50, 0.18)',
      );
      light.addColorStop(1, 'rgba(255, 196, 92, 0)');
      ctx.globalAlpha = (k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35) * fade;
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.lamp;
      for (const delay of [0, 0.16]) {
        const f = Math.max(0, Math.min(1, (k - delay) / 0.6));
        if (f <= 0 || f >= 1) continue;
        ctx.globalAlpha = (1 - f) * fade;
        ctx.lineWidth = Math.max(1.5, cell * 0.06 * (1 - f));
        ctx.beginPath();
        ctx.arc(c.x, c.y, cell * (0.45 + 2.3 * easeOut(f)), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.globalAlpha = fade;
      ctx.strokeStyle = p.lamp;
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(c.x, c.y, cell * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = fade;
    const swell = still ? 0 : 0.06 * Math.sin(Math.min(1, k / 0.5) * Math.PI);
    drawWorld(ctx, c.x, c.y, cell * (0.32 + swell), p, look, 1.3, 'lit', world * 31);
    // The name rises over the world (below it when the world sits on the top row).
    const rise = still ? 1 : easeOut(Math.min(1, k / 0.35));
    const below = at.row < 1;
    const size = Math.max(20, cell * 0.44);
    ctx.font = `600 ${size}px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif`;
    const width = ctx.measureText(name).width;
    const x = Math.min(Math.max(c.x, x0 + width / 2 + 4), x0 + board - width / 2 - 4);
    const y = below ? c.y + cell * (0.55 + 0.4 * rise) + size : c.y - cell * (0.5 + 0.45 * rise);
    ctx.globalAlpha = (still ? 1 : Math.min(1, k / 0.25)) * fade;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * 0.22);
    ctx.strokeStyle = look === 'night' ? 'rgba(6, 10, 23, 0.85)' : 'rgba(244, 235, 215, 0.92)';
    ctx.strokeText(name, x, y);
    ctx.fillStyle = look === 'night' ? p.lampSoft : p.ink;
    ctx.fillText(name, x, y);
    ctx.font = `600 ${Math.max(11, size * 0.42)}px "IBM Plex Mono", ui-monospace, monospace`;
    const small = 'SAFE';
    ctx.lineWidth = 3;
    ctx.strokeText(small, x, y + size * 0.62);
    ctx.fillStyle = p.lamp;
    ctx.fillText(small, x, y + size * 0.62);
  }

  private nova(ctx: CanvasRenderingContext2D, at: Point, k: number) {
    const c = this.center(at);
    const { cell } = this.geometry;
    const r = cell * (0.3 + 1.5 * k);
    const flash = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    flash.addColorStop(0, this.p.nova);
    flash.addColorStop(
      0.5,
      this.look === 'night' ? 'rgba(255, 220, 140, 0.6)' : 'rgba(231, 160, 30, 0.5)',
    );
    flash.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.globalAlpha = 1 - k * 0.8;
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    this.ring(ctx, at, k, this.p.nova, 0.4, 1.9);
  }

  private husk(ctx: CanvasRenderingContext2D, at: Point, k: number, seed: number) {
    const c = this.center(at);
    const { cell } = this.geometry;
    ctx.globalAlpha = 1 - k;
    ctx.translate(c.x, c.y);
    ctx.rotate(k * 2.4);
    ctx.scale(1 - k * 0.5, 1 - k * 0.5);
    drawGleaner(ctx, 0, 0, cell, this.p, this.look, seed, 0.05, seed);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.globalAlpha = (1 - k) * 0.9;
    this.ring(ctx, at, k, this.p.beam, 0.2, 0.9);
  }

  private floater(
    ctx: CanvasRenderingContext2D,
    at: Point,
    text: string,
    color: string,
    k: number,
  ) {
    const c = this.center(at);
    const { cell } = this.geometry;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `700 ${Math.max(13, cell * 0.28)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    const y = c.y - cell * (0.45 + 0.5 * k);
    ctx.strokeStyle = this.look === 'night' ? 'rgba(6, 10, 23, 0.9)' : 'rgba(244, 235, 215, 0.95)';
    ctx.strokeText(text, c.x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, c.x, y);
  }

  private hailWaves(ctx: CanvasRenderingContext2D, from: Point, to: Point, k: number) {
    const a = this.center(from);
    const b = this.center(to);
    const { cell } = this.geometry;
    ctx.strokeStyle = this.p.lamp;
    ctx.lineWidth = Math.max(1, cell * 0.035);
    for (let i = 0; i < 3; i++) {
      const f = (k * 1.5 - i * 0.25) % 1;
      if (f < 0 || f > 1) continue;
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      ctx.globalAlpha = 1 - f;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private whiteout(ctx: CanvasRenderingContext2D, k: number) {
    ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
    ctx.fillStyle = this.look === 'night' ? '#fff6e0' : '#ffffff';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private streaks(ctx: CanvasRenderingContext2D, k: number, arriving: boolean) {
    const { x0, y0, board } = this.geometry;
    const amount = arriving ? 1 - k : k;
    ctx.globalAlpha = amount * 0.95;
    ctx.fillStyle = this.look === 'night' ? '#060a17' : '#f4ebd7';
    ctx.fillRect(x0, y0, board, board);
    const random = decorRandom(97);
    ctx.strokeStyle = this.p.lampSoft;
    ctx.lineWidth = 1.5;
    const cx = x0 + board / 2;
    const cy = y0 + board / 2;
    for (let i = 0; i < 70; i++) {
      const a = random() * Math.PI * 2;
      const r1 = board * (0.05 + random() * 0.45) * (0.3 + amount);
      const r2 = r1 + board * 0.18 * amount;
      ctx.globalAlpha = amount * (0.3 + random() * 0.6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
  }
}

/** The cell on the edge of the zone in the direction of a neighbouring zone. */
function edgeToward(from: Point, toZone: Point, shipZone: Point): Point {
  const dr = Math.sign(toZone.row - shipZone.row);
  const dc = Math.sign(toZone.col - shipZone.col);
  return {
    row: dr < 0 ? -1 : dr > 0 ? 10 : from.row,
    col: dc < 0 ? -1 : dc > 0 ? 10 : from.col,
  };
}

function paintBackground(
  width: number,
  height: number,
  ratio: number,
  geo: Geometry,
  look: Look,
  scene: Scene | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  const p = PALETTES[look];
  const seed = scene ? hashOf(`zone:${scene.zone.row}:${scene.zone.col}`) : 7;
  const random = decorRandom(seed);
  const { x0, y0, board, cell } = geo;
  if (look === 'night') {
    const sky = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    sky.addColorStop(0, p.bg2);
    sky.addColorStop(1, p.bg);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    // A soft nebula tinted by the zone, so every zone has a sky of its own.
    const hues = [220, 260, 190, 300, 170, 240];
    const hue = hues[seed % hues.length]!;
    for (let i = 0; i < 3; i++) {
      const nx = x0 + random() * board;
      const ny = y0 + random() * board;
      const nr = board * (0.3 + random() * 0.4);
      const cloud = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
      cloud.addColorStop(0, `hsla(${hue + i * 18}, 70%, 55%, 0.13)`);
      cloud.addColorStop(1, `hsla(${hue + i * 18}, 70%, 55%, 0)`);
      ctx.fillStyle = cloud;
      ctx.fillRect(0, 0, width, height);
    }
    for (let i = 0; i < 220; i++) {
      const x = random() * width;
      const y = random() * height;
      ctx.globalAlpha = 0.15 + random() * 0.55;
      ctx.fillStyle = random() < 0.2 ? '#ffe6c0' : '#dfe6ff';
      ctx.fillRect(x, y, random() < 0.1 ? 1.6 : 1, random() < 0.1 ? 1.6 : 1);
    }
    ctx.globalAlpha = 1;
    if (scene?.collapsed) {
      const dead = ctx.createRadialGradient(
        x0 + board / 2,
        y0 + board / 2,
        0,
        x0 + board / 2,
        y0 + board / 2,
        board * 0.7,
      );
      dead.addColorStop(0, 'rgba(120, 60, 200, 0.35)');
      dead.addColorStop(1, 'rgba(40, 10, 70, 0)');
      ctx.fillStyle = dead;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, width, height);
    // Paper grain: short faint fibres, never loud enough to read as a pattern.
    ctx.strokeStyle = 'rgba(120, 95, 60, 0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = random() * width;
      const y = random() * height;
      const a = random() * Math.PI;
      const l = 2 + random() * 5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      board * 0.4,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.8,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(120, 90, 40, 0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    drawCompassRose(ctx, x0 + board * 0.82, y0 + board * 0.82, board * 0.15, p);
  }
  // The grid: hairlines every cell, a stronger frame around the zone.
  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * cell, y0);
    ctx.lineTo(x0 + i * cell, y0 + board);
    ctx.moveTo(x0, y0 + i * cell);
    ctx.lineTo(x0 + board, y0 + i * cell);
    ctx.stroke();
  }
  ctx.strokeStyle = p.gridStrong;
  ctx.lineWidth = look === 'chart' ? 1.5 : 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, board - 1, board - 1);
  if (look === 'chart') {
    ctx.strokeRect(x0 - 4.5, y0 - 4.5, board + 9, board + 9);
  }
  return canvas;
}

function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  p: Palette,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const long = i % 2 === 0 ? r * 0.95 : r * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(a - 0.12) * long * 0.25, -Math.cos(a - 0.12) * long * 0.25);
    ctx.lineTo(Math.sin(a) * long, -Math.cos(a) * long);
    ctx.lineTo(Math.sin(a + 0.12) * long * 0.25, -Math.cos(a + 0.12) * long * 0.25);
    ctx.closePath();
    if (i % 2 === 0) ctx.fill();
    else ctx.stroke();
  }
  ctx.font = `600 ${r * 0.28}px "Source Serif 4 Variable", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -r * 1.02);
  ctx.restore();
}
