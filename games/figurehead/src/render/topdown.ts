import { DC, type DesignId, DR, type Nation, windAngle } from '../engine';
import type { Palette } from './palette';

/**
 * A ship seen from above, the way she sits on the chart: hull and deck, masts, the yards braced
 * round to the wind with their canvas, the flag streaming downwind from her stern. Drawn in
 * cell units on a canvas already scaled to the chart.
 */

export interface TopShip {
  /** Centre of the ship in cells, and her heading in radians (0 = east, clockwise). */
  x: number;
  y: number;
  angle: number;
  design: DesignId;
  nation: Nation;
  /** The flag she flies now: her captor's, if taken. */
  flag: Nation;
  sails: 0 | 1 | 2;
  /** 0 to 1 for fore, main and mizzen. */
  rig: readonly number[];
  struck: boolean;
  burning: boolean;
  /** 0 afloat, rising to 1 as she goes down. */
  sinking: number;
  /** The player's own ship: drawn with her painted band. */
  own: boolean;
  dim: boolean;
}

/** Length in cells by design: ships of the line are longer, sloops and brigs shorter. */
const LENGTHS: Partial<Record<DesignId, number>> = {
  'seventy-four': 2.1,
  fifty: 2,
  'heavy-frigate': 1.85,
  frigate: 1.8,
  'light-frigate': 1.7,
  corvette: 1.62,
  'heavy-corvette': 1.65,
  merchantman: 1.65,
  sloop: 1.48,
  brig: 1.38,
  cutter: 1.28,
};

const MASTS: Partial<Record<DesignId, number[]>> = {
  cutter: [0.08],
  brig: [-0.22, 0.28],
};

export function shipLength(design: DesignId): number {
  return LENGTHS[design] ?? 1.7;
}

/** The angle a heading (1–8, 1 north, clockwise) points on screen. */
export function headingAngle(dir: number): number {
  return Math.atan2(-DR[dir]!, -DC[dir]!);
}

/** How far the yards are braced round from square, by the wind on her: square before the wind. */
function brace(winddir: number, dir: number): number {
  const rel = windAngle(winddir, dir);
  const amount = [0, 0.26, 0.46, 0.6, 0.6, 0.6, 0.46, 0.26][rel]!;
  return rel > 0 && rel < 4 ? amount : rel > 4 ? -amount : 0;
}

export function drawTopShip(
  ctx: CanvasRenderingContext2D,
  ship: TopShip,
  p: Palette,
  wind: { dir: number; speed: number },
  shipDir: number,
  time: number,
): void {
  const L = shipLength(ship.design);
  const half = L / 2;
  // Half her beam: a frigate is about four times as long as she is wide.
  const beam = L * 0.135;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.globalAlpha = (ship.dim ? 0.45 : 1) * (1 - ship.sinking * 0.85);
  ctx.rotate(ship.angle);
  const sink = 1 - ship.sinking * 0.35;
  ctx.scale(sink, sink);

  // Shadow on the water, then the hull.
  ctx.fillStyle = 'rgba(10, 20, 30, 0.18)';
  hullPath(ctx, half, beam, 0.05);
  ctx.fill();
  hullPath(ctx, half, beam, 0);
  ctx.fillStyle = p.hull;
  ctx.fill();
  hullPath(ctx, half * 0.9, beam * 0.78, 0);
  ctx.fillStyle = ship.struck ? p.deckLine : p.deck;
  ctx.fill();
  // Deck planking runs fore and aft.
  ctx.strokeStyle = p.deckLine;
  ctx.lineWidth = 0.012;
  for (const t of [-0.5, -0.17, 0.17, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(-half * 0.78, t * beam * 0.7);
    ctx.lineTo(half * 0.62, t * beam * 0.62);
    ctx.stroke();
  }
  // Her painted band along the gunwale; the player's own in her colours.
  hullPath(ctx, half * 0.97, beam * 0.92, 0);
  ctx.strokeStyle = ship.own ? p.nationBand[0] : p.nationBand[ship.nation];
  ctx.lineWidth = 0.05;
  ctx.stroke();
  // Bowsprit.
  ctx.strokeStyle = p.spar;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.moveTo(half * 0.86, 0);
  ctx.lineTo(half * 1.3, 0);
  ctx.stroke();

  // Masts and canvas. Struck ships carry none.
  const masts = MASTS[ship.design] ?? [-0.42, 0.04, 0.44];
  const braced = brace(wind.dir, shipDir);
  const carrying = !ship.struck && ship.sails > 0 && wind.speed > 0;
  // Headsails: a jib from the foremast to the end of the bowsprit, the ship's surest sign.
  const foreRig = ship.rig[0] ?? 1;
  if (carrying && foreRig > 0) {
    const foreX = masts[masts.length - 1]! * half * 1.6;
    ctx.beginPath();
    ctx.moveTo(foreX + 0.04, 0);
    ctx.lineTo(half * 1.28, 0);
    ctx.quadraticCurveTo(half * 0.95, beam * 0.9, foreX + 0.12, beam * 0.3);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    ctx.strokeStyle = p.sailShade;
    ctx.lineWidth = 0.018;
    ctx.stroke();
  }
  masts.forEach((at, i) => {
    const rigIndex = masts.length === 3 ? [2, 1, 0][i]! : masts.length === 2 ? [1, 0][i]! : 1;
    const share = ship.rig[rigIndex] ?? 1;
    const mx = at * half * 1.6;
    if (share > 0 && carrying) {
      // A square sail seen from above: a bellied curve of canvas hanging from its yard, the
      // belly blown forward, its edge in shadow.
      const span = beam * (ship.sails === 2 ? 1.85 : 1.55) * (share < 0.5 ? 0.78 : 1);
      const belly = (ship.sails === 2 ? 0.26 : 0.18) * (share < 0.5 ? 0.6 : 1);
      ctx.save();
      ctx.translate(mx, 0);
      ctx.rotate(braced);
      ctx.beginPath();
      ctx.moveTo(-0.03, -span);
      ctx.quadraticCurveTo(belly * 1.6, 0, -0.03, span);
      ctx.quadraticCurveTo(belly * 0.35, 0, -0.03, -span);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 20, 30, 0.16)';
      ctx.save();
      ctx.translate(-0.05, 0.05);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = p.sail;
      ctx.fill();
      ctx.strokeStyle = p.sailShade;
      ctx.lineWidth = 0.02;
      ctx.stroke();
      ctx.strokeStyle = p.spar;
      ctx.globalAlpha *= 0.75;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(-0.03, -span * 1.04);
      ctx.lineTo(-0.03, span * 1.04);
      ctx.stroke();
      ctx.restore();
    }
    // The aftermost mast of a ship-rigged vessel also sets a fore-and-aft spanker.
    if (carrying && share > 0 && i === 0 && masts.length !== 1) {
      ctx.beginPath();
      ctx.moveTo(mx - 0.02, 0);
      ctx.lineTo(-half * 1.02, 0.02);
      ctx.quadraticCurveTo(-half * 0.8, beam * 0.95, mx - 0.06, beam * 0.25);
      ctx.closePath();
      ctx.fillStyle = p.sail;
      ctx.fill();
      ctx.strokeStyle = p.sailShade;
      ctx.lineWidth = 0.016;
      ctx.stroke();
    }
    ctx.fillStyle = share > 0 ? p.spar : p.newTimber;
    ctx.beginPath();
    ctx.arc(mx, 0, share > 0 ? 0.055 : 0.04, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // The flag streams downwind from the stern, whatever her heading.
  if (!ship.struck && ship.sinking === 0) {
    const sternX = ship.x - Math.cos(ship.angle) * half * 0.86;
    const sternY = ship.y - Math.sin(ship.angle) * half * 0.86;
    const downwind = headingAngle(wind.dir);
    const flutter = Math.sin(time / 260 + ship.x * 3) * 0.12 * (wind.speed > 0 ? 1 : 0);
    ctx.save();
    ctx.translate(sternX, sternY);
    ctx.rotate(downwind + flutter);
    ctx.fillStyle = p.nation[ship.flag];
    ctx.strokeStyle = p.hull;
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -0.1);
    ctx.lineTo(0.36, -0.08 + flutter * 0.2);
    ctx.lineTo(0.36, 0.08 + flutter * 0.2);
    ctx.lineTo(0, 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function hullPath(ctx: CanvasRenderingContext2D, half: number, beam: number, offset: number): void {
  ctx.beginPath();
  ctx.moveTo(half + offset, offset);
  ctx.bezierCurveTo(
    half * 0.55 + offset,
    beam * 1.05 + offset,
    -half * 0.55 + offset,
    beam * 1.02 + offset,
    -half + offset,
    beam * 0.62 + offset,
  );
  ctx.lineTo(-half - 0.02 + offset, -beam * 0.62 + offset);
  ctx.bezierCurveTo(
    -half * 0.55 + offset,
    -beam * 1.02 + offset,
    half * 0.55 + offset,
    -beam * 1.05 + offset,
    half + offset,
    offset,
  );
  ctx.closePath();
}
