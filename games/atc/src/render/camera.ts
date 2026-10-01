/**
 * The radar's camera. Flat, it looks straight down; holding the tilt it swings towards the south
 * until the ground lies back at about fifty degrees, with a gentle perspective, so altitude can
 * be read as height. The ground only ever pitches (it never turns), which keeps every row of
 * the chart a horizontal line on screen and lets the chart texture be copied in thin strips.
 */

export const TILT_DEGREES = 50;
/** How strongly the far side shrinks at full tilt. */
const PERSPECTIVE = 0.2;
/** Height of one thousand feet, in cells, in the tilt view. */
export const LEVEL_HEIGHT = 0.5;

export interface Camera {
  /** 0 flat … 1 fully tilted. */
  tilt: number;
  /** Device pixels per cell when flat. */
  cell: number;
  /** Screen position of the arena's centre when flat. */
  originX: number;
  originY: number;
  /** Arena size in cells. */
  columns: number;
  rows: number;
  /** Extra scale and shift that keep the tilted sky inside the panel (1 and 0 when flat). */
  zoom: number;
  shiftX: number;
  shiftY: number;
}

/** A point the tilted camera leans in on, and how far: scrolling in the tilt view sets it. */
export interface Focus {
  x: number;
  y: number;
  altitude: number;
  zoom: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Size multiplier at that depth (1 when flat). */
  scale: number;
  /** Larger is nearer to the viewer; for sorting. */
  depth: number;
}

function pitch(camera: Camera): number {
  return ((TILT_DEGREES * Math.PI) / 180) * easeTilt(camera.tilt);
}

/** The tilt eases in and out so the swing feels like a hand turning the scope. */
export function easeTilt(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** A point in cells relative to the arena's centre, before zoom and shift. */
function unframed(camera: Camera, x: number, y: number, altitude: number) {
  const phi = pitch(camera);
  const t = easeTilt(camera.tilt);
  const radius = Math.hypot(camera.columns, camera.rows) / 2;
  const gx = x - camera.columns / 2;
  const gy = y - camera.rows / 2;
  const z = altitude * LEVEL_HEIGHT * t;
  const depth = gy * Math.sin(phi) + z * Math.cos(phi);
  const scale = 1 / (1 - (PERSPECTIVE * t * depth) / radius);
  return { x: gx * scale, y: (gy * Math.cos(phi) - z * Math.sin(phi)) * scale, scale, depth };
}

/** Projects a point given in cells (x east, y south) and thousands of feet. */
export function project(camera: Camera, x: number, y: number, altitude = 0): Projected {
  const p = unframed(camera, x, y, altitude);
  return {
    x: camera.originX + p.x * camera.cell * camera.zoom + camera.shiftX,
    y: camera.originY + p.y * camera.cell * camera.zoom + camera.shiftY,
    scale: p.scale * camera.zoom,
    depth: p.depth,
  };
}

/**
 * Chooses the zoom and shift that fit the whole tilted box, from the ground up to the ceiling,
 * inside a panel of the given size (device pixels). Flat, nothing changes.
 */
export function framed(
  camera: Camera,
  width: number,
  height: number,
  ceiling: number,
  focus?: Focus,
): Camera {
  if (!isTilted(camera)) {
    if (!focus) return { ...camera, zoom: 1, shiftX: 0, shiftY: 0 };
    const p = unframed(camera, focus.x, focus.y, 0);
    return {
      ...camera,
      zoom: focus.zoom,
      shiftX: -p.x * camera.cell * focus.zoom,
      shiftY: -p.y * camera.cell * focus.zoom,
    };
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const altitude of [0, ceiling + 0.8]) {
    for (const [x, y] of [
      [0, 0],
      [camera.columns, 0],
      [camera.columns, camera.rows],
      [0, camera.rows],
    ] as const) {
      const p = unframed(camera, x, y, altitude);
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const spanX = (Math.max(...xs) - Math.min(...xs)) * camera.cell;
  const spanY = (Math.max(...ys) - Math.min(...ys)) * camera.cell;
  const margin = camera.cell * 0.6;
  const fit = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY);
  const t = easeTilt(camera.tilt);
  const zoom = 1 + (Math.min(fit, 1.3) - 1) * t;
  const middle = ((Math.max(...ys) + Math.min(...ys)) / 2) * camera.cell * zoom;
  if (!focus) return { ...camera, zoom, shiftX: 0, shiftY: -middle };
  // Lean in: scale about the focus and bring it to the middle of the panel.
  const closer = zoom * (1 + (focus.zoom - 1) * t);
  const p = unframed(camera, focus.x, focus.y, focus.altitude);
  const blend = (from: number, to: number) => from + (to - from) * t;
  return {
    ...camera,
    zoom: closer,
    shiftX: blend(0, -p.x * camera.cell * closer),
    shiftY: blend(-middle, -p.y * camera.cell * closer),
  };
}

/** The vertical squash of the ground at full tilt, for drawing glyphs flat on their layer. */
export function groundSquash(camera: Camera): number {
  return Math.cos(pitch(camera));
}

export function isTilted(camera: Camera): boolean {
  return camera.tilt > 0.001;
}

/**
 * Copies the flat ground texture onto the tilted plane in horizontal strips. Each strip of
 * chart rows lands on one band of screen rows at one scale, which is exact for a pure pitch.
 * The texture reaches `margin` cells beyond the arena on every side.
 */
export function drawGround(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  texture: { canvas: HTMLCanvasElement; margin: { x: number; y: number } },
): void {
  const { canvas, margin } = texture;
  const cellsHigh = camera.rows + margin.y * 2;
  if (!isTilted(camera)) {
    const topLeft = project(camera, -margin.x, -margin.y);
    const bottomRight = project(camera, camera.columns + margin.x, camera.rows + margin.y);
    ctx.drawImage(
      canvas,
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y,
    );
    return;
  }
  const strips = Math.ceil(cellsHigh * camera.cell * camera.zoom * 0.45);
  const sourceRowsPerStrip = canvas.height / strips;
  for (let i = 0; i < strips; i++) {
    const v0 = (i / strips) * cellsHigh - margin.y;
    const v1 = ((i + 1) / strips) * cellsHigh - margin.y;
    const top = project(camera, 0, v0);
    const bottom = project(camera, 0, v1);
    if (bottom.y < -camera.cell || top.y > camera.originY * 2 + camera.cell) continue;
    const middle = (v0 + v1) / 2;
    const left = project(camera, -margin.x, middle).x;
    const right = project(camera, camera.columns + margin.x, middle).x;
    ctx.drawImage(
      canvas,
      0,
      i * sourceRowsPerStrip,
      canvas.width,
      sourceRowsPerStrip,
      left,
      top.y,
      right - left,
      bottom.y - top.y + 0.6,
    );
  }
}
