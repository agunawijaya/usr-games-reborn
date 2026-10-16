/**
 * Each token's emblem: SVG path data on a 48 × 48 grid, drawn as a round 3 px stroke (the same
 * grammar as the Hall's game emblems). The interface draws them beside a player's name; the
 * world prints them on the flags that mark what a player owns.
 */
export const EMBLEMS: Readonly<Record<string, string>> = {
  // Harbour City
  tugboat: 'M6 30h36l-5 9H11zM14 30v-8h14v8M20 22v-9h6v9M31 30v-4h6',
  kite: 'M24 5l11 15-11 15-11-15zM13 20h22M24 5v30M24 35c-3 4 3 6 0 9',
  gull: 'M4 24c6-6 12-6 20 2 8-8 14-8 20-2M24 26v4',
  bike: 'M13 34a7 7 0 1 0 .01 0M35 34a7 7 0 1 0 .01 0M13 34l8-12h10l4 12M21 22l-3-6h-4M31 22l2-6h5',
  balloon:
    'M24 6a12 12 0 0 1 12 12c0 9-8 14-12 18-4-4-12-9-12-18A12 12 0 0 1 24 6zM20 36h8l-1 6h-6z',
  buoy: 'M24 6v6M18 12h12l4 22H14zM16 22h16M15 28h18M10 40c5-3 9-3 14 0s9 3 14 0',
  // Ring Colony
  rover:
    'M8 30h32v6H8zM12 36a4 4 0 1 0 .01 0M36 36a4 4 0 1 0 .01 0M24 36a4 4 0 1 0 .01 0M14 30v-8h14v8M28 22l6-8',
  drone: 'M16 24h16M10 18h12M26 18h12M16 18v6M32 18v6M18 24l2 8h8l2-8',
  robot: 'M14 16h20v16H14zM20 22v.01M28 22v.01M20 28h8M24 16V9M18 32v8M30 32v8M10 22h4M34 22h4',
  satellite:
    'M19 19h10v10H19zM6 15l9 4M6 33l9-4M42 15l-9 4M42 33l-9 4M29 29l7 7M38 34a4 4 0 0 1-4 4',
  helmet: 'M9 30a15 15 0 0 1 30 0v8H9zM14 30a10 10 0 0 1 20 0z',
  comet: 'M30 18a8 8 0 1 0 .01 0M24 24L6 42M28 27L14 41M21 20L7 34',
  // Pop-up 1904
  pennyfarthing: 'M18 28a12 12 0 1 0 .01 0M38 38a4 4 0 1 0 .01 0M18 28l4-14h6M22 14l16 24',
  teapot:
    'M12 22h22v12a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8zM34 26c6-2 8 4 2 8M12 26L5 20M18 22c0-5 10-5 10 0M23 15v2',
  crane: 'M6 30l18-8 18 8-18 6zM24 22L18 8l6 6 6-6-6 14M24 36v6',
  watch: 'M24 13a13 13 0 1 0 .01 0M24 17v9l6 4M24 6v7M21 6h6',
  umbrella: 'M6 24a18 18 0 0 1 36 0zM24 24v14a4 4 0 0 1-8 0M24 6v2',
  gramophone: 'M10 36h18v6H10zM19 36V24M19 24l14-16c4 6 6 12 6 18zM24 18l7 7',
};

/** Draws an emblem onto a canvas at the given size, centred, in one colour. */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  id: string,
  size: number,
  colour: string,
  lineWidth = 3,
): void {
  const path = EMBLEMS[id];
  if (!path) return;
  ctx.save();
  ctx.scale(size / 48, size / 48);
  ctx.strokeStyle = colour;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(path));
  ctx.restore();
}
