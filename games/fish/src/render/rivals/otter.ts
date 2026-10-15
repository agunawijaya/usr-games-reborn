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
} from './common';

/**
 * Otto the otter: forgetful, cheerful, asks for ranks in turn. He sits upright on a floating log
 * with his tail curled along it, holding his cards in both paws. Drawn front on, so his face does
 * the talking: round eyes, a big dark nose, whisker pads and a tidy cream chin.
 */

interface Fur {
  coat: string;
  coatLight: string;
  coatShade: string;
  cream: string;
  creamShade: string;
  nose: string;
  eye: string;
  whisker: string;
  blush: string;
  log: { bark: string; barkShade: string; cut: string; ring: string };
}

const DAY: Fur = {
  coat: '#86573a',
  coatLight: '#a7714b',
  coatShade: '#5f3c27',
  cream: '#f0dcbb',
  creamShade: '#d9bf98',
  nose: '#2d1d16',
  eye: '#1c1412',
  whisker: 'rgba(255, 250, 240, 0.85)',
  blush: 'rgba(240, 120, 120, 0.45)',
  log: { bark: '#7b5634', barkShade: '#553a22', cut: '#d8b27c', ring: '#b88d58' },
};

const NIGHT: Fur = {
  coat: '#6a4a3a',
  coatLight: '#8a6450',
  coatShade: '#45302a',
  cream: '#d8cbb6',
  creamShade: '#b3a58f',
  nose: '#1a1214',
  eye: '#120d0e',
  whisker: 'rgba(235, 240, 255, 0.7)',
  blush: 'rgba(230, 120, 140, 0.35)',
  log: { bark: '#4d3d30', barkShade: '#2f251e', cut: '#a68c6a', ring: '#8a7254' },
};

export const OTTER: RivalPainter = {
  height: 196,
  draw(ctx: Ctx, pose: RivalPose): void {
    const fur = pose.look.dark ? NIGHT : DAY;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.scale(pose.scale, pose.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawLog(ctx, fur, pose.time);
    const lift = pose.mood === 'delighted' ? -12 * hop(pose.moodAge) : 0;
    ctx.translate(0, lift);
    drawTail(ctx, fur, pose);
    drawBody(ctx, fur, pose);
    drawHead(ctx, fur, pose);
    drawArmsAndCards(ctx, fur, pose);
    if (pose.mood === 'thinking') drawThoughtBubble(ctx, 92, -176, pose.time, pose.look);
    if (pose.mood === 'delighted') {
      drawSparkles(ctx, 0, -150, 78, pose.time, pose.look.dark ? '#ffe27a' : '#ffffff');
    }
    if (pose.mood === 'grumpy') drawGrumpCloud(ctx, 40, -222, pose.time, pose.look);
    ctx.restore();
  },
};

function drawLog(ctx: Ctx, fur: Fur, time: number): void {
  const bob = Math.sin(time * 1.3) * 1.2;
  ctx.save();
  ctx.translate(0, bob);
  // The log lies across the water, its cut end towards us on the left.
  ctx.beginPath();
  ctx.moveTo(-78, 0);
  ctx.lineTo(118, -4);
  ctx.quadraticCurveTo(128, 9, 118, 22);
  ctx.lineTo(-78, 26);
  ctx.closePath();
  const bark = ctx.createLinearGradient(0, -4, 0, 26);
  bark.addColorStop(0, fur.log.bark);
  bark.addColorStop(1, fur.log.barkShade);
  ctx.fillStyle = bark;
  ctx.fill();
  ctx.strokeStyle = fur.log.barkShade;
  ctx.lineWidth = 1.5;
  for (const [x, y, w] of [
    [-40, 8, 40],
    [20, 4, 52],
    [70, 12, 30],
    [-10, 17, 36],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 2, x + w, y + 1);
    ctx.stroke();
  }
  ellipse(ctx, -78, 13, 9, 13);
  ctx.fillStyle = fur.log.cut;
  ctx.fill();
  ctx.strokeStyle = fur.log.ring;
  ctx.lineWidth = 1.2;
  ellipse(ctx, -78, 13, 5, 8);
  ctx.stroke();
  ctx.restore();
}

function drawTail(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  const sway = Math.sin(pose.time * 1.1 + pose.seed) * 6 + (pose.mood === 'grumpy' ? 8 : 0);
  const start = { x: 30, y: -16 };
  const control = { x: 88, y: -4 };
  const end = { x: 104, y: -30 + sway * 0.4 };
  const tip = { x: end.x + 2, y: end.y - 14 - sway };
  const steps = 18;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * start.x + 2 * u * t * control.x + t * t * end.x;
    const y = u * u * start.y + 2 * u * t * control.y + t * t * end.y;
    const dx = 2 * u * (control.x - start.x) + 2 * t * (end.x - control.x);
    const dy = 2 * u * (control.y - start.y) + 2 * t * (end.y - control.y);
    const length = Math.hypot(dx, dy) || 1;
    const width = 12 * (1 - t) + 6 * t;
    left.push([x - (dy / length) * width, y + (dx / length) * width]);
    right.push([x + (dy / length) * width, y - (dx / length) * width]);
  }
  ctx.beginPath();
  left.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  const lastRight = right[right.length - 1]!;
  ctx.quadraticCurveTo(tip.x + 8, tip.y + 6, lastRight[0], lastRight[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(30, -40, 100, 0);
  gradient.addColorStop(0, fur.coat);
  gradient.addColorStop(1, fur.coatShade);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = fur.coatShade;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function bodyPath(ctx: Ctx, swell: number): void {
  ctx.beginPath();
  ctx.moveTo(-44, -4);
  ctx.bezierCurveTo(-58 - swell, -34, -52 - swell, -82, -34, -100);
  ctx.bezierCurveTo(-22, -112, 22, -112, 34, -100);
  ctx.bezierCurveTo(52 + swell, -82, 58 + swell, -34, 44, -4);
  ctx.quadraticCurveTo(0, 8, -44, -4);
  ctx.closePath();
}

function drawBody(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  const swell = breath(pose.time, pose.seed) * 1.5;
  bodyPath(ctx, swell);
  const coat = ctx.createLinearGradient(-50, -110, 40, 0);
  coat.addColorStop(0, fur.coatLight);
  coat.addColorStop(0.55, fur.coat);
  coat.addColorStop(1, fur.coatShade);
  ctx.fillStyle = coat;
  ctx.fill();
  ctx.strokeStyle = fur.coatShade;
  ctx.lineWidth = 2;
  ctx.stroke();
  // The cream front, from chin to belly.
  ctx.beginPath();
  ctx.moveTo(-26, -96);
  ctx.bezierCurveTo(-40, -70, -36, -20, -20, -6);
  ctx.quadraticCurveTo(0, 0, 20, -6);
  ctx.bezierCurveTo(36, -20, 40, -70, 26, -96);
  ctx.quadraticCurveTo(0, -106, -26, -96);
  ctx.fillStyle = fur.cream;
  ctx.fill();
  // Hind feet poking out in front.
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 27, -2, 15, 8);
    ctx.fillStyle = fur.coatShade;
    ctx.fill();
    ctx.strokeStyle = fur.coatLight;
    ctx.lineWidth = 1.2;
    for (let toe = -1; toe <= 1; toe++) {
      ctx.beginPath();
      ctx.moveTo(side * 27 + toe * 5, -4);
      ctx.lineTo(side * 27 + toe * 5.5, 3);
      ctx.stroke();
    }
  }
}

function drawHead(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  const tilt =
    pose.mood === 'thinking'
      ? 0.07
      : pose.mood === 'grumpy'
        ? -0.06
        : Math.sin(pose.time * 0.8) * 0.02;
  ctx.save();
  ctx.translate(0, -140);
  ctx.rotate(tilt);
  ctx.translate(0, 140);

  const earDrop = pose.mood === 'grumpy' ? 5 : 0;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * 40, -172 + earDrop, 11, 10);
    ctx.fillStyle = fur.coat;
    ctx.fill();
    ctx.strokeStyle = fur.coatShade;
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipse(ctx, side * 40, -171 + earDrop, 5.5, 5);
    ctx.fillStyle = fur.coatShade;
    ctx.fill();
  }

  // A broad, flat-topped head.
  ctx.beginPath();
  ctx.moveTo(-48, -146);
  ctx.bezierCurveTo(-50, -176, -26, -188, 0, -188);
  ctx.bezierCurveTo(26, -188, 50, -176, 48, -146);
  ctx.bezierCurveTo(46, -118, 24, -108, 0, -108);
  ctx.bezierCurveTo(-24, -108, -46, -118, -48, -146);
  ctx.closePath();
  const coat = ctx.createRadialGradient(-14, -170, 6, 0, -146, 58);
  coat.addColorStop(0, fur.coatLight);
  coat.addColorStop(1, fur.coat);
  ctx.fillStyle = coat;
  ctx.fill();
  ctx.strokeStyle = fur.coatShade;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Whisker pads and chin.
  ctx.fillStyle = fur.cream;
  ellipse(ctx, -12, -129, 18, 13.5);
  ctx.fill();
  ellipse(ctx, 12, -129, 18, 13.5);
  ctx.fill();
  ellipse(ctx, 0, -117, 17, 8);
  ctx.fill();
  ctx.fillStyle = fur.creamShade;
  for (const [x, y] of [
    [-16, -128],
    [-10, -124],
    [-20, -123],
    [16, -128],
    [10, -124],
    [20, -123],
  ] as const) {
    ellipse(ctx, x, y, 1.3, 1.3);
    ctx.fill();
  }

  drawEyes(ctx, fur, pose);
  drawNoseAndMouth(ctx, fur, pose);

  ctx.strokeStyle = fur.whisker;
  ctx.lineWidth = 1.3;
  for (const side of [-1, 1]) {
    for (const [dy, reach, droop] of [
      [-4, 52, -8],
      [0, 56, 0],
      [4, 50, 9],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(side * 24, -128 + dy);
      ctx.quadraticCurveTo(
        side * (reach - 12),
        -128 + dy + droop * 0.3,
        side * reach,
        -128 + dy + droop,
      );
      ctx.stroke();
    }
  }
  if (pose.mood === 'delighted') {
    ctx.fillStyle = fur.blush;
    ellipse(ctx, -32, -134, 9, 5.5);
    ctx.fill();
    ellipse(ctx, 32, -134, 9, 5.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawEyes(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  const blink = blinkAmount(pose.time, pose.seed);
  for (const side of [-1, 1]) {
    const x = side * 18;
    const y = -156;
    if (pose.mood === 'delighted') {
      // Happy closed eyes, curved up.
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 2);
      ctx.quadraticCurveTo(x, y - 8, x + 7, y + 2);
      ctx.strokeStyle = fur.eye;
      ctx.lineWidth = 3;
      ctx.stroke();
      continue;
    }
    const open = pose.mood === 'grumpy' ? 0.55 : 1 - blink * 0.92;
    ellipse(ctx, x, y + (1 - open) * 3, 6.8, 8 * open);
    ctx.fillStyle = fur.eye;
    ctx.fill();
    if (open > 0.3) {
      const look = pose.mood === 'thinking' ? { x: -1.5, y: -3.5 } : { x: 0, y: 0 };
      ellipse(ctx, x - 2 + look.x, y - 3 + look.y, 2.4, 2.4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      ellipse(ctx, x + 2.2 + look.x * 0.5, y + 2.5 + look.y * 0.5, 1.1, 1.1);
      ctx.fill();
    }
    if (pose.mood === 'grumpy') {
      ctx.beginPath();
      ctx.moveTo(x - side * 9, y - 9);
      ctx.lineTo(x + side * 7, y - 4);
      ctx.strokeStyle = fur.coatShade;
      ctx.lineWidth = 3.2;
      ctx.stroke();
    }
    if (pose.mood === 'thinking' && side === -1) {
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 13);
      ctx.quadraticCurveTo(x, y - 18, x + 8, y - 14);
      ctx.strokeStyle = fur.coatShade;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  }
}

function drawNoseAndMouth(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  // A broad, rounded nose.
  ctx.beginPath();
  ctx.moveTo(-9, -143);
  ctx.quadraticCurveTo(0, -148, 9, -143);
  ctx.quadraticCurveTo(10, -137, 0, -133);
  ctx.quadraticCurveTo(-10, -137, -9, -143);
  ctx.closePath();
  ctx.fillStyle = fur.nose;
  ctx.fill();
  ellipse(ctx, -3, -142.5, 2.6, 1.4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();

  ctx.strokeStyle = fur.nose;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -133);
  ctx.lineTo(0, -128);
  ctx.stroke();
  if (pose.mood === 'delighted') {
    ctx.beginPath();
    ctx.moveTo(-8, -127);
    ctx.quadraticCurveTo(0, -116, 8, -127);
    ctx.closePath();
    ctx.fillStyle = '#5a1f22';
    ctx.fill();
    ellipse(ctx, 0, -121.5, 4, 2.4);
    ctx.fillStyle = '#e8828a';
    ctx.fill();
  } else if (pose.mood === 'grumpy') {
    ctx.beginPath();
    ctx.moveTo(-7, -122);
    ctx.quadraticCurveTo(0, -128, 7, -122);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, -127);
    ctx.quadraticCurveTo(-3.5, -124, 0, -128);
    ctx.quadraticCurveTo(3.5, -124, 7, -127);
    ctx.stroke();
  }
}

function drawArmsAndCards(ctx: Ctx, fur: Fur, pose: RivalPose): void {
  const raise = pose.mood === 'delighted' ? -6 : 0;
  drawHeldCards(ctx, 0, -84 + raise, pose.cards, 21, pose.look);
  for (const side of [-1, 1]) {
    // Forearm from the shoulder round to the paw that grips the cards.
    ctx.beginPath();
    ctx.moveTo(side * 34, -92);
    ctx.quadraticCurveTo(side * 34, -70, side * 16, -84 + raise);
    ctx.strokeStyle = fur.coatShade;
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.strokeStyle = fur.coat;
    ctx.lineWidth = 11.5;
    ctx.stroke();
    ellipse(ctx, side * 14, -86 + raise, 8, 7);
    ctx.fillStyle = fur.coatShade;
    ctx.fill();
  }
}
