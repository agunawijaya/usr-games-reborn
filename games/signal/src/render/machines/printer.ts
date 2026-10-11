import type { BannerPrint } from '../../codecs/banner';
import type { DeskPalette } from '../palette';
import {
  alpha,
  contactShadow,
  type Ctx,
  glow,
  linear,
  mix,
  radial,
  roundRect,
  screw,
} from '../paint';

/**
 * The banner printer and its fan-fold paper. The printer types its banner sideways, line after
 * line down the paper, 132 positions across, the way the original filled a line printer's
 * paper. Turned upright, the paper's lines run left to right and its positions bottom to top.
 */
export interface SheetLook {
  print: BannerPrint;
  /** Printer lines already printed (the rest of the sheet is blank). */
  printed: number;
  /** Sideways as it leaves the printer, or turned to read. */
  upright: boolean;
  /** First printer line shown at the sheet's start. */
  fromLine?: number;
  /** Paint only the paper or only the ink (for caching each once). */
  layer?: 'all' | 'paper' | 'ink';
}

/** Print positions on a line printer: ten to the inch across, six lines to the inch down. */
export const CELL_ASPECT = 10 / 6;

/** Lines per fan-fold page: eleven inches at six to the inch. */
const PAGE_LINES = 66;

/**
 * Paints a length of fan-fold paper with its banner. In sideways mode the sheet runs down from
 * `y`; upright it runs right from `x`. `w` × `h` is the sheet as seen on screen.
 */
export function paintSheet(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
  look: SheetLook,
) {
  const { print } = look;
  const along = look.upright ? w : h;
  const across = look.upright ? h : w;
  const margin = across * 0.07;
  const printable = across - margin * 2;
  const cell = printable / print.width;
  const lineStep = cell * CELL_ASPECT;
  const from = look.fromLine ?? 0;
  const layer = look.layer ?? 'all';
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (layer !== 'ink')
    paintPaper(ctx, x, y, w, h, pal, look, { along, across, margin, cell, lineStep, from });
  if (layer !== 'paper') paintInk(ctx, x, y, pal, look, { along, margin, cell, lineStep, from });
  ctx.restore();
}

interface SheetMetrics {
  along: number;
  across: number;
  margin: number;
  cell: number;
  lineStep: number;
  from: number;
}

function paintPaper(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
  look: SheetLook,
  m: SheetMetrics,
) {
  const { along, across, margin, cell, lineStep, from } = m;
  ctx.fillStyle = look.upright
    ? linear(ctx, 0, y, 0, y + h, [
        [0, mix(pal.paper, '#ffffff', 0.3)],
        [1, pal.paper],
      ])
    : linear(ctx, x, 0, x + w, 0, [
        [0, mix(pal.paper, '#ffffff', 0.3)],
        [1, pal.paper],
      ]);
  ctx.fillRect(x, y, w, h);
  // Fan-fold creases: the paper zigzags, so each page darkens towards one crease and the next
  // page lightens away from it; a flat tint per page would read as a grey slab, not a fold.
  for (
    let page = Math.floor(from / PAGE_LINES);
    page * PAGE_LINES - from < along / lineStep + PAGE_LINES;
    page++
  ) {
    const start = (page * PAGE_LINES - from) * lineStep;
    const end = start + PAGE_LINES * lineStep;
    const [first, last] = page % 2 === 0 ? [0, 0.07] : [0.07, 0];
    const lean: [number, string][] = [
      [0, alpha('#5a4630', first)],
      [1, alpha('#5a4630', last)],
    ];
    ctx.fillStyle = look.upright
      ? linear(ctx, x + start, 0, x + end, 0, lean)
      : linear(ctx, 0, y + start, 0, y + end, lean);
    if (look.upright) ctx.fillRect(x + start, y, end - start, h);
    else ctx.fillRect(x, y + start, w, end - start);
    // The perforation.
    ctx.strokeStyle = alpha('#7a6648', 0.45);
    ctx.lineWidth = Math.max(0.5, cell * 0.12);
    ctx.setLineDash([Math.max(1, cell * 0.5), Math.max(1, cell * 0.4)]);
    ctx.beginPath();
    if (look.upright) {
      ctx.moveTo(x + start, y);
      ctx.lineTo(x + start, y + h);
    } else {
      ctx.moveTo(x, y + start);
      ctx.lineTo(x + w, y + start);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Tractor holes along both edges, half an inch apart, each a little under a line across,
  // with a perforated tear line inside each margin.
  const holeStep = lineStep * 3;
  const holeR = Math.max(0.8, lineStep * 0.42);
  const behind = alpha('#3a2a1c', pal.look === 'night' ? 0.7 : 0.45);
  ctx.strokeStyle = alpha('#7a6648', 0.4);
  ctx.lineWidth = Math.max(0.5, cell * 0.1);
  ctx.setLineDash([Math.max(1, cell * 0.45), Math.max(1, cell * 0.45)]);
  for (const edge of [margin, across - margin]) {
    ctx.beginPath();
    if (look.upright) {
      ctx.moveTo(x, y + edge);
      ctx.lineTo(x + w, y + edge);
    } else {
      ctx.moveTo(x + edge, y);
      ctx.lineTo(x + edge, y + h);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let t = holeStep / 2 - ((from * lineStep) % holeStep); t < along; t += holeStep) {
    for (const edge of [margin / 2, across - margin / 2]) {
      ctx.fillStyle = behind;
      ctx.beginPath();
      if (look.upright) ctx.arc(x + t, y + edge, holeR, 0, Math.PI * 2);
      else ctx.arc(x + edge, y + t, holeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The print: each `#` an inked cell with a little jitter in its ink, like a ribbon strike. */
function paintInk(
  ctx: Ctx,
  x: number,
  y: number,
  pal: DeskPalette,
  look: SheetLook,
  m: Omit<SheetMetrics, 'across'>,
) {
  const { along, margin, cell, lineStep, from } = m;
  const { print } = look;
  ctx.fillStyle = alpha(pal.ink, 0.88);
  const last = Math.min(look.printed, print.rows.length);
  const visibleLines = Math.ceil(along / lineStep) + 1;
  for (let line = from; line < Math.min(last, from + visibleLines); line++) {
    const row = print.rows[line];
    if (!row) continue;
    const offset = (line - from) * lineStep;
    for (let col = 0; col < print.width; col++) {
      if (!row[col]) continue;
      const jitter = ((line * 31 + col * 17) % 7) / 7 - 0.5;
      const ink = 0.78 + jitter * 0.3;
      ctx.globalAlpha = ink;
      if (look.upright) {
        const cx = x + offset;
        const cy = y + margin + (print.width - 1 - col) * cell;
        ctx.fillRect(cx + lineStep * 0.08, cy + cell * 0.06, lineStep * 0.84, cell * 0.88);
      } else {
        const cx = x + margin + col * cell;
        const cy = y + offset;
        ctx.fillRect(cx + cell * 0.06, cy + lineStep * 0.08, cell * 0.88, lineStep * 0.84);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** One printed cell's size on screen for a sheet `across` wide, for placing a loupe. */
export function sheetCell(across: number, width: number): { cell: number; line: number } {
  const printable = across - across * 0.07 * 2;
  const cell = printable / width;
  return { cell, line: cell * CELL_ASPECT };
}

export interface PrinterState {
  /** Where the print head is across its run, 0–1. */
  head: number;
  /** 0–1 the busy lamp. */
  lamp: number;
  /** A short length of the banner coming out of the top, sideways. */
  sheet: SheetLook | null;
  /** Seconds, for the head's shimmer. */
  time: number;
}

/**
 * The printer, 460 × 250 at scale 1, `x`, `y` at its front-left foot: a cream cabinet with a
 * smoked lid over the carriage, paper rising from its back and spilling over behind it.
 */
export function paintPrinter(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  state: PrinterState,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  contactShadow(ctx, 230, 0, 260, 24, 0.5);
  // Paper rising out of the lid's slot and rolling over backwards towards the wall.
  if (state.sheet) {
    const rise = 104;
    const fromLine = Math.max(
      0,
      state.sheet.printed - Math.ceil(rise / sheetCell(320, state.sheet.print.width).line),
    );
    paintSheet(ctx, 72, -250 - rise, 316, rise, pal, { ...state.sheet, fromLine });
    // Shade under the roll, then the roll itself.
    ctx.fillStyle = linear(ctx, 0, -250 - rise, 0, -250 - rise + 26, [
      [0, alpha('#3a2a18', 0.3)],
      [1, alpha('#3a2a18', 0)],
    ]);
    ctx.fillRect(72, -250 - rise, 316, 26);
    ctx.fillStyle = linear(ctx, 0, -250 - rise - 22, 0, -250 - rise + 4, [
      [0, mix(pal.paper, '#000000', 0.18)],
      [0.55, mix(pal.paper, '#ffffff', 0.4)],
      [1, mix(pal.paper, '#000000', 0.08)],
    ]);
    ctx.beginPath();
    ctx.ellipse(230, -250 - rise, 158, 14, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(388, -250 - rise + 2);
    ctx.ellipse(230, -250 - rise + 2, 158, 6, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(pal.creamShade, '#000000', 0.45);
    ctx.fillRect(66, -254, 328, 8);
  }
  // Cabinet.
  ctx.fillStyle = linear(ctx, 0, -150, 0, 0, [
    [0, pal.cream],
    [1, pal.creamShade],
  ]);
  roundRect(ctx, 0, -150, 460, 150, 12);
  ctx.fill();
  // The sloped lid with its smoked window.
  ctx.fillStyle = linear(ctx, 0, -250, 0, -148, [
    [0, mix(pal.cream, '#ffffff', 0.15)],
    [1, mix(pal.cream, '#ffffff', 0.03)],
  ]);
  ctx.beginPath();
  ctx.moveTo(26, -250);
  ctx.lineTo(434, -250);
  ctx.lineTo(460, -148);
  ctx.lineTo(0, -148);
  ctx.closePath();
  ctx.fill();
  const smoke = pal.look === 'night' ? '#151a1e' : '#2a3036';
  ctx.fillStyle = alpha(smoke, 0.88);
  ctx.beginPath();
  ctx.moveTo(60, -232);
  ctx.lineTo(400, -232);
  ctx.lineTo(418, -170);
  ctx.lineTo(42, -170);
  ctx.closePath();
  ctx.fill();
  // The carriage seen through the smoked window: a rail and the shuttling head.
  ctx.fillStyle = alpha(pal.steelLight, 0.6);
  ctx.fillRect(66, -200, 330, 4);
  const headX = 80 + state.head * 280;
  ctx.fillStyle = linear(ctx, headX - 20, 0, headX + 20, 0, [
    [0, pal.steel],
    [0.5, pal.steelLight],
    [1, pal.steelDeep],
  ]);
  roundRect(ctx, headX - 20, -216, 40, 30, 5);
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.1);
  ctx.beginPath();
  ctx.moveTo(70, -230);
  ctx.lineTo(160, -230);
  ctx.lineTo(120, -172);
  ctx.lineTo(48, -172);
  ctx.closePath();
  ctx.fill();
  // Front panel: name plate, lamps and a big paper-advance knob on the side.
  ctx.fillStyle = mix(pal.creamShade, '#000000', 0.12);
  roundRect(ctx, 30, -116, 250, 34, 6);
  ctx.fill();
  ctx.fillStyle = alpha(pal.ink, 0.65);
  for (let i = 0; i < 6; i++) ctx.fillRect(46 + i * 36, -103, 22, 8);
  const lit = Math.max(0, Math.min(1, state.lamp));
  for (const [i, color] of [
    [0, '#5fe08a'],
    [1, pal.indicator],
  ] as const) {
    const lx = 330 + i * 34;
    ctx.fillStyle = radial(ctx, lx, -100, 10, [
      [0, mix('#2a2a20', '#ffffff', i === 1 ? lit : 0.6)],
      [1, mix('#1a1a10', color, i === 1 ? lit : 0.8)],
    ]);
    ctx.beginPath();
    ctx.arc(lx, -100, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = linear(ctx, 0, -80, 0, -10, [
    [0, mix(pal.cream, '#000000', 0.05)],
    [1, pal.creamShade],
  ]);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = alpha('#000000', 0.12);
    ctx.fillRect(30, -62 + i * 9, 400, 2);
  }
  ctx.fillStyle = linear(ctx, 0, -190, 0, -130, [
    [0, pal.enamelLight],
    [1, pal.enamel],
  ]);
  ctx.beginPath();
  ctx.ellipse(468, -160, 10, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [sx, sy] of [
    [16, -136],
    [444, -136],
  ] as const) {
    screw(ctx, sx, sy, 4, pal.steelLight, pal.steelDeep);
  }
  ctx.restore();
}

export function printerLamp(x: number, y: number, scale: number) {
  return { x: x + 364 * scale, y: y - 100 * scale, r: 8 * scale };
}

export function paintPrinterGlow(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  pal: DeskPalette,
  lamp: number,
) {
  if (lamp <= 0.02) return;
  const at = printerLamp(x, y, scale);
  glow(ctx, at.x, at.y, at.r * 8, pal.indicatorGlow, lamp);
}
