import { blit, CachedLayer, type DesignFrame } from './frame';
import type { DeskPalette } from './palette';
import {
  alpha,
  type Ctx,
  FONT_DISPLAY,
  FONT_MONO,
  grain,
  linear,
  mix,
  radial,
  roundRect,
  scatter,
  screw,
} from './paint';

/**
 * The signal room behind the machines: a panelled wall, a tall sash window, a clock, a code
 * chart and a rack of pigeonholes, and the oak desk the machines stand on. All coordinates are
 * design pixels of a 1920 × 1080 frame; `span` is the visible width, which may be wider.
 */
export const DESK_BACK_Y = 492;
export const WINDOW = { x: 752, y: 34, width: 616, height: 392, frame: 22 };
export const LAMP = { x: 642, baseY: 548, shadeY: 330 };
/** Where the sashes meet, as a share of the glass height. */
export const MEETING_RAIL = 0.3;

export interface Span {
  left: number;
  right: number;
  /** The design row at the top of the screen; zero unless the screen is taller than 16:9. */
  top?: number;
}

/** The glass of the window, for clipping the view outside. */
export function windowGlass(): { x: number; y: number; width: number; height: number } {
  const f = WINDOW.frame;
  return {
    x: WINDOW.x + f,
    y: WINDOW.y + f,
    width: WINDOW.width - f * 2,
    height: WINDOW.height - f * 2,
  };
}

export function paintWall(ctx: Ctx, span: Span, pal: DeskPalette) {
  const ceiling = Math.min(0, span.top ?? 0);
  ctx.fillStyle = linear(ctx, 0, ceiling, 0, DESK_BACK_Y, [
    [0, pal.wallTop],
    [1, pal.wallLow],
  ]);
  ctx.fillRect(span.left, ceiling, span.right - span.left, DESK_BACK_Y - ceiling);
  const texture = grain(
    ctx,
    pal.look === 'night' ? '#000000' : '#7a6248',
    pal.look === 'night' ? 0.35 : 0.16,
  );
  if (texture) {
    ctx.fillStyle = texture;
    ctx.fillRect(span.left, ceiling, span.right - span.left, DESK_BACK_Y - ceiling);
  }
  // A quiet striped wallpaper above the panelling.
  ctx.fillStyle = alpha(
    pal.look === 'night' ? '#000000' : '#a88b62',
    pal.look === 'night' ? 0.12 : 0.1,
  );
  const stripe = 34;
  for (let x = Math.floor(span.left / stripe) * stripe; x < span.right; x += stripe) {
    ctx.fillRect(x, ceiling, 12, 360 - ceiling);
  }
  // Picture rail.
  ctx.fillStyle = pal.trim;
  ctx.fillRect(span.left, 14, span.right - span.left, 8);
  ctx.fillStyle = alpha('#000000', 0.18);
  ctx.fillRect(span.left, 22, span.right - span.left, 3);
  // Wainscot panels below the dado rail.
  const top = 360;
  ctx.fillStyle = linear(ctx, 0, top, 0, DESK_BACK_Y, [
    [0, pal.wainscot],
    [1, pal.wainscotShade],
  ]);
  ctx.fillRect(span.left, top, span.right - span.left, DESK_BACK_Y - top);
  ctx.fillStyle = mix(pal.wainscot, pal.trim, 0.35);
  ctx.fillRect(span.left, top - 10, span.right - span.left, 12);
  ctx.fillStyle = alpha('#000000', 0.22);
  ctx.fillRect(span.left, top + 2, span.right - span.left, 4);
  const panel = 210;
  const first = Math.floor(span.left / panel) * panel;
  for (let x = first; x < span.right; x += panel) {
    ctx.strokeStyle = alpha('#000000', 0.28);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 22, top + 26, panel - 44, DESK_BACK_Y - top - 26);
    ctx.strokeStyle = alpha('#ffffff', pal.look === 'night' ? 0.05 : 0.12);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 25, top + 29, panel - 50, DESK_BACK_Y - top - 29);
  }
}

/** The window's frame, sash bars and sill, drawn over whatever is outside. */
export function paintWindowFrame(ctx: Ctx, pal: DeskPalette) {
  const { x, y, width, height } = WINDOW;
  const glass = windowGlass();
  // Recess shadow around the frame.
  ctx.fillStyle = alpha('#000000', 0.22);
  ctx.fillRect(x - 10, y - 6, width + 20, height + 18);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.rect(glass.x, glass.y, glass.width, glass.height);
  ctx.fillStyle = linear(ctx, x, 0, x + width, 0, [
    [0, pal.frame],
    [0.5, mix(pal.frame, '#ffffff', pal.look === 'night' ? 0.04 : 0.25)],
    [1, pal.frameShade],
  ]);
  ctx.fill('evenodd');
  ctx.restore();
  // Inner bevel.
  ctx.strokeStyle = alpha('#000000', 0.25);
  ctx.lineWidth = 3;
  ctx.strokeRect(glass.x - 1.5, glass.y - 1.5, glass.width + 3, glass.height + 3);
  // Sash: a meeting rail across the middle and two glazing bars per sash.
  // A small-paned upper sash over one big lower pane, so nothing crosses the signaller.
  const meetY = glass.y + glass.height * MEETING_RAIL;
  ctx.fillStyle = pal.frame;
  ctx.fillRect(glass.x, meetY - 9, glass.width, 18);
  ctx.fillStyle = alpha('#000000', 0.2);
  ctx.fillRect(glass.x, meetY + 9, glass.width, 4);
  for (const t of [1 / 4, 2 / 4, 3 / 4]) {
    const bx = glass.x + glass.width * t;
    ctx.fillStyle = pal.frame;
    ctx.fillRect(bx - 4, glass.y, 8, meetY - glass.y);
    ctx.fillStyle = alpha('#000000', 0.16);
    ctx.fillRect(bx + 4, glass.y, 3, meetY - glass.y);
  }
  // Sash lock.
  ctx.fillStyle = linear(ctx, 0, meetY - 6, 0, meetY + 6, [
    [0, pal.brassLight],
    [1, pal.brassDeep],
  ]);
  roundRect(ctx, x + width / 2 - 16, meetY - 7, 32, 12, 4);
  ctx.fill();
  // Sill.
  const sillY = y + height;
  ctx.fillStyle = linear(ctx, 0, sillY, 0, sillY + 24, [
    [0, mix(pal.frame, '#ffffff', pal.look === 'night' ? 0.05 : 0.2)],
    [1, pal.frameShade],
  ]);
  ctx.fillRect(x - 26, sillY - 4, width + 52, 22);
  ctx.fillStyle = alpha('#000000', 0.3);
  ctx.fillRect(x - 26, sillY + 18, width + 52, 6);
}

/** Faint reflections on the glass, stronger at night when the room is brighter than outside. */
export function paintGlassSheen(ctx: Ctx, pal: DeskPalette) {
  const glass = windowGlass();
  ctx.save();
  ctx.beginPath();
  ctx.rect(glass.x, glass.y, glass.width, glass.height);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  const strength = pal.look === 'night' ? 0.1 : 0.16;
  ctx.fillStyle = linear(ctx, glass.x, glass.y, glass.x + glass.width, glass.y + glass.height, [
    [0, alpha('#ffffff', 0)],
    [0.42, alpha('#ffffff', 0)],
    [0.47, alpha('#ffffff', strength)],
    [0.53, alpha('#ffffff', 0)],
    [0.6, alpha('#ffffff', strength * 0.6)],
    [0.63, alpha('#ffffff', 0)],
  ]);
  ctx.fillRect(glass.x, glass.y, glass.width, glass.height);
  ctx.restore();
}

/** A school-room clock with the given time. */
export function paintClock(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  hours: number,
  pal: DeskPalette,
) {
  ctx.save();
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.beginPath();
  ctx.arc(cx + 4, cy + 6, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = linear(ctx, cx - r, cy - r, cx + r, cy + r, [
    [0, pal.brassLight],
    [0.5, pal.brass],
    [1, pal.brassDeep],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.look === 'night' ? mix(pal.paper, '#000000', 0.25) : pal.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    ctx.lineWidth = major ? 2.4 : 1;
    const inner = r * (major ? 0.8 : 0.88);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  const hand = (turn: number, length: number, width: number) => {
    const a = turn * Math.PI * 2 - Math.PI / 2;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * length * 0.18, cy - Math.sin(a) * length * 0.18);
    ctx.lineTo(cx + Math.cos(a) * length, cy + Math.sin(a) * length);
    ctx.stroke();
  };
  hand((hours % 12) / 12, r * 0.5, 4);
  hand(hours % 1, r * 0.76, 2.6);
  ctx.fillStyle = pal.inkRed;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A framed chart of dots and dashes on the wall. */
export function paintCodeChart(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
) {
  ctx.save();
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.fillRect(x + 5, y + 7, w, h);
  ctx.fillStyle = linear(ctx, x, y, x + w, y + h, [
    [0, pal.woodLight],
    [1, pal.woodDark],
  ]);
  ctx.fillRect(x, y, w, h);
  const m = 12;
  ctx.fillStyle = pal.look === 'night' ? mix(pal.paper, '#000000', 0.3) : pal.paper;
  ctx.fillRect(x + m, y + m, w - m * 2, h - m * 2);
  ctx.fillStyle = pal.ink;
  ctx.font = `600 15px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText('THE CODE', x + w / 2, y + m + 22);
  ctx.font = `500 11px ${FONT_MONO}`;
  const codes = [
    '.-',
    '-...',
    '-.-.',
    '-..',
    '.',
    '..-.',
    '--.',
    '....',
    '..',
    '.---',
    '-.-',
    '.-..',
    '--',
  ];
  const columns = 2;
  const rows = Math.ceil(codes.length / columns);
  for (let i = 0; i < codes.length; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const cx = x + m + 18 + col * ((w - m * 2) / columns);
    const cy = y + m + 44 + row * ((h - m * 2 - 52) / rows);
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.inkRed;
    ctx.fillText(String.fromCharCode(65 + i), cx, cy + 4);
    ctx.fillStyle = pal.ink;
    let dot = cx + 16;
    for (const mark of codes[i]!) {
      if (mark === '.') {
        ctx.beginPath();
        ctx.arc(dot + 2, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
        dot += 8;
      } else {
        ctx.fillRect(dot, cy - 2, 11, 4);
        dot += 15;
      }
    }
  }
  ctx.restore();
}

/** A rack of pigeonholes with telegram envelopes waiting in some. */
export function paintPigeonholes(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
) {
  ctx.save();
  ctx.fillStyle = alpha('#000000', 0.28);
  ctx.fillRect(x + 6, y + 8, w, h);
  ctx.fillStyle = linear(ctx, x, 0, x + w, 0, [
    [0, pal.woodMid],
    [1, pal.woodDark],
  ]);
  ctx.fillRect(x, y, w, h);
  const cols = 4;
  const rows = 3;
  const gap = 8;
  const cw = (w - gap * (cols + 1)) / cols;
  const ch = (h - gap * (rows + 1)) / rows;
  const random = scatter(41);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + gap + c * (cw + gap);
      const cy = y + gap + r * (ch + gap);
      ctx.fillStyle = mix(pal.woodDark, '#000000', 0.45);
      ctx.fillRect(cx, cy, cw, ch);
      if (random() < 0.62) {
        const count = 1 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) {
          const ew = cw * (0.7 + random() * 0.2);
          const eh = ch * 0.5;
          const ex = cx + (cw - ew) / 2 + (random() - 0.5) * 6;
          const ey = cy + ch - eh - 2 - i * 5;
          ctx.fillStyle = mix(
            random() < 0.3 ? pal.manila : pal.paper,
            '#000000',
            0.08 * i + (pal.look === 'night' ? 0.25 : 0),
          );
          ctx.fillRect(ex, ey, ew, eh);
          ctx.strokeStyle = alpha('#000000', 0.18);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + ew / 2, ey + eh * 0.45);
          ctx.lineTo(ex + ew, ey);
          ctx.stroke();
        }
      }
    }
  }
  // Brass label holders along the shelves.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = x + gap + c * (cw + gap) + cw / 2 - 12;
      const ly = y + gap + (r + 1) * (ch + gap) - gap + 1;
      ctx.fillStyle = pal.brass;
      ctx.fillRect(lx, ly, 24, 6);
    }
  }
  ctx.restore();
}

/**
 * The desk top in gentle perspective: grain that converges towards the window, a darker front
 * edge and the shadow line where it meets the wall.
 */
export function paintDeskTop(ctx: Ctx, span: Span, pal: DeskPalette) {
  const top = DESK_BACK_Y;
  const bottom = 1080;
  ctx.fillStyle = linear(ctx, 0, top, 0, bottom, [
    [0, pal.woodDark],
    [0.25, pal.woodMid],
    [1, pal.woodLight],
  ]);
  ctx.fillRect(span.left, top, span.right - span.left, bottom - top);
  // Grain: long strokes that fan out from a vanishing point above the window.
  const vanishX = 1060;
  const vanishY = -900;
  const random = scatter(7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(span.left, top, span.right - span.left, bottom - top);
  ctx.clip();
  for (let i = 0; i < 260; i++) {
    const t = random();
    const bottomX = span.left - 400 + t * (span.right - span.left + 800);
    const wobble = (random() - 0.5) * 40;
    const startT = (top - vanishY) / (bottom - vanishY);
    const sx = vanishX + (bottomX - vanishX) * startT;
    ctx.strokeStyle = alpha(random() < 0.5 ? pal.woodGrain : pal.woodLight, 0.05 + random() * 0.12);
    ctx.lineWidth = 0.6 + random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.bezierCurveTo(
      sx + (bottomX - sx) * 0.33 + wobble,
      top + (bottom - top) * 0.33,
      sx + (bottomX - sx) * 0.66 - wobble,
      top + (bottom - top) * 0.66,
      bottomX,
      bottom,
    );
    ctx.stroke();
  }
  // A few knots.
  for (let i = 0; i < 5; i++) {
    const kx = span.left + random() * (span.right - span.left);
    const ky = top + 120 + random() * 420;
    ctx.strokeStyle = alpha(pal.woodGrain, 0.22);
    ctx.lineWidth = 1.4;
    for (let ring = 1; ring < 5; ring++) {
      ctx.beginPath();
      ctx.ellipse(kx, ky, ring * 7, ring * 2.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Plank seams.
  for (const seam of [-0.35, 0.18, 0.62, 1.1]) {
    const bottomX = span.left + seam * 1920;
    const startT = (top - vanishY) / (bottom - vanishY);
    const sx = vanishX + (bottomX - vanishX) * startT;
    ctx.strokeStyle = alpha('#000000', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(bottomX, bottom);
    ctx.stroke();
  }
  ctx.restore();
  const texture = grain(ctx, '#000000', 0.18);
  if (texture) {
    ctx.fillStyle = texture;
    ctx.fillRect(span.left, top, span.right - span.left, bottom - top);
  }
  // The back edge meets the wall in shadow; the front edge is the desk's thickness.
  ctx.fillStyle = linear(ctx, 0, top - 2, 0, top + 30, [
    [0, alpha('#000000', 0.45)],
    [1, alpha('#000000', 0)],
  ]);
  ctx.fillRect(span.left, top - 2, span.right - span.left, 32);
  ctx.fillStyle = linear(ctx, 0, 1046, 0, 1080, [
    [0, mix(pal.woodLight, '#ffffff', 0.12)],
    [0.12, pal.deskEdge],
    [1, mix(pal.deskEdge, '#000000', 0.4)],
  ]);
  ctx.fillRect(span.left, 1046, span.right - span.left, 34);
}

/** Morning sun through the panes, thrown across the desk and up the wall. */
export function paintSunlight(ctx: Ctx, span: Span, pal: DeskPalette) {
  if (pal.look !== 'morning') return;
  const glass = windowGlass();
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = radial(ctx, 1150, 560, 1250, [
    [0, alpha('#fff2cf', 0.6)],
    [1, alpha('#fff2cf', 0)],
  ]);
  ctx.fillRect(span.left, 0, span.right - span.left, 1080);
  ctx.globalCompositeOperation = 'screen';
  // The panes fall on the desk as soft patches: the big lower pane near the wall, the upper
  // sash's small panes further forward. Each patch is laid down several times, growing and
  // fading, which blurs its edges without a filter.
  const meetY = glass.y + glass.height * MEETING_RAIL;
  const patches: Array<[number, number, number, number]> = [
    [glass.x + 10, meetY + 14, glass.x + glass.width - 10, glass.y + glass.height - 8],
  ];
  for (let i = 0; i < 4; i++) {
    const w = glass.width / 4;
    patches.push([glass.x + i * w + 8, glass.y + 8, glass.x + (i + 1) * w - 8, meetY - 12]);
  }
  const project = (px: number, py: number) => {
    const height = 1 - (py - glass.y) / glass.height;
    return { x: px - 260 - height * 300, y: DESK_BACK_Y + 30 + height * 520 };
  };
  for (const [x0, y0, x1, y1] of patches) {
    const corners = [project(x0, y1), project(x1, y1), project(x1, y0), project(x0, y0)];
    for (let k = 0; k < 5; k++) {
      const grow = k * 9;
      ctx.fillStyle = alpha('#fff0c6', 0.07);
      ctx.beginPath();
      ctx.moveTo(corners[0]!.x - grow, corners[0]!.y - grow * 0.5);
      ctx.lineTo(corners[1]!.x + grow, corners[1]!.y - grow * 0.5);
      ctx.lineTo(corners[2]!.x + grow, corners[2]!.y + grow * 0.5);
      ctx.lineTo(corners[3]!.x - grow, corners[3]!.y + grow * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Dust drifting in the morning light; it moves, so it is drawn live over a cached room. */
export function paintDust(ctx: Ctx, pal: DeskPalette, time: number) {
  if (pal.look !== 'morning') return;
  const glass = windowGlass();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const random = scatter(99);
  for (let i = 0; i < 70; i++) {
    const bx = glass.x - 260 + random() * (glass.width + 60);
    const by = glass.y + 120 + random() * 640;
    const drift = Math.sin(time * 0.3 + i) * 14;
    const x = bx + drift - ((by - glass.y) / 700) * 240;
    const y = by + Math.cos(time * 0.21 + i * 1.7) * 10;
    ctx.fillStyle = alpha('#fff6dc', 0.2 + random() * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Night: everything outside the lamp's pool sinks into the room's blue shadow. Multiplied, so
 * colours keep their hue; glows are added afterwards and stay bright.
 */
export function paintLampDarkness(ctx: Ctx, span: Span, pal: DeskPalette, flicker = 0) {
  if (pal.look !== 'night') return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const r = 900 + flicker * 10;
  ctx.fillStyle = radial(ctx, LAMP.x + 120, LAMP.baseY + 170, r, [
    [0, '#fff4e2'],
    [0.25, '#f0d9bb'],
    [0.55, mix(pal.ambient, '#f0d9bb', 0.4)],
    [1, pal.ambient],
  ]);
  ctx.fillRect(span.left, 0, span.right - span.left, 1080);
  ctx.restore();
}

/** The desk lamp: a brass column with a green glass shade, lit at night. */
export function paintLamp(ctx: Ctx, pal: DeskPalette) {
  const { x, baseY, shadeY } = LAMP;
  ctx.save();
  // Base.
  ctx.fillStyle = alpha('#000000', 0.3);
  ctx.beginPath();
  ctx.ellipse(x + 10, baseY + 6, 84, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = linear(ctx, x - 70, 0, x + 70, 0, [
    [0, pal.brassDeep],
    [0.35, pal.brassLight],
    [0.5, pal.brassShine],
    [0.7, pal.brass],
    [1, pal.brassDeep],
  ]);
  ctx.beginPath();
  ctx.ellipse(x, baseY - 6, 70, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 70, baseY - 20, 140, 14);
  ctx.beginPath();
  ctx.ellipse(x, baseY - 20, 70, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha('#000000', 0.18);
  ctx.beginPath();
  ctx.ellipse(x, baseY - 20, 54, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Column.
  ctx.fillStyle = linear(ctx, x - 9, 0, x + 9, 0, [
    [0, pal.brassDeep],
    [0.4, pal.brassShine],
    [1, pal.brassDeep],
  ]);
  ctx.fillRect(x - 8, shadeY + 30, 16, baseY - 24 - shadeY - 30);
  // A pull chain.
  ctx.strokeStyle = pal.brassLight;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x + 52, shadeY + 44);
  ctx.lineTo(x + 52, shadeY + 104);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pal.brass;
  ctx.beginPath();
  ctx.arc(x + 52, shadeY + 108, 4, 0, Math.PI * 2);
  ctx.fill();
  // The green glass shade, a long half-cylinder.
  const sw = 150;
  const sh = 56;
  const green = pal.look === 'night' ? '#1f6b46' : '#2b7a52';
  ctx.fillStyle = linear(ctx, 0, shadeY, 0, shadeY + sh, [
    [0, mix(green, '#ffffff', 0.45)],
    [0.35, green],
    [1, mix(green, '#000000', 0.45)],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - sw / 2, shadeY + sh);
  ctx.bezierCurveTo(x - sw / 2, shadeY - 4, x + sw / 2, shadeY - 4, x + sw / 2, shadeY + sh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha('#ffffff', 0.35);
  ctx.beginPath();
  ctx.ellipse(x - 28, shadeY + 18, 34, 7, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // Brass rim.
  ctx.fillStyle = pal.brassLight;
  ctx.fillRect(x - sw / 2 - 3, shadeY + sh - 2, sw + 6, 6);
  if (pal.lampOn) {
    // The bright underside of the shade.
    ctx.fillStyle = radial(ctx, x, shadeY + sh + 4, 70, [
      [0, '#fffbe8'],
      [0.5, alpha(pal.lampGlow, 0.9)],
      [1, alpha(pal.lampGlow, 0)],
    ]);
    ctx.beginPath();
    ctx.ellipse(x, shadeY + sh + 4, sw / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The lamp's light: a soft pool on the desk and a bloom under the shade, added on top. */
export function paintLampLight(ctx: Ctx, pal: DeskPalette, flicker = 0) {
  if (!pal.lampOn) return;
  const { x, shadeY } = LAMP;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const strength = 0.85 + flicker * 0.05;
  // The pool where the light lands, flattened by the desk's angle.
  ctx.save();
  ctx.translate(x + 60, 700);
  ctx.scale(1, 0.42);
  ctx.fillStyle = radial(ctx, 0, 0, 520, [
    [0, alpha(pal.lampGlow, 0.2 * strength)],
    [0.5, alpha(pal.lampGlow, 0.08 * strength)],
    [1, alpha(pal.lampGlow, 0)],
  ]);
  ctx.fillRect(-540, -540, 1080, 1080);
  ctx.restore();
  // A faint cone in the air under the shade.
  ctx.fillStyle = linear(ctx, 0, shadeY + 60, 0, 640, [
    [0, alpha(pal.lampGlow, 0.12 * strength)],
    [1, alpha(pal.lampGlow, 0)],
  ]);
  for (let k = 0; k < 4; k++) {
    const spread = 160 + k * 60;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x - 64, shadeY + 58);
    ctx.lineTo(x + 64, shadeY + 58);
    ctx.lineTo(x + spread, 660);
    ctx.lineTo(x - spread, 660);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = radial(ctx, x, shadeY + 62, 130, [
    [0, alpha(pal.lampGlow, 0.55)],
    [1, alpha(pal.lampGlow, 0)],
  ]);
  ctx.fillRect(x - 140, shadeY - 70, 280, 270);
  ctx.restore();
}

/** A wooden nameplate with brass screws, for the title on the wall. */
export function paintNameplate(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: DeskPalette,
) {
  ctx.save();
  ctx.fillStyle = alpha('#000000', 0.25);
  roundRect(ctx, x + 4, y + 6, w, h, 8);
  ctx.fill();
  ctx.fillStyle = linear(ctx, x, y, x, y + h, [
    [0, pal.brassLight],
    [0.5, pal.brass],
    [1, pal.brassDeep],
  ]);
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = alpha(pal.brassShine, 0.6);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 5);
  ctx.stroke();
  for (const sx of [x + 14, x + w - 14])
    screw(ctx, sx, y + h / 2, 4, pal.brassShine, pal.brassDeep);
  ctx.restore();
}

/**
 * The desk seen close, for the machine stations: the camera leans in over one machine, so the
 * wood fills the screen with broad grain, lit by the morning sun from the upper right or by the
 * lamp from the upper left, and darkening towards the edges.
 */
export function paintCloseDesk(ctx: Ctx, span: Span, pal: DeskPalette, time: number) {
  const top = Math.min(0, span.top ?? 0);
  const width = span.right - span.left;
  ctx.fillStyle = linear(ctx, 0, top, 0, 1080, [
    [0, pal.woodDark],
    [0.4, pal.woodMid],
    [1, pal.woodLight],
  ]);
  ctx.fillRect(span.left, top, width, 1080 - top);
  const random = scatter(23);
  ctx.save();
  for (let i = 0; i < 180; i++) {
    const x = span.left + random() * (width + 400) - 200;
    const wobble = (random() - 0.5) * 120;
    ctx.strokeStyle = alpha(random() < 0.5 ? pal.woodGrain : pal.woodLight, 0.05 + random() * 0.12);
    ctx.lineWidth = 1 + random() * 4;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.bezierCurveTo(x + wobble, top + 300, x - wobble, 700, x + wobble * 0.4, 1080);
    ctx.stroke();
  }
  for (const seam of [0.08, 0.41, 0.74]) {
    ctx.strokeStyle = alpha('#000000', 0.22);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(span.left + width * seam, top);
    ctx.lineTo(span.left + width * seam + 30, 1080);
    ctx.stroke();
  }
  ctx.restore();
  const texture = grain(ctx, '#000000', 0.2);
  if (texture) {
    ctx.fillStyle = texture;
    ctx.fillRect(span.left, top, width, 1080 - top);
  }
  if (pal.look === 'morning') {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = radial(ctx, 1500, 120, 1500, [
      [0, alpha('#fff3d2', 0.8)],
      [1, alpha('#fff3d2', 0)],
    ]);
    ctx.fillRect(span.left, top, width, 1080 - top);
    ctx.globalCompositeOperation = 'screen';
    // Two window-pane patches of sun lying across the wood.
    for (const [x0, y0, w, h] of [
      [1180, -40, 560, 420],
      [620, 160, 380, 300],
    ] as const) {
      for (let k = 0; k < 5; k++) {
        const grow = k * 14;
        ctx.fillStyle = alpha('#fff0c6', 0.05);
        ctx.beginPath();
        ctx.moveTo(x0 - grow, y0 - grow);
        ctx.lineTo(x0 + w + grow, y0 - grow);
        ctx.lineTo(x0 + w - 220 + grow, y0 + h + grow);
        ctx.lineTo(x0 - 220 - grow, y0 + h + grow);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = radial(ctx, 520, 280, 1400, [
      [0, '#fff4e2'],
      [0.35, '#e9cfab'],
      [0.75, mix(pal.ambient, '#e9cfab', 0.3)],
      [1, pal.ambient],
    ]);
    ctx.fillRect(span.left, top, width, 1080 - top);
    ctx.restore();
  }
  // Vignette.
  ctx.fillStyle = radial(ctx, 960, 540, 1250, [
    [0.55, alpha('#000000', 0)],
    [1, alpha('#000000', pal.look === 'night' ? 0.5 : 0.28)],
  ]);
  ctx.fillRect(span.left, top, width, 1080 - top);
  void time;
}

/**
 * The light over a station, laid on after its machines: at night the lamp's pool falls from
 * `lamp` and everything beyond it sinks into the room's shadow; by day nothing is added, the
 * close desk already carries the sun.
 */
export function paintStationLight(
  ctx: Ctx,
  span: Span,
  pal: DeskPalette,
  lamp: { x: number; y: number; r: number },
) {
  if (pal.look !== 'night') return;
  const top = Math.min(0, span.top ?? 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = radial(ctx, lamp.x, lamp.y, lamp.r, [
    [0, '#ffffff'],
    [0.45, '#f1dfc6'],
    [0.8, mix(pal.ambient, '#f1dfc6', 0.45)],
    [1, mix(pal.ambient, '#f1dfc6', 0.2)],
  ]);
  ctx.fillRect(span.left, top, span.right - span.left, 1080 - top);
  ctx.restore();
}

/** The close desk, painted once per look and size and copied each frame. */
export class CloseDeskLayer {
  private readonly layer = new CachedLayer();

  paint(ctx: Ctx, frame: DesignFrame, ratio: number, pal: DeskPalette) {
    const span = { ...frame.span, top: frame.top };
    blit(
      ctx,
      this.layer.get(frame, ratio, pal.look, (layer) => paintCloseDesk(layer, span, pal, 0)),
    );
  }
}
