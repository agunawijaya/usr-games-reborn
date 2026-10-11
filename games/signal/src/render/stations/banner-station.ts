import type { BannerPrint } from '../../codecs/banner';
import { CELL_ASPECT, paintPrinter, paintPrinterGlow, paintSheet } from '../machines/printer';
import type { DeskPalette } from '../palette';
import { alpha, type Ctx, FONT_MONO, linear, mix, radial, roundRect } from '../paint';
import { paintDeskTop, paintStationLight, paintSunlight, paintWall, type Span } from '../room';

/**
 * The banner printer close up. While it prints, the paper climbs out of the printer sideways;
 * at the reveal it turns upright and stretches across the wall, joined to the printer by a
 * quarter twist of paper, and a loupe lies on it showing the printed marks.
 */
export const BANNER_LAYOUT = {
  /** The paper's top edge on the wall, its width across, and where it folds down. */
  top: 184,
  across: 360,
  foldX: 1390,
  left: 76,
  printerFootY: 1032,
};

export interface BannerScene {
  time: number;
  print: BannerPrint;
  /** Lines printed so far. */
  printed: number;
  /** 0 = sideways out of the printer, 1 = upright across the wall. */
  turn: number;
  /** The loupe's centre on screen, or null. */
  loupe: { x: number; y: number; r: number } | null;
  head: number;
  /** 0–1: a band of light sweeping along the banner as it lands upright, or null. */
  sheen: number | null;
}

/** Screen geometry of the upright banner, shared by the painter and the loupe. */
export function bannerGeometry(print: BannerPrint) {
  const { top, foldX, left } = BANNER_LAYOUT;
  // A long banner gets narrower paper, so the whole message fits before the fold. Its length is
  // its lines times the line step, which grows with the paper: solve for the paper that fits.
  const room = foldX - left - 40;
  const perAcross = (print.rows.length * 0.86 * CELL_ASPECT) / print.width + 0.16;
  const across = Math.min(BANNER_LAYOUT.across, room / perAcross);
  const lineStep = ((across * 0.86) / print.width) * CELL_ASPECT;
  const lead = across * 0.16;
  return { top, across, foldX, left, lineStep, lead, end: foldX + across };
}

export function paintBannerStation(ctx: Ctx, span: Span, pal: DeskPalette, scene: BannerScene) {
  paintWall(ctx, span, pal);
  paintDeskTop(ctx, span, pal);
  paintSunlight(ctx, span, pal);
  const g = bannerGeometry(scene.print);
  const scale = g.across / 316;
  const printer = {
    x: g.foldX + g.across / 2 - 230 * scale,
    y: BANNER_LAYOUT.printerFootY,
    scale,
  };
  const slotY = printer.y - 250 * scale;
  // The banner's shadow on the wall.
  ctx.fillStyle = alpha('#000000', pal.look === 'night' ? 0.35 : 0.16);
  ctx.beginPath();
  ctx.moveTo(g.left + 16, g.top + 22);
  ctx.lineTo(g.foldX + 16, g.top + 22);
  ctx.lineTo(g.end + 16, g.top + g.across + 22);
  ctx.lineTo(g.left + 16, g.top + g.across + 22);
  ctx.closePath();
  ctx.fill();
  // The upright banner, cut along the fold.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.left, g.top);
  ctx.lineTo(g.foldX, g.top);
  ctx.lineTo(g.end, g.top + g.across);
  ctx.lineTo(g.left, g.top + g.across);
  ctx.closePath();
  ctx.clip();
  paintSheet(ctx, g.left, g.top, g.end - g.left, g.across, pal, {
    print: scene.print,
    printed: scene.printed,
    upright: true,
    fromLine: -Math.round(g.lead / g.lineStep),
  });
  ctx.fillStyle = linear(ctx, 0, g.top, 0, g.top + 16, [
    [0, alpha('#000000', 0.12)],
    [1, alpha('#000000', 0)],
  ]);
  ctx.fillRect(g.left, g.top, g.end - g.left, 16);
  ctx.restore();
  // The paper folds down on a diagonal crease and drops into the printer: the same sheet,
  // turned a quarter, which is what turning a sideways banner upright means.
  paintDrop(ctx, pal, g, slotY);
  // Pins holding the banner to the wall.
  for (const px of [g.left + 16, (g.left + g.foldX) / 2]) {
    ctx.fillStyle = radial(ctx, px - 2, g.top + 12, 9, [
      [0, '#ff8a75'],
      [1, pal.inkRed],
    ]);
    ctx.beginPath();
    ctx.arc(px, g.top + 14, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  paintPrinter(ctx, printer.x, printer.y, printer.scale, pal, {
    head: scene.head,
    lamp: 1,
    sheet: null,
    time: scene.time,
  });
  if (scene.loupe) paintLoupe(ctx, pal, scene, g.left, g.top, g.across, g.lineStep, g.lead);
  paintStationLight(ctx, span, pal, { x: 360, y: 260, r: 1750 });
  paintPrinterGlow(ctx, printer.x, printer.y, printer.scale, pal, 1);
  if (scene.sheen !== null) paintBannerSheen(ctx, scene.print, pal, scene.sheen);
}

/** The folded-down tail: the paper's back, from the crease to the printer's slot. */
function paintDrop(
  ctx: Ctx,
  pal: DeskPalette,
  g: ReturnType<typeof bannerGeometry>,
  slotY: number,
) {
  const x0 = g.foldX;
  const x1 = g.end;
  ctx.save();
  ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [
    [0, mix(pal.paper, '#000000', 0.16)],
    [0.5, mix(pal.paper, '#000000', 0.06)],
    [1, mix(pal.paper, '#000000', 0.2)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x0, g.top);
  ctx.lineTo(x1, g.top + g.across);
  ctx.lineTo(x1, slotY);
  ctx.lineTo(x0, slotY);
  ctx.closePath();
  ctx.fill();
  // Tractor holes now run down both edges.
  const holeStep = g.lineStep * 3;
  ctx.fillStyle = alpha('#3a2a1c', pal.look === 'night' ? 0.6 : 0.4);
  const margin = g.across * 0.035;
  for (let y = g.top + g.across; y < slotY; y += holeStep) {
    for (const x of [x0 + margin, x1 - margin]) {
      ctx.beginPath();
      ctx.arc(x, y, g.lineStep * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The crease: a bright edge and a shadow under it.
  ctx.strokeStyle = alpha('#ffffff', 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, g.top);
  ctx.lineTo(x1, g.top + g.across);
  ctx.stroke();
  ctx.fillStyle = linear(ctx, x0, g.top, x0 + 30, g.top - 30, [
    [0, alpha('#000000', 0.18)],
    [1, alpha('#000000', 0)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x0, g.top);
  ctx.lineTo(x1, g.top + g.across);
  ctx.lineTo(x1, g.top + g.across + 26);
  ctx.lineTo(x0, g.top + 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A brass loupe lying on the banner: inside it the marks read as the printer's own `#`. */
function paintLoupe(
  ctx: Ctx,
  pal: DeskPalette,
  scene: BannerScene,
  sheetX: number,
  sheetY: number,
  across: number,
  lineStep: number,
  lead: number,
) {
  const loupe = scene.loupe!;
  const zoom = 6;
  const cell = (across * 0.86) / scene.print.width;
  const margin = across * 0.07;
  ctx.save();
  // Handle, then the lens.
  ctx.save();
  ctx.translate(loupe.x, loupe.y);
  ctx.rotate(0.75);
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.fillRect(loupe.r * 0.92, -12 + 10, loupe.r * 1.3, 26);
  ctx.fillStyle = linear(ctx, 0, -12, 0, 12, [
    [0, mix(pal.woodLight, '#ffffff', 0.15)],
    [1, pal.woodDark],
  ]);
  roundRect(ctx, loupe.r * 0.95, -12, loupe.r * 1.25, 24, 12);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(loupe.x, loupe.y, loupe.r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = mix(pal.paper, '#ffffff', 0.35);
  ctx.fillRect(loupe.x - loupe.r, loupe.y - loupe.r, loupe.r * 2, loupe.r * 2);
  // Which cells sit under the lens.
  const fromScreen = (sx: number, sy: number) => ({
    line: Math.floor((sx - sheetX - lead) / lineStep),
    column: scene.print.width - 1 - Math.floor((sy - sheetY - margin) / cell),
  });
  const centre = fromScreen(loupe.x, loupe.y);
  const span = Math.ceil(loupe.r / (lineStep * zoom)) + 1;
  ctx.fillStyle = pal.ink;
  ctx.font = `600 ${cell * zoom * 1.2}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let line = centre.line - span; line <= centre.line + span; line++) {
    const row = scene.print.rows[line];
    if (!row || line >= scene.printed) continue;
    for (
      let dc = -Math.ceil(loupe.r / (cell * zoom)) - 1;
      dc <= Math.ceil(loupe.r / (cell * zoom)) + 1;
      dc++
    ) {
      const column = centre.column + dc;
      if (!row[column]) continue;
      const px = loupe.x + (line - centre.line) * lineStep * zoom;
      const py = loupe.y - dc * cell * zoom;
      ctx.save();
      ctx.translate(px, py);
      // Upright, each mark is the printer's # turned on its side.
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('#', 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
  // Brass rim and a lens highlight.
  ctx.strokeStyle = linear(
    ctx,
    loupe.x - loupe.r,
    loupe.y - loupe.r,
    loupe.x + loupe.r,
    loupe.y + loupe.r,
    [
      [0, pal.brassShine],
      [0.5, pal.brass],
      [1, pal.brassDeep],
    ],
  );
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(loupe.x, loupe.y, loupe.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = radial(ctx, loupe.x - loupe.r * 0.35, loupe.y - loupe.r * 0.4, loupe.r * 0.7, [
    [0, alpha('#ffffff', 0.35)],
    [1, alpha('#ffffff', 0)],
  ]);
  ctx.beginPath();
  ctx.arc(loupe.x, loupe.y, loupe.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The reveal's band of light running along the upright banner, drawn live over a cached scene.
 * `sheen` runs 0–1 along the paper.
 */
export function paintBannerSheen(ctx: Ctx, print: BannerPrint, pal: DeskPalette, sheen: number) {
  const g = bannerGeometry(print);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.left, g.top);
  ctx.lineTo(g.foldX, g.top);
  ctx.lineTo(g.end, g.top + g.across);
  ctx.lineTo(g.left, g.top + g.across);
  ctx.closePath();
  ctx.clip();
  const sx = g.left + (g.foldX - g.left) * sheen;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = linear(ctx, sx - 160, 0, sx + 160, 0, [
    [0, alpha('#ffffff', 0)],
    [0.5, alpha(pal.look === 'night' ? '#ffe2a8' : '#ffffff', 0.45)],
    [1, alpha('#ffffff', 0)],
  ]);
  ctx.beginPath();
  ctx.moveTo(sx - 120, g.top);
  ctx.lineTo(sx + 200, g.top);
  ctx.lineTo(sx + 120, g.top + g.across);
  ctx.lineTo(sx - 200, g.top + g.across);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
