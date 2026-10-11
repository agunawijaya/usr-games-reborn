import { printBanner } from '../codecs/banner';
import { punchCard } from '../codecs/bcd';
import { CODE_FREQUENCIES, shareAfter } from '../codecs/caesar';
import { punchTape } from '../codecs/ppt';
import type { MachineId } from '../engine/message';
import { blit, CachedLayer, type DesignFrame } from './frame';
import { paintCardPunch, paintCardPunchGlow } from './machines/card-punch';
import { paintCipherWheel } from './machines/cipher-wheel';
import { paintPrinter, paintPrinterGlow } from './machines/printer';
import { paintScope } from './machines/scope';
import { paintTapeReader, paintTapeReaderGlow } from './machines/tape-reader';
import { paintTelegraph, paintTelegraphGlow, type TelegraphState } from './machines/telegraph';
import { paintOutside } from './outside';
import type { DeskPalette } from './palette';
import { alpha, type Ctx, glow, mix } from './paint';
import { paintMug, paintNotepad, paintTelegrams } from './props';
import {
  LAMP,
  paintClock,
  paintCodeChart,
  paintDeskTop,
  paintDust,
  paintGlassSheen,
  paintLamp,
  paintLampDarkness,
  paintLampLight,
  paintPigeonholes,
  paintSunlight,
  paintWall,
  paintWindowFrame,
  type Span,
  WINDOW,
  windowGlass,
} from './room';
import type { SignallerPose } from './signaller';

/**
 * The desk hub: the room, the window with the signaller, and the five machines where they live.
 * Painted in the 1920 × 1080 design frame. Everything that stands still is painted once into a
 * cached layer with a hole where the glass is; each frame draws the view outside under it and
 * the lamps, dust and steam over it.
 */
export type { MachineId };

/** Where each machine stands on the desk (its foot), and the box a click picks it up by. */
export const PLACES: Record<
  MachineId,
  {
    x: number;
    y: number;
    scale: number;
    hit: { x: number; y: number; width: number; height: number };
  }
> = {
  printer: { x: 70, y: 610, scale: 0.98, hit: { x: 60, y: 260, width: 470, height: 360 } },
  punch: { x: 1440, y: 660, scale: 0.98, hit: { x: 1430, y: 340, width: 430, height: 330 } },
  telegraph: { x: 120, y: 1000, scale: 1.02, hit: { x: 110, y: 790, width: 540, height: 220 } },
  cipher: { x: 900, y: 790, scale: 1, hit: { x: 740, y: 610, width: 320, height: 380 } },
  tape: { x: 1150, y: 1000, scale: 1.02, hit: { x: 1110, y: 790, width: 520, height: 220 } },
  semaphore: { x: 0, y: 0, scale: 1, hit: { x: 774, y: 56, width: 572, height: 348 } },
};

export interface DeskFrame {
  time: number;
  /** Machines with a message waiting: they glow and blink. */
  waiting: readonly MachineId[];
  /** The machine under the pointer or keyboard focus. */
  focus: MachineId | null;
  pose: SignallerPose;
  scene: 'rooftop' | 'ship';
  /** The time on the wall clock, in hours. */
  clock: number;
  reducedMotion: boolean;
  /** Notes the operator has scribbled on the pad. */
  notes: readonly string[];
  /** The telegraph as it moves while a message arrives (the attract loop). */
  telegraph?: TelegraphState;
}

const SAMPLE_CARD = punchCard('NIGHT WIRE 1964');
const SAMPLE_TAPE = punchTape('NIGHT WIRE CALLING '.repeat(6));
const SAMPLE_BANNER = printBanner('HELLO', 40);
const SAMPLE_SECRET = 'WKH QLJKW ZLUH';

const blinkOf = (frame: DeskFrame) =>
  frame.reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(frame.time * 5.2);

/** Everything that stands still, with the window glass left clear. */
export function paintDeskStill(ctx: Ctx, span: Span, pal: DeskPalette, frame: DeskFrame) {
  paintWall(ctx, span, pal);
  paintClock(ctx, 1488, 118, 52, frame.clock, pal);
  paintCodeChart(ctx, 1424, 196, 140, 152, pal);
  paintPigeonholes(ctx, 1600, 70, 280, 260, pal);
  paintDeskTop(ctx, span, pal);
  paintSunlight(ctx, span, pal);
  paintNotepad(ctx, 404, 772, 0.78, pal, frame.notes);
  // Back row first, front row last.
  paintPrinter(ctx, PLACES.printer.x, PLACES.printer.y, PLACES.printer.scale, pal, {
    head: 0.35,
    lamp: 0.15,
    sheet: { print: SAMPLE_BANNER, printed: 24, upright: false },
    time: 0,
  });
  paintLamp(ctx, pal);
  paintScope(ctx, 1176, 524, 196, 150, pal, {
    shares: shareAfter(SAMPLE_SECRET, 23),
    english: CODE_FREQUENCIES,
    rotation: 23,
    fit: 0.9,
    lit: 0,
    detail: 'far',
    time: 0,
  });
  paintCardPunch(ctx, PLACES.punch.x, PLACES.punch.y, PLACES.punch.scale, pal, {
    card: { columns: SAMPLE_CARD.map((c) => c.holes), printed: 'NIGHT WIRE 1964' },
    stroke: 0,
    lamp: 0.15,
  });
  paintTelegrams(ctx, 1096, 812, 0.9, pal);
  paintCipherWheel(ctx, PLACES.cipher.x, PLACES.cipher.y, 150, pal, {
    rotation: 3,
    highlight: null,
    spin: 0,
    lock: 0,
    stand: true,
  });
  paintTapeReader(ctx, PLACES.tape.x, PLACES.tape.y, PLACES.tape.scale, pal, {
    tape: { rows: SAMPLE_TAPE, offset: 0 },
    lamp: 0.15,
    sprocket: 0,
  });
  if (!frame.telegraph) {
    paintTelegraph(ctx, PLACES.telegraph.x, PLACES.telegraph.y, PLACES.telegraph.scale, pal, {
      keyDown: 0,
      armature: 0,
      lamp: 0.15,
    });
  }
  paintMug(ctx, 1764, 1010, 0.95, pal);
  paintLampDarkness(ctx, span, pal, 0);
  paintLampLight(ctx, pal, 0);
  // Clear the glass, then put the frame and its bars back on top, darkened to the room at night.
  const glass = windowGlass();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(glass.x, glass.y, glass.width, glass.height);
  ctx.restore();
  paintGlassSheen(ctx, pal);
  paintWindowFrame(ctx, pal);
  if (pal.look === 'night') {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = mix(pal.ambient, '#ffffff', 0.45);
    ctx.beginPath();
    ctx.rect(WINDOW.x - 30, WINDOW.y - 10, WINDOW.width + 60, WINDOW.height + 40);
    ctx.rect(glass.x, glass.y, glass.width, glass.height);
    ctx.fill('evenodd');
    ctx.restore();
  }
}

/** Things that move: the view outside (painted first, under the room), then lamps and air. */
export function paintDeskOutside(ctx: Ctx, pal: DeskPalette, frame: DeskFrame) {
  const glass = windowGlass();
  paintOutside(
    ctx,
    {
      ...glass,
      roofLine: 0.72,
      signaller: { x: 0.5, y: 0.95, height: glass.height * 0.46 },
      pose: frame.pose,
      scene: frame.scene,
      time: frame.time,
      detail: 'far',
    },
    pal,
  );
}

export function paintDeskLive(ctx: Ctx, pal: DeskPalette, frame: DeskFrame) {
  const blink = blinkOf(frame);
  const lampFor = (id: MachineId) => (frame.waiting.includes(id) ? blink : 0);
  if (frame.telegraph) {
    paintTelegraph(
      ctx,
      PLACES.telegraph.x,
      PLACES.telegraph.y,
      PLACES.telegraph.scale,
      pal,
      frame.telegraph,
    );
  }
  if (!frame.reducedMotion) paintDust(ctx, pal, frame.time);
  const telegraphLamp = Math.max(lampFor('telegraph'), frame.telegraph?.lamp ?? 0);
  paintTelegraphGlow(
    ctx,
    PLACES.telegraph.x,
    PLACES.telegraph.y,
    PLACES.telegraph.scale,
    pal,
    telegraphLamp,
  );
  paintCardPunchGlow(
    ctx,
    PLACES.punch.x,
    PLACES.punch.y,
    PLACES.punch.scale,
    pal,
    lampFor('punch'),
  );
  paintTapeReaderGlow(ctx, PLACES.tape.x, PLACES.tape.y, PLACES.tape.scale, pal, lampFor('tape'));
  paintPrinterGlow(
    ctx,
    PLACES.printer.x,
    PLACES.printer.y,
    PLACES.printer.scale,
    pal,
    lampFor('printer'),
  );
  if (pal.look === 'night') glow(ctx, 1274, 590, 150, alpha(pal.phosphor, 0.1), 1);
  if (frame.waiting.includes('cipher')) glow(ctx, 1274, 600, 110, alpha(pal.phosphor, 0.25), blink);
  if (pal.look === 'night' && !frame.reducedMotion) paintSteam(ctx, frame.time);
  for (const id of frame.waiting) paintWaitingHalo(ctx, id, pal, blink);
  if (frame.focus) paintFocusHalo(ctx, frame.focus, pal);
}

/** The whole desk in one go, uncached: for posters and stills. */
export function paintDesk(ctx: Ctx, span: Span, pal: DeskPalette, frame: DeskFrame) {
  paintDeskOutside(ctx, pal, frame);
  paintDeskStill(ctx, span, pal, frame);
  paintDeskLive(ctx, pal, frame);
}

/** The desk for a screen that draws every frame: the still room is cached. */
export class DeskScene {
  private readonly still = new CachedLayer();

  paint(ctx: Ctx, frame: DesignFrame, ratio: number, pal: DeskPalette, desk: DeskFrame) {
    const span = { ...frame.span, top: frame.top };
    const minute = Math.floor(desk.clock * 60);
    const key = `${pal.look}:${minute}:${desk.notes.join('/')}:${desk.telegraph ? 'live' : 'still'}`;
    const layer = this.still.get(frame, ratio, key, (layerCtx) =>
      paintDeskStill(layerCtx, span, pal, desk),
    );
    // The view outside first, under the room's clear glass.
    ctx.fillStyle = pal.wallTop;
    ctx.fillRect(span.left, span.top, span.right - span.left, 1080 - span.top);
    paintDeskOutside(ctx, pal, desk);
    blit(ctx, layer);
    paintDeskLive(ctx, pal, desk);
  }

  invalidate() {
    this.still.invalidate();
  }
}

function paintSteam(ctx: Ctx, time: number) {
  ctx.save();
  ctx.strokeStyle = alpha('#ffffff', 0.14);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  const x = 1764;
  const y = 1010 - 95 * 0.95;
  for (let k = 0; k < 3; k++) {
    const phase = time * 0.8 + k * 2.1;
    ctx.beginPath();
    ctx.moveTo(x - 11 + k * 11, y);
    ctx.bezierCurveTo(
      x - 19 + k * 11 + Math.sin(phase) * 8,
      y - 24,
      x - 4 + k * 11 + Math.cos(phase) * 8,
      y - 44,
      x - 11 + k * 11 + Math.sin(phase * 1.3) * 10,
      y - 70,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** A warm pool of light under a machine with a message for the operator. */
function paintWaitingHalo(ctx: Ctx, id: MachineId, pal: DeskPalette, blink: number) {
  const hit = PLACES[id].hit;
  const cx = hit.x + hit.width / 2;
  const cy = hit.y + hit.height * 0.62;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(cx, cy);
  ctx.scale(1, 0.55);
  const r = Math.max(hit.width, hit.height) * 0.62;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  const strength = (pal.look === 'night' ? 0.22 : 0.16) * (0.6 + 0.4 * blink);
  g.addColorStop(0, alpha(pal.indicator, strength));
  g.addColorStop(1, alpha(pal.indicator, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintFocusHalo(ctx: Ctx, id: MachineId, pal: DeskPalette) {
  const hit = PLACES[id].hit;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cx = hit.x + hit.width / 2;
  const cy = hit.y + hit.height / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(hit.width, hit.height) * 0.7);
  g.addColorStop(0, alpha('#ffffff', pal.look === 'night' ? 0.1 : 0.12));
  g.addColorStop(1, alpha('#ffffff', 0));
  ctx.fillStyle = g;
  ctx.fillRect(hit.x - 100, hit.y - 100, hit.width + 200, hit.height + 200);
  ctx.restore();
}

export { LAMP };
