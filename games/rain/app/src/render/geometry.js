// Scene geometry, shared by JavaScript and the shaders (port ADR-004).
//
// The camera stands 0.9 m above a still pond, looking out with the horizon
// a third of the way down the frame. The water plane is y = 0; x is right,
// z is away from the camera, distances in metres.
//
// The ripple simulation lives on a log-polar grid centred under the
// camera: u is the azimuth, v is log(distance). The map is conformal —
// grid cells are squares whose size grows with distance — so the wave
// equation stays the plain five-point Laplacian scaled by 1/(s r)^2, and the
// grid spends its texels the way the perspective spends pixels: fine near
// the camera, coarse far away.
//
// The original's bordered area (columns 2..COLS-3, rows 2..LINES-3) is
// laid onto the visible water: a column is an azimuth, a row is a
// distance (top row far, bottom row near), log-spaced like the grid.

export const CAMERA = { height: 0.9, vfovDeg: 42, horizonFrac: 0.32 };
export const WAVE_SPEED = 0.25; // m/s, capillary-gravity minimum (ADR-003)
export const QUALITY = {
  high: { cell: 0.0028, maxDim: 1024 },
  low: { cell: 0.0056, maxDim: 512 },
};

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

export function createCamera(aspect, opt = CAMERA) {
  const tanHalf = Math.tan((opt.vfovDeg * Math.PI) / 360);
  // pitch down so that the horizon sits at horizonFrac from the top
  const pitch = Math.atan((1 - 2 * opt.horizonFrac) * tanHalf);
  return {
    pos: [0, opt.height, 0],
    aspect,
    tanHalf,
    pitch,
    fwd: [0, -Math.sin(pitch), Math.cos(pitch)],
    up: [0, Math.cos(pitch), Math.sin(pitch)],
    right: [1, 0, 0],
  };
}

export function rayDir(cam, nx, ny) {
  const a = nx * cam.tanHalf * cam.aspect;
  const b = ny * cam.tanHalf;
  return norm([
    cam.fwd[0] + a * cam.right[0] + b * cam.up[0],
    cam.fwd[1] + a * cam.right[1] + b * cam.up[1],
    cam.fwd[2] + a * cam.right[2] + b * cam.up[2],
  ]);
}

// Where the ray through NDC (nx, ny) meets the water, or null above the horizon.
export function hitWater(cam, nx, ny) {
  const d = rayDir(cam, nx, ny);
  if (d[1] >= -1e-6) return null;
  const t = -cam.pos[1] / d[1];
  return { x: cam.pos[0] + d[0] * t, z: cam.pos[2] + d[2] * t };
}

// World point -> NDC (and the camera-space depth).
export function project(cam, p) {
  const q = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  const z = q[0] * cam.fwd[0] + q[1] * cam.fwd[1] + q[2] * cam.fwd[2];
  const x = q[0] * cam.right[0] + q[1] * cam.right[1] + q[2] * cam.right[2];
  const y = q[0] * cam.up[0] + q[1] * cam.up[1] + q[2] * cam.up[2];
  return { x: x / (z * cam.tanHalf * cam.aspect), y: y / (z * cam.tanHalf), depth: z };
}

const azimuth = (h) => Math.atan2(h.x, h.z);
const dist = (h) => Math.hypot(h.x, h.z);

// Lay out the pond for a viewport aspect and a quality level.
export function createPond(aspect, quality = 'high', opt = CAMERA) {
  const cam = createCamera(aspect, opt);
  const q = QUALITY[quality] || QUALITY.high;
  // the terminal: rows from 16 m (top) to just above the bottom edge
  const termFar = 16;
  // (a circle of constant distance droops toward the frame's corners)
  const termNear = dist(hitWater(cam, 1, -0.8));
  const farRow = project(cam, [0, 0, termFar]).y;
  const termAz = 0.94 * azimuth(hitWater(cam, 1, farRow));
  // the simulation: everything visible out to well past the terminal
  const bottom = hitWater(cam, 1, -1);
  const r0 = 0.85 * dist(hitWater(cam, 0, -1));
  const r1 = termFar * 1.5;
  let cell = q.cell;
  const SPONGE = 14; // texels of absorbing border on each side
  const halfAz = 1.04 * azimuth(bottom);
  const texU = () => Math.ceil((2 * halfAz) / cell) + 2 * SPONGE;
  const texV = () => Math.ceil(Math.log(r1 / r0) / cell) + SPONGE;
  while (Math.max(texU(), texV()) > q.maxDim) cell *= 1.05;
  const Nu = texU();
  const Nv = texV();
  const theta0 = -(Nu * cell) / 2;
  // time step: CFL c*dt/(s*r0) <= 0.5 on the finest (nearest) cells
  const maxDt = (0.5 * cell * r0) / WAVE_SPEED;
  const substeps = Math.max(1, Math.ceil(1 / 60 / maxDt));
  return {
    cam, aspect, quality,
    termFar, termNear, termAz,
    r0, r1, cell, Nu, Nv, theta0, sponge: SPONGE,
    dt: 1 / 60 / substeps, substeps,
  };
}

// A terminal cell (x, y) -> a point on the water. jx, jy in [-0.5, 0.5]
// place the drop inside its cell (the terminal could not; ADR-004).
export function termToWorld(pond, rain, x, y, jx = 0, jy = 0) {
  const fx = (x - 2 + 0.5 + jx) / rain.cols;
  const fy = (y - 2 + 0.5 + jy) / rain.lines;
  const az = -pond.termAz + 2 * pond.termAz * fx;
  const r = pond.termFar * (pond.termNear / pond.termFar) ** fy;
  return { x: r * Math.sin(az), z: r * Math.cos(az), r, az };
}

// World point -> simulation texture coordinates (0..1 over the grid).
export function worldToGrid(pond, x, z) {
  const az = Math.atan2(x, z);
  const r = Math.hypot(x, z);
  return {
    u: (az - pond.theta0) / pond.cell / pond.Nu,
    v: Math.log(r / pond.r0) / pond.cell / pond.Nv,
  };
}
