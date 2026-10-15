import type { CarInk } from './look';
import { type Ctx, alpha, circle, fillWith, roundRect, strokeWith } from './paint';

/**
 * The two cars, side on, facing right, drawn in car units (100 long, the ground at y = 0) and
 * scaled. They differ in shape as well as colour: your open roadster with its driver's scarf
 * in the wind, the rival's bubble-top coupé with little tail fins.
 */

export type CarModel = 'roadster' | 'coupe';

export interface CarPose {
  /** Turns of the wheels, for the spokes. */
  wheelTurn: number;
  /** Suspension bounce, in car units (negative is up). */
  bob: number;
  /** Nose up (positive) or down, in radians. */
  pitch: number;
  /** Rear tyre gone flat: 0–1. */
  flat: number;
  /** A dented front bumper after a fender bender: 0–1. */
  dent: number;
  /** Lights on: headlamp beams and glowing tail lights. */
  lights: boolean;
  /** How hard the scarf streams back: 0 parked, 1 at speed. */
  wind: number;
  /** A gleam across the paint (a fresh fix): 0–1 along the body, or negative for none. */
  shine: number;
  time: number;
}

export const RESTING: CarPose = {
  wheelTurn: 0,
  bob: 0,
  pitch: 0,
  flat: 0,
  dent: 0,
  lights: false,
  wind: 0.3,
  shine: -1,
  time: 0,
};

const GLASS = '#bfe3ee';
const GLASS_NIGHT = '#33496b';
const CHROME = '#dfe5ea';
const TYRE = '#1f2329';

/** Draws a car with its ground point at (x, y), `scale` pixels per car unit. */
export function drawCar(
  ctx: Ctx,
  model: CarModel,
  ink: CarInk,
  x: number,
  y: number,
  scale: number,
  pose: CarPose,
  night: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Shadow on the road.
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 54, 4.2, 0, 0, Math.PI * 2);
  fillWith(ctx, alpha('#000000', night ? 0.35 : 0.22));
  if (pose.lights) beam(ctx, model);
  const rear = model === 'roadster' ? -31 : -32;
  const front = model === 'roadster' ? 33 : 33;
  const sag = pose.flat * 4;
  ctx.save();
  // Body tilts back over a flat rear tyre and pitches with the road.
  ctx.translate(0, pose.bob);
  ctx.rotate(-pose.pitch - pose.flat * 0.06);
  if (model === 'roadster') roadsterBody(ctx, ink, pose, night);
  else coupeBody(ctx, ink, pose, night);
  ctx.restore();
  wheel(ctx, rear, -10 + sag * 0.4, 10, pose.wheelTurn, pose.flat, model === 'coupe');
  wheel(ctx, front, -10, 10, pose.wheelTurn, 0, model === 'coupe');
  ctx.restore();
}

function beam(ctx: Ctx, model: CarModel): void {
  const fx = model === 'roadster' ? 52 : 52;
  const grad = ctx.createLinearGradient(fx, 0, fx + 120, 0);
  grad.addColorStop(0, 'rgba(255, 238, 170, 0.5)');
  grad.addColorStop(1, 'rgba(255, 238, 170, 0)');
  ctx.beginPath();
  ctx.moveTo(fx, -20);
  ctx.lineTo(fx + 120, -34);
  ctx.lineTo(fx + 120, 2);
  ctx.lineTo(fx, -16);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function roadsterBody(ctx: Ctx, ink: CarInk, pose: CarPose, night: boolean): void {
  // The scarf first, so the body covers its knot.
  scarf(ctx, ink, pose);
  // Lower body: a long hood, a cockpit cut low, a rounded tail.
  ctx.beginPath();
  ctx.moveTo(-50, -9);
  ctx.bezierCurveTo(-52, -16, -50, -24, -42, -25);
  ctx.lineTo(-20, -25);
  ctx.quadraticCurveTo(-16, -21, -10, -21);
  ctx.lineTo(4, -21);
  ctx.lineTo(8, -25);
  ctx.lineTo(40, -23);
  ctx.bezierCurveTo(50, -22, 54, -17, 53, -9);
  ctx.closePath();
  fillWith(ctx, ink.body);
  // Fenders swell over the wheels in the deeper shade.
  for (const wx of [-31, 33]) {
    ctx.beginPath();
    ctx.ellipse(wx, -12, 15, 11, 0, Math.PI, 0);
    fillWith(ctx, ink.bodyDeep);
  }
  // A cream racing stripe along the flank.
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-46, -17.5, 92, 2.6);
  // Windscreen.
  ctx.beginPath();
  ctx.moveTo(6, -24);
  ctx.lineTo(1, -35);
  ctx.lineTo(4, -35);
  ctx.lineTo(10, -24.5);
  ctx.closePath();
  fillWith(ctx, night ? GLASS_NIGHT : GLASS);
  ctx.beginPath();
  ctx.moveTo(6, -24);
  ctx.lineTo(1, -35);
  strokeWith(ctx, CHROME, 1.2);
  // The driver: helmet, goggles, a raised shoulder.
  ctx.beginPath();
  ctx.ellipse(-12, -26, 7, 5, 0, Math.PI, 0);
  fillWith(ctx, '#2a3140');
  circle(ctx, -11, -34, 5.4);
  fillWith(ctx, '#f0c9a0');
  ctx.beginPath();
  ctx.arc(-11, -34.5, 5.6, Math.PI * 1.05, Math.PI * 1.95);
  fillWith(ctx, '#3b2a1e');
  roundRect(ctx, -9.5, -36, 6, 2.6, 1.2);
  fillWith(ctx, night ? '#9ec3ff' : '#7fb4d6');
  // Chrome bumpers, headlamp, tail light.
  roundRect(ctx, 49, -12, 7, 3.2, 1.4);
  fillWith(ctx, CHROME);
  roundRect(ctx, -54, -12, 6, 3.2, 1.4);
  fillWith(ctx, CHROME);
  lamp(ctx, 46, -19, 3.4, '#fff4c8', pose.lights);
  tail(ctx, -50, -18, pose.lights);
  dent(ctx, pose.dent);
  shine(ctx, pose.shine, -46, 50, -24, -10);
  ctx.beginPath();
  ctx.moveTo(-40, -9);
  ctx.lineTo(46, -9);
  strokeWith(ctx, alpha('#000000', 0.18), 1);
}

function coupeBody(ctx: Ctx, ink: CarInk, pose: CarPose, night: boolean): void {
  // Lower body with small tail fins.
  ctx.beginPath();
  ctx.moveTo(-51, -9);
  ctx.lineTo(-52, -22);
  ctx.lineTo(-47, -29);
  ctx.lineTo(-42, -23);
  ctx.lineTo(-26, -24);
  // The bubble roof.
  ctx.bezierCurveTo(-22, -45, 12, -47, 18, -25);
  ctx.lineTo(42, -22);
  ctx.bezierCurveTo(52, -21, 54, -15, 53, -9);
  ctx.closePath();
  fillWith(ctx, ink.body);
  for (const wx of [-32, 33]) {
    ctx.beginPath();
    ctx.ellipse(wx, -12, 15, 10, 0, Math.PI, 0);
    fillWith(ctx, ink.bodyDeep);
  }
  // Windows with a pillar between.
  ctx.beginPath();
  ctx.moveTo(-21, -25);
  ctx.bezierCurveTo(-18, -41, 8, -43, 13, -26);
  ctx.closePath();
  fillWith(ctx, night ? GLASS_NIGHT : GLASS);
  ctx.fillStyle = ink.body;
  ctx.fillRect(-4.5, -42, 3, 18);
  // The driver behind the glass.
  circle(ctx, 4, -32, 4.6);
  fillWith(ctx, alpha('#1d2433', 0.75));
  ctx.beginPath();
  ctx.ellipse(4, -25.5, 6.5, 4, 0, Math.PI, 0);
  fillWith(ctx, alpha('#1d2433', 0.75));
  // Trim line and chrome.
  ctx.fillStyle = ink.trim;
  ctx.fillRect(-48, -16.5, 96, 1.8);
  roundRect(ctx, 49, -12, 7, 3.2, 1.4);
  fillWith(ctx, CHROME);
  roundRect(ctx, -55, -12, 6, 3.2, 1.4);
  fillWith(ctx, CHROME);
  lamp(ctx, 47, -18.5, 3.2, '#fff4c8', pose.lights);
  tail(ctx, -51, -20, pose.lights);
  dent(ctx, pose.dent);
  shine(ctx, pose.shine, -48, 50, -40, -10);
  void night;
}

function scarf(ctx: Ctx, ink: CarInk, pose: CarPose): void {
  const flutter = Math.sin(pose.time * 9) * 1.6 * pose.wind;
  const reach = 10 + 16 * pose.wind;
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.bezierCurveTo(
    -18 - reach * 0.4,
    -31 + flutter,
    -16 - reach * 0.7,
    -26 - flutter,
    -14 - reach,
    -29 + flutter * 1.4,
  );
  ctx.lineTo(-15 - reach, -25.5 + flutter * 1.4);
  ctx.bezierCurveTo(-16 - reach * 0.7, -23 - flutter, -18 - reach * 0.4, -27 + flutter, -14, -27);
  ctx.closePath();
  fillWith(ctx, ink.trim);
}

function lamp(ctx: Ctx, x: number, y: number, r: number, colour: string, on: boolean): void {
  if (on) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 236, 160, 0.95)';
    ctx.shadowBlur = 18;
    circle(ctx, x, y, r);
    fillWith(ctx, '#fffbe6');
    ctx.restore();
    return;
  }
  circle(ctx, x, y, r);
  fillWith(ctx, colour);
  circle(ctx, x, y, r);
  strokeWith(ctx, CHROME, 1);
}

function tail(ctx: Ctx, x: number, y: number, on: boolean): void {
  ctx.save();
  if (on) {
    ctx.shadowColor = 'rgba(255, 60, 60, 0.9)';
    ctx.shadowBlur = 10;
  }
  roundRect(ctx, x - 1.5, y - 2, 3.2, 4.4, 1.2);
  fillWith(ctx, on ? '#ff5146' : '#c23a33');
  ctx.restore();
}

/** A crumpled nose: the bumper knocked askew and a crease in the wing. */
function dent(ctx: Ctx, amount: number): void {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount);
  ctx.fillStyle = alpha('#1d2433', 0.35);
  ctx.beginPath();
  ctx.moveTo(53, -9);
  ctx.lineTo(50, -15);
  ctx.lineTo(46, -12.5);
  ctx.lineTo(44, -17);
  ctx.lineTo(41, -13);
  ctx.lineTo(43, -9);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(55, -10);
  ctx.rotate(0.45);
  roundRect(ctx, -3, -1.6, 7, 3.2, 1.4);
  fillWith(ctx, CHROME);
  ctx.restore();
  ctx.restore();
}

function shine(ctx: Ctx, at: number, x0: number, x1: number, y0: number, y1: number): void {
  if (at < 0 || at > 1) return;
  const x = x0 + (x1 - x0) * at;
  const grad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = grad;
  ctx.fillRect(x - 8, y0, 16, y1 - y0);
  ctx.restore();
}

function wheel(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  turn: number,
  flat: number,
  whitewall: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  const squash = flat * 0.28;
  ctx.save();
  ctx.translate(0, r * squash * 0.5);
  ctx.scale(1 + squash * 0.35, 1 - squash);
  circle(ctx, 0, 0, r);
  fillWith(ctx, TYRE);
  if (whitewall) {
    circle(ctx, 0, 0, r * 0.74);
    fillWith(ctx, '#f2efe6');
  }
  ctx.restore();
  circle(ctx, 0, 0, r * 0.56);
  fillWith(ctx, CHROME);
  ctx.rotate(turn * Math.PI * 2);
  ctx.strokeStyle = '#8a939d';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16);
    ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    ctx.stroke();
  }
  circle(ctx, 0, 0, r * 0.18);
  fillWith(ctx, '#8a939d');
  ctx.restore();
}
