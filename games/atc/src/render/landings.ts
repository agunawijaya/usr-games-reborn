import type { Runway } from '../engine/arena';
import { type Camera, project } from './camera';
import { approachLights, headingVector, type Point, runwayEnds } from './features';
import type { RadarScene } from './radar';

/**
 * The landing moments: approach lights that ripple towards the runway like a running rabbit, and
 * the string of pearls, a bead on each runway for every landing in an unbroken run of ticks,
 * threaded together, with rings that chime out from the newest one.
 */

/** Seconds for the wave to run from the farthest light to the threshold. */
const WAVE_SECONDS = 0.55;
/** The wave runs twice. */
const PASSES = [0, 0.7] as const;
/** Lights stay warm this long after a landing. */
const AFTERGLOW_SECONDS = 2.6;
const CHIME_RINGS = 3;
const CHIME_GAP = 0.22;
const CHIME_SECONDS = 1.3;

function cells(camera: Camera, amount: number): number {
  return camera.cell * amount;
}

/** How brightly the wave lights a light at position `u` (0 farthest, 1 nearest) at `age`. */
function waveGlow(age: number, u: number): number {
  let glow = 0;
  for (const pass of PASSES) {
    const front = (age - pass) / WAVE_SECONDS;
    if (front < -0.3 || front > 1.4) continue;
    glow = Math.max(glow, Math.exp(-(((front - u) / 0.16) ** 2)));
  }
  return glow;
}

export function drawApproachLights(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
): void {
  const { look } = scene;
  const fade = 1 - scene.drain * 0.85;
  ctx.save();
  scene.world.arena.runways.forEach((runway, index) => {
    const ripples = scene.ripples.filter((r) => r.runway === index);
    const lights = approachLights(runway);
    lights.forEach((light, i) => {
      const u = i / (lights.length - 1);
      let glow = look.dark || scene.night ? 0.3 : 0;
      for (const ripple of ripples) {
        const age = scene.reducedMotion ? 0.3 : scene.time - ripple.start;
        if (age < 0) continue;
        glow = Math.max(glow, waveGlow(age, u));
        if (age < AFTERGLOW_SECONDS) glow = Math.max(glow, 0.5 * (1 - age / AFTERGLOW_SECONDS));
      }
      if (glow > 0.01) drawLight(ctx, camera, scene, runway, light, glow * fade);
    });
    const flash = Math.max(
      0,
      ...ripples.map((r) => {
        const sinceArrival = scene.time - r.start - PASSES[1] - WAVE_SECONDS;
        return sinceArrival > 0 && sinceArrival < 0.5 ? 1 - sinceArrival / 0.5 : 0;
      }),
    );
    if (flash > 0 && !scene.reducedMotion) drawRunwayFlash(ctx, camera, scene, index, flash * fade);
  });
  ctx.restore();
}

/** One approach light: a short bar across the approach line, glowing as the wave passes. */
function drawLight(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  runway: Runway,
  light: Point,
  glow: number,
): void {
  const { look } = scene;
  const along = headingVector(runway.heading);
  const half = 0.17 + glow * 0.05;
  const a = project(camera, light.x - along.y * half, light.y + along.x * half);
  const b = project(camera, light.x + along.y * half, light.y - along.x * half);
  const at = project(camera, light.x, light.y);
  const halo = cells(camera, 0.55) * at.scale * glow;
  if (halo > 1) {
    const gradient = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, halo);
    gradient.addColorStop(0, look.lightsOn);
    gradient.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.globalAlpha = Math.min(1, glow) * (look.dark ? 0.7 : 0.45);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(at.x, at.y, halo, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  const width = cells(camera, 0.07 + glow * 0.05) * at.scale;
  if (!look.dark && glow > 0.2) {
    ctx.globalAlpha = Math.min(1, glow);
    ctx.strokeStyle = look.lightsEdge;
    ctx.lineWidth = width + cells(camera, 0.05);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = Math.min(1, 0.3 + glow);
  ctx.strokeStyle = look.lightsOn;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  if (glow > 0.6) {
    ctx.globalAlpha = (glow - 0.6) * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = width * 0.4;
    ctx.stroke();
  }
}

/** The runway edge lights blink once as the wave reaches the threshold. */
function drawRunwayFlash(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  index: number,
  strength: number,
): void {
  const runway = scene.world.arena.runways[index]!;
  const [threshold, end] = runwayEnds(runway);
  const a = project(camera, threshold.x, threshold.y);
  const b = project(camera, end.x, end.y);
  ctx.globalAlpha = strength * 0.9;
  ctx.strokeStyle = scene.look.lightsOn;
  ctx.lineCap = 'round';
  ctx.lineWidth = cells(camera, 0.34) * a.scale;
  ctx.shadowColor = scene.look.lightsOn;
  ctx.shadowBlur = cells(camera, 0.6);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** A plane lined up to continue the string: where its landing light shines, on screen. */
export interface QueuedLight {
  x: number;
  y: number;
  scale: number;
  /** The runway the plane will land on. */
  runway: number;
  /** 1 for the next landing, 2 for the one after … */
  order: number;
}

/** Where a landing touches down: on the centre line, just past the threshold. */
function touchdown(scene: RadarScene, runwayIndex: number): Point {
  const runway = scene.world.arena.runways[runwayIndex]!;
  const [threshold] = runwayEnds(runway);
  const along = headingVector(runway.heading);
  return { x: threshold.x + along.x * 0.45, y: threshold.y + along.y * 0.45 };
}

/**
 * The strings under the traffic: on each runway a dotted thread from the touchdown point up the
 * approach through every plane lined up there to keep the string going, so the landing lights
 * hang on it like pearls; and a pearl where the last landing touched down, chiming.
 */
export function drawPearlThread(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  queue: readonly QueuedLight[],
): void {
  const pearls = scene.pearls ?? [];
  const newest = pearls[pearls.length - 1];
  if (!newest && queue.length === 0) return;
  const { look } = scene;
  ctx.save();

  scene.world.arena.runways.forEach((_, runway) => {
    const lights = queue.filter((q) => q.runway === runway).sort((a, b) => a.order - b.order);
    if (lights.length === 0) return;
    const start = touchdown(scene, runway);
    const points = [project(camera, start.x, start.y, 0), ...lights];
    ctx.strokeStyle = look.pearlThread;
    ctx.lineWidth = Math.max(1.5, cells(camera, 0.05));
    ctx.lineCap = 'round';
    ctx.setLineDash([cells(camera, 0.02), cells(camera, 0.14)]);
    ctx.globalAlpha = 0.95;
    if (look.dark) {
      ctx.shadowColor = look.pearlThread;
      ctx.shadowBlur = cells(camera, 0.25);
    }
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  });

  if (newest) {
    const spot = touchdown(scene, newest.runway);
    const landed = project(camera, spot.x, spot.y, 0);
    const age = scene.time - newest.start;
    if (!scene.reducedMotion && age >= 0) {
      ctx.strokeStyle = look.pearlThread;
      for (let ring = 0; ring < CHIME_RINGS; ring++) {
        const t = (age - ring * CHIME_GAP) / CHIME_SECONDS;
        if (t <= 0 || t >= 1) continue;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.lineWidth = cells(camera, 0.05) * (1 - t * 0.5);
        ctx.beginPath();
        ctx.arc(landed.x, landed.y, cells(camera, 0.35 + t * 1.9), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const grow = scene.reducedMotion ? 1 : Math.min(1, Math.max(0, age / 0.3));
    drawPearl(ctx, camera, scene, landed.x, landed.y, cells(camera, 0.26) * (0.4 + grow * 0.6));
  }
  ctx.restore();
}

/**
 * Landing lights on the planes lined up for the string: the pearls themselves, each with a small
 * number saying when it lands.
 */
export function drawLandingLights(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  queue: readonly QueuedLight[],
): void {
  const { look } = scene;
  ctx.save();
  for (const light of queue) {
    const radius = cells(camera, 0.2) * Math.min(light.scale, 1.6);
    if (look.dark) {
      const bloom = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius * 4);
      bloom.addColorStop(0, 'rgba(255, 246, 225, 0.75)');
      bloom.addColorStop(1, 'rgba(255, 216, 138, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(light.x, light.y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPearl(ctx, camera, scene, light.x, light.y, radius);
    const badge = Math.max(9, cells(camera, 0.2));
    const bx = light.x - radius * 1.25;
    const by = light.y - radius * 1.25;
    ctx.globalAlpha = 1;
    ctx.fillStyle = look.pearlThread;
    ctx.beginPath();
    ctx.arc(bx, by, badge, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.dark ? '#1c1405' : '#fff8f2';
    ctx.font = `700 ${(badge * 1.3).toFixed(1)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(light.order), bx, by + badge * 0.08);
  }
  ctx.restore();
}

function drawPearl(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: RadarScene,
  x: number,
  y: number,
  radius: number,
): void {
  const { look } = scene;
  ctx.globalAlpha = 1;
  if (look.dark) {
    ctx.shadowColor = look.lightsOn;
    ctx.shadowBlur = cells(camera, 0.5);
  } else {
    ctx.shadowColor = 'rgba(60, 40, 10, 0.35)';
    ctx.shadowBlur = cells(camera, 0.12);
    ctx.shadowOffsetY = cells(camera, 0.04);
  }
  const shine = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.1,
    x,
    y,
    radius,
  );
  shine.addColorStop(0, '#ffffff');
  shine.addColorStop(0.45, look.dark ? '#fff4dc' : '#fbf3e4');
  shine.addColorStop(1, look.dark ? '#d8c39a' : '#d9c7a6');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = look.dark ? 'rgba(255, 216, 138, 0.8)' : 'rgba(28, 42, 68, 0.45)';
  ctx.lineWidth = Math.max(1, cells(camera, 0.025));
  ctx.stroke();
}
