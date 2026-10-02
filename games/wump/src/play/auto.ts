import { createRng } from '@usr-games/kit';
import { CAMPAIGN } from '../engine/campaign';
import { dodecahedron } from '../engine/cave';
import { type Expedition, move, shoot, startExpedition } from '../engine/expedition';
import { type Notes, notesFor, observe } from '../engine/knowledge';
import { randomFrom } from '../engine/random';
import { decide } from '../engine/scout';
import { backdrop } from '../render/backdrop';
import { type ChamberScene, drawChamber } from '../render/chamber';
import type { Point } from '../render/hand';
import { layoutCave } from '../render/layout';
import type { Look } from '../render/look';
import { drawMap, type MapScene } from '../render/map';
import { chamberFor, mapFor } from './views';

/**
 * Scenes that run by themselves: the Scout exploring a cave for the Hall's attract mode, and the
 * key art — the wumpus snoring by a lantern with the map sketched round it — for the title screen
 * and the Hall's posters. Both draw with the game's own renderers and never make a sound.
 */

const FIRST_CAVE = CAMPAIGN[0]!;

const keyArtLayouts = new Map<string, Point[]>();
let keyArtChamber: HTMLCanvasElement | null = null;

/** The wumpus asleep by a lantern, the cave's map sketched faintly behind. */
export function drawKeyArt(
  ctx: CanvasRenderingContext2D,
  look: Look,
  width: number,
  height: number,
  time: number,
): void {
  ctx.drawImage(backdrop(look, { width, height }), 0, 0, width, height);
  const cave = dodecahedron();
  const aspect = (width / height).toFixed(2);
  let layout = keyArtLayouts.get(aspect);
  if (!layout) {
    layout = layoutCave(cave, { aspect: width / height, dodecahedron: true });
    keyArtLayouts.set(aspect, layout);
  }
  const all = Array.from({ length: 20 }, (_, i) => i + 1);
  const map: MapScene = {
    cave,
    layout,
    here: 1,
    visited: all,
    sensed: new Map(),
    marks: new Map(),
    rules: 'standard',
    reveal: { pits: [], bats: [], wumpus: 0, origin: 1, progress: 1, mood: 'hushed' },
    time,
  };
  ctx.save();
  ctx.globalAlpha = look.dark ? 0.32 : 0.38;
  drawMap(ctx, map, look, { x: 0, y: 0, w: width, h: height });
  ctx.restore();
  const chamber: ChamberScene = {
    room: 13,
    mouths: [],
    senses: { pit: false, bats: false, wumpus: 0 },
    strongSmell: true,
    explorer: 'camp',
    wumpus: { pose: 'asleep', shift: 0.12 },
    lantern: 0.85,
    signs: false,
    chalked: false,
    time,
  };
  const cw = Math.round(Math.min(width * 0.86, height * 1.5));
  const ch = Math.round(Math.min(height * 0.92, cw * 0.78));
  keyArtChamber ??= document.createElement('canvas');
  const inner = keyArtChamber;
  inner.width = cw;
  inner.height = ch;
  const innerCtx = inner.getContext('2d')!;
  drawChamber(innerCtx, chamber, look, cw, ch);
  if (look.dark) fadeToDark(innerCtx, cw, ch);
  ctx.drawImage(inner, (width - cw) / 2, (height - ch) / 2 + height * 0.02);
}

/** By lantern light the chamber has no edge: it fades into the dark around it. */
function fadeToDark(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(width / 2, height * 0.56);
  ctx.scale(width / 2, height / 2);
  const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  fade.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(0.62, 'rgba(0, 0, 0, 1)');
  fade.addColorStop(0.96, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(-1, -1.2, 2, 2.4);
  ctx.restore();
}

/**
 * The attract mode: the Scout explores a cave, a move every second or so, its flight traced on the
 * map; when the expedition ends the cave is revealed for a moment and a new one is dug.
 */
export class AutoCave {
  private expedition!: Expedition;
  private notes!: Notes;
  private layout!: Point[];
  private round = 0;
  private lastStep = 0;
  private endedAt: number | null = null;
  private frame = 0;
  private running = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly seed: string,
    private look: Look,
  ) {
    this.dig();
  }

  private dig(): void {
    const random = randomFrom(createRng(`${this.seed}:${this.round}`));
    const cave = this.round % 2 === 0 ? FIRST_CAVE : CAMPAIGN[1]!;
    this.expedition = startExpedition(cave.recipe, 'standard', random);
    this.notes = notesFor(this.expedition, this.expedition.announced);
    this.layout = layoutCave(this.expedition.cave, {
      aspect: 1.2,
      dodecahedron: cave.recipe.dodecahedron === true,
    });
    this.endedAt = null;
    this.round += 1;
  }

  setLook(look: Look): void {
    this.look = look;
    this.draw(performance.now() / 1000);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      this.step(now);
      this.draw(now / 1000);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private step(now: number): void {
    if (this.expedition.ending) {
      this.endedAt ??= now;
      if (now - this.endedAt > 3500) this.dig();
      return;
    }
    if (now - this.lastStep < 1100) return;
    this.lastStep = now;
    const decision = decide(this.notes, this.expedition.player, this.expedition.darts);
    const events =
      decision.kind === 'move'
        ? move(this.expedition, decision.to)
        : shoot(this.expedition, decision.path);
    observe(this.notes, this.expedition, events);
  }

  draw(time: number): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.drawImage(backdrop(this.look, { width, height }), 0, 0, width, height);
    const e = this.expedition;
    const ending = e.ending;
    const wide = width / height > 1.35;
    const chamberW = Math.round(wide ? width * 0.56 : width);
    const chamberH = Math.round(wide ? height : height * 0.62);
    let chamber = chamberFor(e, this.layout, new Map(), time);
    if (ending?.kind === 'hushed') {
      chamber = {
        ...chamberFor(e, this.layout, new Map(), time, e.wumpus),
        explorer: 'away',
        wumpus: { pose: 'asleep', dart: true },
        dartLight: 0.85,
        signs: false,
        chalked: false,
      };
    } else if (ending) {
      chamber = { ...chamber, explorer: 'fled', lantern: 0.3, signs: false };
    }
    const inner = document.createElement('canvas');
    inner.width = chamberW;
    inner.height = chamberH;
    drawChamber(inner.getContext('2d')!, chamber, this.look, chamberW, chamberH);
    ctx.drawImage(inner, 0, 0);
    const map: MapScene = {
      ...mapFor(e, this.notes, this.layout, new Map(), time),
      reveal: ending
        ? {
            pits: e.pits,
            bats: e.bats,
            wumpus: e.wumpus,
            origin: e.wumpus,
            progress: 1,
            mood: ending.kind === 'hushed' ? 'hushed' : 'lost',
          }
        : undefined,
    };
    const box = wide
      ? { x: chamberW, y: height * 0.06, w: width - chamberW - 8, h: height * 0.88 }
      : { x: 0, y: chamberH, w: width, h: height - chamberH };
    drawMap(ctx, map, this.look, box);
  }
}
