import type { Layout } from '../layout';
import { alpha, createLayer, type Layer, scatter } from '../paint';
import type { SprintPalette } from './palette';

/**
 * The home straight seen from the infield: six lanes running across the screen, the far lane at
 * the stands' wall and the near one by the grass. Lanes are deeper the nearer they are, and
 * their markings slide by at a speed matching their depth, so the track has real perspective.
 */

export const LANES = 6;
/** The runner's lane, counted from the far side. */
export const RUNNER_LANE = 3;

export interface Lane {
  readonly top: number;
  readonly bottom: number;
  readonly middle: number;
  /** 1 for the runner's lane: how much nearer or farther things in this lane look. */
  readonly depth: number;
}

export interface TrackGeometry {
  readonly top: number;
  readonly bottom: number;
  readonly lanes: readonly Lane[];
  /** Pixels per metre in the runner's lane. */
  readonly metre: number;
}

export function trackGeometry(layout: Layout): TrackGeometry {
  const top = layout.horizon;
  const bottom = layout.height - (layout.kind === 'play' ? 150 : 40) * layout.s;
  const edge = (i: number) => top + (bottom - top) * (i / LANES) ** 1.3;
  const raw = Array.from({ length: LANES }, (_, i) => ({ top: edge(i), bottom: edge(i + 1) }));
  const reference = raw[RUNNER_LANE]!.bottom - raw[RUNNER_LANE]!.top;
  const lanes = raw.map((lane) => ({
    ...lane,
    middle: (lane.top + lane.bottom) / 2,
    depth: (lane.bottom - lane.top) / reference,
  }));
  return { top, bottom, lanes, metre: layout.height * 0.06 };
}

/** The ground that never moves: grass, track colour and its shading. */
export function paintGround(
  layout: Layout,
  geometry: TrackGeometry,
  palette: SprintPalette,
  dark: boolean,
  scale: number,
): Layer {
  const { width, height, s } = layout;
  const layer = createLayer(width, height - geometry.top, scale);
  const ctx = layer.ctx;
  ctx.translate(0, -geometry.top);
  const track = ctx.createLinearGradient(0, geometry.top, 0, geometry.bottom);
  track.addColorStop(0, palette.track[0]);
  track.addColorStop(1, palette.track[1]);
  ctx.fillStyle = track;
  ctx.fillRect(0, geometry.top, width, geometry.bottom - geometry.top);
  // Infield grass in mown stripes, below the near lane.
  const grassTop = geometry.bottom;
  ctx.fillStyle = palette.grass[0];
  ctx.fillRect(0, grassTop, width, height - grassTop);
  ctx.fillStyle = palette.grass[1];
  const stripe = 120 * s;
  for (let x = 0; x < width; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, grassTop);
    ctx.lineTo(x + stripe, grassTop);
    ctx.lineTo(x + stripe * 1.5, height);
    ctx.lineTo(x + stripe * 0.5, height);
    ctx.closePath();
    ctx.fill();
  }
  // The kerb between track and grass.
  ctx.fillStyle = dark ? '#c9d2e0' : '#ffffff';
  ctx.fillRect(0, grassTop, width, 5 * s);
  // Far lanes sit in the stands' shadow by day and in the floodlight pool by night.
  const shade = ctx.createLinearGradient(
    0,
    geometry.top,
    0,
    geometry.top + (geometry.bottom - geometry.top) * 0.45,
  );
  shade.addColorStop(0, dark ? 'rgba(0,0,0,0.35)' : 'rgba(60,20,10,0.22)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, geometry.top, width, geometry.bottom - geometry.top);
  if (dark) {
    const pool = ctx.createRadialGradient(
      width * 0.4,
      geometry.lanes[RUNNER_LANE]!.middle,
      0,
      width * 0.4,
      geometry.lanes[RUNNER_LANE]!.middle,
      width * 0.55,
    );
    pool.addColorStop(0, 'rgba(255, 236, 210, 0.22)');
    pool.addColorStop(1, 'rgba(255, 236, 210, 0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, geometry.top, width, height - geometry.top);
  }
  return layer;
}

/** A tile of rubber grain, slid along with each lane. */
export function grainPattern(
  ctx: CanvasRenderingContext2D,
  palette: SprintPalette,
  dark: boolean,
): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = 96;
  tile.height = 48;
  const t = tile.getContext('2d')!;
  const random = scatter(dark ? 5 : 3);
  for (let i = 0; i < 260; i++) {
    t.fillStyle =
      random() < 0.5
        ? dark
          ? 'rgba(0,0,0,0.28)'
          : 'rgba(90,20,10,0.16)'
        : dark
          ? 'rgba(255,220,200,0.06)'
          : 'rgba(255,230,220,0.18)';
    t.fillRect(random() * 96, random() * 48, 1 + random() * 1.6, 1 + random());
  }
  void palette;
  return ctx.createPattern(tile, 'repeat');
}

/** Lane lines, grain and the chevrons painted every ten metres, slid by `distance` metres. */
export function drawLanes(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  geometry: TrackGeometry,
  palette: SprintPalette,
  grain: CanvasPattern | null,
  distance: number,
) {
  const { width, s } = layout;
  for (const lane of geometry.lanes) {
    const shift = -(distance * geometry.metre * lane.depth);
    if (grain) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, lane.top, width, lane.bottom - lane.top);
      ctx.clip();
      ctx.translate(shift % 96, lane.top);
      ctx.scale(lane.depth, lane.depth * 0.6);
      ctx.fillStyle = grain;
      ctx.fillRect(
        -200,
        0,
        (width + 400) / lane.depth,
        (lane.bottom - lane.top) / (lane.depth * 0.6) + 4,
      );
      ctx.restore();
    }
  }
  // Lane lines: thicker and brighter nearer the camera.
  for (let i = 0; i <= LANES; i++) {
    const lane = geometry.lanes[Math.min(i, LANES - 1)]!;
    const y = i === LANES ? lane.bottom : lane.top;
    const thickness = Math.max(1.2, 3.4 * s * (i === LANES ? lane.depth : lane.depth * 0.85));
    if (palette.laneGlow) {
      ctx.fillStyle = palette.laneGlow;
      ctx.fillRect(0, y - thickness * 1.6, width, thickness * 3.2);
    }
    ctx.fillStyle = palette.lane;
    ctx.fillRect(0, y - thickness / 2, width, thickness);
  }
  // Chevrons every ten metres, mid-lane, sliding past at each lane's own speed.
  const spacing = 10;
  for (const lane of geometry.lanes) {
    const step = spacing * geometry.metre * lane.depth;
    const offset = -((distance * geometry.metre * lane.depth) % step);
    const size = 9 * s * lane.depth;
    ctx.fillStyle = alpha('#ffffff', 0.55);
    for (let x = offset; x < width + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x - size, lane.middle - size * 0.55);
      ctx.lineTo(x + size * 0.4, lane.middle);
      ctx.lineTo(x - size, lane.middle + size * 0.55);
      ctx.lineTo(x - size * 0.55, lane.middle);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Where a point `metres` ahead of the runner sits on screen, in a lane of the given depth. */
export function aheadX(
  runnerX: number,
  metres: number,
  geometry: TrackGeometry,
  depth: number,
): number {
  return runnerX + metres * geometry.metre * depth;
}
