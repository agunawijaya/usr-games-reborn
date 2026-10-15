import {
  blinkAmount,
  breath,
  type Ctx,
  drawGrumpCloud,
  drawHeldCards,
  drawSparkles,
  drawThoughtBubble,
  ellipse,
  hop,
  type RivalPainter,
  type RivalPose,
  star,
} from './common';

/**
 * Hazel the heron: she remembers what you asked for, and asks it back. She stands in the
 * shallows on one leg, drawn in profile because a heron is its silhouette: the long dagger beak,
 * the S of the neck, the black crest and its trailing plumes. Her monocle is the tell of a
 * careful memory. She holds her cards under the bend of her wing.
 */

interface Plumage {
  body: string;
  bodyLight: string;
  bodyShade: string;
  wing: string;
  primaries: string;
  neck: string;
  neckShade: string;
  streak: string;
  crest: string;
  beak: string;
  beakShade: string;
  leg: string;
  iris: string;
  monocle: string;
  ripple: string;
}

const DAY: Plumage = {
  body: '#8796ab',
  bodyLight: '#b6c2d0',
  bodyShade: '#5e6c82',
  wing: '#6f7e95',
  primaries: '#2b3140',
  neck: '#f1f3f1',
  neckShade: '#cfd5d9',
  streak: '#3a404c',
  crest: '#22252d',
  beak: '#e8a73c',
  beakShade: '#b97a22',
  leg: '#c7a04a',
  iris: '#f2d24b',
  monocle: '#b8862e',
  ripple: 'rgba(255, 255, 255, 0.6)',
};

const NIGHT: Plumage = {
  body: '#5d6b82',
  bodyLight: '#7f8ca0',
  bodyShade: '#3e485b',
  wing: '#4d5a6e',
  primaries: '#1a1e28',
  neck: '#cdd2db',
  neckShade: '#a3abb8',
  streak: '#262b35',
  crest: '#121419',
  beak: '#d79a3a',
  beakShade: '#9d6a1f',
  leg: '#a8893f',
  iris: '#f6dc62',
  monocle: '#d6a640',
  ripple: 'rgba(200, 220, 255, 0.45)',
};

export const HERON: RivalPainter = {
  height: 248,
  draw(ctx: Ctx, pose: RivalPose): void {
    const p = pose.look.dark ? NIGHT : DAY;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.scale(pose.scale * (pose.facing ?? 1), pose.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawRipples(ctx, p, pose.time);
    const lift = pose.mood === 'delighted' ? -10 * hop(pose.moodAge) : 0;
    drawLegs(ctx, p, lift);
    ctx.translate(0, lift);
    drawTailAndBody(ctx, p, pose);
    drawNeckAndHead(ctx, p, pose);
    drawWingAndCards(ctx, p, pose);
    // Bubbles and sparkles read the same either way she faces.
    ctx.scale(pose.facing ?? 1, 1);
    const headX = 40 * (pose.facing ?? 1);
    if (pose.mood === 'thinking') drawThoughtBubble(ctx, headX - 92, -228, pose.time, pose.look);
    if (pose.mood === 'delighted') {
      drawSparkles(ctx, headX, -226, 64, pose.time, pose.look.dark ? '#ffe27a' : '#ffffff');
    }
    if (pose.mood === 'grumpy') drawGrumpCloud(ctx, headX + 10, -284, pose.time, pose.look);
    ctx.restore();
  },
};

function drawRipples(ctx: Ctx, p: Plumage, time: number): void {
  ctx.strokeStyle = p.ripple;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.35 + i / 3) % 1;
    ctx.globalAlpha = (1 - t) * 0.9;
    ellipse(ctx, 0, 1, 10 + t * 46, 3 + t * 9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLegs(ctx: Ctx, p: Plumage, lift: number): void {
  ctx.strokeStyle = p.leg;
  // The standing leg, from the water up to the body, with the backward-bending joint.
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3, -50 + lift * 0.4);
  ctx.lineTo(4, -94 + lift);
  ctx.stroke();
  ellipse(ctx, -3, -50 + lift * 0.4, 3.2, 3.2);
  ctx.fillStyle = p.leg;
  ctx.fill();
  // The other leg tucked up under her, toes curled.
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, -96 + lift);
  ctx.lineTo(-8, -76 + lift);
  ctx.lineTo(-20, -86 + lift);
  ctx.stroke();
  ctx.lineWidth = 2.4;
  for (const dx of [-5, -1, 3]) {
    ctx.beginPath();
    ctx.moveTo(-20, -86 + lift);
    ctx.quadraticCurveTo(-24 + dx, -80 + lift, -26 + dx, -84 + lift);
    ctx.stroke();
  }
}

function drawTailAndBody(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const puff = pose.mood === 'grumpy' ? 4 : breath(pose.time, pose.seed) * 1.5;
  // Long tail plumes drooping behind.
  ctx.beginPath();
  ctx.moveTo(-38, -112);
  ctx.quadraticCurveTo(-70, -100, -84, -84);
  ctx.quadraticCurveTo(-64, -92, -40, -100);
  ctx.closePath();
  ctx.fillStyle = p.bodyShade;
  ctx.fill();
  // The body: an egg tipped forward, breast high.
  ctx.save();
  ctx.translate(-6, -120);
  ctx.rotate(-0.42);
  ellipse(ctx, 0, 0, 50 + puff, 30 + puff);
  const body = ctx.createLinearGradient(0, -30, 0, 30);
  body.addColorStop(0, p.bodyLight);
  body.addColorStop(0.6, p.body);
  body.addColorStop(1, p.bodyShade);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = p.bodyShade;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
  // Pale breast feathers hanging at the front.
  ctx.beginPath();
  ctx.moveTo(18, -150);
  ctx.quadraticCurveTo(44, -128, 34, -98);
  ctx.lineTo(28, -104);
  ctx.lineTo(24, -96);
  ctx.lineTo(18, -104);
  ctx.quadraticCurveTo(14, -128, 18, -150);
  ctx.fillStyle = p.neckShade;
  ctx.fill();
}

function drawNeckAndHead(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const sway = Math.sin(pose.time * 0.9 + pose.seed) * 2.2;
  const nod = pose.mood === 'thinking' ? 0.16 : pose.mood === 'grumpy' ? 0.1 : 0;
  const head = { x: 34 + sway, y: -222 + (pose.mood === 'thinking' ? 6 : 0) };
  // The S of the neck, thick at the base and slender under the head.
  const spine: [number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 22 + Math.sin(t * Math.PI * 1.15) * 18 + (head.x - 34) * t * t;
    const y = -140 + (head.y + 140) * t;
    spine.push([x, y]);
  }
  // Thick where it grows from the breast, slender under the head.
  const width = (t: number) => 14 - t * 7.5 + Math.max(0, 0.15 - t) * 30;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  spine.forEach(([x, y], i) => {
    const next = spine[Math.min(spine.length - 1, i + 1)]!;
    const prev = spine[Math.max(0, i - 1)]!;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const length = Math.hypot(dx, dy) || 1;
    const w = width(i / 20);
    left.push([x - (dy / length) * w, y + (dx / length) * w]);
    right.push([x + (dy / length) * w, y - (dx / length) * w]);
  });
  ctx.beginPath();
  left.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
  ctx.closePath();
  ctx.fillStyle = p.neck;
  ctx.fill();
  ctx.strokeStyle = p.neckShade;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // The dark streaks down the front of the neck.
  ctx.strokeStyle = p.streak;
  ctx.lineWidth = 1.8;
  for (let i = 3; i < 17; i += 2) {
    const [x, y] = right[i]!;
    const [x2, y2] = spine[i]!;
    ctx.beginPath();
    ctx.moveTo(x + (x2 - x) * 0.25, y + (y2 - y) * 0.25);
    ctx.lineTo(x + (x2 - x) * 0.25, y + (y2 - y) * 0.25 + 4);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(nod);
  drawCrest(ctx, p, pose);
  drawBeak(ctx, p, pose);
  // The head itself.
  ellipse(ctx, 0, 0, 17.5, 12.5);
  ctx.fillStyle = p.neck;
  ctx.fill();
  ctx.strokeStyle = p.neckShade;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // The black stripe from the eye back to the nape.
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.quadraticCurveTo(-2, -12, -15, -5);
  ctx.quadraticCurveTo(-4, -7, 8, -3);
  ctx.closePath();
  ctx.fillStyle = p.crest;
  ctx.fill();
  drawEye(ctx, p, pose);
  ctx.restore();
}

function drawCrest(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const lift = pose.mood === 'delighted' ? -0.55 : pose.mood === 'grumpy' ? 0.25 : 0;
  ctx.strokeStyle = p.crest;
  for (const [length, angle, width] of [
    [34, 0.18, 2.6],
    [28, 0.32, 2],
  ] as const) {
    const a = Math.PI - angle + lift;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.quadraticCurveTo(
      -10 + Math.cos(a + 0.2) * length * 0.6,
      -4 + Math.sin(a + 0.2) * length * 0.6 - 2,
      -10 + Math.cos(a) * length,
      -4 - Math.sin(a) * length * -1,
    );
    ctx.stroke();
  }
}

function drawBeak(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const open = pose.mood === 'delighted' ? 0.22 : 0;
  // Lower mandible, hinged at the face.
  ctx.save();
  ctx.translate(12, 2);
  ctx.rotate(open);
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(58, 2);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fillStyle = p.beakShade;
  ctx.fill();
  ctx.restore();
  // Upper mandible, the long dagger.
  ctx.beginPath();
  ctx.moveTo(10, -5);
  ctx.quadraticCurveTo(40, -4, 72, 3);
  ctx.quadraticCurveTo(40, 1.5, 11, 3);
  ctx.closePath();
  ctx.fillStyle = p.beak;
  ctx.fill();
  ctx.strokeStyle = p.beakShade;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function drawEye(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const eye = { x: 7, y: -2 };
  ellipse(ctx, eye.x, eye.y, 4.2, 4.2);
  ctx.fillStyle = p.iris;
  ctx.fill();
  const look = pose.mood === 'thinking' ? 1.2 : 0;
  ellipse(ctx, eye.x + 0.8, eye.y + look, 2.1, 2.1);
  ctx.fillStyle = '#0e0f12';
  ctx.fill();
  ellipse(ctx, eye.x - 0.6, eye.y - 1.4, 0.9, 0.9);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const blink = blinkAmount(pose.time, pose.seed);
  const lid = pose.mood === 'grumpy' ? 0.55 : pose.mood === 'delighted' ? 0.35 : blink;
  if (lid > 0.02) {
    ctx.save();
    ellipse(ctx, eye.x, eye.y, 4.6, 4.6);
    ctx.clip();
    ctx.fillStyle = p.neckShade;
    ctx.fillRect(eye.x - 5, eye.y - 5, 10, 10 * lid);
    ctx.restore();
  }
  // The monocle, gold rim and a chain falling to her breast.
  ellipse(ctx, eye.x, eye.y, 8.2, 8.2);
  ctx.fillStyle = 'rgba(210, 230, 255, 0.18)';
  ctx.fill();
  ctx.strokeStyle = p.monocle;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eye.x - 3, eye.y + 8);
  ctx.quadraticCurveTo(eye.x - 10, eye.y + 30, eye.x - 2, eye.y + 52);
  ctx.lineWidth = 0.9;
  ctx.setLineDash([1.6, 1.6]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (pose.mood === 'thinking') {
    // A glint off the glass while she remembers.
    const twinkle = (Math.sin(pose.time * 4) + 1) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    star(ctx, eye.x + 5, eye.y - 5, 2 + twinkle * 3);
    ctx.fill();
  }
}

function drawWingAndCards(ctx: Ctx, p: Plumage, pose: RivalPose): void {
  const raise = pose.mood === 'delighted' ? -0.16 : pose.mood === 'grumpy' ? 0.04 : 0;
  ctx.save();
  ctx.translate(14, -136);
  ctx.rotate(raise);
  // The folded wing, its front edge curling round the cards like a hand.
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.quadraticCurveTo(24, 8, 26, 26);
  ctx.quadraticCurveTo(14, 26, 2, 22);
  ctx.quadraticCurveTo(-40, 30, -76, 34);
  ctx.quadraticCurveTo(-46, 12, -16, -4);
  ctx.quadraticCurveTo(-6, -6, 4, 0);
  ctx.closePath();
  const wing = ctx.createLinearGradient(-60, 0, 20, 20);
  wing.addColorStop(0, p.wing);
  wing.addColorStop(1, p.body);
  ctx.fillStyle = wing;
  ctx.fill();
  ctx.strokeStyle = p.bodyShade;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Black flight feathers at the wing's tip.
  ctx.beginPath();
  ctx.moveTo(-40, 26);
  ctx.quadraticCurveTo(-62, 30, -76, 34);
  ctx.quadraticCurveTo(-58, 20, -44, 16);
  ctx.closePath();
  ctx.fillStyle = p.primaries;
  ctx.fill();
  // Scalloped coverts.
  ctx.strokeStyle = p.bodyShade;
  ctx.lineWidth = 1;
  for (const [x, y] of [
    [-6, 8],
    [-16, 12],
    [-26, 16],
    [-12, 2],
    [-22, 6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
  // Her cards held up in front of her breast, gripped by three feather tips like fingers.
  drawHeldCards(ctx, 46, -104, pose.cards, 22, pose.look, 0.18);
  ctx.fillStyle = p.wing;
  ctx.strokeStyle = p.bodyShade;
  ctx.lineWidth = 1;
  for (const [x, y, angle] of [
    [38, -104, -0.5],
    [42, -100, -0.15],
    [47, -98, 0.2],
  ] as const) {
    ellipse(ctx, x, y, 4.5, 9, angle);
    ctx.fill();
    ctx.stroke();
  }
}
