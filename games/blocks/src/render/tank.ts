import { AIR_ROWS, type Layout } from './layout';
import { FONT_DATA, type Look, withAlpha } from './look';

/**
 * The tank: a tall glass case standing on the sand. Its water is drawn behind the sinkers and its
 * glass in front of them (panes, sheen, the rims at its lip and its foot), with a depth gauge down
 * the left pane in metres. There is no grid: depth is read off the gauge, never off lines in the
 * water.
 */

export function tankBox(layout: Layout): {
  x: number;
  y: number;
  w: number;
  h: number;
  pane: number;
} {
  const pane = layout.cell * 0.24;
  return {
    x: layout.left - pane,
    y: layout.top - layout.cell * AIR_ROWS,
    w: layout.cols * layout.cell + pane * 2,
    h: layout.rows * layout.cell + layout.cell * AIR_ROWS + pane,
    pane,
  };
}

/** The water inside the tank, slightly clearer than the sea, and its surface. */
export function drawTankBack(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  look: Look,
  time: number,
  still: boolean,
): void {
  const box = tankBox(layout);
  const inside = {
    x: layout.left,
    y: layout.top,
    w: layout.cols * layout.cell,
    h: layout.rows * layout.cell,
  };
  ctx.save();
  // Shadow of the tank on the sand.
  ctx.fillStyle = withAlpha(look.sandShade, look.dark ? 0.6 : 0.35);
  ctx.beginPath();
  ctx.ellipse(
    box.x + box.w / 2,
    box.y + box.h + layout.cell * 0.15,
    box.w * 0.62,
    layout.cell * 0.32,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  const water = ctx.createLinearGradient(0, inside.y, 0, inside.y + inside.h);
  water.addColorStop(0, look.tankWater);
  water.addColorStop(1, look.tankWaterDeep);
  ctx.fillStyle = water;
  ctx.fillRect(box.x, inside.y - layout.cell * 0.2, box.w, inside.h + layout.cell * 0.2);
  // The surface: a gently moving line just above the top row, with the air above it.
  const t = still ? 0 : time;
  const surfaceY = inside.y - layout.cell * 0.2;
  ctx.fillStyle = withAlpha(look.glassShine, look.dark ? 0.06 : 0.18);
  ctx.fillRect(box.x, box.y, box.w, surfaceY - box.y);
  ctx.strokeStyle = withAlpha(look.glassEdge, 0.8);
  ctx.lineWidth = Math.max(1.5, layout.dpr * 2);
  ctx.beginPath();
  for (let x = box.x; x <= box.x + box.w; x += 4 * layout.dpr) {
    const y = surfaceY + Math.sin(x / (layout.cell * 0.9) + t * 1.6) * layout.cell * 0.04;
    if (x === box.x) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** The glass in front: side panes, a soft sheen across the front, the rims and the gauge. */
export function drawTankFront(ctx: CanvasRenderingContext2D, layout: Layout, look: Look): void {
  const box = tankBox(layout);
  const { pane, x, y, w, h } = box;
  ctx.save();
  // Side panes: thick glass seen edge-on, bright at their outer edge.
  for (const side of [x, x + w - pane]) {
    const glass = ctx.createLinearGradient(side, 0, side + pane, 0);
    glass.addColorStop(0, withAlpha(look.glassEdge, look.dark ? 0.35 : 0.55));
    glass.addColorStop(0.5, look.glass);
    glass.addColorStop(1, withAlpha(look.glassEdge, look.dark ? 0.2 : 0.35));
    ctx.fillStyle = glass;
    ctx.fillRect(side, y, pane, h);
  }
  // Two soft streaks of reflected light across the front glass.
  ctx.globalCompositeOperation = 'screen';
  for (const [from, width, alpha] of [
    [0.1, 0.07, look.dark ? 0.05 : 0.12],
    [0.24, 0.025, look.dark ? 0.04 : 0.1],
  ] as const) {
    ctx.fillStyle = withAlpha(look.glassShine, alpha);
    ctx.beginPath();
    ctx.moveTo(x + w * from, y);
    ctx.lineTo(x + w * (from + width), y);
    ctx.lineTo(x + w * (from + width - 0.18), y + h);
    ctx.lineTo(x + w * (from - 0.18), y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // The lip at the top and the foot at the bottom.
  const lip = layout.cell * 0.16;
  for (const [top, height] of [
    [y - lip * 0.5, lip],
    [y + h - lip * 0.2, lip * 1.6],
  ] as const) {
    ctx.fillStyle = look.rim;
    ctx.beginPath();
    ctx.roundRect(x - lip * 0.6, top, w + lip * 1.2, height, lip * 0.5);
    ctx.fill();
    ctx.fillStyle = withAlpha(look.rimLight, 0.8);
    ctx.fillRect(x - lip * 0.3, top + height * 0.12, w + lip * 0.6, Math.max(1, layout.dpr * 1.5));
  }
  ctx.restore();
  drawGauge(ctx, layout, look);
}

/** Metres down the left pane: a tick for every row, a number every third. */
function drawGauge(ctx: CanvasRenderingContext2D, layout: Layout, look: Look): void {
  const x = layout.left - layout.cell * 0.24;
  ctx.save();
  ctx.strokeStyle = look.gauge;
  ctx.fillStyle = look.gaugeInk;
  ctx.lineWidth = Math.max(1, layout.dpr * 1.2);
  ctx.font = `600 ${Math.round(layout.cell * 0.26)}px ${FONT_DATA}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let row = 1; row <= layout.rows; row++) {
    const y = layout.top + row * layout.cell;
    const major = row % 3 === 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + layout.cell * (major ? 0.22 : 0.12), y);
    ctx.stroke();
    if (major) ctx.fillText(`${row} m`, x - layout.cell * 0.14, y);
  }
  ctx.restore();
}
