import { alpha, lerp } from '../paint';
import type { SprintPalette } from './palette';

/**
 * The athlete, side on and facing right, drawn from a skeleton every frame: joint angles make a
 * pose, poses blend, and limbs are thick round strokes from joint to joint, so nothing can come
 * apart however the pose moves. Angles are measured from straight down, forward positive; the
 * torso's lean is measured from straight up.
 */

interface LegAngles {
  /** Thigh from straight down. */
  readonly thigh: number;
  /** How far the knee folds the shin back from the thigh's line. */
  readonly knee: number;
  /** Extra toe-down at the ankle. */
  readonly point: number;
}

interface ArmAngles {
  readonly shoulder: number;
  readonly elbow: number;
}

export interface Pose {
  readonly lean: number;
  /** Lift above the ground in body units (180 is standing height). */
  readonly lift: number;
  readonly near: LegAngles;
  readonly far: LegAngles;
  readonly nearArm: ArmAngles;
  readonly farArm: ArmAngles;
  /** Head tilt from the torso's line, down positive. */
  readonly nod: number;
}

/** Body lengths in units of a 180-unit standing height. */
const TORSO = 52;
const NECK = 8;
const HEAD = 13.5;
const UPPER_ARM = 28;
const FOREARM = 27;
const THIGH = 49;
const SHIN = 47;
const FOOT = 21;

function legAt(phase: number, stride: number): LegAngles {
  const swing = Math.max(0, Math.cos(phase + 0.6)) ** 2.2;
  return {
    thigh: 0.2 + 0.8 * stride * Math.sin(phase),
    knee: 0.38 + 1.95 * stride * swing,
    point: 0.1 + 0.75 * Math.max(0, -Math.sin(phase)),
  };
}

function armAt(phase: number, stride: number): ArmAngles {
  return { shoulder: 0.12 - 1.05 * stride * Math.sin(phase), elbow: 1.45 + 0.4 * Math.sin(phase) };
}

/** One instant of the running stride; `stride` 0–1 grows the swing from a jog to a sprint. */
export function runPose(phase: number, stride = 1): Pose {
  return {
    lean: 0.2 + 0.14 * stride,
    lift: 5 * stride * Math.max(0, Math.sin(2 * phase + 0.4)),
    near: legAt(phase, stride),
    far: legAt(phase + Math.PI, stride),
    nearArm: armAt(phase, stride),
    farArm: armAt(phase + Math.PI, stride),
    nod: 0.05,
  };
}

/**
 * Crouched in the blocks, "set": hips above the shoulders, arms straight down to the line, the
 * front knee near a right angle and the back leg reaching to the rear block. `breath` rocks it.
 */
export function setPose(breath = 0): Pose {
  return {
    lean: 1.74 + 0.025 * breath,
    lift: 0,
    near: { thigh: 1.0, knee: 1.62, point: 0.95 },
    far: { thigh: -0.12, knee: 1.22, point: 1.05 },
    nearArm: { shoulder: 0.03, elbow: 0.03 },
    farArm: { shoulder: -0.02, elbow: 0.03 },
    nod: 0.3,
  };
}

/** Standing easy between events, bouncing a little on the toes; `breath` is a slow sine. */
export function standPose(breath = 0): Pose {
  return {
    lean: 0.06,
    lift: 1.5 + 1.5 * breath,
    near: { thigh: 0.08, knee: 0.16, point: 0.12 },
    far: { thigh: -0.06, knee: 0.12, point: 0.1 },
    nearArm: { shoulder: 0.12, elbow: 0.55 },
    farArm: { shoulder: -0.08, elbow: 0.5 },
    nod: 0.05,
  };
}

/** Over a hurdle: lead leg out straight, trail leg folded under, arms reaching. */
export function hurdlePose(): Pose {
  return {
    lean: 0.55,
    lift: 34,
    near: { thigh: 1.5, knee: 0.08, point: -0.15 },
    far: { thigh: 0.25, knee: 1.95, point: 0.35 },
    nearArm: { shoulder: -0.75, elbow: 1.1 },
    farArm: { shoulder: 1.35, elbow: 0.25 },
    nod: 0.15,
  };
}

/** Arms up in a V, still jogging: the finish. */
export function celebratePose(phase: number): Pose {
  const jog = runPose(phase, 0.35);
  return {
    ...jog,
    lean: -0.06,
    nearArm: { shoulder: 2.7, elbow: 0.25 },
    farArm: { shoulder: 2.55, elbow: 0.3 },
    nod: -0.2,
  };
}

/** A stumble: knees give, the body pitches forward and down for a moment. */
export function stumblePose(phase: number): Pose {
  const run = runPose(phase, 0.6);
  return {
    ...run,
    lean: 0.62,
    lift: -6,
    near: { ...run.near, knee: run.near.knee + 0.5 },
    far: { ...run.far, knee: run.far.knee + 0.5 },
    nearArm: { shoulder: 1.2, elbow: 0.7 },
    farArm: { shoulder: -0.6, elbow: 0.9 },
    nod: 0.4,
  };
}

const mixLeg = (a: LegAngles, b: LegAngles, t: number): LegAngles => ({
  thigh: lerp(a.thigh, b.thigh, t),
  knee: lerp(a.knee, b.knee, t),
  point: lerp(a.point, b.point, t),
});
const mixArm = (a: ArmAngles, b: ArmAngles, t: number): ArmAngles => ({
  shoulder: lerp(a.shoulder, b.shoulder, t),
  elbow: lerp(a.elbow, b.elbow, t),
});

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    lean: lerp(a.lean, b.lean, t),
    lift: lerp(a.lift, b.lift, t),
    near: mixLeg(a.near, b.near, t),
    far: mixLeg(a.far, b.far, t),
    nearArm: mixArm(a.nearArm, b.nearArm, t),
    farArm: mixArm(a.farArm, b.farArm, t),
    nod: lerp(a.nod, b.nod, t),
  };
}

interface Point {
  x: number;
  y: number;
}

const down = (angle: number, length: number): Point => ({
  x: Math.sin(angle) * length,
  y: Math.cos(angle) * length,
});
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });

interface Leg {
  hip: Point;
  knee: Point;
  ankle: Point;
  toe: Point;
  heel: Point;
}

interface Arm {
  shoulder: Point;
  elbow: Point;
  hand: Point;
}

function leg(hip: Point, angles: LegAngles): Leg {
  const knee = add(hip, down(angles.thigh, THIGH));
  const shinAngle = angles.thigh - angles.knee;
  const ankle = add(knee, down(shinAngle, SHIN));
  const footAngle = -shinAngle + angles.point;
  const toe = {
    x: ankle.x + Math.cos(footAngle) * FOOT * 0.78,
    y: ankle.y + Math.sin(footAngle) * FOOT * 0.78,
  };
  const heel = {
    x: ankle.x - Math.cos(footAngle) * FOOT * 0.25,
    y: ankle.y - Math.sin(footAngle) * FOOT * 0.25,
  };
  return { hip, knee, ankle, toe, heel };
}

function arm(shoulder: Point, angles: ArmAngles): Arm {
  const elbow = add(shoulder, down(angles.shoulder, UPPER_ARM));
  const hand = add(elbow, down(angles.shoulder + angles.elbow, FOREARM));
  return { shoulder, elbow, hand };
}

export interface Skeleton {
  readonly hip: Point;
  readonly shoulder: Point;
  readonly neck: Point;
  readonly head: Point;
  readonly near: Leg;
  readonly far: Leg;
  readonly nearArm: Arm;
  readonly farArm: Arm;
  readonly up: Point;
  readonly forward: Point;
}

/** Joint positions in body units, with the lowest foot or hand resting on y = 0. */
export function skeleton(pose: Pose): Skeleton {
  const hip = { x: 0, y: 0 };
  const up = { x: Math.sin(pose.lean), y: -Math.cos(pose.lean) };
  const forward = { x: Math.cos(pose.lean), y: Math.sin(pose.lean) };
  const shoulder = { x: up.x * TORSO, y: up.y * TORSO };
  const headAngle = pose.lean + pose.nod;
  const neck = add(shoulder, {
    x: Math.sin(pose.lean * 0.8) * NECK,
    y: -Math.cos(pose.lean * 0.8) * NECK,
  });
  const head = add(neck, {
    x: Math.sin(headAngle) * HEAD * 0.95,
    y: -Math.cos(headAngle) * HEAD * 0.95,
  });
  const near = leg(hip, pose.near);
  const far = leg(hip, pose.far);
  const armRoot = add(shoulder, { x: -forward.x * 2, y: -forward.y * 2 + 3 });
  const nearArm = arm(armRoot, pose.nearArm);
  const farArm = arm(armRoot, pose.farArm);
  const lowest = Math.max(
    near.toe.y,
    near.heel.y,
    far.toe.y,
    far.heel.y,
    nearArm.hand.y + 4,
    farArm.hand.y + 4,
  );
  const drop = -lowest - pose.lift;
  const shift = (p: Point) => ({ x: p.x, y: p.y + drop });
  const shiftLeg = (l: Leg): Leg => ({
    hip: shift(l.hip),
    knee: shift(l.knee),
    ankle: shift(l.ankle),
    toe: shift(l.toe),
    heel: shift(l.heel),
  });
  const shiftArm = (a: Arm): Arm => ({
    shoulder: shift(a.shoulder),
    elbow: shift(a.elbow),
    hand: shift(a.hand),
  });
  return {
    hip: shift(hip),
    shoulder: shift(shoulder),
    neck: shift(neck),
    head: shift(head),
    near: shiftLeg(near),
    far: shiftLeg(far),
    nearArm: shiftArm(nearArm),
    farArm: shiftArm(farArm),
    up,
    forward,
  };
}

function stroke(ctx: CanvasRenderingContext2D, color: string, width: number, ...points: Point[]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function drawLeg(ctx: CanvasRenderingContext2D, l: Leg, palette: SprintPalette, far: boolean) {
  const skin = far ? palette.skinShade : palette.skin;
  stroke(ctx, skin, 17, l.hip, l.knee);
  stroke(ctx, skin, 12.5, l.knee, l.ankle);
  // The calf bulges a little behind the shin's upper half.
  const calf = { x: lerp(l.knee.x, l.ankle.x, 0.32), y: lerp(l.knee.y, l.ankle.y, 0.32) };
  stroke(ctx, skin, 14.5, l.knee, calf);
  // Shorts over the top of the thigh.
  const shortsEnd = { x: lerp(l.hip.x, l.knee.x, 0.5), y: lerp(l.hip.y, l.knee.y, 0.5) };
  stroke(ctx, far ? palette.shortsShade : palette.shorts, 21, l.hip, shortsEnd);
  // The shoe: heel to toe, with a sole and a stripe.
  stroke(ctx, far ? '#c9ced8' : palette.shoe, 11, l.heel, l.toe);
  const sole = { x: (l.toe.y - l.heel.y) * 0.18, y: -(l.toe.x - l.heel.x) * 0.18 };
  stroke(
    ctx,
    far ? '#7d8796' : '#3a4352',
    3,
    { x: l.heel.x - sole.x, y: l.heel.y - sole.y },
    { x: l.toe.x - sole.x, y: l.toe.y - sole.y },
  );
  const mid = { x: lerp(l.heel.x, l.toe.x, 0.5), y: lerp(l.heel.y, l.toe.y, 0.5) };
  stroke(ctx, palette.shoeStripe, 3.4, { x: l.heel.x + 2, y: l.heel.y - 1 }, mid);
}

function drawArm(ctx: CanvasRenderingContext2D, a: Arm, palette: SprintPalette, far: boolean) {
  const skin = far ? palette.skinShade : palette.skin;
  stroke(ctx, skin, 10.5, a.shoulder, a.elbow);
  stroke(ctx, skin, 9, a.elbow, a.hand);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(a.hand.x, a.hand.y, 5.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorso(
  ctx: CanvasRenderingContext2D,
  k: Skeleton,
  palette: SprintPalette,
  bib: string,
) {
  const { hip, up, forward } = k;
  const at = (along: number, across: number) => ({
    x: hip.x + up.x * along + forward.x * across,
    y: hip.y + up.y * along + forward.y * across,
  });
  // Pelvis in the shorts, so legs and body always meet.
  ctx.fillStyle = palette.shorts;
  ctx.beginPath();
  const pelvis = at(2, 0);
  ctx.ellipse(pelvis.x, pelvis.y, 13, 12, Math.atan2(up.y, up.x), 0, Math.PI * 2);
  ctx.fill();
  // The singlet: narrow at the waist, broad at the chest.
  ctx.fillStyle = palette.singlet;
  ctx.beginPath();
  const outline = [
    at(4, -10.5),
    at(4, 10),
    at(24, 10.5),
    at(40, 13.5),
    at(TORSO, 8),
    at(TORSO + 2, -4),
    at(TORSO - 4, -10.5),
    at(28, -11),
  ];
  ctx.moveTo(outline[0]!.x, outline[0]!.y);
  for (const p of outline.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.singlet;
  ctx.lineWidth = 6;
  ctx.stroke();
  // Shade along the back, a waistband and a white stripe down the side seam.
  stroke(ctx, palette.singletShade, 5, at(6, -9), at(30, -9.5), at(TORSO - 3, -8));
  stroke(ctx, palette.shorts, 4, at(5, -11), at(5, 10.5));
  stroke(ctx, alpha('#ffffff', 0.9), 2.6, at(7, 1), at(TORSO - 3, 1));
  // The race number on the chest.
  ctx.save();
  const centre = at(31, 9.5);
  ctx.translate(centre.x, centre.y);
  ctx.rotate(Math.atan2(up.y, up.x) + Math.PI / 2);
  ctx.fillStyle = '#fbfbf7';
  ctx.fillRect(-6.5, -8, 13, 15);
  ctx.fillStyle = '#1b2433';
  ctx.font = '700 10px "Bricolage Grotesque Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bib, 0, 0.5);
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, k: Skeleton, palette: SprintPalette, nod: number) {
  stroke(ctx, palette.skin, 9, k.shoulder, k.neck);
  const { head } = k;
  const angle = Math.atan2(k.head.y - k.neck.y, k.head.x - k.neck.x) + Math.PI / 2;
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);
  // Hair: close-cropped, covering the back and top.
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(0, 0, HEAD + 0.8, Math.PI * 0.62, Math.PI * 1.88);
  ctx.quadraticCurveTo(-2, -4, -HEAD * 0.95, 4);
  ctx.closePath();
  ctx.fill();
  // Headband in the race colour.
  ctx.strokeStyle = palette.band;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-HEAD * 0.98, -1.5);
  ctx.quadraticCurveTo(0, -HEAD * 0.42, HEAD * 0.98, -4.5);
  ctx.stroke();
  // Nose and ear.
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.moveTo(HEAD - 1, -1);
  ctx.lineTo(HEAD + 3.2, 3);
  ctx.lineTo(HEAD - 1.5, 4.5);
  ctx.fill();
  ctx.fillStyle = palette.skinShade;
  ctx.beginPath();
  ctx.ellipse(-2.5, 1.5, 2.4, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void nod;
}

export interface RunnerDraw {
  readonly x: number;
  /** The ground line under the runner. */
  readonly ground: number;
  /** Standing height in pixels. */
  readonly height: number;
  readonly pose: Pose;
  readonly bib: string;
  /** Floodlights behind: a rim of light along the back. */
  readonly rim: boolean;
  /** Drawn as a see-through silhouette in this colour: the personal-best ghost. */
  readonly ghost?: string;
}

export function drawRunner(
  ctx: CanvasRenderingContext2D,
  runner: RunnerDraw,
  sourcePalette: SprintPalette,
) {
  const palette = runner.ghost ? ghostPalette(sourcePalette, runner.ghost) : sourcePalette;
  const k = skeleton(runner.pose);
  const scale = runner.height / 180;
  // The shadow stays on the ground and shrinks as the body rises.
  const rise = -k.hip.y - 92;
  ctx.fillStyle = runner.ghost ? 'rgba(0,0,0,0)' : palette.shadow;
  ctx.beginPath();
  ctx.ellipse(
    runner.x + 4 * scale,
    runner.ground + 2 * scale,
    46 * scale * (1 - Math.min(0.5, rise / 140)),
    7 * scale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.save();
  ctx.translate(runner.x, runner.ground);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawArm(ctx, k.farArm, palette, true);
  drawLeg(ctx, k.far, palette, true);
  drawTorso(ctx, k, palette, runner.bib);
  drawLeg(ctx, k.near, palette, false);
  drawHead(ctx, k, palette, runner.pose.nod);
  drawArm(ctx, k.nearArm, palette, false);
  if (runner.rim && palette.rim) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(k.head.x, k.head.y, HEAD - 0.4, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
    const back = (along: number) => ({
      x: k.hip.x + k.up.x * along - k.forward.x * 11.5,
      y: k.hip.y + k.up.y * along - k.forward.y * 11.5,
    });
    stroke(ctx, palette.rim, 1.6, back(4), back(36), back(TORSO));
  }
  ctx.restore();
}

/** One flat colour for every part: the ghost reads as a shape, never as a second athlete. */
function ghostPalette(palette: SprintPalette, color: string): SprintPalette {
  return {
    ...palette,
    skin: color,
    skinShade: color,
    hair: color,
    singlet: color,
    singletShade: color,
    shorts: color,
    shortsShade: color,
    shoe: color,
    shoeStripe: color,
    band: color,
    rim: null,
  };
}
