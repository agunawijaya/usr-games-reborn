import { faceLabel, type Face } from '../engine/grid';
import { type Camera, halfGrid, project, TRAY_MARGIN } from './camera';
import { type Palette, type Rgb } from './palette';
import type { Vec3 } from './math3d';

/**
 * The board without WebGL 2: the same tabletop drawn flat on the 2D layer, each cube as its top
 * and front faces in perspective with its letter. Plainer than the lit cubes, but the game is
 * whole. Tumbling cubes are drawn upright as they fall.
 */
export interface FlatCube {
  position: Vec3;
  colour: Rgb;
  face: Face;
  trace: number;
}

function css([r, g, b]: Rgb, shade = 1): string {
  const channel = (value: number) => Math.round(Math.min(255, value * 255 * shade));
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}

function quad(ctx: CanvasRenderingContext2D, camera: Camera, corners: readonly Vec3[]) {
  const points = corners.map((corner) => project(camera, corner));
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}

export function paintFlatBoard(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  palette: Palette,
  cubes: readonly FlatCube[],
  width: number,
  height: number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const half = halfGrid(camera.size) + TRAY_MARGIN;
  ctx.fillStyle = palette.trayEdge;
  quad(ctx, camera, [
    [-half, 0, half],
    [half, 0, half],
    [half, -0.36, half],
    [-half, -0.36, half],
  ]);
  ctx.fill();
  ctx.fillStyle = palette.tray;
  quad(ctx, camera, [
    [-half, 0, -half],
    [half, 0, -half],
    [half, 0, half],
    [-half, 0, half],
  ]);
  ctx.fill();

  // Far cubes first, so nearer ones overlap them.
  const ordered = [...cubes].sort((a, b) => a.position[2] - b.position[2]);
  for (const cube of ordered) {
    const [x, y, z] = cube.position;
    const top = y + 0.5;
    const bottom = y - 0.5;
    const s = 0.47;
    ctx.fillStyle = css(cube.colour, 0.78);
    quad(ctx, camera, [
      [x - s, top, z + s],
      [x + s, top, z + s],
      [x + s, bottom, z + s],
      [x - s, bottom, z + s],
    ]);
    ctx.fill();
    ctx.fillStyle = css(cube.colour, 1 + cube.trace * 0.08);
    quad(ctx, camera, [
      [x - s, top, z - s],
      [x + s, top, z - s],
      [x + s, top, z + s],
      [x - s, top, z + s],
    ]);
    ctx.fill();
    if (cube.trace > 0) {
      ctx.strokeStyle = palette.traceGlow;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const centre = project(camera, [x, top, z]);
    const left = project(camera, [x - s, top, z]);
    const right = project(camera, [x + s, top, z]);
    const size = Math.abs(right.x - left.x) * (cube.face === 'qu' ? 0.5 : 0.62);
    ctx.fillStyle = palette.letter;
    ctx.font = `600 ${Math.round(size)}px 'Fredoka Variable', 'Fredoka', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(faceLabel(cube.face), centre.x, centre.y + size * 0.04);
  }
}
